/**
 * 凌舟（总负责人）独立审计脚本 —— MIG-5 验收用（只读，不改仓库任何文件）。
 *
 * 与执行方 `mig5-verify.mjs` 的区别（这是本脚本存在的唯一理由）：
 *   `mig5-verify.mjs` 的"修复前"用**回退变换**（把 `splitSqlStatements` 函数体换回旧实现）得到；
 *   本脚本用**真实的修复前源码**（`git show HEAD:backend/src/shared/migration.ts` 原样落盘的文件）
 *   驱动同一套 harness，验证"修复前该块不执行 / 修复后被挑出"这句话对**历史产物**也成立。
 *
 * 用法：
 *   git show HEAD:backend/src/shared/migration.ts > <临时目录>/head-migration.ts
 *   node docs/evidence/MIG-5/tools/mig5-lz-audit.mjs <临时目录>/head-migration.ts
 * 退出码：0 = 全部符合预期；1 = 有断言不符。
 */
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readMigrationSource,
  readRealMigrationFile,
  sha256,
  loadMigrationModule,
} from "./mig5-lib.mjs";

const headSource = readFileSync(process.argv[2], "utf8");
const curSource = readMigrationSource();
const realSql = readRealMigrationFile();
const TMP = mkdtempSync(join(tmpdir(), "mig5-lz-audit-"));

let failures = 0;
const out = (s = "") => process.stdout.write(s + "\n");
const check = (id, title, pass, detail) => {
  if (!pass) failures += 1;
  out(`  [${pass ? "绿" : "红"}] ${id} ${title}${detail ? ` —— ${detail}` : ""}`);
};

async function runWith(source, tag) {
  const { mod, stubs } = await loadMigrationModule(join(TMP, tag), source, tag);
  stubs.fsState.fixtureName = "006_phase4_schema.sql";
  stubs.fsState.fixture = realSql;
  stubs.fsState.files = ["006_phase4_schema.sql"];
  stubs.fsState.exists = true;
  stubs.dbState.queries.length = 0;
  for (const k of Object.keys(stubs.logs)) stubs.logs[k].length = 0;
  delete process.env.MIGRATION_WRITE_GATE; // 默认 = block
  await mod.runMigrations();
  const queries = stubs.dbState.queries
    .filter((s) => typeof s === "string")
    .map((s) => String(s).trim());
  return {
    queries,
    gateLogs: stubs.logs.warn.filter((m) => m.includes("写闸门 block 跳过")),
  };
}

const anchors = [
  "SET FOREIGN_KEY_CHECKS = 0",
  "CREATE TABLE IF NOT EXISTS t_trace_config",
  "CREATE TABLE IF NOT EXISTS t_trace_code",
  "CREATE TABLE IF NOT EXISTS t_trace_event_log",
  "CREATE TABLE IF NOT EXISTS t_trace_scan_log",
  "CREATE TABLE IF NOT EXISTS t_recall_record",
];

out("=".repeat(96));
out("凌舟独立审计：真实修复前源码（HEAD）vs 工作区源码，真实输入 docs/migrations/006_phase4_schema.sql");
out("=".repeat(96));
out(`  SHA256(HEAD 源码，git show 落盘) = ${sha256(headSource)}`);
out(`  SHA256(工作区源码)               = ${sha256(curSource)}`);
out(`  两者相同（应为 false）           = ${headSource === curSource}`);
out("");

const head = await runWith(headSource, "head");
const cur = await runWith(curSource, "current");

out("-- 修复前（HEAD 真实源码）：注释开头块内的真实语句一条都不应下发");
for (const a of anchors) {
  const hit = head.queries.some((q) => q.includes(a));
  check(`HEAD · ${a}`, "不应下发", hit === false, `命中=${hit}`);
}
check(
  "HEAD · 闸门日志",
  "被整体丢弃的块含 INSERT，闸门根本看不到它 ⇒ 日志应为 0",
  head.gateLogs.length === 0,
  `日志=${head.gateLogs.length}`
);
out(`  下发语句总数 = ${head.queries.length}`);
out("");

out("-- 修复后（工作区源码）：同一批语句应被挑出下发，且闸门仍生效");
for (const a of anchors) {
  const hit = cur.queries.some((q) => q.includes(a));
  check(`CUR · ${a}`, "应被挑出并下发", hit === true, `命中=${hit}`);
}
const doublePrefix = cur.queries.filter((q) => q.includes("t_t_"));
check("CUR · 双前缀", "已带 t_ 的建表名不得变成 t_t_", doublePrefix.length === 0, `命中=${doublePrefix.length}`);
const execInsert = cur.queries.filter((q) => /^INSERT/i.test(q));
check(
  "CUR · 写闸门",
  "同批 INSERT 在默认 block 下被跳过且有日志（MIG-4 存留）",
  cur.gateLogs.length >= 1 && execInsert.length === 0,
  `闸门日志=${cur.gateLogs.length} / 执行 INSERT=${execInsert.length}`
);
out(`  下发语句总数 = ${cur.queries.length}`);
out("");

const lost = head.queries.filter((q) => !cur.queries.includes(q));
out(`-- 反向丢失检查：修复前有、修复后没有的语句 = ${lost.length} 条（应为 0）`);
for (const l of lost.slice(0, 10)) out(`     - ${l.slice(0, 90)}`);
check("NO-REVERSE-LOSS", "不得出现反向丢失", lost.length === 0, `丢失=${lost.length}`);

const gained = cur.queries.filter((q) => !head.queries.includes(q));
out(`-- 修复后新增下发 = ${gained.length} 条`);
for (const g of gained) out(`     + ${g.slice(0, 90)}`);

out("");
out(`结论：${failures === 0 ? "全部符合预期（EXIT=0）" : `有 ${failures} 条不符（EXIT=1）`}`);
process.exit(failures === 0 ? 0 : 1);
