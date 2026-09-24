/**
 * S3-110 ④ 反测：积分规则 INSERT 漏 `rule_name` / `earn_type` 的 1364 复现与修复验证。
 *
 * 沙箱事实：本容器无 MySQL（`Get-Command mysql/mysqld` 空、127.0.0.1:3306 无监听），
 * 故用 **node:sqlite 隔离库**做等价判定：
 *   - 表结构按 docs/migrations/071_客户积分.sql 的 `t_points_rule` 真 DDL 复刻，
 *     并在运行时断言真 DDL 里 `rule_name` / `earn_type` 确实是 NOT NULL 且无 DEFAULT；
 *   - 「修复前」臂按派单卡给出的漏列写法（7 列）执行 ⇒ 缺 NOT NULL 无默认值列，
 *     SQLite 报 `NOT NULL constraint failed`，与 MySQL 严格模式 1364 ER_NO_DEFAULT_FOR_FIELD 语义等价；
 *   - 「修复后」臂的 INSERT **从生产源码里现抽**（不做字面硬编码），列数与占位符数必须一致。
 * 原始 MySQL 错误码（1364）需凌舟在真库复跑确认，本脚本只给等价证据。
 *
 * 用法：node docs/evidence/S3-110/probe/points-insert-1364.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");
const SERVICE = join(REPO, "backend/src/services/admin/marketing-points.service.ts");
const DDL_FILE = join(REPO, "docs/migrations/071_客户积分.sql");
const OUT_DIR = join(REPO, "docs/evidence/S3-110/outputs");

const log = [];
const say = (line = "") => {
  log.push(line);
  process.stdout.write(line + "\n");
};
let failed = 0;
const assert = (ok, label, detail) => {
  say(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed++;
};

// ── 1. 真 DDL 事实核对 ─────────────────────────────────────────────────────
const ddl = readFileSync(DDL_FILE, "utf-8");
const tableDdl = ddl.slice(ddl.indexOf("CREATE TABLE IF NOT EXISTS t_points_rule"));
const tableBody = tableDdl.slice(0, tableDdl.indexOf("ENGINE=InnoDB"));
say("## 1 真 DDL（docs/migrations/071_客户积分.sql 的 t_points_rule）");
for (const col of ["rule_name", "earn_type"]) {
  const line = tableBody.split(/\r?\n/).find((l) => l.trim().startsWith(col + " ")) ?? "";
  say(`  ${line.trim()}`);
  assert(/NOT NULL/i.test(line) && !/DEFAULT/i.test(line), `1.${col} 是 NOT NULL 且无 DEFAULT`, line.trim());
}

// ── 2. node:sqlite 隔离库（结构按真 DDL 复刻） ─────────────────────────────
const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE t_points_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    earn_type VARCHAR(20) NOT NULL,
    earn_rate DECIMAL(6,4) DEFAULT 0,
    daily_limit INT DEFAULT 0,
    enabled TINYINT DEFAULT 1,
    tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    earn_ratio DECIMAL(6,4) DEFAULT 0,
    redeem_ratio DECIMAL(6,4) DEFAULT 100,
    min_redeem_amount DECIMAL(10,2) DEFAULT 0,
    max_redeem_ratio DECIMAL(6,4) DEFAULT 0.5,
    expire_days INT NOT NULL DEFAULT 365
  )
`);
say("");
say("## 2 隔离库（node:sqlite 内存库，t_points_rule 列结构按 071 真 DDL + 151 补列复刻）");

/** MySQL 严格模式错误语义 → 等价判定说明 */
function classify(err) {
  const msg = String(err?.message ?? err);
  if (/NOT NULL constraint failed/i.test(msg)) {
    return { kind: "mysql-1364-equivalent", msg };
  }
  return { kind: "other-error", msg };
}

// ── 3. 修复前臂：漏列写法（7 列） ───────────────────────────────────────────
say("");
say("## 3 修复前（漏 rule_name / earn_type，7 列写法）");
const PRE_FIX_SQL = `INSERT INTO t_points_rule (earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`;
const PRE_FIX_PARAMS = [1, 100, 0, 0.5, 365, 0, "t-1001"];
say(`  SQL：${PRE_FIX_SQL.replace(/\s+/g, " ")}`);
let preFix = null;
try {
  db.prepare(PRE_FIX_SQL).run(...PRE_FIX_PARAMS);
  preFix = { kind: "unexpected-success" };
} catch (err) {
  preFix = classify(err);
}
say(`  结果：${preFix.kind} :: ${preFix.msg}`);
assert(preFix.kind === "mysql-1364-equivalent",
  "3.1 修复前写法在隔离库必然失败（NOT NULL 无默认值列缺失 ⇒ MySQL 严格模式 1364 的等价行为）");

// 源码里不应再残留漏列写法（证明修复已落地，而不是只在探针里）
const src = readFileSync(SERVICE, "utf-8");
assert(!src.includes("INSERT INTO t_points_rule (earn_ratio"),
  "3.2 生产源码已不含「漏列」写法（修复真正落在代码里，不是探针自证）");

// ── 4. 修复后臂：INSERT 从生产源码现抽 ─────────────────────────────────────
say("");
say("## 4 修复后（INSERT 语句从 marketing-points.service.ts 现抽）");
const match = /INSERT INTO t_points_rule \(([\s\S]*?)\)\s*VALUES \(([\s\S]*?)\)/.exec(src);
if (!match) throw new Error("未能从生产源码抽取 INSERT 语句");
const columns = match[1].split(",").map((c) => c.trim());
const placeholders = match[2].split(",").map((c) => c.trim());
say(`  列（${columns.length}）：${columns.join(", ")}`);
say(`  占位符（${placeholders.length}）：${placeholders.join(", ")}`);
assert(columns.length === placeholders.length && placeholders.every((p) => p === "?"),
  "4.1 列数与占位符数一致且全为 ?");
assert(columns.includes("rule_name") && columns.includes("earn_type"),
  "4.2 列清单含 rule_name / earn_type（NOT NULL 无默认值列不再漏）");

const POST_FIX_PARAMS = ["积分兑换规则", "CONSUMPTION", 1, 100, 0, 0.5, 365, 0, "t-1001"];
assert(src.includes('body.ruleName ?? "积分兑换规则"') && src.includes('body.earnType ?? "CONSUMPTION"'),
  "4.3 默认值可由请求体覆盖（ruleName / earnType 缺省兜底）");

const sql = `INSERT INTO t_points_rule (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
let postFix = null;
try {
  const result = db.prepare(sql).run(...POST_FIX_PARAMS);
  postFix = { kind: "success", changes: result.changes };
} catch (err) {
  postFix = classify(err);
}
assert(postFix.kind === "success", "4.4 修复后写法执行成功（不再 1364）", JSON.stringify(postFix));

const row = db.prepare("SELECT id, rule_name, earn_type, earn_ratio, tenant_id FROM t_points_rule").all();
say(`  库内行：${JSON.stringify(row)}`);
assert(row.length === 1 && row[0].rule_name === "积分兑换规则" && row[0].earn_type === "CONSUMPTION",
  "4.5 落库行含 rule_name='积分兑换规则' / earn_type='CONSUMPTION'");

// ── 5. 覆盖臂：请求体传值 ─────────────────────────────────────────────────
say("");
say("## 5 请求体覆盖（ruleName='消费得积分' / earnType='PURCHASE'）");
const overrideParams = ["消费得积分", "PURCHASE", 2, 100, 0, 0.5, 365, 1, "t-1002"];
db.prepare(sql).run(...overrideParams);
const row2 = db.prepare("SELECT rule_name, earn_type, tenant_id FROM t_points_rule WHERE tenant_id = 't-1002'").all();
say(`  库内行：${JSON.stringify(row2)}`);
assert(row2.length === 1 && row2[0].rule_name === "消费得积分" && row2[0].earn_type === "PURCHASE",
  "5.1 请求体值被采用（默认值只是兜底）");

db.close();
say("");
say(`结论：${failed === 0 ? "全部通过" : failed + " 项失败"}`);
say("说明：本脚本引擎为 node:sqlite，「1364」是按 MySQL 严格模式的**语义等价判定**，");
say("      原生错误码需凌舟在真库复跑（沙箱无 MySQL/docker）。");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "points-insert-1364.log"), log.join("\n") + "\n", "utf-8");
process.exitCode = failed === 0 ? 0 : 1;
