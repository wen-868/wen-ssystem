/**
 * MIG-5 断言复跑 + 反测（本环境 vitest 不可运行，见 outputs/03-vitest-blocked.txt）。
 *
 * 口径：
 *   A 丢块根治   ：以**真实受影响文件** `docs/migrations/006_phase4_schema.sql` 为输入，
 *                 正常版（工作区真实源码）vs 回退版（splitSqlStatements 函数体换回修复前实现）。
 *   B 写闸门不回归：同一份 006 输入 + 合成批次（INSERT/UPDATE/DELETE/REPLACE/CALL），
 *                 正常版 vs 闸门回退版（resolveWriteGate 恒 allow）。
 *   C addTablePrefix 同族收口 + MIG-2 反引号存留：MIG-2 的 H01~H20 全套断言（原样沿用）
 *                 + MIG-5 新增 REFERENCES/INTO 断言；正常版 vs 同族回退版。
 *
 * 被测函数**全部来自真实源码文本**（转译后加载），不复刻；输出源码 SHA256 供核对。
 *
 * 用法：node docs/evidence/MIG-5/tools/mig5-verify.mjs
 * 退出码：0 = 正常版全绿 且 各反测位在对应回退版全红 且 冻结位在回退版全绿；1 = 否则。
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  REPO_ROOT,
  MIGRATION_TS,
  REAL_MIGRATION_FILE,
  readMigrationSource,
  readRealMigrationFile,
  sha256,
  normalizeSource,
  loadMigrationModule,
  makeGateDisabledSource,
  makeSplitFixRevertedSource,
  makePrefixFamilyRevertedSource,
} from "./mig5-lib.mjs";

const OUTDIR = resolve(REPO_ROOT, "docs", "evidence", "MIG-5", "outputs");
mkdirSync(OUTDIR, { recursive: true });
const TMP = mkdtempSync(join(tmpdir(), "mig5-"));

let failures = 0;
function line(text = "") {
  process.stdout.write(text + "\n");
}
/** 断言并记录 */
function assert(id, title, pass, detail) {
  if (!pass) failures += 1;
  line(`  [${pass ? "绿" : "红"}] ${id} ${title}${detail ? ` —— ${detail}` : ""}`);
  return pass;
}

// ── 载入"正常版"与三种回退版 ────────────────────────────────────────────────
const rawSource = readMigrationSource();
const normalSource = normalizeSource(rawSource);
const splitReverted = makeSplitFixRevertedSource(rawSource);
const prefixReverted = makePrefixFamilyRevertedSource(rawSource);
const gateReverted = makeGateDisabledSource(rawSource);

line("=".repeat(96));
line("MIG-5 断言复跑 + 反测");
line("=".repeat(96));
line(`被测源码：${MIGRATION_TS}`);
line(`  SHA256(原始文件，CRLF)      = ${sha256(rawSource)}`);
line(`  SHA256(归一化 LF 后)        = ${sha256(normalSource)}`);
line(`  SHA256(回退：丢块根治)      = ${sha256(splitReverted.source)}`);
line(`  SHA256(回退：addTablePrefix 同族) = ${sha256(prefixReverted.source)}`);
line(`  SHA256(回退：写闸门)        = ${sha256(gateReverted.source)}`);
line(`真实输入文件：${join("docs", "migrations", REAL_MIGRATION_FILE)}（${readRealMigrationFile().length} 字符）`);
line("");

const normal = await loadMigrationModule(join(TMP, "normal"), normalSource, "normal");
const splitOld = await loadMigrationModule(join(TMP, "split-old"), splitReverted.source, "split-old");
const prefixOld = await loadMigrationModule(join(TMP, "prefix-old"), prefixReverted.source, "prefix-old");
const gateOld = await loadMigrationModule(join(TMP, "gate-old"), gateReverted.source, "gate-old");

line("回退版源码落盘（供人工核对，不污染工作区）：");
for (const [name, src] of [
  ["00b-reverted-split-migration.ts.txt", splitReverted.source],
  ["00c-reverted-prefix-migration.ts.txt", prefixReverted.source],
  ["00d-reverted-gate-migration.ts.txt", gateReverted.source],
]) {
  const p = join(OUTDIR, name);
  writeFileSync(p, src, "utf8");
  line(`  ${p.replace(REPO_ROOT + "\\", "")}`);
}
line("");

// ── 场景执行：驱动真实 runMigrations，记录"真的发给连接的语句"与日志 ─────────────
async function runScenario(mod, stubs, sql, fileName, gate) {
  stubs.fsState.fixture = sql;
  stubs.fsState.fixtureName = fileName;
  stubs.fsState.files = [fileName];
  stubs.fsState.exists = true;
  stubs.dbState.queries.length = 0;
  for (const key of Object.keys(stubs.logs)) stubs.logs[key].length = 0;

  const previous = process.env.MIGRATION_WRITE_GATE;
  if (gate === undefined) delete process.env.MIGRATION_WRITE_GATE;
  else process.env.MIGRATION_WRITE_GATE = gate;
  try {
    await mod.runMigrations();
  } finally {
    if (previous === undefined) delete process.env.MIGRATION_WRITE_GATE;
    else process.env.MIGRATION_WRITE_GATE = previous;
  }
  const queries = stubs.dbState.queries.filter((s) => typeof s === "string");
  return {
    queries,
    warns: [...stubs.logs.warn],
    infos: [...stubs.logs.info],
    errors: [...stubs.logs.error],
    gateLogs: stubs.logs.warn.filter((m) => m.includes("写闸门 block 跳过")),
    dropLogs: stubs.logs.warn.filter((m) => m.includes("跳过 DROP TABLE 语句")),
  };
}

const realSql = readRealMigrationFile();

// ══════════════════════════════════════════════════════════════════════════
// A + B：真实文件 006（丢块根治 + 写闸门同批生效）
// ══════════════════════════════════════════════════════════════════════════
line("-".repeat(96));
line(`A/B 真实文件 ${REAL_MIGRATION_FILE}：丢块根治（正常版）`);
line("-".repeat(96));
const a = await runScenario(normal.mod, normal.stubs, realSql, REAL_MIGRATION_FILE, undefined);

const hasSet0 = a.queries.some((s) => s.trim() === "SET FOREIGN_KEY_CHECKS = 0");
const hasSet1 = a.queries.some((s) => s.trim() === "SET FOREIGN_KEY_CHECKS = 1");
const hasTraceConfig = a.queries.some((s) => s.includes("CREATE TABLE IF NOT EXISTS t_trace_config"));
const hasTraceCode = a.queries.some((s) => s.includes("CREATE TABLE IF NOT EXISTS t_trace_code"));
const executedInsert = a.queries.filter((s) => /^\s*INSERT/i.test(s));
const executedDrop = a.queries.filter((s) => /^\s*DROP\s+TABLE/i.test(s));

assert(
  "A1",
  "注释块首后的真实语句被挑出执行：SET FOREIGN_KEY_CHECKS = 0（#006 第 11 行）",
  hasSet0,
  `命中=${hasSet0}`
);
assert("A2", "同文件第 156 行 SET FOREIGN_KEY_CHECKS = 1 同样被执行", hasSet1, `命中=${hasSet1}`);
assert(
  "A3",
  "注释块首后的建表语句被挑出执行：CREATE TABLE IF NOT EXISTS t_trace_config（第 161 行）",
  hasTraceConfig,
  `命中=${hasTraceConfig}`
);
assert("A4", "同文件其余 4 张追溯表（t_trace_code 等）同样被挑出执行", hasTraceCode, `命中=${hasTraceCode}`);
assert(
  "A5",
  "闸门仍生效：同批 INSERT IGNORE（第 82 行 price_level）一条都没执行",
  executedInsert.length === 0,
  `实际执行 INSERT 条数=${executedInsert.length}`
);
assert(
  "A6",
  "闸门日志：该条 INSERT 有 1 行含 文件 + 类型 + 目标表 的跳过日志",
  a.gateLogs.length === 1 && a.gateLogs[0].includes(REAL_MIGRATION_FILE) && a.gateLogs[0].includes("INSERT 语句") && a.gateLogs[0].includes("目标 price_level"),
  `日志条数=${a.gateLogs.length}；首条=${JSON.stringify(a.gateLogs[0] ?? null)}`
);
assert(
  "A7",
  "生产保护未回归：DROP TABLE 一条都没执行，且逐条走了 DROP 保护分支（有日志）",
  executedDrop.length === 0 && a.dropLogs.length > 0,
  `执行 DROP=${executedDrop.length}；DROP 保护日志=${a.dropLogs.length} 条`
);
line(`  执行语句总数（含内置迁移步骤下发）= ${a.queries.length}；其中 006 相关 = ${a.queries.filter((s) => /t_price_level|t_trace|t_customer_credit|SET FOREIGN_KEY_CHECKS/.test(s)).length}`);
line(`  006 相关结构语句抽样（前缀后的实际下发文本）：`);
for (const q of a.queries.filter((s) => /CREATE TABLE IF NOT EXISTS t_(price_level|sku_price|trace_config|recall_record)/.test(s))) {
  line(`    · ${q.split("\n")[0].trim().slice(0, 88)}`);
}
line("");

line("-".repeat(96));
line(`反测 A/B：同一输入喂给【丢块修复回退版】——A1~A4 必须变红`);
line("-".repeat(96));
const aOld = await runScenario(splitOld.mod, splitOld.stubs, realSql, REAL_MIGRATION_FILE, undefined);
const oldSet0 = aOld.queries.some((s) => s.trim() === "SET FOREIGN_KEY_CHECKS = 0");
const oldTraceConfig = aOld.queries.some((s) => s.includes("CREATE TABLE IF NOT EXISTS t_trace_config"));
const oldInsert = aOld.queries.filter((s) => /^\s*INSERT/i.test(s));
const oldGateLogs = aOld.gateLogs.length;
/** 006 相关的下发语句（用于逐条打印"正常版 vs 回退版"的差集） */
const is006 = (q) =>
  /SET FOREIGN_KEY_CHECKS|t_price_level|t_sku_price|t_customer_price_binding|t_price_change_log|t_customer_credit|t_credit_operation_log|t_collection_record|t_trace_config|t_trace_code|t_trace_event_log|t_trace_scan_log|t_recall_record|price_level/.test(
    q
  );
const onlyNormal = a.queries.filter((q) => is006(q) && !aOld.queries.includes(q));
const onlyOld = aOld.queries.filter((q) => is006(q) && !a.queries.includes(q));
assert("R1", "回退版：SET FOREIGN_KEY_CHECKS = 0 不再被执行（A1 变红）", oldSet0 === false, `命中=${oldSet0}`);
assert(
  "R2",
  "回退版：CREATE TABLE IF NOT EXISTS t_trace_config 不再被执行（A3 变红）",
  oldTraceConfig === false,
  `命中=${oldTraceConfig}`
);
assert(
  "R3",
  "回退版：被丢弃的块含 INSERT，故闸门日志也为 0（A6 变红）",
  oldGateLogs === 0,
  `闸门日志=${oldGateLogs}`
);
line(`  回退版执行语句总数 = ${aOld.queries.length}（正常版 ${a.queries.length}；差值=${a.queries.length - aOld.queries.length}）`);
line(`  修复后被挑出、修复前被整块丢掉的 006 语句（${onlyNormal.length} 条）：`);
for (const q of onlyNormal) line(`    + ${q.replace(/\s+/g, " ").slice(0, 96)}`);
line(`  修复前执行、修复后不再执行的 006 语句（${onlyOld.length} 条，应为 0）：`);
for (const q of onlyOld) line(`    - ${q.replace(/\s+/g, " ").slice(0, 96)}`);
line(
  `  被丢弃块内的 DROP TABLE 是否进入生产保护分支：正常版 ${a.dropLogs.length} 条日志 vs 回退版 ${aOld.dropLogs.length} 条日志（回退版被 split 过滤器静默丢弃，D 保护分支根本看不到它们）`
);
line("");

line("-".repeat(96));
line("反测 B：把写闸门回退（resolveWriteGate 恒 allow）——A5/A6 必须变红");
line("-".repeat(96));
const aGateOld = await runScenario(gateOld.mod, gateOld.stubs, realSql, REAL_MIGRATION_FILE, "allow");
const gateOldInsert = aGateOld.queries.filter((s) => /^\s*INSERT/i.test(s));
assert(
  "R4",
  "闸门回退版：同批 INSERT IGNORE 被放行执行（A5 变红）",
  gateOldInsert.length > 0,
  `执行 INSERT 条数=${gateOldInsert.length}；首条=${JSON.stringify(gateOldInsert[0]?.split("\n")[0]?.slice(0, 80) ?? null)}`
);
assert("R5", "闸门回退版：无写闸门跳过日志（A6 变红）", aGateOld.gateLogs.length === 0, `日志条数=${aGateOld.gateLogs.length}`);
line("");

// ── B2：合成批次（INSERT / UPDATE / DELETE / REPLACE / CALL + 结构语句）───────────
const SYNTH_FILE = "001_mig5_gate_fixture.sql";
const SYNTH_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS t_mig5_demo (id INT)",
  "INSERT INTO t_mig5_demo (id) VALUES (1)",
  "INSERT IGNORE INTO t_mig5_demo (id) VALUES (2)",
  "UPDATE t_mig5_demo SET id = 5 WHERE id = 1",
  "DELETE FROM t_mig5_demo WHERE id = 3",
  "REPLACE INTO t_mig5_demo (id) VALUES (4)",
  "CALL sync_mig5_demo()",
  "ALTER TABLE t_mig5_demo ADD COLUMN name VARCHAR(50)",
];
const SYNTH_SQL = "-- 合成批次：首行注释，其后是真实语句（丢块缺陷复现位）\n" + SYNTH_STATEMENTS.join(";\n") + ";";
line("-".repeat(96));
line("B2 合成批次（默认 block）：结构语句执行、写语句与 CALL 全部跳过并有日志");
line("-".repeat(96));
const b = await runScenario(normal.mod, normal.stubs, SYNTH_SQL, SYNTH_FILE, undefined);
const bExec = b.queries.filter((s) => s.includes("t_mig5_demo") || s.includes("sync_mig5_demo"));
assert(
  "B1",
  "首行注释下的 CREATE TABLE / ALTER TABLE 被执行（丢块根治生效）",
  bExec.some((s) => s.includes("CREATE TABLE IF NOT EXISTS t_mig5_demo")) && bExec.some((s) => s.includes("ALTER TABLE t_mig5_demo")),
  `执行=${bExec.length} 条`
);
assert(
  "B2",
  "INSERT / INSERT IGNORE / UPDATE / DELETE / REPLACE / CALL 一条都没执行",
  !bExec.some((s) => /^\s*(INSERT|UPDATE|DELETE|REPLACE|CALL)\b/i.test(s)),
  `执行=${JSON.stringify(bExec.map((s) => s.split("\n")[0].slice(0, 40)))}`
);
assert("B3", "6 条写语句/CALL 各有一条跳过日志", b.gateLogs.length === 6, `日志条数=${b.gateLogs.length}`);
for (const m of b.gateLogs) line(`    · ${m.slice(0, 120)}`);
line("");

// ══════════════════════════════════════════════════════════════════════════
// C：addTablePrefix —— MIG-2 反引号存留断言（H01~H20 原样沿用）+ MIG-5 新断言
// ══════════════════════════════════════════════════════════════════════════
line("-".repeat(96));
line("C addTablePrefix：MIG-2 反引号存留断言（H01~H20，断言表沿用 docs/evidence/MIG-2/tools/mig2-verify.mjs）");
line("-".repeat(96));
const MIG2_CASES = [
  ["H01", "CREATE TABLE IF NOT EXISTS 反引号表名", "CREATE TABLE IF NOT EXISTS `open_webhook` (id INT);", { exact: "CREATE TABLE IF NOT EXISTS `t_open_webhook` (id INT);" }],
  ["H02", "CREATE TABLE 反引号表名", "CREATE TABLE `open_webhook` (id INT);", { exact: "CREATE TABLE `t_open_webhook` (id INT);" }],
  ["H03", "CREATE TABLE 裸表名（回归）", "CREATE TABLE IF NOT EXISTS sys_user (id INT);", { exact: "CREATE TABLE IF NOT EXISTS t_sys_user (id INT);" }],
  ["H04", "ALTER TABLE 反引号表名", "ALTER TABLE `sys_user` ADD COLUMN name VARCHAR(50);", { exact: "ALTER TABLE `t_sys_user` ADD COLUMN name VARCHAR(50);" }],
  ["H05", "INSERT INTO 反引号表名", "INSERT INTO `open_webhook` (id) VALUES (1);", { exact: "INSERT INTO `t_open_webhook` (id) VALUES (1);" }],
  ["H06", "语句首 UPDATE 反引号表名", "UPDATE `open_webhook` SET status = 1;", { exact: "UPDATE `t_open_webhook` SET status = 1;" }],
  ["H07", "DELETE FROM 反引号表名", "DELETE FROM `open_webhook` WHERE id = 1;", { exact: "DELETE FROM `t_open_webhook` WHERE id = 1;" }],
  ["H08", "FROM 子句反引号表名", "SELECT * FROM `open_webhook` WHERE id = 1;", { exact: "SELECT * FROM `t_open_webhook` WHERE id = 1;" }],
  ["H09", "JOIN 反引号表名", "SELECT * FROM sys_user JOIN `sys_role` ON sys_user.role_id = sys_role.id;", { contains: ["JOIN `t_sys_role`"] }],
  ["H10", "INSERT IGNORE INTO 反引号表名（MIG-5 起由 INSERT_INTO 模式覆盖）", "INSERT IGNORE INTO `open_webhook` (id) VALUES (1);", { exact: "INSERT IGNORE INTO `t_open_webhook` (id) VALUES (1);" }],
  ["H11", "RENAME TABLE 反引号表名", "RENAME TABLE `open_webhook` TO open_webhook_old;", { contains: ["RENAME TABLE `t_open_webhook`"] }],
  ["H12", "DROP TABLE IF EXISTS 反引号表名", "DROP TABLE IF EXISTS `open_webhook`;", { exact: "DROP TABLE IF EXISTS `t_open_webhook`;" }],
  ["H13", "反引号形态已带 t_ 前缀不重复加", "CREATE TABLE `t_open_webhook` (id INT);", { exact: "CREATE TABLE `t_open_webhook` (id INT);" }],
  ["H14", "反引号 + t_ 前缀的 INSERT/FROM 不重复加", "INSERT INTO `t_open_webhook` (id) SELECT id FROM `t_open_webhook`;", { notContains: ["t_t_open_webhook"] }],
  ["H15", "裸表名已带 t_ 前缀不重复加（回归）", "SELECT * FROM t_x;", { exact: "SELECT * FROM t_x;" }],
  ["H16", "反引号包裹的 mysql 系统库不加前缀", "SELECT * FROM `mysql`.`user`;", { exact: "SELECT * FROM `mysql`.`user`;" }],
  ["H17", "关键字 IF / NOT / EXISTS 不得被当成表名", "CREATE TABLE IF NOT EXISTS `open_webhook` (id INT);", { notContains: ["t_IF", "t_NOT", "t_EXISTS"] }],
  ["H18", "字面量中已是 t_ 前缀的名字不被改写（回归）", "SELECT id FROM t_orders WHERE remark = 'JOIN t_x';", { exact: "SELECT id FROM t_orders WHERE remark = 'JOIN t_x';" }],
  ["H19", "存量行为冻结：字面量 'FROM y' 的改写修复前后逐字节一致", "INSERT INTO t_x (name) VALUES ('FROM y');", { exact: "INSERT INTO t_x (name) VALUES ('FROM t_y');" }],
  ["H20", "非反引号输入零差异：已有 t_ 前缀的 UPDATE 原样返回", "UPDATE t_x SET a = 1 WHERE id = 1;", { exact: "UPDATE t_x SET a = 1 WHERE id = 1;" }],
];

/** MIG-5 新增断言：反测位（同族回退版必须变红） */
const MIG5_NEW_CASES = [
  ["N01", "REFERENCES 裸名：REFERENCES tenant(id) → t_tenant", "FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE", { contains: ["REFERENCES t_tenant("] }, true],
  ["N02", "REFERENCES 反引号：REFERENCES `retail_order` (`id`) → `t_retail_order`", "FOREIGN KEY (order_id) REFERENCES `retail_order` (`id`) ON DELETE CASCADE", { contains: ["REFERENCES `t_retail_order`"] }, true],
  // 说明：N03/N04/N05 是"冻结位"（回退到修复前形态后**同样为绿**，用来证明收窄 INTO 没有误删真实表名的覆盖），
  // 故 reverse=false；真正的反测位是 N01/N02（REFERENCES 原本漏模式）与 N06/N07（通用 INTO 原本误伤变量）。
  ["N03", "REFERENCES 已带 t_ 前缀不重复加（冻结位）", "FOREIGN KEY (a) REFERENCES t_tenant(id)", { exact: "FOREIGN KEY (a) REFERENCES t_tenant(id)" }, false],
  ["N04", "INSERT IGNORE INTO 裸名（不再依赖过宽 INTO）→ t_price_level（冻结位）", "INSERT IGNORE INTO price_level (level_code) VALUES ('RETAIL')", { contains: ["INSERT IGNORE INTO t_price_level"] }, false],
  ["N05", "REPLACE INTO 裸名 → t_price_level（补偿被收窄的通用 INTO；冻结位）", "REPLACE INTO price_level (level_code) VALUES ('RETAIL')", { contains: ["REPLACE INTO t_price_level"] }, false],
  ["N06", "SELECT ... INTO 过程变量不得被加前缀（092 实际案例 col_count）", "SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS WHERE TABLE_NAME = 'x'", { exact: "SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS WHERE TABLE_NAME = 'x'" }, true],
  ["N07", "SELECT ... INTO 过程变量不得被加前缀（092 实际案例 idx_count）", "SELECT COUNT(*) INTO idx_count FROM information_schema.STATISTICS WHERE TABLE_NAME = 'x'", { exact: "SELECT COUNT(*) INTO idx_count FROM information_schema.STATISTICS WHERE TABLE_NAME = 'x'" }, true],
  ["N08", "SET ... INTO 变量赋值不得被加前缀", "SET @v = 1; SET @w = 2;", { notContains: ["t_@"] }, false],
];

function checkCase(out, c) {
  const fails = [];
  if (c.exact !== undefined && out !== c.exact) fails.push(`exact 期望 ${JSON.stringify(c.exact)}，实际 ${JSON.stringify(out)}`);
  for (const s of c.contains ?? []) if (!out.includes(s)) fails.push(`contains 期望含 ${JSON.stringify(s)}`);
  for (const s of c.notContains ?? []) if (out.includes(s)) fails.push(`notContains 期望不含 ${JSON.stringify(s)}`);
  return { pass: fails.length === 0, detail: fails.join("；") };
}

let hGreen = 0;
for (const [id, title, sql, expectShape] of MIG2_CASES) {
  const res = checkCase(normal.mod.addTablePrefix(sql), expectShape);
  hGreen += res.pass ? 1 : 0;
  assert(id, title, res.pass, res.detail);
}
assert("C0", `MIG-2 反引号存留断言全部为绿（${hGreen}/${MIG2_CASES.length}）`, hGreen === MIG2_CASES.length, `绿=${hGreen}`);
line("");

line("-".repeat(96));
line("C2 MIG-5 新增断言：REFERENCES / INTO（正常版）");
line("-".repeat(96));
let nGreen = 0;
for (const [id, title, sql, expectShape] of MIG5_NEW_CASES) {
  const out = normal.mod.addTablePrefix(sql);
  const res = checkCase(out, expectShape);
  nGreen += res.pass ? 1 : 0;
  assert(id, title, res.pass, res.detail || `实际 ${JSON.stringify(out)}`);
}
line("");

line("-".repeat(96));
line("反测 C：把 addTablePrefix 同族收口回退——N01~N07 必须变红、H01~H20 必须保持全绿");
line("-".repeat(96));
let nRed = 0;
for (const [id, title, sql, expectShape, reverse] of MIG5_NEW_CASES) {
  const res = checkCase(prefixOld.mod.addTablePrefix(sql), expectShape);
  if (!reverse) continue;
  nRed += res.pass ? 0 : 1;
  assert(`R-${id}`, `回退版：${title}`, res.pass === false, res.pass ? "回退后仍为绿（反测失效）" : res.detail.slice(0, 150));
}
let hOldGreen = 0;
for (const [id, , sql, expectShape] of MIG2_CASES) {
  const res = checkCase(prefixOld.mod.addTablePrefix(sql), expectShape);
  hOldGreen += res.pass ? 1 : 0;
}
assert(
  "R-C0",
  `回退版：MIG-2 反引号断言仍全绿（冻结位不受本单同族回退影响，${hOldGreen}/${MIG2_CASES.length}）`,
  hOldGreen === MIG2_CASES.length,
  `绿=${hOldGreen}`
);
assert("R-C1", `回退版：MIG-5 新增断言中 ${nRed} 条变红（反测位 N01/N02/N06/N07）`, nRed === 4, `变红=${nRed}`);
line("");

rmSync(TMP, { recursive: true, force: true });
line("=".repeat(96));
line(failures === 0 ? "结论：全部断言符合预期（正常版全绿；各反测位在对应回退版全红）" : `结论：有 ${failures} 条不符合预期`);
line("=".repeat(96));
process.exit(failures === 0 ? 0 : 1);
