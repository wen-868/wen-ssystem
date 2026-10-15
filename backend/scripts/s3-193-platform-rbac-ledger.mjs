#!/usr/bin/env node
/**
 * S3-193 · 平台 RBAC 接线台账生成器（只读扫描，可复跑）
 *
 * 产出：`docs/tasks/R101-平台RBAC接线台账.md`（105 个平台写端点逐条登记）
 * 用法：
 *   node backend/scripts/s3-193-platform-rbac-ledger.mjs            # 写台账 + 打印计数守恒
 *   node backend/scripts/s3-193-platform-rbac-ledger.mjs --json     # 只打印机读 JSON（不写文件）
 *   node backend/scripts/s3-193-platform-rbac-ledger.mjs --check    # 只做计数守恒断言（不写文件）
 *
 * 口径（与 S3-185 取证、G4 `guard:rbac-wiring` 基线**同一口径**，便于三方对账）：
 *   · 范围 = `backend/src/routes/platform*.routes.ts`（29 个文件）；
 *   · 「写端点」= 源码里的 `.post(` / `.put(` / `.patch(` / `.delete(` **声明**（105 条）；
 *   · 多 routeConfig 文件按「router 变量 ↔ prefix」精确配对（不再像 S3-185 那样把同文件的所有前缀
 *     拼在一起）⇒ 本台账的 `完整路径` 更精确，差异逐条可核对（见台账 §四 口径差异说明）。
 *   · 计数守恒：总声明数 = 105；每条都必须能映射到「归属域 + 拟定权限点（或豁免理由）」，否则 exit 1。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const ROUTES_DIR = join(ROOT, "backend", "src", "routes");
const OUT_MD = join(ROOT, "docs", "tasks", "R101-平台RBAC接线台账.md");

/** S3-185 / G4 基线口径的期望总数（三者必须一致） */
const EXPECTED_TOTAL = 105;
const EXPECTED_FILES = 29;

/**
 * 归属域 + 拟定权限点（人工判定，逐文件可核对；per-endpoint 覆盖用 `endpoints`）。
 * domain：平台功能域；code：拟定权限点（`null` ⇒ 豁免，必写 reason）。
 */
const DOMAIN_MAP = {
  "platform-tenant.routes.ts": { domain: "tenant 租户管理", code: "tenant:manage" },
  "platform-applications.routes.ts": { domain: "tenant 租户管理（入驻申请审核）", code: "tenant:manage" },
  "platform-plans.routes.ts": { domain: "billing 套餐与计费", code: "billing:manage" },
  "platform-billing.routes.ts": { domain: "billing 套餐与计费", code: "billing:manage" },
  "platform-billing-arrears.routes.ts": { domain: "billing 套餐与计费（欠费）", code: "billing:manage" },
  "platform-reconciliation.routes.ts": { domain: "billing 套餐与计费（对账）", code: "billing:manage" },
  "platform-subscription-applies.routes.ts": { domain: "billing 套餐与计费（订阅申请审核）", code: "billing:manage" },
  "platform-promo-code.routes.ts": { domain: "marketing 运营营销（促销码）", code: "marketing:manage" },
  "platform-agent.routes.ts": { domain: "marketing 运营营销（代理商档案/层级）", code: "marketing:manage" },
  "platform-config.routes.ts": { domain: "sysconfig 全局系统配置", code: "sysconfig:manage" },
  "platform-msg-config.routes.ts": {
    domain: "sysconfig 全局系统配置（短信/邮件配置）",
    code: "sysconfig:manage",
    wired: true,
    wiredBy: "S3-193 试点"
  },
  "platform-templates.routes.ts": { domain: "sysconfig 全局系统配置（模板）", code: "sysconfig:manage" },
  "platform-app-version.routes.ts": { domain: "sysconfig 全局系统配置（App 版本发布）", code: "sysconfig:manage" },
  "platform-export-task.routes.ts": { domain: "sysconfig 全局系统配置（导出任务）", code: "sysconfig:manage" },
  "platform-role.routes.ts": { domain: "sysconfig 全局系统配置（平台角色与权限点）", code: "sysconfig:manage" },
  "platform.routes.ts": { domain: "sysconfig 全局系统配置（平台管理员账号）", code: "sysconfig:manage" },
  "platform-monitor.routes.ts": { domain: "monitor 运维监控 / 日志", code: "monitor:manage" },
  "platform-monitor-ops.routes.ts": { domain: "monitor 运维监控 / 日志（阈值）", code: "monitor:manage" },
  // 以下 3 个文件本次扫描**无写端点**（0 条），登记在此仅为"29 个文件全覆盖"的可核对性：
  // platform-channel-report = 渠道报表（只读）、platform-dashboard = 总览大盘（只读）、
  // platform-referral-ledger = 老带新台账（只读；写路径在其它文件）。
  "platform-channel-report.routes.ts": { domain: "marketing 运营营销（渠道报表，只读）", code: "marketing:manage" },
  "platform-dashboard.routes.ts": { domain: "monitor 运维监控 / 日志（总览大盘，只读）", code: "monitor:manage" },
  "platform-referral-ledger.routes.ts": { domain: "marketing 运营营销（老带新台账，只读）", code: "marketing:manage" },
  "platform-error-log.routes.ts": {
    domain: "monitor 运维监控 / 日志（前端自身错误上报）",
    code: null,
    reason: "自助通道：总台前端上报自身运行时错误，非业务写操作；纳入权限域会阻断可观测性"
  },
  "platform-ticket.routes.ts": {
    domain: "ticket 工单系统",
    code: null,
    reason: "逐端点使用目录既有 BUTTON 码（见下表逐条）",
    endpoints: {
      "/tickets/:id/reply": "ticket:reply",
      "/tickets/:id/note": "ticket:note",
      "/tickets/:id/transfer": "ticket:transfer",
      "/tickets/:id/resolve": "ticket:resolve",
      "/tickets/:id/close": "ticket:close"
    }
  },
  // S3-219（收口总清单第 67 项）：3 个目录外域已在平台侧目录扩码 + 28 条写端点接线
  // ⇒ 状态由「待接线（需先扩目录）」变「已接线（S3-219）」，needsCatalog 不再置位。
  "platform-library.routes.ts": {
    domain: "library 商品库",
    code: "library:manage",
    wired: true,
    wiredBy: "S3-219"
  },
  "platform-open.routes.ts": {
    domain: "open 开放平台",
    code: "open:manage",
    wired: true,
    wiredBy: "S3-219"
  },
  "platform-review.routes.ts": {
    domain: "review 平台评价/审核",
    code: "review:manage",
    wired: true,
    wiredBy: "S3-219"
  },
  "platform-miniapp.routes.ts": {
    domain: "miniapp 平台小程序（公开端点）",
    code: null,
    reason: "该文件 routeConfig.auth = none（公开端点，小程序订阅上报），本就不在平台鉴权域；如需收敛属另一议题"
  },
  "platform-notification.routes.ts": {
    domain: "自助（站内通知）",
    code: null,
    reason: "操作对象是管理员自己的站内通知（已读/全部已读），无越权面，按自助处理"
  },
  "platform-auth.routes.ts": {
    domain: "auth 平台认证（豁免）",
    code: null,
    reason: "登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记"
  }
};

function listFiles() {
  return readdirSync(ROUTES_DIR)
    .filter((f) => /^platform.*\.routes\.ts$/.test(f))
    .sort();
}

/** router 变量 → prefix（支持 `prefix, router` 与 `router, prefix` 两种书写顺序） */
function routerPrefixMap(text) {
  const map = new Map();
  for (const m of text.matchAll(
    /prefix:\s*["'`]([^"'`]+)["'`]\s*,\s*router:\s*([A-Za-z0-9_$]+)/g
  )) {
    map.set(m[2], m[1]);
  }
  for (const m of text.matchAll(
    /router:\s*([A-Za-z0-9_$]+)\s*,\s*prefix:\s*["'`]([^"'`]+)["'`]/g
  )) {
    map.set(m[1], m[2]);
  }
  return map;
}

/** prefix → auth 声明（`{ prefix: "X", router: Y, auth: "Z" }` 同块内） */
function prefixAuthMap(text) {
  const map = new Map();
  for (const m of text.matchAll(
    /prefix:\s*["'`]([^"'`]+)["'`][^}]*?auth:\s*["'`]([^"'`]+)["'`]/gs
  )) {
    map.set(m[1], m[2]);
  }
  return map;
}

function scan() {
  const rows = [];
  const unknown = [];
  for (const file of listFiles()) {
    const text = readFileSync(join(ROUTES_DIR, file), "utf8");
    const prefixByRouter = routerPrefixMap(text);
    const authByPrefix = prefixAuthMap(text);
    const mapping = DOMAIN_MAP[file];
    if (!mapping) unknown.push(`${file}（未登记归属域）`);

    const re = /([A-Za-z0-9_$]+)\.(post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      const [, routerVar, method, sub] = m;
      const prefix = prefixByRouter.get(routerVar);
      if (!prefix) unknown.push(`${file}:${line}（router 变量 ${routerVar} 未配对 prefix）`);
      const fullPath = prefix ? `${prefix.replace(/\/$/, "")}${sub}` : `(未配对)${sub}`;
      const perEndpoint = mapping?.endpoints?.[sub];
      rows.push({
        file,
        line,
        method: method.toUpperCase(),
        routerVar,
        prefix: prefix ?? "(未配对)",
        path: fullPath,
        auth: prefix ? authByPrefix.get(prefix) ?? "-" : "-",
        domain: mapping?.domain ?? "（未登记）",
        code: perEndpoint ?? mapping?.code ?? null,
        codeExists: Boolean(perEndpoint),
        reason: mapping?.reason ?? null,
        wired: Boolean(mapping?.wired),
        wiredBy: mapping?.wiredBy ?? null,
        needsCatalog: Boolean(mapping?.needsCatalog)
      });
    }
  }
  return { rows, unknown };
}

function statusOf(row) {
  if (row.wired) return `✅ 已接线（${row.wiredBy ?? "已接线"}）`;
  if (row.code) return row.needsCatalog ? "待接线（需先扩权限点目录）" : "待接线（已立项）";
  return "豁免（理由见下表）";
}

function codeText(row) {
  if (row.code) {
    return (
      `\`${row.code}\`` +
      (row.codeExists ? "（目录既有）" : row.wired ? "（S3-219 扩入平台侧目录）" : "（本单新增）")
    );
  }
  return "—（豁免）";
}

function buildMarkdown(rows, unknown) {
  const byDomain = new Map();
  for (const row of rows) {
    const key = row.domain;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key).push(row);
  }
  const byMethod = rows.reduce((acc, r) => ((acc[r.method] = (acc[r.method] ?? 0) + 1), acc), {});
  const wired = rows.filter((r) => r.wired).length;
  const exempt = rows.filter((r) => !r.code).length;
  const needsCatalog = rows.filter((r) => r.needsCatalog).length;
  /** 按「谁接的线」分档计数（S3-219 起两批接线，状态列必须能区分批次，不许都写成"试点"） */
  const wiredByTag = (tag) => rows.filter((r) => r.wired && r.wiredBy === tag).length;

  const out = [];
  out.push("# R101 · 平台 RBAC 接线台账（平台写端点逐条登记）");
  out.push("");
  out.push("> 派单：**S3-193**（收口总清单第 50 项）→ **S3-219** 更新（第 67 项：平台侧 3 域目录扩 + 28 条写端点接线）｜生成器：`backend/scripts/s3-193-platform-rbac-ledger.mjs`（可复跑）");
  out.push("> 复核命令：`node backend/scripts/s3-193-platform-rbac-ledger.mjs --check`（计数守恒 + 逐条映射断言）");
  out.push("");
  out.push(`**总数核对**：扫描 ${EXPECTED_FILES} 个 \`platform*.routes.ts\` ⇒ 写端点声明 **${rows.length}** 条（期望 ${EXPECTED_TOTAL}）；`);
  out.push(`按方法：${Object.entries(byMethod).map(([k, v]) => `${k} ${v}`).join(" / ")}；`);
  out.push(
    `其中**已接线 ${wired} 条**（S3-193 试点域 ${wiredByTag("S3-193 试点")} 条 ＋ S3-219 商品库/开放平台/评价 3 域 ${wiredByTag("S3-219")} 条）、` +
      `待接线 ${rows.length - wired - exempt - needsCatalog} 条、需先扩目录 ${needsCatalog} 条、豁免 ${exempt} 条。`
  );
  out.push("");
  out.push("**口径**：写端点 = 源码 `.post/.put/.patch/.delete` **声明数**（与 S3-185 取证、CI 外的 G4 门禁 `guard:rbac-wiring` 基线 `rbac-wiring-baseline.json` 同为 105，三方同口径）。");
  out.push("行号 = 该声明在文件中的行；`完整路径` 由「router 变量 ↔ routeConfig.prefix」精确配对得出（多 router 文件不再拼前缀，见 §四）。");
  out.push(
    `**S3-219 更新（2026-10-16，第 67 项）**：\`library\`/\`open\`/\`review\` 3 域由「需先扩目录」→「已接线」（共 ${wiredByTag("S3-219")} 条），` +
      `总声明数与 §一/§二 计数守恒不变；接线形态 = 端点声明上的 \`requirePlatformPermission("…")\` **字面量**（与 S3-193 试点域同形，` +
      `G4 门禁 \`guard-rbac-wiring.mjs --json\` 的 \`authForm\` 记为 \`inline\`）。`
  );
  out.push("");

  out.push("## 一、按域汇总");
  out.push("");
  out.push("| 归属域 | 端点数 | 拟定权限点 | 接入状态 |");
  out.push("|:--|--:|:--|:--|");
  for (const [domain, list] of [...byDomain.entries()].sort()) {
    const codes = [...new Set(list.map((r) => r.code ?? "—（豁免）"))].join(" / ");
    const status = list.some((r) => r.wired)
      ? `✅ 已接线（${list.find((r) => r.wired)?.wiredBy ?? "已接线"}）`
      : list.some((r) => r.needsCatalog)
        ? "待接线（需先扩目录）"
        : list.every((r) => !r.code)
          ? "豁免"
          : "待接线";
    out.push(`| ${domain} | ${list.length} | ${codes} | ${status} |`);
  }
  out.push("");

  out.push("## 二、逐条清单（105 条，一条不漏）");
  out.push("");
  out.push("| # | 方法 | 完整路径 | 文件:行 | 归属域 | 拟定权限点 | 是否已有现成码 | 接入状态 |");
  out.push("|--:|:--|:--|:--|:--|:--|:--|:--|");
  rows.forEach((row, i) => {
    const existing = row.code
      ? row.codeExists
        ? "✅ 有（目录既有）"
        : row.wired
          ? "✅ 有（S3-219 扩入平台侧目录）"
          : "❌ 无（本单新增）"
      : "—（豁免）";
    out.push(
      `| ${i + 1} | ${row.method} | \`${row.path}\` | \`${row.file}:${row.line}\` | ${row.domain} | ${codeText(row)} | ${existing} | ${statusOf(row)} |`
    );
  });
  out.push("");

  out.push("## 三、豁免清单与理由（逐条，不是整栏省略）");
  out.push("");
  out.push("| 方法 | 完整路径 | 文件:行 | 豁免理由 |");
  out.push("|:--|:--|:--|:--|");
  for (const row of rows.filter((r) => !r.code)) {
    out.push(`| ${row.method} | \`${row.path}\` | \`${row.file}:${row.line}\` | ${row.reason ?? "（未登记理由 ⇒ 视为未完成）"} |`);
  }
  out.push("");

  out.push("## 四、与 S3-185 原始输出（`docs/evidence/S3-185/02b-*.txt`）的口径差异（逐条可核对）");
  out.push("");
  out.push("| 文件 | S3-185 打印的完整路径 | 本台账的完整路径 | 原因 |");
  out.push("|:--|:--|:--|:--|");
  out.push("| `platform-app-version.routes.ts` | `/api/app + /api/padmin/app-versions/*`（7 条） | `/api/padmin/app-versions/*`（7 条） | 该文件两个 router：`appVersionPublicRouter`（`/api/app`，`auth:none`，只有 1 个 GET）+ `appVersionAdminRouter`（`/api/padmin`，`requirePlatformAuth`）；7 个写端点**全在管理端 router** 上 |");
  out.push("| `platform-role.routes.ts` | `/api/platform/admins + /api/platform/permissions + /api/platform/roles/*`（4 条） | `/api/platform/roles/*`（4 条） | 该文件三个 router；4 个写端点全在 `platformRolesRouter`（`/api/platform/roles`）上 |");
  out.push("");
  out.push("> 差异仅影响 `完整路径` 的**可读性**，不影响总数（两者都是 105）；判据以本台账为准（精确到 router↔prefix 配对）。");
  out.push("");

  out.push("## 五、权限点与目录的关系（本单设计，待凌舟批准的 3 项）");
  out.push("");
  out.push("1. **读码**：`<域>:view` 共 7 条，已在平台侧 `PERMISSION_CATALOG`（迁移 179 建表 + 代码常量供数）内，可直接用于读端点；");
  out.push("2. **写码**：`<域>:manage` 共 9 条（S3-193 新增，一域一码，**不按 105 个端点 1:1 建码**，避免矩阵碎片化）；");
  out.push("3. **目录外域（S3-219 已处置 3 个）**：`library` / `open` / `review` 已按 S3-213 裁定 ② **扩入平台侧目录**（`backend/src/services/platform/platform-role.service.ts` 的 `PERMISSION_CATALOG` 新增 3 条 BUTTON 码 ⇒ 8 域 → 11 域、18 条 → 21 条），对应写码因此**可被角色矩阵授予**；`miniapp` 仍不在目录内（其唯一写端点是公开端点，按豁免登记，本单未接线）。");
  out.push("4. **两处必须同时改（S3-219 教训）**：`middleware/platform-rbac.ts` 的 `PLATFORM_PERMISSIONS` 决定「码能不能被端点引用」，`platform-role.service.ts` 的 `PERMISSION_CATALOG` 决定「码能不能被授予」（`updateRolePermissions()` 对目录外 `module_code` 直接 400）。只改前者 ⇒ 端点永久 403（除超管），属静默失效。");
  out.push("");
  out.push("**卡内示例命名 `platform:tenant:manage` 未采纳的理由**：目录既有命名规范是 `<moduleCode>:<action>`（`tenant:view` / `ticket:reply`），");
  out.push("再加一层 `platform:` 会让同一个域出现两种写法（目录里 `tenant:view`、端点里 `platform:tenant:manage`），与项目「同一概念只留一个出处」的原则相悖。");
  out.push("");

  if (unknown.length > 0) {
    out.push("## ⚠️ 未能自动映射的条目（必须为空，否则生成器 exit 1）");
    out.push("");
    for (const item of unknown) out.push(`- ${item}`);
    out.push("");
  }
  return out.join("\n") + "\n";
}

const args = process.argv.slice(2);
const { rows, unknown } = scan();

if (args.includes("--json")) {
  console.log(JSON.stringify({ total: rows.length, files: listFiles().length, rows, unknown }, null, 2));
  process.exit(unknown.length === 0 && rows.length === EXPECTED_TOTAL ? 0 : 1);
}

console.log(`[s3-193-ledger] 文件数=${listFiles().length}（期望 ${EXPECTED_FILES}） 写端点=${rows.length}（期望 ${EXPECTED_TOTAL}）`);
const byMethod = rows.reduce((acc, r) => ((acc[r.method] = (acc[r.method] ?? 0) + 1), acc), {});
console.log(`[s3-193-ledger] 按方法：${JSON.stringify(byMethod)}`);
console.log(
  `[s3-193-ledger] 已接线=${rows.filter((r) => r.wired).length} 待接线=${rows.filter((r) => r.code && !r.wired && !r.needsCatalog).length} ` +
    `需扩目录=${rows.filter((r) => r.needsCatalog).length} 豁免=${rows.filter((r) => !r.code).length}`
);

let failed = false;
if (rows.length !== EXPECTED_TOTAL) {
  console.error(`❌ 计数守恒失败：写端点 ${rows.length} ≠ ${EXPECTED_TOTAL}`);
  failed = true;
}
if (unknown.length > 0) {
  console.error(`❌ 存在未能映射的条目：\n${unknown.map((u) => `   - ${u}`).join("\n")}`);
  failed = true;
}
if (failed) process.exit(1);

if (args.includes("--check")) {
  console.log("✅ 计数守恒 + 逐条映射：全部通过（未写文件）");
  process.exit(0);
}

writeFileSync(OUT_MD, buildMarkdown(rows, unknown), { encoding: "utf8" });
console.log(`✅ 已写台账：docs/tasks/R101-平台RBAC接线台账.md（${rows.length} 条）`);
