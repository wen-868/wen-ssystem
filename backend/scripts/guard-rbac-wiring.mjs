#!/usr/bin/env node
/**
 * G4 门禁 · guard:rbac-wiring（S3-180 批 B2-1）
 *
 * ⚠️ 本门禁当前是「**报告器**」，**未接 CI**，也不会阻断任何人。
 *    接 CI 的前置条件（二选一，缺一不可）：
 *      ① 缺口清零（REGISTERED_GAPS 为空且扫描 0 条「无权限检查」）；或
 *      ② 逐条登记完毕（每一处缺口都在下方 REGISTERED_GAPS 里逐条留痕，
 *         并能在 `docs/tasks/R101-RBAC接线缺口清单.md` 找到「该不该要权限 / 建议权限码」的判定）。
 *    在此之前 **禁止**把本脚本接进 CI：一个恒绿或恒红的门禁都是假门禁（项目已有三次教训）。
 *
 * 防的是什么（根因）：`requirePermission` 是租户端 RBAC 的唯一入口
 *   （middleware/rbac-auth.ts，权限串来自 `t_sys_role.permissions`，匹配语义见
 *   services/admin/rbac.service.ts `matchPermission`）。
 *   189 个路由文件里只有 20 个用过它 ⇒ 「授权没有统一入口，靠人一处一处补」，
 *   新增写端点默认**裸奔**（任何登录态用户都能调）。只补当下发现问题的那几处 ⇒ 下次照旧。
 *   ⇒ 本脚本把「哪个写端点没有权限检查」变成**可机械复算的清单**，而不是靠人记得。
 *
 * 判据（与 guard-route-auth 同一套扫描口径，便于交叉核对）：
 *   · 扫描 `backend/src/routes/*.routes.ts`，逐个**写端点**（post/put/patch/delete）判定；
 *   · 「有权限检查」= 该端点调用的同一语句内出现 `requirePermission(...)`（**同行/同调用内联**），
 *     或该端点路径被本文件一条 `router.use(<scope>, ..., requirePermission(x))` 的 scope 覆盖
 *     （scope 是路径前缀，且挂载行在端点之前）；
 *   · **平台侧同理**（S3-193 起）：`requirePlatformPermission(...)`（middleware/platform-rbac.ts）
 *     与租户侧 `requirePermission(...)` 同判（两者都是"写端点挂了权限中间件"），数据源不同
 *     （平台= t_platform_role_permission 矩阵 + 平台超管口径；租户= t_sys_role.permissions）。
 *     不识别平台机制会让平台域接线后仍被报成"无权限检查"（台账失真），故两条都算。
 *   · **消费者端保护形态（S3-205 / 收口总清单第 68 项，2026-10-15 凌舟裁定）**：
 *     同一挂载调用里 **`requireConsumerAuthWithTenant(...)` 与 `csrfMiddleware` 成对出现** ⇒ 记为
 *     「消费者端保护形态」，**不算缺口**。理由：消费者不是商家角色，商家 RBAC 的 `requirePermission`
 *     对它**不适用**（消费者 roles 恒空；硬套商家权限码会把小程序写端点打成 403，同 S3-203 的 `trace:*`
 *     教训），消费者端的访问控制 = 消费者身份（S3-196：微信令牌 → 绑定的会员身份）+ CSRF + 归属校验
 *     （如 `bindSelfIdentity` 与 service 层 `tenant_id` / 归属过滤）。
 *     ⚠️ 判据**刻意保持严格**：只挂消费者认证而**没有 CSRF** 的写端点**仍记缺口**（认证≠授权；状态变更
 *     无 CSRF 是实缺口）；且该形态**必须逐条登记**在 `consumerEnd` 台账里，`--strict` 才放行——避免
 *     「新加的端点只要套上这两个中间件就自动洗绿」。`requireWxAuth` 等**其它**认证中间件不在此列。
 *   · `routeConfig` 声明式（auth: requireAuthWithTenant / requirePlatformAuth / none）**不携带权限码**
 *     ⇒ 只挂认证的写端点一律记「无权限检查」。这是**有意的**：认证≠授权。
 *   · 注释行 / import 行不算（踩坑[134]：注释里的 `requirePermission(` 不是调用）。
 *
 * 已知边界（写在明处，不藏着）：
 *   · 只看「有没有挂 `requirePermission`」，**不判断权限码选得对不对**（码的合理性由
 *     `docs/tasks/R101-RBAC接线缺口清单.md` 逐条判定 + 人工复核）；
 *   · 自定义包装中间件（如 `requireStoreAuth` / `requireWxAuth`）内部的挂载看不穿（同 guard-route-auth）；
 *   · 多 routeConfig 文件按「离 `router: X` 最近的 `prefix: "..."`」配对；配不上时前缀记为 `?`
 *     并在输出里显式标出（不静默猜）。
 *
 * 用法：
 *   node backend/scripts/guard-rbac-wiring.mjs           报告模式（**恒 exit 0**），打印缺口清单 + 缺口总数
 *   node backend/scripts/guard-rbac-wiring.mjs --json     机读模式（`{file, method, path, hasPermission, authForm}[]`；
 *                                                       `authForm` ∈ `inline` / `use-mount` / `consumer` / `none`）
 *   node backend/scripts/guard-rbac-wiring.mjs --strict   严格模式：存在**未登记**缺口 ⇒ exit 1
 *                                                       （已登记缺口按 `rbac-wiring-baseline.json` 的 `gaps` 豁免；
 *                                                        消费者端保护形态须在 `consumerEnd` 里逐条登记，同样不报红）
 *   node backend/scripts/guard-rbac-wiring.mjs --holders <权限码>
 *                                                       打印「该权限码在租户 RBAC 里授给了哪些角色」
 *                                                       （仓库角色种子 × 真实 `matchPermission` 语义复算；
 *                                                        用于接线前核对「持有者 ⊇ 页面角色」）
 *
 * 反测（2026-10-13，两侧原始输出见 `docs/tasks/cards/R101-S3-180-阿坚-回传.md`）：
 *   A 分辨力：对既有**已知无权限**端点（如 `admin-report.routes.ts` 的 POST /collection-links/:linkNo/revoke）
 *     必须报「无权限检查」——证明它不是恒绿摆设；
 *   B `--strict` 两侧：摘掉试点域（报表域）任一新增的 `requirePermission` ⇒ exit 1 并点出该端点；
 *     复原 ⇒ exit 0。
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(HERE, "..", "src", "routes");

const WRITE_METHODS = ["post", "put", "patch", "delete"];
const WRITE_CALL_RE = /([A-Za-z_$][\w$]*)\s*\.\s*(post|put|patch|delete)\s*\(/g;
/** 租户侧权限中间件（数据源：`t_sys_role.permissions` + `matchPermission`） */
const PERM_CALL_RE = /\brequirePermission\s*\(/;
/**
 * 平台侧权限中间件（S3-193：数据源 `t_platform_role_permission` 矩阵 + 平台超管口径）。
 * 两个机制**判据同形**（"该写端点挂了权限中间件"），数据源与语义不同，故都算「有权限检查」；
 * 若不识别平台机制，平台域接线后本门禁会把已接线的端点继续报成"无权限检查"（台账失真）。
 */
const PLATFORM_PERM_CALL_RE = /\brequirePlatformPermission\s*\(/;
/** 任一机制命中即记为「有权限检查」（判据的唯一入口，供挂载判定与端点判定共用） */
const ANY_PERM_CALL_RE = new RegExp(
  `(?:${PERM_CALL_RE.source})|(?:${PLATFORM_PERM_CALL_RE.source})`
);
/**
 * 消费者端保护形态（S3-205 / 收口总清单第 68 项）：`requireConsumerAuthWithTenant` **与** `csrfMiddleware`
 * 必须**成对**出现在同一挂载调用里。前者 = 消费者身份（S3-196 起接受微信令牌，注入绑定的会员身份，
 * roles 恒空，故不适用商家 RBAC）；后者 = 状态变更端点的 CSRF 防护。
 */
/** ⚠️ 与 `requirePermission(...)` 不同：`requireConsumerAuthWithTenant` 是**数组**（`[requireConsumerAuth, tenantMiddleware]`），
 *  在路由里以**裸引用**传入（`router.post("/x", requireConsumerAuthWithTenant, csrfMiddleware, …)`），**不带括号**。 */
const CONSUMER_AUTH_CALL_RE = /\brequireConsumerAuthWithTenant\b/;
const CSRF_CALL_RE = /\bcsrfMiddleware\b/;
/** 一段调用文本是否构成「消费者端保护形态」（成对判据，写在一处供挂载与端点共用） */
function isConsumerProtectedCall(text) {
  return CONSUMER_AUTH_CALL_RE.test(text) && CSRF_CALL_RE.test(text);
}
const USE_CALL_RE = /\.\s*use\s*\(/g;
/** 注释行 / import 行不是调用（踩坑[134]） */
const NON_CALL_LINE_RE = /^\s*(?:\/\/|\*|\/\*|import\b)/;

/**
 * 已登记缺口台账（**逐条登记**）＝ 同目录 `rbac-wiring-baseline.json`（机读镜像；
 * 人读判定在 `docs/tasks/R101-RBAC接线缺口清单.md`；键 = 文件，值 = `["METHOD 完整路径", ...]`）。
 *
 * ① 空台账 = 「缺口清零」，那是接 CI 的硬条件之一；
 * ② 当前非空（既有欠账，见 S3-180 卡 §一，**非本单引入**），每一条的
 *    「该不该要权限 / 建议权限码」判定在 `docs/tasks/R101-RBAC接线缺口清单.md`；
 * ③ **登记 ≠ 合规**：登记只表示「已被盘点、待后续批次接线」，不表示这些端点安全；
 * ④ 台账只对 `--strict` 生效；报告模式永远 exit 0；
 * ⑤ 台账不得用于「让新增缺口变绿」：新加的裸写端点不在台账里 ⇒ `--strict` 必红；
 * ⑥ 本脚本**不提供**「跑一下就自动登记」的写入开关：台账只能由人审阅缺口清单后落盘，
 *    否则新缺口会被"重新生成台账"这一动作静默洗绿。
 *
 * 写端点三分（S3-205 起，键 = 文件，值 = `["METHOD 完整路径", ...]`，**按端点路径匹配，不按行号**）：
 * ① `gaps`        = 无授权形态的**真缺口**（认证≠授权）⇒ 登记只表示「已盘点、待后续批次接线」；
 * ② `consumerEnd` = **消费者端保护形态**（`requireConsumerAuthWithTenant` + `csrfMiddleware` 成对）
 *                   ⇒ 按 2026-10-15 凌舟裁定**不适用商家权限码**，故**不计入缺口**，但必须逐条登记；
 * ③ 挂了 `requirePermission` / `requirePlatformPermission` 的端点**不入台账**（已接线）。
 */
const BASELINE_PATH = join(HERE, "rbac-wiring-baseline.json");
const REGISTERED_GAPS = new Set();
/** 已登记的消费者端保护形态（S3-205）：未登记 ⇒ `--strict` 判红（防"套上两个中间件就自动洗绿"） */
const REGISTERED_CONSUMER = new Set();
let baselineExists = false;
if (existsSync(BASELINE_PATH)) {
  baselineExists = true;
  const raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  for (const [file, list] of Object.entries(raw.gaps ?? {})) {
    for (const item of list) REGISTERED_GAPS.add(`${file}|${item}`);
  }
  for (const [file, list] of Object.entries(raw.consumerEnd ?? {})) {
    for (const item of list) REGISTERED_CONSUMER.add(`${file}|${item}`);
  }
}

/**
 * 租户角色 → 权限串（仓库种子口径，作为 `matchPermission` 的输入）。
 * 来源（逐条可核对）：
 *   · `docs/migrations/079_权限矩阵.sql:85-93`（8 角色）、`docs/migrations/128_fix_roles_binding.sql:3-34`（10 角色幂等补全）
 *   · `docs/ops/S3-122-role-permission-align.sql`（STORE_MANAGER ← finance:payment；STORE_OPERATOR ← sale:return / finance:payment）
 *   · `docs/ops/S3-122-F4-finance-daily-settle.sql`（两角色 ← finance:daily-settle）
 *   · STORE_MANAGER 的 `goods:price` 取自 `backend/src/__tests__/routes/rbac-g1-wiring.test.ts`（生产实值 9009）
 * ⚠️ 边界：生产库另有仓库种子里没有的角色（`STORE_ADMIN` / `SALESMAN` 等，见
 *   `docs/tasks/cards/R101-S3-136-F1-生产矩阵基线.md` §二）⇒ 本表**不是**生产真值。
 *   接线前的最终持有核对须由凌舟在服务器执行等价 SQL：
 *   `SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;`
 */
const ROLE_PERMISSIONS_SEED = {
  SUPER_ADMIN: ["*"],
  OPERATION_ADMIN: ["*"],
  STORE_MANAGER: [
    "store:*",
    "sale:*",
    "customer:*",
    "inventory:*",
    "report:*",
    "dashboard:*",
    "finance:payment",
    "goods:price",
    "finance:daily-settle",
  ],
  STORE_OPERATOR: ["sale:create", "sale:view", "inventory:view", "dashboard:view", "sale:return", "finance:daily-settle"],
  SALES_STAFF: ["sale:create", "sale:view", "customer:view", "customer:visit", "dashboard:view"],
  PURCHASE_STAFF: ["purchase:*", "supplier:*", "inventory:inbound", "report:purchase"],
  WAREHOUSE_STAFF: ["inventory:*", "trace:*", "transfer:*", "stock-check:*"],
  FINANCE_STAFF: ["finance:*", "report:*", "customer:statement", "supplier:statement", "dashboard:view"],
  CUSTOMER_SERVICE: ["customer:view", "aftersale:*", "miniapp:*", "notification:view"],
  READONLY: ["*:view"],
};

/** 与 `services/admin/rbac.service.ts` 的 `matchPermission` 逐行同义（`*` / `dom:*` / `*:action` / 精确码） */
function matchPermission(perms, permCode) {
  if (!Array.isArray(perms) || typeof permCode !== "string" || permCode.length === 0) return false;
  if (perms.includes("*")) return true;
  const domIndex = permCode.indexOf(":");
  if (domIndex > 0 && perms.includes(`${permCode.slice(0, domIndex)}:*`)) return true;
  const actionIndex = permCode.lastIndexOf(":");
  if (actionIndex > -1 && actionIndex < permCode.length - 1 && perms.includes(`*:${permCode.slice(actionIndex + 1)}`)) {
    return true;
  }
  return perms.includes(permCode);
}

/** 字符下标 → 1-based 行号 */
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/** 从 `(` 处按括号配平取出整段调用实参文本（跳过字符串字面量；上限 4000 字符防跑飞） */
function callText(src, openIdx, cap = 4000) {
  let depth = 0;
  const end = Math.min(src.length, openIdx + cap);
  for (let i = openIdx; i < end; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i++;
      while (i < end) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === ch) break;
        i++;
      }
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx, end);
}

/** 取一段文本里第一个字符串字面量（支持跨行；单行路径 / mount scope） */
function firstStringLiteral(text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      let out = "";
      i++;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\") {
          i++;
          if (i >= text.length) break;
        }
        out += text[i];
        i++;
      }
      return out;
    }
  }
  return null;
}

/** Express `router.use(scope, mw)` 的 scope 语义：scope 是否为 path 的前缀 */
function covers(scope, path) {
  return path === scope || path.startsWith(`${scope}/`);
}

/**
 * 本文件里 路由变量 → prefix。
 * ① 常规：`router: X` 与同配置对象里的 `prefix: "..."` 配对（取索引最近的一条）；
 * ② 简写：`{ prefix: "/api/sync", router, auth: ... }` 这种**属性简写**没有 `router:`，
 *    此时若文件里只有**一个** prefix，则把该 prefix 分给所有接收者变量（如 sync.routes.ts 的 `router`）。
 *    多 prefix + 简写 ⇒ 无法判定，保持 `?` 并在输出里显式标出（不静默猜）。
 */
function prefixByRouter(src, receiverVars = []) {
  const prefixes = [...src.matchAll(/prefix\s*:\s*["']([^"']*)["']/g)].map((m) => ({
    idx: m.index,
    prefix: m[1],
  }));
  const map = new Map();
  for (const m of src.matchAll(/router\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    let best = null;
    for (const p of prefixes) {
      const d = Math.abs(p.idx - m.index);
      if (!best || d < best.d) best = { d, prefix: p.prefix };
    }
    if (best) map.set(m[1], best.prefix);
  }
  if (prefixes.length === 1) {
    for (const v of receiverVars) if (!map.has(v)) map.set(v, prefixes[0].prefix);
  }
  return map;
}

/** 扫描单个文件 → 写端点记录 */
function scanFile(file, src) {
  const lines = src.split(/\r?\n/);
  const receiverVars = [...new Set([...src.matchAll(WRITE_CALL_RE)].map((m) => m[1]))];
  const prefixMap = prefixByRouter(src, receiverVars);

  // 1) `router.use(...)` 挂载：scope + 是否含权限中间件（租户/平台任一机制）
  const mounts = [];
  for (const um of src.matchAll(USE_CALL_RE)) {
    const line = lineOf(src, um.index);
    if (NON_CALL_LINE_RE.test(lines[line - 1] || "")) continue;
    const call = callText(src, src.indexOf("(", um.index + um[0].length - 1));
    mounts.push({
      line,
      receiver: src.slice(0, um.index).match(/([A-Za-z_$][\w$]*)\s*$/)?.[1] ?? null,
      scope: firstStringLiteral(call),
      hasPerm: ANY_PERM_CALL_RE.test(call),
      consumerProtected: isConsumerProtectedCall(call),
    });
  }

  // 2) 写端点
  const out = [];
  for (const m of src.matchAll(WRITE_CALL_RE)) {
    const lineNo = lineOf(src, m.index);
    if (NON_CALL_LINE_RE.test(lines[lineNo - 1] || "")) continue;
    const call = callText(src, src.indexOf("(", m.index + m[0].length - 1));
    const routePath = firstStringLiteral(call) ?? "?";
    const prefix = prefixMap.get(m[1]) ?? "?";
    const fullPath = `${prefix === "?" ? "?" : prefix}${routePath === "?" ? "" : routePath}`;
    const inlinePerm =
      ANY_PERM_CALL_RE.test(call) || ANY_PERM_CALL_RE.test(lines[lineNo - 1] || "");
    const coveringPermMounts = mounts.filter(
      (x) => x.hasPerm && x.scope && x.line < lineNo && covers(x.scope, routePath)
    );
    const inlineConsumer = isConsumerProtectedCall(call);
    const coveringConsumerMounts = mounts.filter(
      (x) => x.consumerProtected && x.scope && x.line < lineNo && covers(x.scope, routePath)
    );
    const hasPerm = inlinePerm || coveringPermMounts.length > 0;
    // 消费者端保护形态只在**没有**商家/平台权限码时判定（有权限码就按已接线记，形态更明确）
    const consumerProtected = !hasPerm && (inlineConsumer || coveringConsumerMounts.length > 0);
    /** inline = 内联权限码 ／ use-mount = 被 `router.use(scope, …, requirePermission())` 覆盖 ／
     *  consumer = 消费者端保护形态（认证 + CSRF，不适用商家权限码）／ none = 无授权形态（真缺口） */
    const authForm = hasPerm
      ? inlinePerm
        ? "inline"
        : "use-mount"
      : consumerProtected
        ? "consumer"
        : "none";
    out.push({
      file,
      line: lineNo,
      method: m[2].toUpperCase(),
      prefix,
      routePath,
      path: fullPath,
      hasPermission: authForm !== "none",
      authForm,
      mountLine: (coveringPermMounts[0] ?? coveringConsumerMounts[0])?.line ?? null,
    });
  }
  return out;
}

if (!existsSync(ROUTES_DIR)) {
  console.error(`找不到路由目录：${ROUTES_DIR}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const JSON_MODE = args.includes("--json");
const STRICT = args.includes("--strict");
const holdersIdx = args.indexOf("--holders");

if (holdersIdx > -1) {
  const code = args[holdersIdx + 1];
  if (!code) {
    console.error("用法：node backend/scripts/guard-rbac-wiring.mjs --holders <权限码>");
    process.exit(1);
  }
  const holders = Object.entries(ROLE_PERMISSIONS_SEED)
    .filter(([, perms]) => matchPermission(perms, code))
    .map(([role]) => role);
  console.log(`[guard:rbac-wiring --holders] 权限码 \`${code}\` 的持有角色（仓库种子口径）：`);
  console.log(holders.length > 0 ? `   ${holders.join(" / ")}` : "   （无任何角色持有 ⇒ 仅 SUPER_ADMIN 之类旁路角色可通过）");
  console.log(`   判定依据：matchPermission（services/admin/rbac.service.ts）× 角色种子（079 / 128 / ops/S3-122*）`);
  console.log(`   ⚠️ 非生产真值（生产另有 STORE_ADMIN / SALESMAN 等未入仓库种子的角色）⇒ 见脚本头 ROLE_PERMISSIONS_SEED 注释`);
  process.exit(0);
}

const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts")).sort();
const all = [];
for (const f of files) all.push(...scanFile(f, readFileSync(join(ROUTES_DIR, f), "utf8")));

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      all.map((r) => ({
        file: r.file,
        method: r.method,
        path: r.path,
        hasPermission: r.hasPermission,
        authForm: r.authForm,
      })),
      null,
      2
    )
  );
  process.exit(0);
}

const gaps = all.filter((r) => r.authForm === "none");
const consumerEndpoints = all.filter((r) => r.authForm === "consumer");
const wired = all.filter((r) => r.authForm === "inline" || r.authForm === "use-mount");
const gapFiles = [...new Set(gaps.map((r) => r.file))].sort();
const consumerFiles = [...new Set(consumerEndpoints.map((r) => r.file))].sort();
const unknownPrefix = all.filter((r) => r.prefix === "?" || r.routePath === "?").map((r) => `${r.file}:${r.line}`);

console.log(`[guard:rbac-wiring] 扫描 ${files.length} 个路由文件 · ${all.length} 个写端点`);
console.log(
  `[guard:rbac-wiring] 已接线（权限码）${wired.length} 处 ／ 消费者端保护形态 ${consumerEndpoints.length} 处` +
    ` ／ **无授权形态 ${gaps.length} 处**（分布在 ${gapFiles.length} 个文件）`
);
console.log(
  `[guard:rbac-wiring] 本门禁当前是【报告器】，未接 CI（接 CI 前置＝缺口清零或逐条登记，见脚本头）`
);

console.log(`\n—— 缺口清单（按文件分组，逐条 METHOD /prefix/path ⇒ 无授权形态）——`);
for (const f of gapFiles) {
  const rows = gaps.filter((r) => r.file === f);
  console.log(`\n${f}  (${rows.length} 处)`);
  for (const r of rows) console.log(`   L${r.line}: ${r.method} ${r.path} ⇒ 无授权形态`);
}

console.log(
  `\n—— 消费者端保护形态（第 68 项裁定：requireConsumerAuthWithTenant + csrfMiddleware，不适用商家权限码）——`
);
if (consumerEndpoints.length === 0) console.log("   （0 处）");
for (const f of consumerFiles) {
  const rows = consumerEndpoints.filter((r) => r.file === f);
  console.log(`\n${f}  (${rows.length} 处)`);
  for (const r of rows) console.log(`   L${r.line}: ${r.method} ${r.path} ⇒ 消费者端保护形态`);
}

if (unknownPrefix.length > 0) {
  console.log(`\n⚠️ 前缀/路径未能解析（需人工核对）：${unknownPrefix.join(", ")}`);
}

const unregistered = gaps.filter((r) => !REGISTERED_GAPS.has(`${r.file}|${r.method} ${r.path}`));
const staleRegistrations = [...REGISTERED_GAPS].filter(
  (k) => !gaps.some((r) => `${r.file}|${r.method} ${r.path}` === k)
);
const unregisteredConsumer = consumerEndpoints.filter(
  (r) => !REGISTERED_CONSUMER.has(`${r.file}|${r.method} ${r.path}`)
);
const staleConsumerRegistrations = [...REGISTERED_CONSUMER].filter(
  (k) => !consumerEndpoints.some((r) => `${r.file}|${r.method} ${r.path}` === k)
);
console.log(
  `\n—— 台账核对（rbac-wiring-baseline.json ${baselineExists ? "存在" : "**缺失**（缺失 ⇒ 一切缺口都算未登记）"}）——\n` +
    `gaps：已登记 ${REGISTERED_GAPS.size} 条 ／ 未登记 ${unregistered.length} 条 ／ ` +
    `已登记但当前无缺口 ${staleRegistrations.length} 条（仅提示，不判红）\n` +
    `consumerEnd：已登记 ${REGISTERED_CONSUMER.size} 条 ／ 未登记 ${unregisteredConsumer.length} 条 ／ ` +
    `已登记但当前非消费者端形态 ${staleConsumerRegistrations.length} 条（仅提示，不判红）`
);
for (const r of unregistered) console.log(`   ❌ 未登记：${r.file}:${r.line} ${r.method} ${r.path}`);
for (const r of unregisteredConsumer)
  console.log(`   ❌ 未登记（消费者端形态）：${r.file}:${r.line} ${r.method} ${r.path}`);

if (STRICT && (unregistered.length > 0 || unregisteredConsumer.length > 0)) {
  console.error(
    `\n❌ [--strict] 存在 ${unregistered.length} 处**未登记**的无授权写端点` +
      ` ＋ ${unregisteredConsumer.length} 处**未登记**的消费者端保护形态 ⇒ exit 1` +
      `（前者确为既有欠账者登记进 \`gaps\`；后者登记进 \`consumerEnd\`；` +
      `两类都须在 docs/tasks/R101-RBAC接线缺口清单.md 写明判定）`
  );
  process.exit(1);
}

if (STRICT) {
  console.log(
    `✅ [--strict] 无「未登记」项（已登记欠账 ${REGISTERED_GAPS.size} 条、` +
      `已登记消费者端保护形态 ${REGISTERED_CONSUMER.size} 条，均不计红）`
  );
}
process.exit(0);
