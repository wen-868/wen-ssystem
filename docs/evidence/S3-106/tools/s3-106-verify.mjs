/**
 * S3-106 复跑脚本（沙箱内，vitest 起不来的替代取证）：
 *   把下面几件事在**同一份最小 vitest 运行时**里跑出原始输出，并先落盘再截尾读回。
 *
 *   [A] 修复后：工作区实现 + 本单新增守门文件 `migration-drop-guard.test.ts` ⇒ 必须全绿；
 *   [B] 反测①（本单 ③ 主反测）：第 8 步保护回退成**文本包含式**（原实现逐字写法）
 *       ⇒ "(b) 过程体内部含 DROP TABLE 字样时不再被跳过" 必须变红，且 (a) 仍绿；
 *   [B2] 反测②（补充）：判定函数本体也回退成文本包含式 ⇒ 函数级断言同时变红；
 *   [C] 回归：既有 3 个守门文件（split / write-gate / delimiter）跑真实实现 ⇒ 0 红（未放宽/删除既有断言）；
 *   [D] 影响面：`docs/migrations/*.sql` 里 `DROP TABLE` 的全部命中逐条列出并给出改造后判定；
 *   [E] 读数：真实实现下"下发语句数 / 保护日志条数 / 过程体是否下发"。
 *
 * 用法：`node docs/evidence/S3-106/tools/s3-106-verify.mjs`（EXIT=0 表示所有预期都成立）
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DROP_GUARD_TEST_FILE,
  EXISTING_GUARD_TEST_FILES,
  REPO_ROOT,
  MIGRATION_TS,
  createRuntime,
  makeDropGuardCallSiteRevertedSource,
  makeDropGuardFullyRevertedSource,
  readRealMigrationSource,
  readTestSource,
  sha256,
} from "./s3-106-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, "..", "outputs");
mkdirSync(OUTPUT_DIR, { recursive: true });

const LOG = [];
const out = (text = "") => {
  console.log(text);
  LOG.push(text);
};
const line = (title) => out(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);

/** 沙箱禁止 spawn 子进程（node child_process = EPERM），故直接读 .git 文件取分支与 HEAD（只读） */
function readGitHead() {
  try {
    const dotGit = join(REPO_ROOT, ".git");
    let gitDir = dotGit;
    const dotGitContent = readFileSync(dotGit, "utf8").trim();
    if (dotGitContent.startsWith("gitdir: ")) gitDir = resolve(REPO_ROOT, dotGitContent.slice(8).trim());
    const headFile = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (!headFile.startsWith("ref: ")) return headFile.slice(0, 12);
    const refPath = join(gitDir, ...headFile.slice(5).split("/"));
    if (readFileSync && refPath && headFile) {
      try {
        return `${headFile.slice(5)} @ ${readFileSync(refPath, "utf8").trim().slice(0, 12)}`;
      } catch {
        return `${headFile.slice(5)} @ (ref 未展开，见 outputs/worktree-status)`;
      }
    }
    return headFile;
  } catch (error) {
    return `(读不到 .git/HEAD：${error.message})`;
  }
}

const realSource = readRealMigrationSource();
const newTestSource = readTestSource(DROP_GUARD_TEST_FILE);
const callSiteReverted = makeDropGuardCallSiteRevertedSource(realSource);
const fullyReverted = makeDropGuardFullyRevertedSource(realSource);

line("[0] 环境与指纹");
out(`工作区            : ${REPO_ROOT}`);
out(`分支/HEAD         : ${readGitHead()}`);
out(`migration.ts      : ${MIGRATION_TS}`);
out(`  sha256          : ${sha256(realSource)}`);
out(`新增守门测试文件   : ${DROP_GUARD_TEST_FILE}`);
out(`  sha256          : ${sha256(newTestSource)}`);
out(`回退①（调用点→文本包含式）已定位替换：${callSiteReverted.from} → ${callSiteReverted.to}`);
out(`回退②（调用点+函数体）已定位替换：isDropTableStatement 收窄函数体 → 文本包含式`);

const scenarios = [
  {
    id: "A",
    title: "修复后：工作区实现 + 新增守门文件",
    migrationSource: realSource,
    testSource: newTestSource,
    testPath: DROP_GUARD_TEST_FILE,
    expect: { tests: 5, failures: 0 },
    mustBeGreen: ["(a) 真 DROP TABLE 仍被跳过", "(b) 过程体内部含 DROP TABLE 字样时不再被跳过"],
  },
  {
    id: "B",
    title: "反测①：第 8 步保护改回文本包含式（原实现逐字写法）",
    migrationSource: callSiteReverted.source,
    testSource: newTestSource,
    testPath: DROP_GUARD_TEST_FILE,
    expect: { tests: 5, failures: 1, mustFailContains: "(b) 过程体内部含 DROP TABLE 字样时不再被跳过" },
    mustBeGreen: ["(a) 真 DROP TABLE 仍被跳过"],
  },
  {
    id: "B2",
    title: "反测②：判定函数本体也回退成文本包含式（调用点+函数体）",
    migrationSource: fullyReverted.source,
    testSource: newTestSource,
    testPath: DROP_GUARD_TEST_FILE,
    expect: { tests: 5, failures: 3, mustFailContains: "(b) 过程体内部含 DROP TABLE 字样时不再被跳过" },
    mustBeGreen: ["(a) 真 DROP TABLE 仍被跳过"],
  },
];

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

  const failures = results.filter((r) => !r.ok);
  out(`用例：${results.length} 条，红 ${failures.length} 条`);
  for (const result of results) {
    out(`  ${result.ok ? "✓" : "✗"} ${result.label}  (${result.ms}ms)`);
    if (!result.ok) out(`      → ${result.error?.name}: ${String(result.error?.message).split("\n")[0]}`);
  }
}

line("[C] 回归：既有守门文件（真实实现，未改动；口径＝未放宽/删除任何既有断言）");
/**
 * harness 能力边界：本 harness 的 `vi.fn()` 只提供 calls / 返回值等基本能力，**未实现 vitest spy 匹配器**，
 * 因此 `toHaveBeenCalledWith(expect.stringContaining(...))` 两条用例在 harness 内必然报
 * `TypeError: [Function fn] is not a spy or a call to a spy!` —— 这是 harness 覆盖缺口，不是回归；
 * 其断言语义（写闸门 info 日志声明取值）在 [C2] 用同一运行时的读数补证。
 */
const REGRESSION_EXPECT = {
  "migration-split.test.ts": { failures: 0 },
  "migration-write-gate.test.ts": {
    failures: 2,
    harnessLimited: [
      "默认挡：info 日志声明本次运行生效的闸门取值",
      "显式放行（MIGRATION_WRITE_GATE=allow）：同一组语句全部执行，且不再有跳过日志",
    ],
  },
  "migration-delimiter.test.ts": { failures: 0 },
};
const regression = [];
for (const testFile of EXISTING_GUARD_TEST_FILES) {
  const runtime = createRuntime({ migrationSource: realSource, testSource: readTestSource(testFile), testPath: testFile });
  const results = await runtime.run();
  const failures = results.filter((r) => !r.ok);
  const shortName = testFile.split(/[\\/]/).pop();
  regression.push({ testFile, shortName, runtime, results, failures });
  out(`\n${shortName}：${results.length} 条，红 ${failures.length} 条（预期红 ${REGRESSION_EXPECT[shortName]?.failures ?? 0} 条）`);
  for (const result of failures) {
    out(`  ✗ ${result.label} → ${result.error?.name}: ${String(result.error?.message).split("\n")[0]}`);
  }
}

line("[C2] 补证：写闸门 info 日志声明取值（同一运行时读数，替代 harness 不支持的 spy 匹配器）");
const c2Proof = [];
{
  const wg = regression.find((r) => r.shortName === "migration-write-gate.test.ts");
  const fsStub = wg.runtime.mockExports.get("fs");
  const mysqlStub = wg.runtime.mockExports.get("mysql2/promise");
  const loggerKey = [...wg.runtime.mockExports.keys()].find((k) => String(k).endsWith("logger.ts"));
  const loggerStub = wg.runtime.mockExports.get(loggerKey);
  if (!fsStub || !mysqlStub || !loggerStub) {
    out(`读数不可用：fs=${!!fsStub} mysql=${!!mysqlStub} logger=${!!loggerStub}`);
  } else {
    fsStub.readdirSync.mockReturnValue(["001_test.sql"]);
    fsStub.existsSync.mockReturnValue(true);
    fsStub.readFileSync.mockReturnValue("SELECT 1;");
    const connection = await mysqlStub.default.createConnection();
    connection.query.mockReset();
    connection.query.mockResolvedValue([{ affectedRows: 0 }]);
    const migration = wg.runtime.loadMigrationModule();
    for (const gate of [undefined, "allow"]) {
      for (const bucket of ["info", "warn", "error", "debug"]) loggerStub.default[bucket].mockClear?.();
      if (gate === undefined) delete process.env.MIGRATION_WRITE_GATE;
      else process.env.MIGRATION_WRITE_GATE = gate;
      await migration.runMigrations();
      const infos = loggerStub.default.info.mock.calls.map((c) => String(c[0]));
      const declaration = infos.find((m) => m.includes("外部迁移写闸门="));
      out(`  MIGRATION_WRITE_GATE=${gate === undefined ? "(未设置)" : gate} ⇒ ${declaration ?? "(未找到闸门声明日志)"}`);
      const ok = gate === undefined ? !!declaration?.includes("block（默认）") : !!declaration?.includes("allow（显式配置）");
      c2Proof.push(ok);
      out(`     语义自证：${ok}`);
    }
    delete process.env.MIGRATION_WRITE_GATE;
  }
}

line("[E] 读数：用**真实迁移文件**驱动 runMigrations（006＝DROP TABLE 组，092＝过程体组）");
const realFileReadings = {};
{
  const { runtime } = outputs.get("A");
  const fsStub = runtime.mockExports.get("fs");
  const mysqlStub = runtime.mockExports.get("mysql2/promise");
  const loggerKey = [...runtime.mockExports.keys()].find((k) => String(k).endsWith("logger.ts"));
  const loggerStub = loggerKey ? runtime.mockExports.get(loggerKey) : undefined;
  if (!fsStub || !mysqlStub || !loggerStub) {
    out(`读数不可用：fs=${!!fsStub} mysql=${!!mysqlStub} logger=${!!loggerStub}（loggerKey=${loggerKey}）`);
  } else {
    const connection = await mysqlStub.default.createConnection();
    const mockQuery = connection.query;
    const migration = runtime.loadMigrationModule();
    for (const fileName of ["006_phase4_schema.sql", "092_租户ID.sql"]) {
      const realSql = readFileSync(join(REPO_ROOT, "docs", "migrations", fileName), "utf8");
      mockQuery.mockReset();
      mockQuery.mockResolvedValue([{ affectedRows: 0 }]);
      for (const bucket of ["info", "warn", "error", "debug"]) loggerStub.default[bucket].mockClear?.();
      fsStub.readFileSync.mockImplementation((p) => (String(p).endsWith(fileName) ? realSql : "SELECT 1;"));
      fsStub.readdirSync.mockReturnValue([fileName]);
      fsStub.existsSync.mockReturnValue(true);
      await migration.runMigrations();

      const delivered = mockQuery.mock.calls.map((c) => c[0]).filter((s) => typeof s === "string");
      const warns = loggerStub.default.warn.mock.calls.map((c) => String(c[0]));
      const dropLogs = warns.filter((m) => m.includes("跳过 DROP TABLE"));
      const routines = delivered.filter((s) => /^\s*CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?PROCEDURE\b/i.test(s));
      const reading = {
        delivered: delivered.length,
        dropDelivered: delivered.filter((s) => /^\s*DROP\s+TABLE/i.test(s)).length,
        dropGuardLogs: dropLogs,
        routines: routines.length,
        routineNames: routines.map((s) => (s.match(/PROCEDURE\s+`?([A-Za-z0-9_]+)/i) ?? [])[1]).filter(Boolean),
        dropProcedureDelivered: delivered.filter((s) => /^\s*DROP\s+PROCEDURE/i.test(s)).length,
      };
      realFileReadings[fileName] = reading;
      out(`\n  ${fileName}：`);
      out(`      下发语句总数                : ${reading.delivered}`);
      out(`      DROP TABLE 下发条数          : ${reading.dropDelivered}（新口径下应为 0）`);
      out(`      DROP TABLE 保护日志条数      : ${reading.dropGuardLogs.length}`);
      if (reading.dropGuardLogs.length) out(`        ↳ 例：${reading.dropGuardLogs[0]}`);
      out(`      过程定义下发条数            : ${reading.routines}（${reading.routineNames.join(" / ") || "无"}）`);
      out(`      DROP PROCEDURE 下发条数      : ${reading.dropProcedureDelivered}（不是 DROP TABLE，本就不该被拦）`);
    }
    delete process.env.MIGRATION_WRITE_GATE;
  }
}

line("[D] 影响面：docs/migrations 里 DROP TABLE 的全部命中与改造后判定");
const migrationsDir = join(REPO_ROOT, "docs", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();
const migrationModule = outputs.get("A").runtime.loadMigrationModule();

const lineHits = [];
const stmtHits = [];
for (const file of migrationFiles) {
  const raw = readFileSync(join(migrationsDir, file), "utf8");
  raw.split(/\r?\n/).forEach((text, index) => {
    if (/DROP\s+TABLE/i.test(text)) lineHits.push({ file, line: index + 1, text: text.trim() });
  });
  const cleaned = raw
    .split("\n")
    .filter((l) => !l.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  for (const stmt of migrationModule.splitSqlStatements(cleaned)) {
    if (!/DROP\s+TABLE/i.test(stmt)) continue;
    stmtHits.push({
      file,
      firstKeyword: migrationModule.firstKeyword(stmt),
      blockedNew: migrationModule.isDropTableStatement(stmt),
      blockedOld: true, // 旧口径＝文本包含，凡 contains 即拦
      head: stmt.replace(/\s+/g, " ").trim().slice(0, 96),
    });
  }
}

out(`扫描文件数（*.sql，与 runner 同口径排除 add_tenant_id.sql）：${migrationFiles.length}`);
out(`\n一、行级命中（rg -n "DROP\\s+TABLE" docs/migrations 等价）：共 ${lineHits.length} 条，逐条列出：`);
for (const hit of lineHits) {
  const isCommentOnly = /^(--|#)/.test(hit.text);
  out(`  ${hit.file}:${hit.line}  ${isCommentOnly ? "[整行注释]" : "[SQL 语句文本]"}  ${hit.text}`);
}

out(`\n二、语句级判定（用真实 splitSqlStatements + isDropTableStatement 跑真实文件）：共 ${stmtHits.length} 条 含 DROP TABLE 字样的语句`);
for (const hit of stmtHits) {
  const verdict = hit.blockedNew ? "仍被拦（本条语句以 DROP TABLE 开头）" : "放行";
  out(`  ${hit.file}  首关键字=${hit.firstKeyword || "(空)"}  新口径=${verdict}  旧口径=整条静默跳过`);
  out(`      ${hit.head}…`);
}
const rescuedStmts = stmtHits.filter((h) => h.blockedNew === false);
out(`\n三、差值（旧口径会静默跳过、新口径放行的语句数）：${rescuedStmts.length}`);
for (const hit of rescuedStmts) {
  out(`  ${hit.file}  首关键字=${hit.firstKeyword || "(空)"}  ← 旧口径会把整条静默跳过`);
}
out(`四、结论：真 DROP TABLE 语句被拦 ${stmtHits.filter((h) => h.blockedNew).length} 条；` +
  `因"文本包含"被误伤的语句 ${rescuedStmts.length} 条（改造后照常执行）。`);

line("结论");
let failed = 0;
const verdict = (ok, text) => {
  if (!ok) failed += 1;
  out(`${ok ? "✓" : "✗"} ${text}`);
};
for (const scenario of scenarios) {
  const results = outputs.get(scenario.id).results;
  const failures = results.filter((r) => !r.ok);
  verdict(
    results.length === scenario.expect.tests && failures.length === scenario.expect.failures,
    `[${scenario.id}] 用例 ${results.length}（预期 ${scenario.expect.tests}）/ 红 ${failures.length}（预期 ${scenario.expect.failures}）`
  );
  if (scenario.expect.mustFailContains) {
    verdict(
      failures.some((f) => f.label.includes(scenario.expect.mustFailContains)),
      `[${scenario.id}] 预期变红用例命中：${scenario.expect.mustFailContains}`
    );
  }
  for (const label of scenario.mustBeGreen ?? []) {
    const hit = results.find((r) => r.label.includes(label));
    verdict(!!hit && hit.ok, `[${scenario.id}] 应保持绿：${label}`);
  }
}
for (const { shortName, results, failures } of regression) {
  const expected = REGRESSION_EXPECT[shortName] ?? { failures: 0 };
  verdict(
    results.length > 0 && failures.length === expected.failures,
    `[C] ${shortName} 用例 ${results.length} / 红 ${failures.length}（预期红 ${expected.failures}）`
  );
  if (expected.harnessLimited) {
    verdict(
      expected.harnessLimited.every((label) => {
        const hit = failures.find((f) => f.label.includes(label));
        return !!hit && String(hit.error?.message).includes("is not a spy");
      }),
      `[C] ${shortName} 的 ${expected.failures} 条红均为 harness 缺 spy 匹配器（非回归）`
    );
  }
}
verdict(
  c2Proof.length === 2 && c2Proof.every(Boolean),
  "[C2] 写闸门 info 日志声明取值：block（默认）与 allow（显式配置）两条语义自证成立"
);
verdict(
  stmtHits.filter((h) => h.blockedNew).length === lineHits.filter((h) => !/^(--|#)/.test(h.text)).length,
  `[D] 语句级"仍被拦"条数（${stmtHits.filter((h) => h.blockedNew).length}）＝行级非注释命中条数（${lineHits.filter((h) => !/^(--|#)/.test(h.text)).length}）`
);
{
  const r006 = realFileReadings["006_phase4_schema.sql"];
  const r092 = realFileReadings["092_租户ID.sql"];
  verdict(
    !!r006 && r006.dropDelivered === 0 && r006.dropGuardLogs.length > 0,
    `[E] 006：DROP TABLE 下发 ${r006?.dropDelivered} 条（预期 0）、保护日志 ${r006?.dropGuardLogs.length} 条（预期 >0）`
  );
  verdict(
    !!r092 && r092.routines >= 2 && r092.dropGuardLogs.length === 0,
    `[E] 092：过程定义下发 ${r092?.routines} 条（预期 ≥2）、DROP TABLE 保护日志 ${r092?.dropGuardLogs.length} 条（预期 0）`
  );
}

out(`\nEXIT=${failed === 0 ? 0 : 1}`);

const outputPath = join(OUTPUT_DIR, "01-s3-106-verify.txt");
writeFileSync(outputPath, `${LOG.join("\n")}\n`, "utf8");
console.log(`\n（原始输出已落盘：${outputPath}）`);
process.exit(failed === 0 ? 0 : 1);
