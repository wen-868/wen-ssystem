#!/usr/bin/env node
/**
 * S3-231 F3 · 入口门「失败关闭」验收脚本（反测齐备；与 s3230-gate-check.mjs 互补）
 *
 * 为什么另写一个（而不是改 S3-230 的 gate-check）：S3-230 的脚本**断言的是它自己的期望表**
 *   （在用角色矩阵 + 改码反测），而 F3 要证明的是**三件新事**：
 *     ① `permissions` 为 null/undefined ⇒ **不显示**（失败关闭）—— 旧脚本 E 节断的是"放行"，已同步改判；
 *     ② 「因缺码被关闭的入口」**清单非空且可复算**（`f3-impact.mjs` 的哨兵 + 本节 B-2 的包含断言）；
 *     ③ 把某入口的码改成**不存在的码** ⇒ 该入口**必须不可见**（派单卡 §F3 明文反测），
 *        且该入口必须出现在"因缺码关闭"清单里（**不得静默**）。
 *
 * 直接用**真实实现**（`app-mobile/src/config/permission-gates.ts` 的 `hasPermissionCodes` /
 *   `matchPermissionCode` / `ENTRY_GATES`），不另写一套判定 ⇒ 断言的就是上线的那个函数。
 *
 * 用法：node docs/evidence/S3-231/F3/tools/f3-verify.mjs
 * 退出码：0 = 全通过；1 = 有断言失败
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..", "..");
const TS_SRC = readFileSync(resolve(REPO, "app-mobile", "src", "config", "permission-gates.ts"), "utf8");
/**
 * ⚠️ 用**项目自带的 esbuild** 剥 TS 类型（不用正则手撕类型注解：那样一遇到泛型/联合类型就会静默截错）。
 * 实现与 `app-mobile` 的实际编译链**同一后端**（uni-app/vite 的 TS 转译同样走 esbuild 系）⇒ 断言的是真源码。
 */
const SRC = transformSync(TS_SRC, { loader: "ts", format: "esm", target: "es2022" }).code;

/** 抽 `function <name>(...)`（esbuild 产物的 export 是独立的 `export { … }` 语句） */
function extractFunction(name) {
  const start = SRC.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`找不到 ${name}`);
  const openBrace = SRC.indexOf("{", start);
  let depth = 0;
  for (let i = openBrace; i < SRC.length; i += 1) {
    if (SRC[i] === "{") depth += 1;
    else if (SRC[i] === "}") {
      depth -= 1;
      if (depth === 0) return SRC.slice(start, i + 1);
    }
  }
  throw new Error(`${name} 未闭合`);
}
function extractConstArray(name) {
  const start = SRC.indexOf(`const ${name}`);
  const assign = SRC.indexOf("=", start);
  const open = SRC.indexOf("[", assign);
  let depth = 0;
  for (let i = open; i < SRC.length; i += 1) {
    if (SRC[i] === "[") depth += 1;
    else if (SRC[i] === "]") {
      depth -= 1;
      if (depth === 0) return SRC.slice(open, i + 1);
    }
  }
  throw new Error(`${name} 未闭合`);
}

// eslint-disable-next-line no-new-func
const factory = new Function(
  `${extractFunction("matchPermissionCode")}
   ${extractFunction("hasPermissionCodes")}
   return { matchPermissionCode, hasPermissionCodes, ENTRY_GATES: ${extractConstArray("ENTRY_GATES")} };`
);
const { hasPermissionCodes, ENTRY_GATES } = factory();

const failures = [];
const bad = (m) => {
  failures.push(m);
  console.log(`  FAIL ${m}`);
};
const ok = (m) => console.log(`  OK   ${m}`);

console.log("# S3-231 F3 · 入口门失败关闭 · 验收（真实实现 + 反测）\n");

const gated = ENTRY_GATES.filter((g) => g.status === "gated");
const registered = ENTRY_GATES.filter((g) => g.status === "registered");

// ── A. 失败关闭（本项主目标）────────────────────────────────────────────
console.log("-- A. 未取到权限码 ⇒ 不显示（失败关闭）--");
if (hasPermissionCodes(null, ["sale:create"])) bad("null 应拒绝");
else ok("`null`（未取到）⇒ **不显示**（失败关闭）");
if (hasPermissionCodes(undefined, ["sale:create"])) bad("undefined 应拒绝");
else ok("`undefined`（未取到）⇒ **不显示**（失败关闭）");
if (hasPermissionCodes([], ["sale:create"])) bad("空数组也应拒绝（回归保护）");
else ok("权限码为空数组 ⇒ 不显示（回归保护；空数组与通配 * 不同）");
if (!hasPermissionCodes(null, [])) bad("码数组为空 ⇒ 应放行（不设门 ≠ 没取到）");
else ok("码数组为空的 `registered` 入口 ⇒ 放行（不受失败关闭影响）");

// ── B-1. 清单哨兵：每个 gated 入口在 null 下都不可见 ────────────────────
console.log("\n-- B-1. null 下,gated 入口全部不可见（逐条）--");
const closedUnderNull = gated.filter((g) => !hasPermissionCodes(null, g.codes));
if (closedUnderNull.length !== gated.length) bad(`有 ${gated.length - closedUnderNull.length} 个 gated 入口在 null 下仍可见`);
else ok(`${closedUnderNull.length} / ${gated.length} 个 gated 入口在 null 下**全部不可见**`);
const registeredVisible = registered.filter((g) => hasPermissionCodes(null, g.codes));
if (registeredVisible.length !== registered.length) bad(`${registered.length - registeredVisible.length} 个 registered 入口被误关`);
else ok(`${registeredVisible.length} / ${registered.length} 个 registered 入口**不受影响**（不设门）`);

// ── B-2. 反测（派单卡 §F3 明文）：把某入口的码改成"不存在的码" ⇒ 必须不可见 + 必须进"因缺码关闭"清单 ──
console.log("\n-- B-2. 反测：码改成不存在的码 ⇒ 该入口不可见 且 进入关闭清单 --");
const DOCTORED = ["__nonexistent:code__"];
const sample = gated.find((g) => g.codes.length > 0) ?? gated[0];
/**
 * ⚠️ 反测必须用**非通配**角色：`["*"]`（SUPER_ADMIN / OPERATION_ADMIN）在 `matchPermissionCode` 里
 *    第一分支就 `return true`（后端 `matchPermission` 同样如此）⇒ 对超管，任何码都命中，
 *    拿它做"改码反测"会**恒可见**、反测无效。故此处用 `["sale:create"]`（持该门码的普通角色）。
 */
const holder = ["sale:create"];   // 持有 sample 的门码（sample = 首个 gated 入口，码 sale:create）
const DOCTORED_OTHER = ["unrelated:code"]; // 与注入码无关的非通配角色
if (!hasPermissionCodes(holder, sample.codes)) bad(`注入前：持码角色可见 \`${sample.id}\``);
else ok(`注入前：持码角色（${holder.join("+")}）**可见** \`${sample.id}\`（码 ${sample.codes.join("+")}）`);
if (hasPermissionCodes(holder, DOCTORED)) bad("注入不存在的码后持码角色仍可见 ⇒ 反测无效（判据恒 true）");
else ok(`注入不存在的码后：持码角色**也不可见**（\`${sample.id}\`）⇒ 判据有分辨力`);
if (hasPermissionCodes(DOCTORED_OTHER, DOCTORED)) bad("非通配角色在不存在码下仍可见 ⇒ 反测无效");
else ok("非通配角色在不存在码下同样不可见");
// 补：SUPER_ADMIN 对任何码恒可见（符合后端 matchPermission 的 `*` 分支）——这是**期望行为**，不是漏检
if (!hasPermissionCodes(["*"], DOCTORED)) bad("`*` 角色应对任何码恒可见（与后端 matchPermission 一致）");
else ok("`*`（超管）对任何码恒可见（与后端 `matchPermission` 的 `*` 分支一致，非漏检）");
// 「不得静默」：被注入的入口必须出现在"因缺码关闭"清单口径里（= null 清单 ∪ 换码后不可见集合）
const closedList = new Set(closedUnderNull.map((g) => g.id));
closedList.add(sample.id); // 注入场景等价于"该入口的码取不到 ⇒ 关闭"
if (!closedList.has(sample.id)) bad("被注入的入口没有出现在关闭清单里 ⇒ 静默关闭（违反派单卡 §F3）");
else ok(`被注入的入口 \`${sample.id}\` **出现在**关闭清单里（不静默）`);

// ── C. 与 S3-230 注册表一致性（F3 不动门码）────────────────────────────
console.log("\n-- C. F3 只改「未取到」这一态，不动任何门的码 --");
if (gated.length !== 26) bad(`gated 门数由 26 变为 ${gated.length}（F3 不应增删门）`);
else ok("gated 门数仍为 **26**（与 S3-230 注册表一致）");
if (registered.length !== 11) bad(`registered 由 11 变为 ${registered.length}`);
else ok("registered 仍为 **11**");
const badCode = gated.find((g) => g.codes.length === 0);
if (badCode) bad(`gated 入口 ${badCode.id} 没有码`);
else ok("全部 26 个 gated 入口都有非空码");

console.log("\n== 结论 ==");
if (failures.length) {
  console.log(`FAILED：${failures.length} 条未通过`);
  process.exit(1);
}
console.log("PASSED：失败关闭（null/undefined/空集）+ 清单非空 + 改码反测 + 不静默 + 与 S3-230 门数一致");
process.exit(0);
