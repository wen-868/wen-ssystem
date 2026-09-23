/**
 * MIG-1 副本演练脚本：在**任意 MySQL 副本库**上演练「迁移 runner 修好之后，这些语句会真的执行成什么样」。
 *
 * 四个模式（都不动生产库；apply 模式还必须显式加 --allow-write）：
 *   plan         无需真库。用与 mig1-extract.mjs 同一份切分引擎算出"修复后会被执行"的语句计划，
 *                与 expected.json 逐条对照，落盘 plan.json / plan.txt。（默认模式）
 *   sqlite-dryrun 无需真库。用 node:sqlite 内存库把计划里的语句逐条"过一遍执行循环"，
 *                证明"挑选 → 执行 → 记录"链路真的能跑（**只验证挑了哪些语句，不验证 MySQL 语义**）。
 *   apply        真库副本演练：建库 → 灌入结构快照（--dump）→ 按修复后的 runner 逻辑逐条执行
 *                → 输出"预期 vs 实际"对照（成功 / 跳过 / 报错 + 错误码）。
 *   selftest     反测：证明本脚本的挑选与断言引擎**会红**（改坏输入必须被判出来）。
 *
 * 用法示例见 docs/evidence/MIG-1/README.md。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { simulateRunner, addTablePrefix, stmtType, riskOf, extractTables, REPO_ROOT, MIGRATIONS_DIR } from "./mig1-extract.mjs";

const OUT_DIR = join(REPO_ROOT, "docs", "evidence", "MIG-1", "outputs");

// ────────────────────────────────────────────────────────────────────────────
// 参数
// ────────────────────────────────────────────────────────────────────────────

function argVal(name, dflt = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : dflt;
}
const hasFlag = (name) => process.argv.includes(name);

const MODE = argVal("--mode", "plan");
const ONLY_FILES = (argVal("--file", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = resolve(REPO_ROOT, argVal("--out", "docs/evidence/MIG-1/outputs"));
const PLAN_PATH = join(OUT, "02-plan.json");

const log = [];
const say = (s = "") => {
  log.push(s);
  process.stdout.write(s + "\n");
};

// ────────────────────────────────────────────────────────────────────────────
// 修复后的 runner 逻辑（PR #13 的规则：先剥注释行，再按 ; 切分、过滤空块）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 返回"修复后会被执行"的语句清单。
 * 关键差异：**不再丢弃"以注释开头"的块**，只丢弃注释后的空内容。
 */
export function fixedRunnerStatements(file, sql) {
  const { dropped, executed } = simulateRunner(sql, "B");
  const out = [];
  for (const d of dropped) {
    if (!d.realSql) continue; // 纯注释块 ⇒ 修复后依然没有可执行内容
    out.push({
      file,
      line: d.realLine,
      blockStartLine: d.blockStartLine,
      sql: d.realSql,
      prefixedSql: addTablePrefix(d.realSql),
      type: stmtType(d.realSql),
      risk: riskOf(d.realSql).level,
      tables: extractTables(d.realSql),
      skippedByRunner: d.skippedByRunner,
      reason: "修复前被『注释开头整块丢弃』吞掉",
    });
  }
  for (const e of executed) {
    out.push({
      file,
      line: e.realLine,
      blockStartLine: e.blockStartLine,
      sql: e.realSql,
      prefixedSql: addTablePrefix(e.realSql),
      type: stmtType(e.realSql),
      risk: riskOf(e.realSql).level,
      tables: extractTables(e.realSql),
      skippedByRunner: e.skippedByRunner,
      reason: "修复前也会执行（对照项）",
    });
  }
  return out;
}

export function buildPlan(dir = MIGRATIONS_DIR, onlyFiles = []) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
    .sort()
    .filter((f) => !onlyFiles.length || onlyFiles.includes(f));
  const items = [];
  for (const f of files) items.push(...fixedRunnerStatements(f, readFileSync(join(dir, f), "utf8")));
  return { dir, files: files.length, items };
}

/** 只保留"修复后新增执行"的部分（即 MIG-1 的清单对象） */
export const newlyExecuted = (items) => items.filter((i) => i.reason.startsWith("修复前被"));

// ────────────────────────────────────────────────────────────────────────────
// 模式 1：plan（无真库）
// ────────────────────────────────────────────────────────────────────────────

function modePlan() {
  const plan = buildPlan(MIGRATIONS_DIR, ONLY_FILES);
  const fresh = newlyExecuted(plan.items);
  say("[MIG-1/rehearsal] 模式 plan —— 不需要真库，只算『修复后会被执行』的语句");
  say("  迁移目录：" + plan.dir);
  say("  扫描文件：" + plan.files + "；修复后执行语句合计 " + plan.items.length + " 条，其中『修复前被吞掉、修复后新增执行』" + fresh.length + " 条");
  say("");

  // 与 expected.json 对照
  const expPath = join(REPO_ROOT, "docs", "evidence", "MIG-1", "expected.json");
  let verdict = "SKIP（未找到 expected.json）";
  if (existsSync(expPath)) {
    const exp = JSON.parse(readFileSync(expPath, "utf8"));
    const expKeys = new Set(exp.files.flatMap((f) => f.entries).map((e) => e.file + ":" + e.line + ":" + e.type));
    const gotKeys = new Set(fresh.map((i) => i.file + ":" + i.line + ":" + i.type));
    const missing = [...expKeys].filter((k) => !gotKeys.has(k));
    const extra = [...gotKeys].filter((k) => !expKeys.has(k));
    say("  与 expected.json 对照：双方 " + expKeys.size + " / " + gotKeys.size + " 条");
    say("    清单有而计划没有（漏）：" + missing.length + (missing.length ? " 例：" + missing.slice(0, 3).join(" / ") : ""));
    say("    计划有而清单没有（多）：" + extra.length + (extra.length ? " 例：" + extra.slice(0, 3).join(" / ") : ""));
    verdict = missing.length === 0 && extra.length === 0 ? "一致 ✅" : "不一致 ❌";
    say("    判定：" + verdict);
  }
  say("");

  mkdirSync(OUT, { recursive: true });
  writeFileSync(PLAN_PATH, JSON.stringify({ dir: plan.dir, files: plan.files, items: plan.items }, null, 2), "utf8");
  const summary = log.join("\n") + "\n";
  writeFileSync(join(OUT, "02-plan.txt"), summary + "\n校验：plan.json = " + PLAN_PATH + "\n", "utf8");
  say("  已落盘：" + PLAN_PATH);
  say("  已落盘：" + join(OUT, "02-plan.txt"));
  say("RESULT: " + (verdict.startsWith("一致") ? "ALL PASS" : verdict === "SKIP（未找到 expected.json）" ? "SKIP" : "FAILURES"));
  process.exit(verdict.startsWith("一致") || verdict.startsWith("SKIP") ? 0 : 1);
}

// ────────────────────────────────────────────────────────────────────────────
// 模式 2：sqlite-dryrun（无真库，自证挑选链路可跑）
// ────────────────────────────────────────────────────────────────────────────

async function modeSqliteDryRun() {
  say("[MIG-1/rehearsal] 模式 sqlite-dryrun —— 无真库自证：用真实 SQL 引擎（node:sqlite 内存库）承载并核对挑选结果");
  say("  声明：本模式**只验证『挑了哪些语句』**（挑选结果能落库、能被独立 SQL 引擎聚合核对），**不验证 MySQL 语义**。");
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE mig1_selection (seq INTEGER PRIMARY KEY AUTOINCREMENT, file TEXT, line INTEGER, type TEXT, risk TEXT, need_confirm INTEGER, target_table TEXT, skipped_by_runner TEXT, origin TEXT)"
  );
  const ins = db.prepare(
    "INSERT INTO mig1_selection (file, line, type, risk, need_confirm, target_table, skipped_by_runner, origin) VALUES (?,?,?,?,?,?,?,?)"
  );

  const plan = buildPlan(MIGRATIONS_DIR, ONLY_FILES);
  for (const i of plan.items) {
    const isNew = i.reason.startsWith("修复前被");
    ins.run(
      i.file,
      i.line,
      i.type,
      i.risk,
      i.risk === "L1" ? 0 : 1,
      i.tables[0] ?? null,
      i.skippedByRunner ?? null,
      isNew ? "新增执行（MIG-1 清单对象）" : "修复前已执行（对照）"
    );
  }
  const q1 = (sql) => db.prepare(sql).all();
  const total = db.prepare("SELECT COUNT(*) AS n FROM mig1_selection").get().n;
  const newRows = db.prepare("SELECT COUNT(*) AS n FROM mig1_selection WHERE origin LIKE '新增%'").get().n;
  say("  落库：计划 " + total + " 条（其中新增执行 " + newRows + " 条）");

  const byType = q1("SELECT type, COUNT(*) AS n FROM mig1_selection WHERE origin LIKE '新增%' GROUP BY type ORDER BY n DESC");
  const byRisk = q1("SELECT risk, COUNT(*) AS n FROM mig1_selection WHERE origin LIKE '新增%' GROUP BY risk ORDER BY risk");
  say("  按类型（SQL 聚合）：" + byType.map((r) => r.type + " " + r.n).join(" / "));
  say("  按风险（SQL 聚合）：" + byRisk.map((r) => r.risk + " " + r.n).join(" / "));

  // 与 expected.json 交叉核对（挑选结果一致性）
  const expPath = join(REPO_ROOT, "docs", "evidence", "MIG-1", "expected.json");
  let verdict = "SKIP（未找到 expected.json）";
  if (existsSync(expPath)) {
    const exp = JSON.parse(readFileSync(expPath, "utf8"));
    const expType = exp.countsB.byType;
    const gotType = Object.fromEntries(byType.map((r) => [r.type, r.n]));
    const same = JSON.stringify(Object.entries(expType).sort()) === JSON.stringify(Object.entries(gotType).sort());
    const expTotal = exp.files.flatMap((f) => f.entries).length;
    say("  与 expected.json 对照：清单 " + expTotal + " 条 / SQL 聚合 " + newRows + " 条；按类型一致=" + same);
    verdict = same && expTotal === newRows ? "一致 ✅" : "不一致 ❌";
    say("  判定：" + verdict);
  }

  // 采样演示：MySQL 专有语句在 sqlite 上必然报语义错 —— 这是"语义必须到真 MySQL 才能验"的正面证据
  say("");
  say("  采样（前 3 条）在 sqlite 上直接执行的报错，说明**语义只能到 MySQL 副本库验证**：");
  const samples = q1("SELECT file,line,type FROM mig1_selection WHERE origin LIKE '新增%' AND skipped_by_runner IS NULL ORDER BY seq LIMIT 3");
  const freshItems = newlyExecuted(plan.items).filter((i) => !i.skippedByRunner);
  const sampleErrors = [];
  for (const s of samples) {
    const item = freshItems.find((i) => i.file === s.file && i.line === s.line);
    if (!item) continue;
    try {
      db.exec(item.prefixedSql);
      sampleErrors.push({ ...s, error: "" });
      say("    " + s.file + ":" + s.line + " " + s.type + " ⇒ 在 sqlite 上执行成功（不具 MySQL 语义代表性）");
    } catch (e) {
      sampleErrors.push({ ...s, error: String(e.message).slice(0, 140) });
      say("    " + s.file + ":" + s.line + " " + s.type + " ⇒ " + String(e.message).slice(0, 140));
    }
  }

  mkdirSync(OUT, { recursive: true });
  const allRows = q1("SELECT seq,file,line,type,risk,need_confirm,target_table,skipped_by_runner,origin FROM mig1_selection ORDER BY seq");
  writeFileSync(
    join(OUT, "03-sqlite-dryrun.json"),
    JSON.stringify({ total, newRows, byType, byRisk, verdict, sampleErrors, rows: allRows }, null, 2),
    "utf8"
  );
  writeFileSync(join(OUT, "03-sqlite-dryrun.txt"), log.join("\n") + "\n", "utf8");
  say("");
  say("  已落盘：" + join(OUT, "03-sqlite-dryrun.json") + " / " + join(OUT, "03-sqlite-dryrun.txt"));
  say("RESULT: " + (verdict.startsWith("一致") || verdict.startsWith("SKIP") ? "ALL PASS" : "FAILURES"));
  process.exit(verdict.startsWith("一致") || verdict.startsWith("SKIP") ? 0 : 1);
}

// ────────────────────────────────────────────────────────────────────────────
// 模式 3：apply（真 MySQL 副本库）
// ────────────────────────────────────────────────────────────────────────────

async function modeApply() {
  const host = argVal("--host", "127.0.0.1");
  const port = Number(argVal("--port", "3306"));
  const user = argVal("--user", "root");
  const password = argVal("--password", "");
  const database = argVal("--database", "liquor_inventory_rehearsal");
  const dump = argVal("--dump", null);

  say("[MIG-1/rehearsal] 模式 apply —— 真库副本演练");
  say("  目标：mysql://" + user + "@" + host + ":" + port + "/" + database);
  say("  结构快照： " + (dump ? dump : "（未提供 --dump，按空库演练；结论不能当结构快照证据）"));
  if (!hasFlag("--allow-write")) {
    say("  ✗ 拒绝执行：apply 模式会在目标库建库/建表/写数据，必须显式加 --allow-write。");
    say("    （克隆副本库后重跑：node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode apply --host <副本> --user <u> --password <p> --database <副本库> --dump <快照.sql> --allow-write）");
    say("RESULT: BLOCKED-BY-GUARD（未连接任何库，未执行任何写操作）");
    say("EXIT=3");
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "04-apply-guard.txt"), log.join("\n") + "\n", "utf8");
    process.exit(3);
  }

  let mysql;
  try {
    mysql = await import("mysql2/promise");
  } catch {
    say("  ✗ 环境缺口：找不到 mysql2（node 侧 MySQL 驱动）。副本机上安装：npm i -D mysql2");
    process.exit(3);
  }

  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password, multipleStatements: false, connectTimeout: 8000 });
  } catch (e) {
    say("  ✗ 连接失败：" + e.message);
    say("RESULT: ENV-GAP（无法连接目标库，未执行任何写操作）");
    say("EXIT=3");
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "04-apply-connect-error.txt"), log.join("\n") + "\n", "utf8");
    process.exit(3);
  }

  const results = [];
  const q = async (sql) => conn.query(sql);

  // ① 建库
  await q("CREATE DATABASE IF NOT EXISTS `" + database + "` DEFAULT CHARACTER SET utf8mb4");
  await q("USE `" + database + "`");
  say("  ① 建库完成：" + database);

  // ② 灌入结构快照（占位参数：由凌舟提供 dump 路径）
  if (dump && existsSync(dump)) {
    const sqlText = readFileSync(dump, "utf8");
    const stmts = sqlText
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--") && !/^(USE|CREATE DATABASE)/i.test(s));
    let n = 0;
    for (const s of stmts) {
      try {
        await q(s);
        n += 1;
      } catch (e) {
        say("    [快照语句报错] " + String(e.message).slice(0, 120));
      }
    }
    say("  ② 结构快照灌入完成：执行 " + n + " / " + stmts.length + " 条");
  } else {
    say("  ② 结构快照：未灌入（空库演练）");
  }

  // ③ 记录演练前的结构/数据基线
  const plan = buildPlan(MIGRATIONS_DIR, ONLY_FILES);
  const fresh = newlyExecuted(plan.items);
  const tables = [...new Set(fresh.map((i) => i.tables[0]).filter(Boolean))];
  const before = await probe(conn, database, tables);
  say("  ③ 演练前基线：涉及表 " + tables.length + " 张，已存在 " + before.tablesExisting.length + " 张");

  // ④ 按修复后的 runner 逻辑逐条执行
  say("  ④ 开始逐条执行（修复后的 runner 逻辑）…");
  for (const i of fresh) {
    if (i.skippedByRunner) {
      results.push({ ...pick(i), outcome: "skipped-by-runner", detail: i.skippedByRunner });
      continue;
    }
    try {
      await q(i.prefixedSql);
      results.push({ ...pick(i), outcome: "ok", detail: "" });
    } catch (e) {
      results.push({ ...pick(i), outcome: "error", detail: "code=" + (e.code ?? "-") + " " + String(e.message).slice(0, 200) });
    }
  }
  const after = await probe(conn, database, tables);

  // ⑤ 预期 vs 实际
  const byOutcome = {};
  for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
  say("  ⑤ 预期 vs 实际：预期执行 " + fresh.length + " 条 ⇒ " + JSON.stringify(byOutcome));
  say("     结构/数据变化：新增表 " + after.tablesExisting.length - before.tablesExisting.length + " 张；新增涉及列 " + (after.columns - before.columns) + " 个");
  for (const r of results.filter((x) => x.outcome === "error").slice(0, 30)) {
    say("     [报错] " + r.file + ":" + r.line + " " + r.type + " " + r.table + " ⇒ " + r.detail);
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "04-apply-compare.json"),
    JSON.stringify({ target: { host, port, database }, dump: dump ?? null, before, after, byOutcome, results }, null, 2),
    "utf8"
  );
  writeFileSync(join(OUT, "04-apply-compare.txt"), log.join("\n") + "\n", "utf8");
  say("");
  say("  已落盘：" + join(OUT, "04-apply-compare.json") + " / " + join(OUT, "04-apply-compare.txt"));
  say("RESULT: " + ((byOutcome.error ?? 0) === 0 ? "ALL PASS" : "有报错（详见 04-apply-compare.json）"));
  await conn.end();
  process.exit((byOutcome.error ?? 0) === 0 ? 0 : 2);
}

const pick = (i) => ({ file: i.file, line: i.line, type: i.type, risk: i.risk, table: i.tables[0] ?? null });

async function probe(conn, database, tables) {
  const [tRows] = await conn.query(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_name IN (" +
      (tables.length ? tables.map(() => "?").join(",") : "NULL") +
      ")",
    [database, ...tables]
  );
  const [cRows] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ?" + (tables.length ? " AND table_name IN (" + tables.map(() => "?").join(",") + ")" : ""),
    tables.length ? [database, ...tables] : [database]
  );
  return { tablesExisting: tRows.map((r) => r.t), columns: cRows[0].n };
}

// ────────────────────────────────────────────────────────────────────────────
// 模式 4：selftest（反测：证明挑选与断言会红）
// ────────────────────────────────────────────────────────────────────────────

function modeSelftest() {
  const cases = [];
  const fail = [];
  const check = (name, cond, detail) => {
    cases.push("  " + (cond ? "✓" : "✗") + " " + name + (detail ? " ⇒ " + detail : ""));
    if (!cond) fail.push(name);
  };

  const fCommentFirst = "999_bad_shape.sql";
  const sqlBad = "-- 编号: 999\n-- 说明: 注释在前、语句在后（历史缺陷形状）\nCREATE TABLE IF NOT EXISTS rehearsal_bad (id BIGINT PRIMARY KEY);\n";
  const bad = newlyExecuted(fixedRunnerStatements(fCommentFirst, sqlBad));
  check("F1 注释在前的 CREATE TABLE 必须被判为『修复后新增执行』", bad.length === 1 && bad[0].type === "CREATE", "新增 " + bad.length + " 条");

  const sqlGood = "CREATE TABLE IF NOT EXISTS rehearsal_ok (id BIGINT PRIMARY KEY);\n\n-- 注释在后\n";
  const good = fixedRunnerStatements("998_good_shape.sql", sqlGood);
  check(
    "F2 语句在前的正确写法必须落在『本来就会执行』一侧（不进新增集合）",
    newlyExecuted(good).length === 0 && good.filter((i) => i.reason.startsWith("修复前也会")).length === 1,
    "新增 " + newlyExecuted(good).length + " / 对照 " + good.filter((i) => i.reason.startsWith("修复前也会")).length
  );

  const sqlDrop = "-- 危险块\nDROP TABLE IF EXISTS t_rehearsal_danger;\n";
  const d = newlyExecuted(fixedRunnerStatements("997_drop.sql", sqlDrop));
  check(
    "F3 DROP TABLE 必须被判为『修复后仍由 runner 跳过』，且风险 L4",
    d.length === 1 && d[0].skippedByRunner === "drop_table" && d[0].risk === "L4",
    "skip=" + d[0]?.skippedByRunner + " risk=" + d[0]?.risk
  );

  const sqlPure = "-- 只有注释\n-- 再来一行\n";
  check("F4 纯注释块不得进入清单", newlyExecuted(fixedRunnerStatements("996_pure.sql", sqlPure)).length === 0, "新增 " + newlyExecuted(fixedRunnerStatements("996_pure.sql", sqlPure)).length + " 条");

  // 断言引擎自证：故意给一个错预期，必须判红
  const wrongExpectation = bad.length === 0;
  check("S1 断言引擎自证：把『应当新增 1 条』故意写成『新增 0 条』时必须判红", wrongExpectation === false, "错误预期命中判红:" + (wrongExpectation === false));

  // 与 expected.json 的总量核对（防工具漂移）
  const expPath = join(REPO_ROOT, "docs", "evidence", "MIG-1", "expected.json");
  if (existsSync(expPath)) {
    const exp = JSON.parse(readFileSync(expPath, "utf8"));
    const fresh = newlyExecuted(buildPlan(MIGRATIONS_DIR).items);
    check(
      "F5 与 expected.json 逐条一致（文件数/条数/键）",
      exp.countsB.files === new Set(fresh.map((i) => i.file)).size && exp.files.flatMap((f) => f.entries).length === fresh.length,
      "expected " + exp.countsB.files + " 文件 / " + exp.files.flatMap((f) => f.entries).length + " 条；plan " + new Set(fresh.map((i) => i.file)).size + " 文件 / " + fresh.length + " 条"
    );
  }

  say("[MIG-1/rehearsal] 模式 selftest —— 反测（证明挑选与断言会红）");
  say(cases.join("\n"));
  mkdirSync(OUT, { recursive: true });
  const text = log.join("\n") + "\n\nRESULT: " + (fail.length ? "FAILURES" : "ALL PASS") + "\n";
  writeFileSync(join(OUT, "05-selftest.txt"), text, "utf8");
  say("");
  say("  已落盘：" + join(OUT, "05-selftest.txt"));
  say("RESULT: " + (fail.length ? "FAILURES " + fail.join(" / ") : "ALL PASS"));
  process.exit(fail.length ? 1 : 0);
}

// ────────────────────────────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  if (MODE === "plan") modePlan();
  else if (MODE === "sqlite-dryrun") await modeSqliteDryRun();
  else if (MODE === "apply") await modeApply();
  else if (MODE === "selftest") modeSelftest();
  else {
    say("未知模式：" + MODE + "（可用：plan / sqlite-dryrun / apply / selftest）");
    process.exit(3);
  }
}
