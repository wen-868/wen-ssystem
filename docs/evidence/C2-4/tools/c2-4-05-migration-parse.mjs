/**
 * C2-4 核验④（可独立验证的那部分）：`docs/migrations/171_platform_templates.sql` 在**真实迁移 runner 语义**下
 * 到底会不会被执行 —— 即「生产 4 张新表已建」这个自报结论的**仓库侧必要条件**。
 *
 * 为什么查这个：项目有过「以注释开头的整块语句被 runner 丢弃」的历史缺陷（踩坑日志[63]，
 * 曾导致上百张 CREATE TABLE 静默失效）。只要 171 的语句块以注释开头，4 张表就**不会**被建出来 ——
 * 这会直接推翻自报结论 ④。本工具按 `backend/src/shared/migration.ts:894-931` 的**逐行/逐块规则**做离线复演。
 *
 * 同时做**全量影响面扫描**（技术债铁律：同一缺陷多处分现必须给数字）。
 *
 * 用法：node docs/evidence/C2-4/tools/c2-4-05-migration-parse.mjs
 * 退出码：0 = 171 判定为「会被执行」且反测通过；1 = 171 会被丢弃 / 反测失败
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(".");
const MIG_DIR = join(REPO, "docs/migrations");
const lines = [];
const log = (s = "") => lines.push(s);
const failures = [];

/** 复演 runner：先删 USE/DELIMITER 行 ⇒ 按 ";" 切 ⇒ trim ⇒ 丢弃空块与「以 -- 开头」的块 */
function simulateRunner(sql) {
  const cleaned = sql
    .split("\n")
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
    })
    .join("\n");

  const executed = [];
  const dropped = [];
  for (const raw of cleaned.split(";")) {
    const stmt = raw.trim();
    if (stmt.length === 0) continue;
    if (stmt.startsWith("--")) {
      dropped.push({ kind: "注释开头整块被丢弃", stmt });
      continue;
    }
    if (/DROP\s+TABLE/i.test(stmt)) {
      dropped.push({ kind: "DROP TABLE 保护性跳过", stmt });
      continue;
    }
    if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) {
      dropped.push({ kind: "存储过程跳过", stmt });
      continue;
    }
    executed.push(stmt);
  }
  return { executed, dropped };
}

/** 复演 addTablePrefix：已 t_ 开头的表名不再加前缀 */
function addTablePrefix(sql) {
  const patterns = [
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([a-z_][a-z0-9_]*)/gi,
    /(ALTER\s+TABLE\s+)([a-z_][a-z0-9_]*)/gi,
  ];
  let out = sql;
  for (const p of patterns) {
    out = out.replace(p, (m, prefix, name) => (name.startsWith("t_") ? m : prefix + "t_" + name));
  }
  return out;
}

const EXPECTED_TABLES = [
  "t_platform_template",
  "t_platform_template_version",
  "t_platform_print_template",
  "t_platform_io_template",
];

/**
 * 「丢弃块里是否真的还藏着语句」：块以 `--` 开头被 runner 丢弃，
 * 若把其中**以注释开头的行**全部去掉后仍有内容，说明真语句被连带丢弃；
 * 若去掉后为空 ⇒ 丢掉的只是纯注释（无害）。
 */
function realContentOf(stmt) {
  return stmt
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim();
}

log("[C2-4/05] docs/migrations 语句切分复演（对齐 backend/src/shared/migration.ts:894-931）");
log(`         仓库根：${REPO}`);
log("");

// ── 反测：证明本检查器**会红** ──────────────────────────────────────
log("== 反测（先证明检查器会红） ==");
{
  const bad = `-- 编号: 999, 描述: 历史缺陷复刻, 依据: xxx\n-- 说明: 注释在前、语句在后\nCREATE TABLE IF NOT EXISTS bad_shape_table (id BIGINT PRIMARY KEY);\n`;
  const sim = simulateRunner(bad);
  const lostCreate = sim.dropped.filter((d) => realContentOf(d.stmt).length > 0 && /CREATE\s+TABLE/i.test(realContentOf(d.stmt))).length;
  log(`  反测输入：注释块在前 + 1 条 CREATE TABLE（历史缺陷形状）`);
  log(`  复演结果：执行 ${sim.executed.length} 条 / 丢弃 ${sim.dropped.length} 条，其中含 CREATE TABLE 的丢弃 ${lostCreate} 条`);
  if (lostCreate === 1 && sim.executed.length === 0) {
    log("  ✓ 反测通过：该形状会被本检查器判为「建表语句丢失」");
  } else {
    failures.push("反测失败：注释在前的 CREATE TABLE 未被判为丢失");
    log("  ✗ 反测失败：注释在前的 CREATE TABLE 未被判为丢失");
  }
  const good = `CREATE TABLE IF NOT EXISTS ok_shape_table (id BIGINT PRIMARY KEY);\n\n-- 注释在后\n`;
  const sim2 = simulateRunner(good);
  const goodLostReal = sim2.dropped.filter((d) => realContentOf(d.stmt).length > 0).length;
  log(`  对照输入：语句在前 + 注释在后 ⇒ 执行 ${sim2.executed.length} 条 / 丢弃 ${sim2.dropped.length} 条（丢弃块中的真实语句 ${goodLostReal} 条，期望 1/1/0）`);
  if (sim2.executed.length !== 1) {
    failures.push("对照失败：语句在前的写法不应被丢弃");
    log("  ✗ 对照失败：语句在前的写法不应被丢弃");
  }
  if (goodLostReal !== 0) {
    failures.push("对照失败：纯注释块不应被判为「丢掉语句」");
    log("  ✗ 对照失败：纯注释块被误判为丢掉语句");
  }
}
log("");

// ── 171 判定 ────────────────────────────────────────────────────────
log("== 171_platform_templates.sql 判定 ==");
{
  const file = "171_platform_templates.sql";
  const sql = readFileSync(join(MIG_DIR, file), "utf8");
  const sim = simulateRunner(sql);
  const firstNonEmpty = sql.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
  log(`  首行非空内容：${firstNonEmpty.slice(0, 90)}`);
  log(`  复演：被执行 ${sim.executed.length} 条，被丢弃 ${sim.dropped.length} 条`);
  for (const d of sim.dropped) log(`    丢弃[${d.kind}] ${d.stmt.replace(/\s+/g, " ").slice(0, 80)}`);

  const createStmts = sim.executed.filter((s) => /^CREATE\s+TABLE/i.test(s));
  const alters = sim.executed.filter((s) => /^ALTER\s+TABLE/i.test(s));
  const names = createStmts.map((s) => (/(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i.exec(s.replace(/^CREATE\s+TABLE\s+/i, "").replace(/^IF\s+NOT\s+EXISTS\s+/i, "")) || [])[1]);
  log(`  被执行语句：CREATE TABLE ${createStmts.length} 条 / ALTER TABLE ${alters.length} 条`);
  log(`  解析出的表名：${names.join(", ")}`);
  const prefixed = createStmts.map((s) => {
    const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i.exec(s);
    return m ? addTablePrefix(m[0]).replace(/\s+/g, " ") : "(未匹配)";
  });
  log(`  addTablePrefix 复演（应保持 t_ 前缀不变）：${prefixed.join(" | ")}`);

  const idempotent = createStmts.every((s) => /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(s));
  const sameSet =
    names.length === EXPECTED_TABLES.length && EXPECTED_TABLES.every((t) => names.includes(t));
  const noAlter = alters.length === 0;
  const lostReal = sim.dropped.filter((d) => realContentOf(d.stmt).length > 0);
  log(`  丢弃块中是否含真实语句：${lostReal.length} 条（注释块里出现 "CREATE TABLE" 字样不算语句）`);
  const noLostCreate = lostReal.filter((d) => /CREATE\s+TABLE/i.test(realContentOf(d.stmt))).length === 0;

  log(`  判定：幂等关键字齐全=${idempotent}；4 张预期表名齐全=${sameSet}；零 ALTER=${noAlter}；无建表语句被丢弃=${noLostCreate}`);
  if (!(idempotent && sameSet && noAlter && noLostCreate)) {
    failures.push("171 判定不通过：见上行逐项");
  }
}
log("");

// ── 全量影响面扫描（技术债铁律：同一缺陷的多处分现必须给数字） ────────
log("== 全量扫描：docs/migrations/*.sql 中「以注释开头被丢弃」的语句 ==");
{
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  const affected = [];
  let lostCreate = 0;
  let lostAlter = 0;
  let lostOther = 0;
  for (const f of files) {
    const sim = simulateRunner(readFileSync(join(MIG_DIR, f), "utf8"));
    const lost = sim.dropped.filter(
      (d) =>
        d.kind === "注释开头整块被丢弃" &&
        realContentOf(d.stmt).length > 0 &&
        /^CREATE\s+TABLE|^ALTER\s+TABLE|^INSERT\s+INTO|^UPDATE\s+|^DELETE\s+FROM/im.test(realContentOf(d.stmt))
    );
    if (!lost.length) continue;
    const c = lost.filter((d) => /^CREATE\s+TABLE/im.test(realContentOf(d.stmt))).length;
    const a = lost.filter((d) => /^ALTER\s+TABLE/im.test(realContentOf(d.stmt))).length;
    const o = lost.length - c - a;
    lostCreate += c;
    lostAlter += a;
    lostOther += o;
    affected.push({ file: f, lost: lost.length, create: c, alter: a, other: o });
  }
  log(`  扫描 SQL 文件 ${files.length} 个；存在「注释开头被丢弃且含建表/改表/写数据」的文件 ${affected.length} 个`);
  log(`  受影响语句合计：CREATE TABLE ${lostCreate} 条 / ALTER TABLE ${lostAlter} 条 / INSERT 等 ${lostOther} 条`);
  for (const a of affected.slice(0, 25)) {
    log(`    - ${a.file}：丢弃 ${a.lost} 条（CREATE ${a.create} / ALTER ${a.alter} / 其他 ${a.other}）`);
  }
  if (affected.length > 25) log(`    … 其余 ${affected.length - 25} 个文件见 05-migration-parse.json`);
  log("  说明：本项属**独立发现**，非 C2-4 四条的组成部分；171 本身不在此列（语句在前）。");

  const jsonOut = { scannedFiles: files.length, affected, lostCreate, lostAlter, lostOther, failures };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(REPO, "docs/evidence/C2-4/outputs/05-migration-parse.json"), JSON.stringify(jsonOut, null, 2), "utf8");
}
log("");

log(`[C2-4/05] 结论：${failures.length === 0 ? "171 会被 runner 执行（4 张表的仓库侧必要条件成立）" : "存在不通过项"}`);
for (const f of failures) log(`      ✗ ${f}`);
log(`RESULT: ${failures.length === 0 ? "ALL PASS" : "FAILURES"}`);
log(`EXIT=${failures.length === 0 ? 0 : 1}`);

process.stdout.write(`${lines.join("\n")}\n`);
process.exit(failures.length === 0 ? 0 : 1);
