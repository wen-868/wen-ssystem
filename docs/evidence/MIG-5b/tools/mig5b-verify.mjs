/**
 * MIG-5b 复跑脚本：把下面 5 件事**在同一份运行时里跑出原始输出**（先落盘再截尾读回）。
 *
 *   0. 口径自证：vitest 真实 `normalizeModuleId("node:fs")` 与 `("fs")` 是否撞同一个 mock key
 *      —— 这是 MIG-5 两条红的根因判定依据（事实 4 的证实/推翻）。
 *   A. 旧口径复现：**修复前的测试文件**（outputs/00a-…）跑真实实现 ⇒ 必须复现凌舟报的 2 条红
 *      （且失败文案必须逐字一致：`expected false to be true` / `expected [] to have a length of 1 but got +0`）
 *      —— 复现成功同时证明"本 harness 与真实 vitest 同口径"。
 *   B. 修复后：**工作区测试文件**跑真实实现 ⇒ 9 条用例全绿（0 红）。
 *   C. 反测 1（必做）：`splitSqlStatements` 回退成旧的 `filter(s => !s.startsWith("--"))` ⇒
 *      "注释块首之后的真实语句被挑出执行" 必须变红。
 *   D. 反测 2（选做）：写闸门恒 `allow` ⇒ "恰好 1 条闸门日志" 必须变红（0 条 + INSERT 被下发）。
 *
 * 用法：`node docs/evidence/MIG-5b/tools/mig5b-verify.mjs`（EXIT=0 表示所有预期都成立）
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BACKEND_SRC,
  MIGRATION_TS,
  PRE_FIX_TEST_ARTIFACT,
  TEST_DIR,
  TEST_FILE,
  REPO_ROOT,
  createRuntime,
  readRealMigrationSource,
  readTestSource,
  sha256,
  vitestInternals,
} from "./mig5b-harness.mjs";
import { makeSplitFixRevertedSource } from "../../MIG-5/tools/mig5-lib.mjs";
import { makeGateDisabledSource } from "../../MIG-4/tools/mig4-lib.mjs";

const REAL_SQL = readFileSync(join(REPO_ROOT, "docs", "migrations", "006_phase4_schema.sql"), "utf8");
const REAL_FILE = "006_phase4_schema.sql";
const loggerKey = vitestInternals.normalizeModuleId(join(BACKEND_SRC, "shared", "logger.ts"));

const line = (title) => console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);

const realSource = readRealMigrationSource();
const fixedTestSource = readTestSource(TEST_FILE);
const preFixTestSource = readTestSource(PRE_FIX_TEST_ARTIFACT);
const splitReverted = makeSplitFixRevertedSource(realSource);
const gateDisabled = makeGateDisabledSource(realSource);

// 沙箱禁止 spawn 子进程（git 起不来），故直接读 .git 文件取分支与 HEAD（只读）
const head = (() => {
  try {
    // 链接工作区里 .git 是**文件**（`gitdir: …`），普通仓库里 .git 是目录
    const dotGit = join(REPO_ROOT, ".git");
    let gitDir = dotGit;
    if (!existsSync(dotGit)) return "(没有 .git)";
    const dotGitContent = readFileSync(dotGit, "utf8").trim();
    if (dotGitContent.startsWith("gitdir: ")) gitDir = resolve(REPO_ROOT, dotGitContent.slice(8).trim());
    const headFile = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (!headFile.startsWith("ref: ")) return headFile.slice(0, 12);
    const refPath = join(gitDir, ...headFile.slice(5).split("/"));
    if (existsSync(refPath)) return `${headFile.slice(5)} @ ${readFileSync(refPath, "utf8").trim().slice(0, 12)}`;
    // ref 被打包进 packed-refs（沙箱里 git 起不来，故手工检索）
    const packedRefs = join(gitDir, "packed-refs");
    if (existsSync(packedRefs)) {
      const hit = readFileSync(packedRefs, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.endsWith(` ${headFile.slice(5)}`));
      if (hit) return `${headFile.slice(5)} @ ${hit.split(" ")[0].slice(0, 12)}`;
    }
    return `${headFile.slice(5)} @ (HEAD 哈希见 outputs/05-worktree-status.txt)`;
  } catch (error) {
    return `(读不到 .git/HEAD：${error.message})`;
  }
})();

line("MIG-5b 复跑（沙箱内最小 vitest 运行时；被测源码与测试文件都取自工作区真实文本）");
console.log(`工作区     : ${REPO_ROOT}`);
console.log(`分支/HEAD  : ${head}`);
console.log(`vitest 归一化真源 : ${vitestInternals.chunkPath}`);
console.log(`migration.ts sha256 : ${sha256(realSource)}`);
console.log(`测试文件(修复后) sha256 : ${sha256(fixedTestSource)}`);
console.log(`测试文件(修复前) sha256 : ${sha256(preFixTestSource)}  ← outputs/00a-pre-fix-migration-split.test.ts.txt`);

line("[0] 口径自证：vi.mock(\"fs\") 与 import ... from \"node:fs\" 是否撞同一个 mock key");
console.log(`normalizeModuleId("node:fs") = ${JSON.stringify(vitestInternals.normalizeModuleId("node:fs"))}`);
console.log(`normalizeModuleId("fs")      = ${JSON.stringify(vitestInternals.normalizeModuleId("fs"))}`);
console.log(
  `⇒ ${vitestInternals.normalizeModuleId("node:fs") === vitestInternals.normalizeModuleId("fs") ? "同一个 key ⇒ node:fs 会被 vi.mock(\"fs\") 命中（根因证实）" : "不同 key ⇒ 根因不成立"}`
);

const scenarios = [
  {
    id: "A",
    title: "旧口径复现：修复前的测试文件 + 工作区实现",
    migrationSource: realSource,
    testSource: preFixTestSource,
    testPath: join(TEST_DIR, "00a-pre-fix-migration-split.test.ts"),
    expect: { tests: 9, failures: 2 },
  },
  {
    id: "B",
    title: "修复后：工作区测试文件 + 工作区实现",
    migrationSource: realSource,
    testSource: fixedTestSource,
    testPath: TEST_FILE,
    expect: { tests: 9, failures: 0 },
  },
  {
    id: "C",
    title: "反测 1：splitSqlStatements 回退成旧的 filter(s => !s.startsWith(\"--\"))",
    migrationSource: splitReverted.source,
    testSource: fixedTestSource,
    testPath: TEST_FILE,
    // 回退后：两条 MIG-5 真文件用例 + 两条 splitSqlStatements 守门用例（#13 原意）同时变红 = 4
    expect: {
      tests: 9,
      failures: 4,
      mustFailContains: "注释块首之后的真实语句被挑出执行",
      mustFailAlso: "闸门仍生效",
    },
  },
  {
    id: "D",
    title: "反测 2：写闸门恒 allow（resolveWriteGate 回退）",
    migrationSource: gateDisabled.source,
    testSource: fixedTestSource,
    testPath: TEST_FILE,
    // 回退后：只有"闸门仍生效"变红（INSERT 被放行下发 ⇒ 日志 0 条 + INSERT 进入下发集合）
    expect: { tests: 9, failures: 1, mustFailContains: "闸门仍生效" },
  },
];

const verdicts = [];
const outputs = new Map();

for (const scenario of scenarios) {
  line(`[${scenario.id}] ${scenario.title}`);
  const runtime = createRuntime({
    migrationSource: scenario.migrationSource,
    testSource: scenario.testSource,
    testPath: scenario.testPath,
  });
  const results = await runtime.run();
  outputs.set(scenario.id, { runtime, results });

  const mockKeys = [...runtime.mocks.keys()];
  console.log(`mock 注册表 keys（vitest 口径）: ${JSON.stringify(mockKeys, null, 0)}`);
  console.log(`用例：${results.length} 条，红 ${results.filter((r) => !r.ok).length} 条\n`);
  for (const result of results) {
    console.log(`${result.ok ? "  ✓" : "  ✗"} ${result.label}  (${result.ms}ms)`);
    if (!result.ok) console.log(`      → ${result.error?.name}: ${String(result.error?.message).split("\n")[0]}`);
  }

  const failures = results.filter((r) => !r.ok);
  const problems = [];
  if (results.length !== scenario.expect.tests) {
    problems.push(`用例数 ${results.length} ≠ 预期 ${scenario.expect.tests}`);
  }
  if (failures.length !== scenario.expect.failures) {
    problems.push(`红条数 ${failures.length} ≠ 预期 ${scenario.expect.failures}`);
  }
  if (scenario.expect.mustFailContains) {
    const hit = failures.some((f) => f.label.includes(scenario.expect.mustFailContains));
    if (!hit) problems.push(`预期变红的用例未命中：${scenario.expect.mustFailContains}`);
  }
  if (scenario.expect.mustFailAlso) {
    const hit = failures.some((f) => f.label.includes(scenario.expect.mustFailAlso));
    if (!hit) problems.push(`预期变红的用例未命中：${scenario.expect.mustFailAlso}`);
  }
  if (scenario.id === "A") {
    const messages = failures.map((f) => String(f.error?.message).split("\n")[0]);
    const expectedMessages = ["expected false to be true", "expected [] to have a length of 1 but got +0"];
    for (const expected of expectedMessages) {
      if (!messages.some((m) => m.startsWith(expected))) {
        problems.push(`未复现凌舟报的失败文案：${expected}（实际：${JSON.stringify(messages)}）`);
      }
    }
  }
  verdicts.push({ scenario, problems });
  console.log(problems.length ? `\n  ✗ 预期不符：${problems.join("；")}` : "\n  ✓ 与预期一致");
}

line("[B’] 读数（B 场景同一运行时的原始读数：006 相关下发语句 / 闸门日志 / 保护分支）");
{
  const { runtime } = outputs.get("B");
  const fsStub = runtime.mockExports.get("fs");
  const mysqlStub = runtime.mockExports.get("mysql2/promise");
  const loggerStub = runtime.mockExports.get(loggerKey);
  if (!fsStub || !mysqlStub || !loggerStub) {
    console.log(`读数不可用：fs=${!!fsStub} mysql=${!!mysqlStub} logger=${!!loggerStub}（key=${loggerKey}）`);
  } else {
    const connection = await mysqlStub.default.createConnection();
    const mockQuery = connection.query;
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
    fsStub.readFileSync.mockImplementation((p) => (String(p).endsWith(REAL_FILE) ? REAL_SQL : "SELECT 1;"));
    fsStub.readdirSync.mockReturnValue([REAL_FILE]);
    fsStub.existsSync.mockReturnValue(true);
    for (const bucket of ["info", "warn", "error", "debug"]) loggerStub.default[bucket].mockClear?.();
    const migration = runtime.loadMigrationModule();
    await migration.runMigrations();

    const MARKERS = [
      "SET FOREIGN_KEY_CHECKS",
      "t_price_level",
      "t_sku_price",
      "t_customer_price_binding",
      "t_price_change_log",
      "t_customer_credit",
      "t_credit_operation_log",
      "t_collection_record",
      "t_trace_config",
      "t_trace_code",
      "t_trace_event_log",
      "t_trace_scan_log",
      "t_recall_record",
      "price_level",
    ];
    const all = mockQuery.mock.calls.map((c) => c[0]).filter((s) => typeof s === "string");
    const marked = all.filter((s) => MARKERS.some((m) => s.includes(m)));
    const warns = loggerStub.default.warn.mock.calls.map((c) => String(c[0]));
    const gateLogs = warns.filter((m) => m.includes("写闸门 block 跳过"));
    const dropLogs = warns.filter((m) => m.includes("跳过 DROP TABLE"));
    console.log(`下发语句总数                : ${all.length}`);
    console.log(`006 相关（含真实内容）       : ${marked.length}`);
    console.log(`SET FOREIGN_KEY_CHECKS = 0 : ${marked.some((s) => s.trim() === "SET FOREIGN_KEY_CHECKS = 0")}`);
    console.log(`SET FOREIGN_KEY_CHECKS = 1 : ${marked.some((s) => s.trim() === "SET FOREIGN_KEY_CHECKS = 1")}`);
    for (const table of ["t_trace_config", "t_trace_code", "t_trace_event_log", "t_trace_scan_log", "t_recall_record"]) {
      console.log(`CREATE TABLE IF NOT EXISTS ${table} : ${marked.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${table}`))}`);
    }
    console.log(`INSERT 下发条数             : ${marked.filter((s) => /^\s*INSERT/i.test(s)).length}`);
    console.log(`DROP TABLE 下发条数         : ${marked.filter((s) => /^\s*DROP\s+TABLE/i.test(s)).length}`);
    console.log(`写闸门 block 跳过日志条数    : ${gateLogs.length}`);
    console.log(`  ↳ ${gateLogs[0] ?? "(无)"}`);
    console.log(`DROP 生产保护日志条数        : ${dropLogs.length}`);
  }
}

line("结论");
let failed = 0;
for (const { scenario, problems } of verdicts) {
  if (problems.length) {
    failed += 1;
    console.log(`✗ [${scenario.id}] ${scenario.title} — ${problems.join("；")}`);
  } else {
    console.log(`✓ [${scenario.id}] ${scenario.title}`);
  }
}
console.log(`\nEXIT=${failed === 0 ? 0 : 1}`);
process.exit(failed === 0 ? 0 : 1);
