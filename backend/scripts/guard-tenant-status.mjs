#!/usr/bin/env node
/**
 * G2 门禁 · guard:tenant-status（S3-176 B0）
 *
 * 防的是什么（根因）：同一张 `t_tenant` 被两条链路各写一套状态取值
 *   （platform-tenant 写数值 1/0；admin/tenant 原写字符串 'ACTIVE'），
 *   外加 controller 的 Zod 枚举另有一套（ACTIVE/SUSPENDED/EXPIRED/CLOSED），
 *   ⇒ 前端发 DISABLED 被 Zod 400、列表筛选未知值静默返回全量。
 *   只把某一条改对 ⇒ 下一次仍会有第三套出现 ⇒ 反复。
 *   ⇒ 本门禁把「租户状态域只允许 ACTIVE/DISABLED」变成**机械红**。
 *
 * 规则（只作用于"租户状态域"的文件集合，避免误伤其它域的合法枚举）：
 *   R1 域内文件不得出现**带引号**的 SUSPENDED / EXPIRED / CLOSED / PENDING（可写状态值）。
 *      · 列名 `suspended_at`、字段名 `suspendedAt`、注释里的裸词**不算**（必须是引号字面量）。
 *   R2 唯一映射函数 `toTenantStatusValue` 的接受集合必须恰好是 {ACTIVE,1,DISABLED,0}。
 *   R3（S3-189 ② 新增，收口总清单第 22 项）**域清单不再只是"写死的 4 条"**：除显式清单外，
 *      另有**机械信号自动发现**——凡 `src/**`（不含 `__tests__`）里出现「域内写法」的文件，
 *      要么在 DOMAIN_FILES 里（受 R1/R2 守），要么在 SIGNAL_EXEMPT 里逐条登记理由，
 *      否则判红（"漏登"）。信号 = ① 调用 `toTenantStatusValue(`；② SQL 里 `UPDATE/INSERT INTO t_tenant`
 *      且同句含 `status` 列（即"写租户状态"这一动作本身）。
 *      ⇒ 将来新开一个文件直接改租户状态、却没进清单：本门禁会点名它（对"域扩张"有感）。
 *      选 (b)「显式清单 + 漏登检测」而非 (a)「纯自动发现」的理由：纯自动发现必须把信号放宽到
 *      "出现 ACTIVE/DISABLED 字面量"，而这两个词在**券/秒杀/满减等其它域**同样是合法枚举
 *      （`t_coupon_template.status='ACTIVE'` 等），放宽即误伤；故清单保持权威、探测器只补"漏登"这一缺口。
 *
 * 用法：node backend/scripts/guard-tenant-status.mjs    退出码 0=绿 / 1=红
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");

/** 租户状态域文件集合（只扫这些，避免误伤工单/订阅等其它域的合法枚举） */
const DOMAIN_FILES = [
  "services/platform-tenant.service.ts",
  "services/admin/tenant.service.ts",
  "controllers/admin/tenant.controller.ts",
  "controllers/platform/tenant.controller.ts",
];

/** 允许出现的例外（必须逐条给理由；键 = 文件相对 SRC 的路径） */
const LITERAL_ALLOWLIST = {
  "controllers/admin/tenant.controller.ts": [
    // 仅为注释中说明"这些不再是可写状态"，非引号字面量，本不会被 R1 命中；
    // 若将来确需保留引号字面量，在此登记理由。
  ],
};

const FORBIDDEN = ["SUSPENDED", "EXPIRED", "CLOSED", "PENDING"];
const problems = [];

/**
 * R3 的"域外但机械信号命中"登记表（键 = 相对 `src/` 的路径，值 = 逐条理由）。
 * ⚠️ 这是**豁免台账**，不是"合规证明"：登记只说明"它不属该域 / 已被别处守"，不说明它没问题。
 */
const SIGNAL_EXEMPT = {
  "shared/migration.ts":
    "迁移/引导 SQL（建库默认租户：INSERT INTO t_tenant 含 status 列 + UPDATE t_tenant SET name）。" +
    "它是**一次性引导**，不参与租户状态的运行时口径（没有 ACTIVE/DISABLED 映射逻辑），故不属本域；" +
    "其状态字面量由迁移语料自身的一致性单测（migration-*.test.ts）守。",
  // ── S3-189 ②：机械信号**新发现**的 4 个"写租户状态"文件（旧域清单只有 4 条，从未覆盖它们） ──
  // ⚠️ 登记 ≠ 合规：这 4 条是"登记为待裁定 / 暂不纳入钝刀 R1"的理由，不是"它们没问题"的证明。
  "services/subscription-expiry.service.ts":
    "订阅到期作业：L93 `UPDATE t_tenant SET status = 'EXPIRED', suspend_reason=…, suspended_at=NOW()` 直接写租户状态" +
    "（另有 L100 写**另一张表** t_subscription.status）。未纳入 DOMAIN_FILES 的原因：本文件的 'EXPIRED' 有一处落在 t_subscription，" +
    "R1 是「带引号即命中」的钝刀、会误伤 ⇒ 是否把 R1 细化为「语句级/表级」口径后再收编，需凌舟裁定。" +
    " ⚠️ 同时报回（本次升级**新暴露**的存量问题）：L93 直接写 'EXPIRED' 与「租户状态可写值仅 ACTIVE/DISABLED、EXPIRED 由 expire_at 派生」的口径**冲突**。",
  "services/tenant-register.service.ts":
    "租户注册审核通过时 INSERT INTO t_tenant（L253，含 status 列）—— 真实「写租户状态」路径。" +
    "未纳入 DOMAIN_FILES 的原因：本文件另有 2 处 `t_tenant_register_application.status='PENDING'`（L226/386，**另一张表**的合法值），" +
    "纳入钝刀 R1 会误伤。报回：随 R1 口径细化一并收编（该文件写入 t_tenant 的取值本身未发现被禁字面量）。",
  "services/saas/tenant.service.ts":
    "写 t_tenant：INSERT（L179）+ `UPDATE t_tenant SET status = ?`（L295，值为**参数**非字面量）。" +
    "未纳入 DOMAIN_FILES 的原因：本文件含读/统计语句里的 'SUSPENDED'/'EXPIRED'（L321/322）与输入分支 `body.status === \"SUSPENDED\"`（L265），" +
    "纳入钝刀 R1 会误伤。 ⚠️ 另报回：L265 说明该接口**接受** SUSPENDED 入参（口径上属被禁值），是否按「接受即违规」另行判定，需凌舟裁定。",
  "services/platform/tenant-admin.service.ts":
    "写 t_tenant：`UPDATE t_tenant SET ${fields}`（L409，**动态字段**，可能含 status）。" +
    "未纳入 DOMAIN_FILES 的原因：本文件含类型联合 `status?: \"ACTIVE\" | \"DISABLED\" | \"EXPIRED\"`（L35）与多处读/统计语句，纳入钝刀 R1 会误伤；" +
    "另：动态字段写法使「是否写了 status」静态不可判，建议收编时同批把 SQL 改成显式列。",
};

/** 递归列出 `src/` 下所有 .ts（跳过 __tests__，与 tsconfig 的 exclude 同口径） */
function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...listSourceFiles(full));
      continue;
    }
    if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * R3：机械信号扫描——"域内写法"出现在域清单**之外**的文件里 ⇒ 漏登（判红）。
 * @returns 命中信号的文件（相对路径 → 命中的信号清单）
 */
function collectDomainSignals() {
  /** 文件相对路径 → 命中的信号描述 */
  const hits = new Map();
  const note = (rel, what) => {
    const list = hits.get(rel) ?? [];
    list.push(what);
    hits.set(rel, list);
  };

  for (const abs of listSourceFiles(SRC)) {
    const rel = abs.slice(SRC.length + 1).replace(/\\/g, "/");
    const src = readFileSync(abs, "utf8");

    // 信号 ①：调用唯一映射函数（定义处不算"使用"）
    const calls = (src.match(/\btoTenantStatusValue\s*\(/g) || []).length;
    const defines = /export\s+function\s+toTenantStatusValue\s*\(/.test(src);
    if (calls > (defines ? 1 : 0)) note(rel, `调用 toTenantStatusValue ×${calls - (defines ? 1 : 0)}`);

    // 信号 ②：SQL 里"写租户状态"（UPDATE/INSERT INTO t_tenant，且同一句里出现 status 列）
    const writeRe = /\b(UPDATE|INSERT\s+INTO)\s+`?t_tenant\b/gi;
    let m;
    while ((m = writeRe.exec(src)) !== null) {
      const statement = src.slice(m.index, m.index + 400);
      if (/\bstatus\b/i.test(statement)) {
        note(rel, `${m[1].toUpperCase().replace(/\s+/g, " ")} t_tenant + status`);
        break;
      }
    }
  }
  return hits;
}

for (const rel of DOMAIN_FILES) {
  const abs = join(SRC, rel);
  if (!existsSync(abs)) {
    problems.push(`${rel}: 文件不存在（域清单需同步更新）`);
    continue;
  }
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const word of FORBIDDEN) {
      // 只认带引号的字面量：'ACTIVE' / "ACTIVE"
      const re = new RegExp(`["']${word}["']`);
      if (re.test(line)) {
        const allow = (LITERAL_ALLOWLIST[rel] || []).some((reason) => reason.includes(`${idx + 1}`));
        if (!allow) {
          problems.push(
            `${rel}:${idx + 1}: 出现被禁的租户状态字面量 "${word}" —— 租户状态可写值唯一口径是 ACTIVE / DISABLED（EXPIRED 由 expire_at 派生）`
          );
        }
      }
    }
  });
}

// R2：唯一映射函数的接受集合
const mapper = join(SRC, "services", "platform-tenant.service.ts");
if (existsSync(mapper)) {
  const src = readFileSync(mapper, "utf8");
  const fn = /export function toTenantStatusValue[\s\S]*?\n\}/.exec(src);
  if (!fn) {
    problems.push("services/platform-tenant.service.ts: 找不到 toTenantStatusValue（唯一映射函数）");
  } else {
    const body = fn[0];
    for (const token of ['"ACTIVE"', '"DISABLED"', '"1"', '"0"']) {
      if (!body.includes(token)) {
        problems.push(`toTenantStatusValue 缺少接受的取值 ${token}（唯一口径被改动）`);
      }
    }
    for (const word of FORBIDDEN) {
      if (body.includes(`"${word}"`)) {
        problems.push(`toTenantStatusValue 不应接受 ${word}（可写值只有 ACTIVE/DISABLED）`);
      }
    }
  }
}

// ── R3：域清单"漏登检测"（机械信号自动发现）+ 打印对照表 ──
const signals = collectDomainSignals();
const discovered = Array.from(signals.keys()).sort();
const comparison = discovered.map((rel) => ({
  rel,
  inList: DOMAIN_FILES.includes(rel),
  exempt: Object.prototype.hasOwnProperty.call(SIGNAL_EXEMPT, rel),
  signals: signals.get(rel) ?? [],
}));
for (const item of comparison) {
  if (item.inList || item.exempt) continue;
  problems.push(
    `${item.rel}: 出现"写租户状态"的域内写法（${item.signals.join("；")}）但**不在域清单里** ⇒` +
      ` 若确属租户状态域，请登记进 guard-tenant-status.mjs 的 DOMAIN_FILES（随即受 R1/R2 约束）；` +
      `若只是引导脚本/无关写法，请在 SIGNAL_EXEMPT 里逐条写明理由。`
  );
}

console.log(
  `[guard:tenant-status] 扫描 ${DOMAIN_FILES.length} 个域内文件 + 唯一映射函数；机械信号发现 ${discovered.length} 个文件` +
    `（清单内 ${comparison.filter((c) => c.inList).length} / 清单外已登记豁免 ${comparison.filter((c) => c.exempt && !c.inList).length} / 漏登 ${comparison.filter((c) => !c.inList && !c.exempt).length}）`
);
for (const item of comparison) {
  if (item.inList) {
    console.log(`   · [清单内·受 R1/R2 守] ${item.rel} ← 信号：${item.signals.join("；")}`);
    continue;
  }
  if (item.exempt) {
    console.log(`   · [清单外·已登记豁免（⚠️ 登记≠合规）] ${item.rel} ← 信号：${item.signals.join("；")}`);
    console.log(`       理由：${SIGNAL_EXEMPT[item.rel]}`);
    continue;
  }
  console.log(`   · [❌ 漏登] ${item.rel} ← 信号：${item.signals.join("；")}`);
}
const notDetected = DOMAIN_FILES.filter((f) => !discovered.includes(f));
if (notDetected.length > 0) {
  console.log(`   · 清单内但机械信号未命中（属人工判断补入，非自动发现）：${notDetected.join(", ")}`);
}

if (problems.length > 0) {
  console.error(`\n❌ G2 违规 ${problems.length} 条：`);
  for (const p of problems) console.error(`   ${p}`);
  process.exit(1);
}
console.log("✅ G2 通过：租户状态域只有 ACTIVE / DISABLED 一套口径");
