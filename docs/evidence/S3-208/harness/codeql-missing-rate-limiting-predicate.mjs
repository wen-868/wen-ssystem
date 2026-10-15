/**
 * S3-208 证据装置：`js/missing-rate-limiting` 的**本地等价判据**（CodeQL 不可本地跑时的替代）。
 *
 * CodeQL 该查询的目标对象（按 PR #297 check-run 115404340298 的 23 条注解反推，并经
 * `docs/tasks/派单规范.md` §8.7 的既有结论交叉验证）：
 *   一条**路由注册**同时满足 ①注册链上出现鉴权中间件（authentication/authorization）
 *   ②同一注册链上**没有内联**限流中间件调用 `rateLimit(...)` ⇒ 报一条 high。
 *   ⚠️ S3-112 结论文档化于此：把 `rateLimit(...)` 包进 helper（如 `createRateLimiter()`）返回
 *   中间件，CodeQL 识别不到 ⇒ 判据必须落在"注册点上的**调用形态**"而不是"文件里有没有限流代码"。
 *
 * 本脚本按上面两条判据扫指定路由文件；用途：
 *   ① 接线前跑（`--git-ref HEAD`）⇒ 必须报出与 PR #297 注解**同一批**路由（否则判据本身有问题）；
 *   ② 接线后跑（默认工作树）⇒ 必须为 0；
 *   ③ 反测：临时摘掉一条路由的 `rateLimit(` ⇒ 必须重新报出**那一条**（且只报那一条）。
 *
 * 用法：node codeql-missing-rate-limiting-predicate.mjs [--git-ref <ref>] [--repo <路径>]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const getFlag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const repo = path.resolve(getFlag("--repo", process.cwd()));
const gitRef = getFlag("--git-ref", null);

/** 被测文件（第 57 项 23 条注解里 `missing-rate-limiting` 的 11 条全部落在这 3 个文件） */
const TARGETS = [
  "backend/src/routes/wechat.routes.ts",
  "backend/src/routes/marketing-miniapp.routes.ts",
  "backend/src/routes/commerce-fix.routes.ts",
];

/** 与 CodeQL 判据①对齐：注册链上的鉴权中间件（本仓既有命名族） */
const AUTH_MIDDLEWARE =
  /\b(requireWxAuth|requireConsumerAuthWithTenant|requireAuth|requireAuthWithTenant|requirePlatformAuth|requirePlatformPermission|requirePermission|requireRoles|requireStoreAuth|csrfMiddleware)\b/;
/** 与 CodeQL 判据②对齐：注册点上**内联**的限流中间件调用形态（S3-112 的结论） */
const INLINE_RATE_LIMIT = /\brateLimit\(/;

/** 剥注释（块注释 + 行内注释；字符串字面量原样保留，避免注释里的 `rateLimit(` 骗过判据） */
function stripComments(source) {
  return source.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`])(?:\\.|(?!\2)[^\\\n])*\2/g,
    (match, comment) => (comment === undefined ? match : "")
  );
}

function readSource(rel) {
  if (!gitRef) return { text: readFileSync(path.join(repo, rel), "utf8"), from: "工作树" };
  const text = execFileSync("git", ["show", `${gitRef}:${rel}`], { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { text, from: `git ${gitRef}` };
}

/** 抽出文件里所有"路由注册语句"（含跨行写法；用括号配平找语句边界） */
function extractRegistrations(code) {
  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete|all)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = re.lastIndex - 1; // 指向 '('
    for (; i < code.length; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const statement = code.slice(start, i + 1);
    const line = code.slice(0, start).split("\n").length;
    const pathMatch = statement.match(/^\s*[A-Za-z_$][\w$]*\s*\.\s*\w+\s*\(\s*"([^"]*)"/) || statement.match(/"([^"]*)"/);
    if (!pathMatch) continue;
    out.push({
      line,
      method: m[2].toUpperCase(),
      routePath: pathMatch[1],
      hasAuth: AUTH_MIDDLEWARE.test(statement),
      hasInlineRateLimit: INLINE_RATE_LIMIT.test(statement),
    });
  }
  return out;
}

let totalRegistrations = 0;
const hits = [];
for (const rel of TARGETS) {
  const { text, from } = readSource(rel);
  const registrations = extractRegistrations(stripComments(text));
  totalRegistrations += registrations.length;
  for (const r of registrations) {
    if (r.hasAuth && !r.hasInlineRateLimit) {
      hits.push({ file: rel, ...r, source: from });
    }
  }
}

console.log(`[判据] 目标文件 ${TARGETS.length} 个；扫描路由注册 ${totalRegistrations} 条；来源=${gitRef ? `git ${gitRef}` : "工作树"}`);
console.log(`[判据] 命中「有鉴权 + 注册点未内联 rateLimit(...)」= ${hits.length} 条`);
for (const h of hits) {
  console.log(`  - ${h.file}:${h.line}  ${h.method} ${h.routePath}`);
}
if (totalRegistrations === 0) {
  console.error("[判据] 扫描到 0 条路由注册 ⇒ 判据自身失效（同 S3-49 假门禁教训），退出码 2");
  process.exit(2);
}
process.exit(hits.length === 0 ? 0 : 1);
