/**
 * S3-57 影响面扫描（只读；不改任何文件，不连数据库）
 *
 * 目的（派单卡交付物 4 + 技术债铁律"同一缺陷多处出现必须全量扫描给数字"）：
 *   ① 过程/函数/触发器类迁移文件的存量数量（DELIMITER / CREATE PROCEDURE / CREATE FUNCTION /
 *      CREATE TRIGGER / CREATE EVENT / DROP PROCEDURE / CALL）；
 *   ② **切分口径变更的影响面**：对每个迁移文件，比较
 *        - 修复前流水线：移除 USE + DELIMITER 行 → 旧的 `;` 切分（含注释块首剥离）
 *        - 修复后流水线：只移除 USE 行 → 新的分隔符/BEGIN…END 感知切分
 *      两者产出的"下发语句数组"不同的文件数（含方向：语句数多了还是少了）。
 *
 * 用法：node docs/evidence/D1-S3-57/tools/d1-impact.mjs
 * 说明：旧的 `;` 切分按**修复前源码逐字复刻**（见 LEGACY_SPLIT 注释），仅用于影响面比对；
 *       新切分直接调用工作区真实实现 `splitSqlStatements`（不另写一份）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, createRuntime, readRealMigrationSource } from "../../MIG-5b/tools/mig5b-harness.mjs";

const MIGRATIONS_DIR = join(REPO_ROOT, "docs", "migrations");

// 与 backend/vitest.config.ts 的 env 对齐：加载真实 env.ts 需要 JWT_SECRET（否则直接抛错）
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-vitest";
process.env.USE_MOCK_DB = "true";

/** 修复前的切分实现（逐字复刻 backend/src/shared/migration.ts 修复前 `splitSqlStatements`） */
const LEGACY_SPLIT = (sql) =>
  sql
    .split(";")
    .map((s) => s.trim())
    .map((s) => s.replace(/^(\s*--[^\n]*(\n|$))+/, "").trim())
    .filter((s) => s.length > 0);

/** 修复前调用点预处理：移除 USE 行 + DELIMITER 行 */
const legacyCleaned = (sql) =>
  sql
    .split("\n")
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
    })
    .join("\n");

/** 修复后调用点预处理：只移除 USE 行（DELIMITER 行交给 splitSqlStatements 解析） */
const fixedCleaned = (sql) =>
  sql
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");

const countMatches = (text, pattern) => (text.match(pattern) ?? []).length;

/** 去掉注释与空白后的"代码骨架"，用于判断一条"消失的语句"是否只是注释/残片（不是真实语句丢失） */
const codeOnly = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** 抽出文件里全部注释正文（空白折叠），用于判定"消失的语句"其实是注释被 ; 切出的垃圾片段 */
const commentTextOf = (sql) => {
  const parts = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      // 连注释标记一起收录：碎片常把"注释行 + 下一行注释标记"整段带进来
      parts.push(sql.slice(i, end < 0 ? sql.length : end));
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (ch === "#") {
      const end = sql.indexOf("\n", i);
      parts.push(sql.slice(i, end < 0 ? sql.length : end));
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      parts.push(sql.slice(i, close < 0 ? sql.length : close + 2));
      i = close < 0 ? sql.length : close + 2;
      continue;
    }
    i += 1;
  }
  return parts.join("\n").replace(/\s+/g, " ");
};
const collapse = (text) => text.replace(/\s+/g, " ").trim();

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// 真实实现：通过 MIG-5b 最小运行时加载工作区 migration.ts（只取具名导出，不执行迁移）
const runtime = createRuntime({
  migrationSource: readRealMigrationSource(),
  testSource: "export {};",
  testPath: join(REPO_ROOT, "docs", "evidence", "D1-S3-57", "tools", "d1-empty.test.ts"),
});
const { splitSqlStatements } = runtime.loadMigrationModule();

let delimiterFiles = 0;
let delimiterLines = 0;
let createProcedureFiles = 0;
let createProcedureCount = 0;
let dropProcedureCount = 0;
let callCount = 0;
let functionCount = 0;
let triggerCount = 0;
let eventCount = 0;
const changedFiles = [];
const createProcedureFileNames = [];
const callFiles = [];
let lostCommentOnly = 0;
let lostFragment = 0;
let lostCommentResidue = 0;
let lostDelimiterArtifact = 0;
const lostUnknown = [];

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  const hasDelimiter = /^\s*DELIMITER\s/mi.test(sql);
  const createProcedure = countMatches(sql, /CREATE\s+PROCEDURE\b/gi);
  const dropProcedure = countMatches(sql, /DROP\s+PROCEDURE\b/gi);
  const call = countMatches(sql, /^\s*CALL\s/gim);
  const fn = countMatches(sql, /CREATE\s+FUNCTION\b/gi);
  const trigger = countMatches(sql, /CREATE\s+TRIGGER\b/gi);
  const event = countMatches(sql, /\bCREATE\s+EVENT\b/gi);

  if (hasDelimiter) delimiterFiles += 1;
  delimiterLines += countMatches(sql, /^\s*DELIMITER\s/gim);
  if (createProcedure > 0) {
    createProcedureFiles += 1;
    createProcedureFileNames.push(`${file}（CREATE PROCEDURE ${createProcedure} 条）`);
  }
  createProcedureCount += createProcedure;
  dropProcedureCount += dropProcedure;
  callCount += call;
  functionCount += fn;
  triggerCount += trigger;
  eventCount += event;

  const before = LEGACY_SPLIT(legacyCleaned(sql));
  const after = splitSqlStatements(fixedCleaned(sql));
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const oneLine = (s) => s.replace(/\s+/g, " ").slice(0, 140);
    const lost = before.filter((s) => !after.includes(s));
    const afterCode = after.map(codeOnly);
    const fileComments = commentTextOf(sql);
    for (const s of lost) {
      const code = codeOnly(s);
      if (code.length === 0) lostCommentOnly += 1;
      else if (afterCode.some((c) => c.includes(code))) lostFragment += 1;
      else if (fileComments.includes(collapse(s))) lostCommentResidue += 1;
      else if (code.includes("$$")) lostDelimiterArtifact += 1;
      else lostUnknown.push(`${file} :: ${oneLine(s)}`);
    }
    changedFiles.push({
      file,
      beforeCount: before.length,
      修复后Count: after.length,
      新增语句: after.filter((s) => !before.includes(s)).length,
      消失语句: lost.length,
      消失明细: lost.map(oneLine),
      新增明细: after.filter((s) => !before.includes(s)).map(oneLine),
    });
  }

  if (call > 0) callFiles.push(`${file}（CALL ${call} 条）`);
}

console.log("=== S3-57 影响面扫描（只读）===");
console.log(`迁移文件总数                         : ${files.length}`);
console.log(`含 DELIMITER 指令行的文件数          : ${delimiterFiles}`);
console.log(`DELIMITER 指令行总数                 : ${delimiterLines}`);
console.log(`含 CREATE PROCEDURE 的文件数         : ${createProcedureFiles}`);
console.log(`CREATE PROCEDURE 条数                : ${createProcedureCount}`);
console.log(`DROP PROCEDURE 条数                  : ${dropProcedureCount}`);
console.log(`CALL 条数                            : ${callCount}`);
console.log(`CREATE FUNCTION / TRIGGER / EVENT 数 : ${functionCount} / ${triggerCount} / ${eventCount}`);
console.log("");
console.log(`切分口径变更后"下发语句数组发生变化"的迁移文件数 : ${changedFiles.length}`);
for (const c of changedFiles) {
  console.log(
    `  - ${c.file}：修复前 ${c.beforeCount} 条 → 修复后 ${c.修复后Count} 条` +
      `（新增 ${c.新增语句} 条 / 消失 ${c.消失语句} 条）`
  );
  for (const s of c.消失明细) console.log(`      · 消失：${s}`);
  for (const s of c.新增明细) console.log(`      · 新增：${s}`);
}
console.log("");
console.log(`过程类文件清单：${createProcedureFileNames.length ? createProcedureFileNames.join("；") : "（无）"}`);
console.log(`含 CALL 的文件清单：${callFiles.length ? callFiles.join("；") : "（无）"}`);
console.log("");
console.log("切分口径变更后\"消失语句\"的分类（证明没有真实语句被丢掉）：");
console.log(`  纯注释/空白残块            : ${lostCommentOnly} 条`);
console.log(`  注释正文被 ; 切出的垃圾片段  : ${lostCommentResidue} 条（修复前当独立语句下发、被 MySQL 判语法错误后静默跳过）`);
console.log(`  旧 DELIMITER 残片（含 $$）   : ${lostDelimiterArtifact} 条（DELIMITER 行被整行删掉后 $$ 粘在语句尾部）`);
console.log(`  是修复后某条完整语句的子串  : ${lostFragment} 条（过程体残片/多语句粘连被还原）`);
console.log(`  待人工复核                  : ${lostUnknown.length} 条`);
for (const item of lostUnknown) console.log(`      ! ${item}`);
