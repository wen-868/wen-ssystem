#!/usr/bin/env node
/**
 * S3-231 · 把本单**已接线**的端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，移除名单写死在下方 WIRED 常量里，
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * ⚠️ 反测顺序（派单规范 §九.1）：**先跑本脚本，再注入违规**，否则摘掉接线只会产出"已登记的缺口" ⇒ `--strict` 仍绿（假绿）。
 *
 * 用法：node docs/evidence/S3-231/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";
/** F1 接线 4 条 + F4 查询型 POST 登记 3 条 = 从 `gaps` 逐条移除 7 条 */
const EXPECT_REMOVED = 7;

/** F1 · 会员等级配置 4 条改挂 `customer:level`（凌舟裁定 1） */
const WIRED = {
  "points.routes.ts": [
    "POST /api/admin/members/levels/config",
    "PUT /api/admin/members/levels/config/:id",
    "PUT /api/admin/members/levels/config/:id/status",
    "DELETE /api/admin/members/levels/config/:id",
  ],
};

/** F4 · 查询型 POST 登记 3 条（不再计入 `gaps`，改由 `guard-rbac-wiring` 的 `READ_ONLY_POSTS` 覆盖） */
const READ_ONLY_POSTS = {
  "admin-marketing-calculation.routes.ts": ["POST /api/admin/marketing/calculate"],
  "trace.routes.ts": ["POST /api/admin/trace/configs/check"],
  "platform-billing.routes.ts": ["POST /api/platform/billing/statement/export"],
};
const EXPECT_READ_ONLY = 3;

const json = JSON.parse(readFileSync(PATH, "utf8"));
const before = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) before.endpoints += list.length;

let removed = 0;
const removeOne = (file, p) => {
  const list = json.gaps[file];
  if (!list) throw new Error(`台账里没有该文件：${file}`);
  const i = list.indexOf(p);
  if (i === -1) throw new Error(`台账里没有该端点：${file} | ${p}`);
  list.splice(i, 1);
  removed++;
  if (list.length === 0) delete json.gaps[file];
};
for (const [file, paths] of Object.entries(WIRED)) for (const p of paths) removeOne(file, p);
for (const [file, paths] of Object.entries(READ_ONLY_POSTS)) for (const p of paths) removeOne(file, p);

const after = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) after.endpoints += list.length;

if (removed !== EXPECT_REMOVED) throw new Error(`预期移除 ${EXPECT_REMOVED} 条，实际 ${removed} 条`);
if (before.endpoints - after.endpoints !== EXPECT_REMOVED) throw new Error("计数不守恒");

/**
 * ⚠️ 两条**性质不同**的移除必须分开记账（否则"台账自洽"会把查询型登记读成接线）：
 *   · F1 的 4 条 = **已接线** ⇒ `wiredEndpoints` / `wiredPermOccurrences` 各 +4；
 *   · F4 的 3 条 = **查询型登记** ⇒ 只 +`readOnlyPostEndpoints`，**不**计入已接线。
 */
const F1_WIRED = 4;
const F4_READ_ONLY = EXPECT_READ_ONLY;
if (removed !== F1_WIRED + F4_READ_ONLY) throw new Error("两条通道的条数与 EXPECT_REMOVED 不一致");

const filesWithoutReadOnly = new Set(Object.keys(READ_ONLY_POSTS));
const readOnlyFileAdded = [...filesWithoutReadOnly].filter((f) => !json.gaps[f]).length;

json._counts = {
  ...json._counts,
  files: after.files,
  endpoints: after.endpoints,
  readOnlyPostFiles: json._counts.readOnlyPostFiles + readOnlyFileAdded,
  readOnlyPostEndpoints: json._counts.readOnlyPostEndpoints + F4_READ_ONLY,
  wiredEndpoints: json._counts.wiredEndpoints + F1_WIRED,
  wiredPermOccurrences: json._counts.wiredPermOccurrences + F1_WIRED,
};
const sum = json._counts.endpoints + json._counts.consumerEndEndpoints + json._counts.readOnlyPostEndpoints + json._counts.wiredEndpoints;
if (sum !== json._counts.scannedEndpoints) throw new Error(`台账不自洽：${sum} ≠ ${json._counts.scannedEndpoints}`);

json._lastUpdate = "2026-10-16 S3-231 F1 接线 4 条（378 → 374）+ F4 查询型 POST 登记 3 条（374 → 371）";
json._s3231_note =
  "S3-231（收尾批）两条通道，逐条留痕：" +
  "**① F1 已接线 4 条**：`points.routes.ts` 会员等级配置（增/改/启停/删）挂 `requirePermission(\"customer:level\")`" +
  "（凌舟裁定 1，`R101-S3-229-凌舟验收与裁定.md` §二.1；依据 = 该页**自身的注册码** `customer:level`，`app-mobile/src/config/function-menu.ts:84`）" +
  "⇒ `wiredEndpoints` / `wiredPermOccurrences` 各 +4。" +
  "命中机制：`STORE_MANAGER`（生产在用、1 账号）持 `customer:*` ⇒ `matchPermission` 域通配命中（零回归）；" +
  "`SALES_STAFF` / `CUSTOMER_SERVICE`（各 0 账号）持精确码 `customer:view` ⇒ 不命中（该两角色在该页被降级为只读，影响面见 docs/evidence/S3-231/F1）。" +
  "**② F4 查询型 POST 登记 3 条**（**不是接线**，只 +`readOnlyPostEndpoints`）：" +
  "`POST /api/admin/marketing/calculate`（试算，全 SELECT）/ `POST /api/admin/trace/configs/check`（配置判定，全 SELECT）/" +
  "`POST /api/platform/billing/statement/export`（对账单导出，SELECT + sendCsv）⇒ 已在 `guard-rbac-wiring.mjs` 的 `READ_ONLY_POSTS` 逐条登记" +
  "（batch=S3-231、含 reason/ruling）+ `docs/tasks/R101-RBAC接线缺口清单.md` §十八.3 同时含路径与「查询型」判定行（门禁闸门②）。" +
  "**③ F4 不可登记 3 条**（有写 ⇒ 留在 gaps 按真写端点处理）：`POST /api/admin/alerts/check`（INSERT t_alert_record）、" +
  "`POST /api/platform/reports/export/`（createExportTask 落 PENDING）、`POST /api/admin/commission/calculate`（INSERT t_sales_commission_record；且已被 `rbac-g0-wiring.test.ts` NOT_IN_G0 锁定）。" +
  "本单**保留登记**的行：`POST /api/admin/members/:id/points/adjust`（同文件 B 类，不在 F1 范围）。" +
  "⚠️ 域外无关项（含 F2/F3 涉及项）一条未动。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(
  `移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`
);
