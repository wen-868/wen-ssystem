/**
 * S3-57 复跑脚本：把下面几件事在**同一份最小 vitest 运行时**里跑出原始输出（先落盘再截尾读回）。
 *
 *   A. 修复前（`outputs/00a-prefix-migration.ts.txt` = HEAD 版 migration.ts 逐字副本）
 *      + 本轮新增测试文件（`migration-delimiter.test.ts`）⇒ **必须红**（先红证据）
 *   B. 修复后（工作区实现）+ 新增测试文件 ⇒ **全绿**（后绿证据）
 *   C. 修复后 + 既有 `migration.test.ts`（S3-57 改写了其中 1 条旧口径用例）⇒ 全绿
 *   D. 修复后 + 既有 `migration-split.test.ts`（MIG-5/MIG-5b 守门，未改动）⇒ 全绿（不回归）
 *   E. 反测 1：把 `splitSqlStatements` 退回旧的 `;` 切分（调用点仍保留 DELIMITER 行）⇒ 新增测试**必须红**
 *   F. 反测 2：保留新切分但把"跳过存储过程语句"的 `continue` 加回去 ⇒ 新增测试**必须红**（DROP PROCEDURE 用例）
 *   G. 读数：真实 092 驱动 runMigrations（假连接）打印实际下发语句序列读数
 *   H. 返工第 1 轮专测：把 `migration.test.ts` 里**两条过程用案例文逐字抽取**（连同该 describe 的
 *      beforeEach 与文件顶部 mock 骨架）拼成最小测试文件后跑三种实现：
 *        H1 修复后实现            ⇒ 两条用例全绿
 *        H2 反测 3a（退回旧 `;` 切分） ⇒ `CREATE PROCEDURE` 用例必须红（`DROP PROCEDURE` 用例不受影响——该语句体内无 `;`）
 *        H3 反测 3b（加回过程类 continue） ⇒ 两条用例**必须红**（含本轮改写的 DROP PROCEDURE 用例）
 *
 * 用法：`node docs/evidence/D1-S3-57/tools/d1-verify.mjs`（EXIT=0 表示所有预期都成立）
 * 说明：沙箱内 vitest 起不来（esbuild spawn EPERM），故复用 MIG-5b 的最小运行时"原样执行测试文件原文"；
 *       最终绿红仍以凌舟本机 `cd backend && npx vitest run` 为准。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  TEST_DIR,
  TEST_FILE,
  createRuntime,
  formatFailure,
  readRealMigrationSource,
  readTestSource,
  sha256,
} from "../../MIG-5b/tools/mig5b-harness.mjs";

// 与 backend/vitest.config.ts 的 env 对齐（被测文件多数 mock 了 env，此处只作兜底）
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-vitest";

const EVIDENCE_DIR = join(REPO_ROOT, "docs", "evidence", "D1-S3-57");
const PRE_FIX_SOURCE_ARTIFACT = join(EVIDENCE_DIR, "outputs", "00a-prefix-migration.ts.txt");
const READINGS_TEST_ARTIFACT = join(EVIDENCE_DIR, "tools", "d1-readings.test.ts.txt");
const NEW_TEST = join(TEST_DIR, "migration-delimiter.test.ts");
const MIGRATION_TEST = join(TEST_DIR, "migration.test.ts");
const REWORK_SAME_SOURCE_ARTIFACT = join(EVIDENCE_DIR, "outputs", "11-rework-same-source-case.txt");

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const normalize = (text) => stripBom(text).replace(/\r\n/g, "\n");

const realSource = readRealMigrationSource();
const preFixSource = normalize(readFileSync(PRE_FIX_SOURCE_ARTIFACT, "utf8"));
const newTestSource = readTestSource(NEW_TEST);
const legacySplitTestSource = readTestSource(TEST_FILE);
const migrationTestSource = readTestSource(MIGRATION_TEST);

/** 反测 1：把分隔符/BEGIN…END 感知退回修复前的 `;` 切分（调用点仍保留 DELIMITER 行） */
function makeSplitterRevertedSource(source) {
  const src = normalize(source);
  const pattern = /export function splitSqlStatements\(sql: string\): string\[\] \{[\s\S]*?\n\}/;
  const matched = pattern.exec(src);
  if (!matched) throw new Error("反测失效：定位不到 splitSqlStatements 函数块");
  const reverted = [
    "export function splitSqlStatements(sql: string): string[] {",
    "  return sql",
    '    .split(";")',
    "    .map((s) => s.trim())",
    '    .map((s) => s.replace(/^(\\s*--[^\\n]*(\\n|$))+/, "").trim())',
    "    .filter((s) => s.length > 0);",
    "}",
  ].join("\n");
  return { source: src.replace(matched[0], reverted) };
}

/**
 * 反测 2：保留新切分，但把"跳过过程类语句"的 continue 加回**两处**调用点
 * （5.5.8 AI 底座建表 + 第 8 步外部迁移）——即修复前 HEAD 的缺陷行为（HEAD:920-922 / HEAD:1068-1071）。
 * 只还原第 8 步那一处是不够的：5.5.8 也会读迁移文件，会把同一条 DROP PROCEDURE 下发出去。
 */
function makeProcedureSkipRestoredSource(source) {
  const src = normalize(source);
  const aiNeedle = "      for (const stmt of aiStatements) {\n        await safeExec(conn, addTablePrefix(stmt), \"5.5.8 AI底座建表\");";
  if (!src.includes(aiNeedle)) throw new Error("反测失效：定位不到 5.5.8 AI 底座循环（for of aiStatements）");
  const aiSkipBlock = [
    "      for (const stmt of aiStatements) {",
    '        if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) {',
    "          continue;",
    "        }",
    '        await safeExec(conn, addTablePrefix(stmt), "5.5.8 AI底座建表");',
  ].join("\n");

  const needle = "        for (const stmt of statements) {\n          // 紧急保护（R95-03）";
  if (!src.includes(needle)) throw new Error("反测失效：定位不到外部迁移循环（for of statements）");
  const skipBlock = [
    '          if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) {',
    "            logger.info(`[migration] ${file}: 跳过存储过程语句`);",
    "            continue;",
    "          }",
    "",
  ].join("\n");
  return {
    source: src
      .replace(aiNeedle, aiSkipBlock)
      .replace(needle, "        for (const stmt of statements) {\n" + skipBlock + "          // 紧急保护（R95-03）"),
  };
}

const splitterReverted = makeSplitterRevertedSource(realSource);
const skipRestored = makeProcedureSkipRestoredSource(realSource);

/**
 * 从**仓库里的既有测试文件**逐字抽取一个调用块（圆括号配平），用于"跑的就是仓库那段真实文本"。
 * 只按 ASCII 圆括号配平：被测文本里出现的全角括号不参与计数。
 */
function extractCall(source, startIndex) {
  const open = source.indexOf("(", startIndex);
  if (open < 0) throw new Error("抽取失败：找不到 '('");
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        const semi = source.indexOf(";", i);
        if (semi < 0) throw new Error("抽取失败：调用块末尾缺 ';'");
        return { text: source.slice(startIndex, semi + 1), end: semi + 1 };
      }
    }
  }
  throw new Error("抽取失败：圆括号未配平");
}

const indexOfOrThrow = (source, needle) => {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`抽取失败：定位不到 ${JSON.stringify(needle)}`);
  return index;
};

/**
 * 返工第 1 轮（H）：把 `migration.test.ts` 的 ① 顶部 mock 骨架 ② `runMigrations` 的 beforeEach
 * ③ 两条过程用例（CREATE PROCEDURE / DROP PROCEDURE）逐字抽出，拼成一个可执行的最小测试文件。
 * 抽出文本同时落盘到 `outputs/11-...txt`，凌舟可比对它与仓库原文。
 */
function extractSameSourceReworkTest(source) {
  const headerEnd = indexOfOrThrow(source, 'describe("migration - 常量"');
  const header = source.slice(0, headerEnd).trimEnd();

  const runMigrationsDescribe = indexOfOrThrow(source, 'describe("runMigrations"');
  const beforeEachStart = indexOfOrThrow(source.slice(runMigrationsDescribe), "beforeEach(() => {") + runMigrationsDescribe;
  const beforeEachBlock = extractCall(source, beforeEachStart).text;

  const createProcStart = indexOfOrThrow(source, 'it("存储过程语句应作为完整语句下发');
  const createProcBlock = extractCall(source, createProcStart).text;

  const dropNeedle = indexOfOrThrow(source, 'mockReadFileSync.mockReturnValue("DROP PROCEDURE IF EXISTS test;")');
  const dropStart = source.lastIndexOf('  it("', dropNeedle);
  if (dropStart < 0) throw new Error("抽取失败：定位不到 DROP PROCEDURE 用例的 it( 起始");
  const dropBlock = extractCall(source, dropStart).text;

  const composed = [
    header,
    "",
    "// 本文件由 docs/evidence/D1-S3-57/tools/d1-verify.mjs 从 backend/src/__tests__/shared/migration.test.ts",
    "// 逐字抽取生成（① 顶部 mock 骨架 ② runMigrations 的 beforeEach ③ 两条过程用例），仅供证据复跑，不参与仓库测试发现。",
    'describe("S3-57 返工第 1 轮：与 migration.test.ts 逐字同源的用例", () => {',
    beforeEachBlock,
    "",
    createProcBlock,
    "",
    dropBlock,
    "});",
    "",
  ].join("\n");

  const lineOf = (index) => source.slice(0, index).split("\n").length;
  return {
    composed,
    ranges: {
      顶部mock骨架: `1-${lineOf(headerEnd) - 1}`,
      beforeEach: `${lineOf(beforeEachStart)}-${lineOf(extractCall(source, beforeEachStart).end)}`,
      CREATE_PROCEDURE用例: `${lineOf(createProcStart)}-${lineOf(extractCall(source, createProcStart).end)}`,
      DROP_PROCEDURE用例: `${lineOf(dropStart)}-${lineOf(extractCall(source, dropStart).end)}`,
    },
  };
}

const reworkTest = extractSameSourceReworkTest(migrationTestSource);

const line = (title) => console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);

async function runScenario({ id, title, migrationSource, testSource, testPath, expectFailures = 0 }) {
  line(`[${id}] ${title}`);
  const runtime = createRuntime({ migrationSource, testSource, testPath });
  const results = await runtime.run();
  const failures = results.filter((r) => !r.ok);
  console.log(`用例数 ${results.length} ／ 通过 ${results.length - failures.length} ／ 失败 ${failures.length}`);
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}${r.ok ? "" : "  ← " + formatFailure(r)}`);
  }
  const ok = expectFailures === "any" ? failures.length > 0 : failures.length === expectFailures;
  console.log(
    `预期失败数 ${expectFailures === "any" ? ">0" : expectFailures} ⇒ ${ok ? "符合" : "不符合（!）"}`
  );
  return { id, ok, results, failures };
}

line("S3-57 复跑（沙箱内最小 vitest 运行时；被测源码与测试文件都取自工作区真实文本）");
console.log(`工作区              : ${REPO_ROOT}`);
console.log(`migration.ts(修复后) sha256 : ${sha256(realSource)}`);
console.log(`migration.ts(修复前) sha256 : ${sha256(preFixSource)}  ← outputs/00a-prefix-migration.ts.txt`);
console.log(`新增测试文件          : ${NEW_TEST}`);
console.log(`新增测试文件 sha256   : ${sha256(newTestSource)}`);

const outcomes = [];
outcomes.push(
  await runScenario({
    id: "A",
    title: "先红：修复前实现 + 本轮新增测试文件",
    migrationSource: preFixSource,
    testSource: newTestSource,
    testPath: NEW_TEST,
    expectFailures: "any",
  })
);
outcomes.push(
  await runScenario({
    id: "B",
    title: "后绿：修复后实现 + 本轮新增测试文件",
    migrationSource: realSource,
    testSource: newTestSource,
    testPath: NEW_TEST,
    expectFailures: 0,
  })
);
// C0/C：既有 migration.test.ts 的左右对照（该文件里依赖 `vi.clearAllMocks` 的用例在本最小运行时下
// 因缺该 API 而失败——修复前/后同因同数，故用"失败用例集合比对"证明本单没有新增失败）
const c0 = await runScenario({
  id: "C0",
  title: "基线：修复前实现 + 既有 migration.test.ts",
  migrationSource: preFixSource,
  testSource: migrationTestSource,
  testPath: MIGRATION_TEST,
  expectFailures: "any",
});
const c1 = await runScenario({
  id: "C",
  title: "对照：修复后实现 + 既有 migration.test.ts",
  migrationSource: realSource,
  testSource: migrationTestSource,
  testPath: MIGRATION_TEST,
  expectFailures: "any",
});
{
  const before = new Set(c0.failures.map((r) => r.label));
  const after = c1.failures.map((r) => r.label);
  const newlyFailed = after.filter((label) => !before.has(label));
  console.log(
    `\n[C 对照] 修复前失败 ${c0.failures.length} 条 / 修复后失败 ${c1.failures.length} 条；` +
      `新增失败 ${newlyFailed.length} 条${newlyFailed.length ? " → " + JSON.stringify(newlyFailed) : "（无新增失败）"}`
  );
  c1.ok = newlyFailed.length === 0 && c1.failures.length <= c0.failures.length;
}
outcomes.push(c0, c1);
outcomes.push(
  await runScenario({
    id: "D",
    title: "不回归：修复后实现 + 既有 migration-split.test.ts（MIG-5/MIG-5b 守门）",
    migrationSource: realSource,
    testSource: legacySplitTestSource,
    testPath: TEST_FILE,
    expectFailures: 0,
  })
);
outcomes.push(
  await runScenario({
    id: "E",
    title: "反测 1：splitSqlStatements 退回旧 `;` 切分（其余不动）",
    migrationSource: splitterReverted.source,
    testSource: newTestSource,
    testPath: NEW_TEST,
    expectFailures: "any",
  })
);
outcomes.push(
  await runScenario({
    id: "F",
    title: "反测 2：新切分保留，但把「跳过存储过程语句」的 continue 加回去",
    migrationSource: skipRestored.source,
    testSource: newTestSource,
    testPath: NEW_TEST,
    expectFailures: "any",
  })
);

// H. 返工第 1 轮（D1-R1）：把既有 migration.test.ts 的两条过程用例逐字抽取出来同源执行 —— 左右对照
writeFileSync(REWORK_SAME_SOURCE_ARTIFACT, reworkTest.composed, "utf8");
line("[H] 返工第 1 轮专测：migration.test.ts 两条过程用例（逐字抽取，同源执行）");
console.log(`抽取来源            : ${MIGRATION_TEST}`);
console.log(`抽取行号            : ${JSON.stringify(reworkTest.ranges)}`);
console.log(`拼接测试文件 sha256 : ${sha256(reworkTest.composed)}`);
console.log(`拼接测试文件落盘    : ${REWORK_SAME_SOURCE_ARTIFACT}`);

const H_CREATE_LABEL = "存储过程语句应作为完整语句下发";
const H_DROP_LABEL = "DROP PROCEDURE 语句应作为完整语句下发";
const H_TEST_PATH = join(TEST_DIR, "d1-rework-same-source.test.ts");

async function runReworkScenario({ id, title, migrationSource, expectFailures }) {
  const outcome = await runScenario({
    id,
    title,
    migrationSource,
    testSource: reworkTest.composed,
    testPath: H_TEST_PATH,
    expectFailures,
  });
  const labels = outcome.failures.map((r) => r.label);
  outcome.createRed = labels.some((label) => label.includes(H_CREATE_LABEL));
  outcome.dropRed = labels.some((label) => label.includes(H_DROP_LABEL));
  console.log(
    `本条判定：CREATE PROCEDURE 用例 ${outcome.createRed ? "红" : "绿"} ／ DROP PROCEDURE 用例 ${outcome.dropRed ? "红" : "绿"}`
  );
  const dropFailure = outcome.failures.find((r) => r.label.includes(H_DROP_LABEL));
  if (dropFailure) console.log(`DROP PROCEDURE 用例红输出（原始）：${formatFailure(dropFailure)}`);
  return outcome;
}

const h1 = await runReworkScenario({
  id: "H1",
  title: "返工后实现（工作区）+ 同源用例 ⇒ 必须全绿",
  migrationSource: realSource,
  expectFailures: 0,
});
const h2 = await runReworkScenario({
  id: "H2",
  title: "反测 3a：splitSqlStatements 退回旧 `;` 切分 ⇒ CREATE PROCEDURE 用例必须红",
  migrationSource: splitterReverted.source,
  expectFailures: "any",
});
h2.ok = h2.createRed;
console.log(
  "反测 3a 说明：DROP PROCEDURE 用例对「旧 ; 切分」不敏感" +
    "（DROP PROCEDURE IF EXISTS test 语句体内无 ;，旧切分与新切分结果相同）" +
    " ⇒ 该用例的靶是「过程类语句被 continue 跳过」，见 H3。"
);
const h3 = await runReworkScenario({
  id: "H3",
  title: "反测 3b：把「跳过 CREATE/DROP PROCEDURE」的 continue 加回去 ⇒ 两条用例必须红",
  migrationSource: skipRestored.source,
  expectFailures: "any",
});
h3.ok = h3.createRed && h3.dropRed;
outcomes.push(h1, h2, h3);

// G. 读数：真实 092 驱动 runMigrations（假连接）
line("[G] 读数：真实 092_租户ID.sql 驱动 runMigrations（假连接捕获实际下发语句）");
{
  const readingsSource = readFileSync(READINGS_TEST_ARTIFACT, "utf8");
  const runtime = createRuntime({
    migrationSource: realSource,
    testSource: readingsSource,
    // 必须是 __tests__ 下的虚拟路径：最小运行时据此走 vitest 的 mock 提升语义
    testPath: join(TEST_DIR, "d1-readings.test.ts"),
  });
  const results = await runtime.run();
  for (const r of results) {
    if (!r.ok) console.log(`  ✗ ${r.label}  ← ${formatFailure(r)}`);
  }
  outcomes.push({ id: "G", ok: results.every((r) => r.ok), results, failures: results.filter((r) => !r.ok) });
}

line("汇总");
let allOk = true;
for (const o of outcomes) {
  if (!o.ok) allOk = false;
  console.log(`  ${o.ok ? "OK " : "NG "} [${o.id}] 失败 ${o.failures.length} 条`);
}
console.log(allOk ? "\n所有场景符合预期。" : "\n存在不符合预期的场景（!）");
process.exitCode = allOk ? 0 : 1;
