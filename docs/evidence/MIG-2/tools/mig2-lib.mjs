/**
 * MIG-2 公共库：**从真实源码文本里抽取 `addTablePrefix` 函数块**并用 `typescript.transpileModule`
 * 转译为可执行 JS 后加载。
 *
 * 为什么要抽取而不是 import：
 *   `backend/src/shared/migration.ts` 顶部 import 了 `mysql2/promise` / `./env` / `./logger` / `./seed-data`，
 *   本环境 vitest 不可运行（esbuild spawn EPERM，见派工卡 §六 E7），直接 import 会拉起整条依赖链。
 *   **禁止手写复刻版函数**（派工卡验收标准 3 明文），因此这里只做"取文本 → 转译 → 执行"，
 *   并输出函数源码块的 SHA256 作为可核对指纹。
 */
import { createHash } from "node:crypto";
import ts from "typescript";

/** 抽取 `export function <fnName>(...) { ... }` 的完整源码块（花括号配对；本函数体内无 `{}` 字面量） */
export function extractFunctionBlock(sourceText, fnName = "addTablePrefix") {
  const head = new RegExp(`(?:^|\\n)(export\\s+function\\s+${fnName}\\s*\\()`, "m");
  const m = head.exec(sourceText);
  if (!m) throw new Error(`源码里找不到 export function ${fnName}`);
  const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
  const braceOpen = sourceText.indexOf("{", start);
  if (braceOpen < 0) throw new Error(`${fnName} 函数体缺失`);
  let depth = 0;
  let end = -1;
  for (let i = braceOpen; i < sourceText.length; i += 1) {
    const ch = sourceText[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`${fnName} 花括号不配对`);
  const block = sourceText.slice(start, end + 1);
  const startLine = sourceText.slice(0, start).split("\n").length;
  const endLine = sourceText.slice(0, end).split("\n").length;
  return { block, startLine, endLine };
}

/** 加载函数：返回 { fn, block, sha256, startLine, endLine } */
export function loadAddTablePrefix(sourceText, fnName = "addTablePrefix") {
  const { block, startLine, endLine } = extractFunctionBlock(sourceText, fnName);
  const js = ts.transpileModule(block, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      removeComments: false,
    },
    fileName: `${fnName}.ts`,
  }).outputText;
  const sandboxModule = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("exports", "module", js)(sandboxModule.exports, sandboxModule);
  const fn = sandboxModule.exports[fnName];
  if (typeof fn !== "function") throw new Error(`${fnName} 转译后不是函数`);
  return {
    fn,
    block,
    sha256: createHash("sha256").update(block, "utf8").digest("hex"),
    startLine,
    endLine,
  };
}

/**
 * 表名抽取（口径复用 MIG-1 `mig1-extract.mjs:extractTables` 的取表正则族，含反引号）。
 * 与 MIG-1 的唯一差别：**不在这里再加前缀**——调用方传入的已经是"加过前缀"的语句，
 * 否则会把「旧结果表名 vs 新结果表名」的差异抹平（MIG-2 要看的正是这个差异）。
 */
export function extractTableNames(prefixedSql) {
  const found = [];
  const push = (n) => {
    if (n && !found.includes(n)) found.push(n);
  };
  for (const m of prefixedSql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/ALTER\s+TABLE\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/REPLACE\s+INTO\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/(?:^|\n)\s*UPDATE\s+`?([a-z_][a-z0-9_]*)`?/gim)) push(m[1]);
  for (const m of prefixedSql.matchAll(/DELETE\s+FROM\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixedSql.matchAll(/RENAME\s+TABLE\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  return found;
}
