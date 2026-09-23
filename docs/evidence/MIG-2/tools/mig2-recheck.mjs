/**
 * MIG-2 独立复验（第二轮/复验轮，2026-09-24）。
 *
 * 与上一轮 tools/mig2-verify.mjs、tools/mig2-impact.mjs **不共用代码**：
 *   本脚本自带一套"源码文本 → 花括号配对抽块 → typescript 转译 → 执行"的实现（不 import mig2-lib.mjs），
 *   并对"新旧函数在真实迁移语料上的差异"做一次朴素（不套 runner 过滤）的全量对比，
 *   用于交叉验证上一轮结论：① 差异全部归因于「关键字被当表名」缺陷；② 不含反引号的语句零差异。
 *
 * 运行：node docs/evidence/MIG-2/tools/mig2-recheck.mjs
 * 输出：控制台 + docs/evidence/MIG-2/outputs/08-recheck.txt
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");
const migrationsDir = path.join(repoRoot, "docs", "migrations");
const migrationTs = path.join(repoRoot, "backend", "src", "shared", "migration.ts");

/** 自写抽块：定位 `export function addTablePrefix(`，按花括号配对取到函数结束 */
function pickBlock(source) {
  const at = source.indexOf("export function addTablePrefix");
  if (at < 0) throw new Error("未找到 export function addTablePrefix");
  let depth = 0;
  let seen = false;
  for (let i = at; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      seen = true;
    } else if (source[i] === "}") {
      depth -= 1;
      if (seen && depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error("花括号不配对");
}

/** 转译并取函数（禁止手写复刻：只做文本抽取 + 转译 + 执行） */
function loadFn(source) {
  const block = pickBlock(source);
  const js = ts.transpileModule(block, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      removeComments: false,
    },
    fileName: "addTablePrefix.ts",
  }).outputText;
  const box = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("exports", "module", js)(box.exports, box);
  const fn = box.exports.addTablePrefix;
  if (typeof fn !== "function") throw new Error("转译后不是函数");
  return { fn, sha: createHash("sha256").update(block, "utf8").digest("hex") };
}

const newSource = readFileSync(migrationTs, "utf8");
/** 旧版本取 git HEAD 真值；git 不可用时回退到上一轮落盘的原件 */
let oldSource;
let oldFrom = "git show HEAD:backend/src/shared/migration.ts";
try {
  oldSource = execFileSync("git", ["show", "HEAD:backend/src/shared/migration.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch {
  oldFrom = "docs/evidence/MIG-2/outputs/00-old-migration.ts.txt（git 不可用时的回退）";
  oldSource = readFileSync(path.join(here, "..", "outputs", "00-old-migration.ts.txt"), "utf8");
}

const NEW = loadFn(newSource);
const OLD = loadFn(oldSource);
const lines = [];
const say = (s = "") => {
  lines.push(s);
  console.log(s);
};
/** 只写文件、不打控制台（避免大段 SQL 刷屏） */
const detail = (s = "") => lines.push(s);
const firstLine = (s) => s.trim().split("\n")[0].trim();
/** 取"旧/新结果表名"：CREATE/ALTER/INSERT 等语句的首个目标名 */
const tableOf = (s) => {
  const m = /(?:CREATE\s+TABLE|ALTER\s+TABLE|INSERT\s+(?:IGNORE\s+)?INTO|DROP\s+TABLE|RENAME\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+|IF\s+EXISTS\s+)?(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)/i.exec(s);
  if (!m) return "(未取到)";
  const v = m[1].replace(/^`|`$/g, "");
  return v.startsWith("t_") ? v : `t_${v}`;
};

say("[MIG-2/recheck] 独立复验：真实源码抽块 + 语料全量新旧差异");
say(`  新函数块（工作区）SHA256 ${NEW.sha}`);
say(`  旧函数块来源 ${oldFrom}`);
say(`  旧函数块 SHA256 ${OLD.sha}`);

// ---------- 1) 自写负控用例（含上一轮未覆盖的边界） ----------
const cases = [
  ["CREATE TABLE IF NOT EXISTS `open_webhook` (id INT);", "CREATE TABLE IF NOT EXISTS `t_open_webhook` (id INT);"],
  ["create table if not exists `x` (id int);", "create table if not exists `t_x` (id int);"],
  ["DROP TABLE IF EXISTS `open_webhook`;", "DROP TABLE IF EXISTS `t_open_webhook`;"],
  ["REPLACE INTO `open_webhook` (id) VALUES (1);", "REPLACE INTO `t_open_webhook` (id) VALUES (1);"],
  ["SELECT * FROM a JOIN `b` ON a.id = b.id;", "SELECT * FROM t_a JOIN `t_b` ON a.id = b.id;"],
  // 不配对反引号：不得匹配、必须原样返回（新引入改写 = 缺陷）
  ["CREATE TABLE `x (id INT);", "CREATE TABLE `x (id INT);"],
  // 列名不得被当表名（ON DUPLICATE KEY UPDATE 既有防线）
  ["INSERT INTO sys_user (a) VALUES (1) ON DUPLICATE KEY UPDATE `name` = 1;", null],
  // 已带 t_ 前缀（含反引号）/系统库：不二次加前缀
  ["ALTER TABLE `t_x` ADD COLUMN a INT;", "ALTER TABLE `t_x` ADD COLUMN a INT;"],
  ["SELECT * FROM information_schema.`COLUMNS`;", "SELECT * FROM information_schema.`COLUMNS`;"],
  ["SELECT * FROM `mysql`.`user`;", "SELECT * FROM `mysql`.`user`;"],
];

say("");
say("== 1) 自写负控用例（新函数期望值；null = 只断言与旧版一致） ==");
let caseFail = 0;
for (const [input, expectOut] of cases) {
  const out = NEW.fn(input);
  const oldOut = OLD.fn(input);
  const ok = expectOut === null ? out === oldOut : out === expectOut;
  if (!ok) caseFail += 1;
  const tag = ok ? "PASS" : "FAIL";
  say(`  [${tag}] in : ${JSON.stringify(input)}`);
  say(`         new: ${JSON.stringify(out)}`);
  if (!ok) say(`         old: ${JSON.stringify(oldOut)}  期望: ${JSON.stringify(expectOut)}`);
  // 额外断言：列名/字面量不得被改写
  if (input.includes("ON DUPLICATE KEY UPDATE") && /t_`name`/.test(out)) {
    caseFail += 1;
    say("         [FAIL] 列名被误加前缀");
  }
}

// ---------- 2) 真实迁移语料：新旧全量差异 ----------
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();

const diffAll = [];
let chunks = 0;
let chunksWithoutBacktick = 0;
for (const f of files) {
  const text = readFileSync(path.join(migrationsDir, f), "utf8");
  text.split(";").forEach((chunk, idx) => {
    chunks += 1;
    const oldOut = OLD.fn(chunk);
    const newOut = NEW.fn(chunk);
    if (!chunk.includes("`")) chunksWithoutBacktick += 1;
    if (oldOut === newOut) return;
    const t = chunk.trim();
    const skipped =
      t.startsWith("--") || t.startsWith("/*")
        ? "注释开头块（runner 丢）"
        : /^DROP\s+TABLE/i.test(t)
          ? "DROP TABLE（runner 跳）"
          : /procedure/i.test(t)
            ? "存储过程（runner 跳）"
            : "进入 addTablePrefix（runner 会执行）";
    diffAll.push({ file: f, chunkIndex: idx + 1, skipped, oldOut, newOut, hasBacktick: chunk.includes("`") });
  });
}

const signature = /t_(IF|NOT|EXISTS)\b/;
const explained = diffAll.filter((d) => signature.test(d.oldOut));
const unexplained = diffAll.filter((d) => !signature.test(d.oldOut));
const executed = diffAll.filter((d) => d.skipped.startsWith("进入"));
const differencesAmongChunksWithoutBacktick = diffAll.filter((d) => !d.hasBacktick);

say("");
say("== 2) 真实迁移语料：新旧 addTablePrefix 全量差异（朴素 `;` 切分，不套 runner 过滤） ==");
say(`  SQL 文件数（排除 add_tenant_id.sql）：${files.length}`);
say(`  朴素切分分块总数：${chunks}（其中不含反引号的分块 ${chunksWithoutBacktick}）`);
say(`  新旧输出不同的分块：${diffAll.length} 条`);
say(`  按 runner 语义分桶：`);
for (const bucket of [
  "进入 addTablePrefix（runner 会执行）",
  "注释开头块（runner 丢）",
  "DROP TABLE（runner 跳）",
  "存储过程（runner 跳）",
]) {
  say(`    ${bucket}：${diffAll.filter((d) => d.skipped === bucket).length} 条`);
}
say(`  差异中命中「关键字被当表名」缺陷签名（old 含 t_IF / t_NOT / t_EXISTS）的：${explained.length}/${diffAll.length}`);
say(`  差异无法用该缺陷解释的（应为 0）：${unexplained.length}`);
for (const d of unexplained) say(`    [UNEXPLAINED] ${d.file} 第${d.chunkIndex}块  old=${JSON.stringify(d.oldOut)}  new=${JSON.stringify(d.newOut)}`);
say("");
say("  进入 addTablePrefix 的差异明细（应与上一轮 影响面 5 条一致；完整文本见本文件末尾附录）：");
for (const d of executed) {
  say(`    ${d.file} 第${d.chunkIndex}块 | old 首行=${JSON.stringify(firstLine(d.oldOut))} → new 首行=${JSON.stringify(firstLine(d.newOut))}`);
}
say("");
say(`  被 runner 跳过的差异明细（本单不影响其执行，仅证明修复同时改善了这些分块的文本）：${diffAll.length - executed.length} 条，按文件计：`);
const skippedByFile = new Map();
for (const d of diffAll) {
  if (d.skipped.startsWith("进入")) continue;
  skippedByFile.set(d.file, (skippedByFile.get(d.file) ?? 0) + 1);
}
for (const [f, n] of [...skippedByFile.entries()].sort()) say(`    ${f}：${n} 条`);
say("");
detail("== 附录：全量差异明细（old → new 完整文本） ==");
for (const d of diffAll) {
  detail(`[${d.skipped}] ${d.file} 第${d.chunkIndex}块 | 旧结果表名=${tableOf(d.oldOut)} → 新结果表名=${tableOf(d.newOut)}`);
  detail(`  旧：${JSON.stringify(d.oldOut.trim())}`);
  detail(`  新：${JSON.stringify(d.newOut.trim())}`);
}

const pass =
  caseFail === 0 && unexplained.length === 0 && executed.length === 5 && differencesAmongChunksWithoutBacktick.length === 0;
say("");
say(`  自写负控用例失败数：${caseFail}（要求 0）`);
say(`  进入 addTablePrefix 的差异数：${executed.length}（要求 5，与上一轮影响面一致）`);
say(`  不含反引号的分块中出现的差异数（应为 0）：${differencesAmongChunksWithoutBacktick.length}`);
say(`  RESULT: ${pass ? "ALL PASS" : "FAILED"}`);

writeFileSync(path.join(here, "..", "outputs", "08-recheck.txt"), lines.join("\n") + "\n", "utf8");
process.exit(pass ? 0 : 1);
