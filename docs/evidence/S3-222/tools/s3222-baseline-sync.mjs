/**
 * S3-222（客户域接线 · B2 批 4）· 台账同步工具（**只移除本域已接线条目**）
 *
 * 用途：把 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 里
 * 「本单 12 个客户域文件 × 当前已被门禁判为**已接线**（authForm=inline/use-mount）」的条目逐条移除，
 * 并同步 `_counts`。脚本**不做整文件重写式的重新生成**：只按
 * 「文件 + `METHOD 路径`」精确删条目，删除前后都打印逐文件计数供人工核对（台账铁律：登记只由人工审阅后落盘）。
 *
 * 用法：
 *   node docs/evidence/S3-222/tools/s3222-baseline-sync.mjs <guard-json> [--dry]
 *
 * 边界（写在明处）：
 *   · 只动 `gaps`；`consumerEnd` 一字不动（本单不涉消费者端形态）；
 *   · 只动本单 12 个文件的键；其它文件的条目即使同批变化也不动（S3-220 并行，其条目由对方负责）；
 *   · 若「本域已接线但未登记在 gaps」的端点数 ≠ 预期，脚本以非 0 退出并**不落盘**（防静默漂移）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DOMAIN_FILES = [
  "admin-customer.routes.ts",
  "customer-care.routes.ts",
  "customer-merge.routes.ts",
  "customer-payment.routes.ts",
  "customer-price.routes.ts",
  "customer-segment.routes.ts",
  "customer-statement.routes.ts",
  "customer-tag.routes.ts",
  "customer-type.routes.ts",
  "customer-visit.routes.ts",
  "member-register.routes.ts",
  "tag.routes.ts",
];

/** 本单预期**保留**在 gaps 里的条目（不接线者，逐条有理由） */
const EXPECTED_REMAIN = {
  "member-register.routes.ts": ["POST /api/store/members/sms-code", "POST /api/store/members/register"],
  "customer-statement.routes.ts": ["POST /api/store/customer-statements/:statementNo/confirm"],
};
const EXPECTED_WIRED = 42;

const guardJsonPath = process.argv[2];
const dryRun = process.argv.includes("--dry");
if (!guardJsonPath) {
  console.error("用法：node docs/evidence/S3-222/tools/s3222-baseline-sync.mjs <guard-json> [--dry]");
  process.exit(2);
}

const baselinePath = resolve("backend/scripts/rbac-wiring-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const guard = JSON.parse(readFileSync(resolve(guardJsonPath), "utf8"));

/** 门禁当前判为「已接线」的 key 集合（authForm = inline / use-mount） */
const wiredNow = new Set(
  guard.filter((r) => r.hasPermission).map((r) => `${r.file}|${r.method} ${r.path}`)
);

const before = {};
const after = {};
let removed = 0;
for (const file of DOMAIN_FILES) {
  const list = baseline.gaps[file] ?? [];
  before[file] = list.length;
  const keep = list.filter((item) => !wiredNow.has(`${file}|${item}`));
  removed += list.length - keep.length;
  if (keep.length > 0) baseline.gaps[file] = keep;
  else delete baseline.gaps[file];
  after[file] = keep.length;
}

for (const [file, expected] of Object.entries(EXPECTED_REMAIN)) {
  const keep = baseline.gaps[file] ?? [];
  if (JSON.stringify(keep) !== JSON.stringify(expected)) {
    console.error(`❌ 保留条目不符：${file}\n  实际：${JSON.stringify(keep)}\n  预期：${JSON.stringify(expected)}`);
    process.exit(1);
  }
}
if (removed !== EXPECTED_WIRED) {
  console.error(`❌ 移除条数不符：实际 ${removed}，预期 ${EXPECTED_WIRED}（未落盘）`);
  process.exit(1);
}

const endpoints = Object.values(baseline.gaps).reduce((n, l) => n + l.length, 0);
const files = Object.keys(baseline.gaps).length;
console.log("[s3222-baseline-sync] 逐文件：移除前 → 移除后");
for (const file of DOMAIN_FILES) console.log(`   ${file}: ${before[file]} → ${after[file]}`);
console.log(`[s3222-baseline-sync] 本域移除 ${removed} 条（= 本批接线数）；gaps 合计 ${baseline._counts.endpoints} → ${endpoints}；文件数 ${baseline._counts.files} → ${files}`);

if (dryRun) {
  console.log("[s3222-baseline-sync] --dry：未落盘");
  process.exit(0);
}

baseline._counts.files = files;
baseline._counts.endpoints = endpoints;
baseline._lastUpdate =
  "2026-10-16 S3-222 入账：客户域 12 文件 / 45 写端点中，42 条按「使用者已持码」接线后从 gaps 逐条移除（588→546、148→138 文件）；" +
  "保留 3 条 —— 2 条公开端点（member-register，auth:\"none\"）+ 1 条待授权模型定案（customer-statement confirm，移动端页面可见角色 ⊉ 码持有人）。";
baseline._s3222_note =
  "S3-222（2026-10-16，客户域 45 条按「使用者已持码」接线，批 4）：本批接线 42 条**不入台账**（逐条见 docs/tasks/R101-RBAC接线缺口清单.md §十二）；" +
  "保留 3 条：① `POST /api/store/members/sms-code`、`POST /api/store/members/register`（member-register.routes.ts，routeConfig auth=\"none\" ⇒ 真公开端点，免鉴权，挂商家权限码无意义）；" +
  "② `POST /api/store/customer-statements/:statementNo/confirm`：该端点被移动端「对账单」页调用（app-mobile/src/pages-sub/finance/statements/statements.vue:97），" +
  "而该页可见角色（生产 t_sys_role_menu 的 `finance:statement`）= {FINANCE_STAFF, OPERATION_ADMIN, READONLY, STORE_ADMIN}，其中 READONLY(`[\"*:view\"]`) 与 STORE_ADMIN（099 旧词表）" +
  "不持任何客户域写码 ⇒ 接线即把「看得到该按钮的角色」打成 403（批 1 `trace:*` 同款形态）⇒ 待授权模型定案（补授权 / 收紧菜单 / 另立细码，三选一），不在本批硬接。";

writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
console.log("[s3222-baseline-sync] 已落盘（仅 gaps 与 _counts 变化）");
