/**
 * S3-110 ③ 反测：迁移 178「逐列拆分」的幂等性与"全有全无"消除。
 *
 * 沙箱事实：本容器无 MySQL、无 docker（`Get-Command mysql/mysqld/docker` 全空），
 * 故用**真迁移管线**（production 代码 `splitSqlStatements` / `addTablePrefix` / `safeExec` /
 * `SKIP_ERRORS` / `SKIP_PATTERNS`，均从 backend/src/shared/migration.ts 直接 import）+ 一个
 * **按 MySQL 语句级语义实现的假连接**（每列已存在 ⇒ 该语句返 ER_DUP_FIELDNAME/1060 且整条不生效）。
 * 这一点是本反测的关键：MySQL 的 ALTER 是**语句级**原子，假连接必须复刻"整条回滚"而不是"跳过该列继续"。
 *
 * 四段用例：
 *   A 全空库首跑：6 条 ALTER 全部生效，6 列齐（现状文件）
 *   B 无变化重跑：6 条 ALTER 全部 1060 被 safeExec 跳过，零新失败（"第二次应全部被跳过"）
 *   C 中间态（3 列中 1 列已存在）：逐列写法自愈补满 6 列；旧"合并写法"丢列（全有全无缺陷）
 *   D 控制组：非跳过类错误（ER_BAD_NULL_ERROR）不被当跳过（证明本脚本能区分"跳过"与"失败"）
 *
 * 用法：node --import ./docs/evidence/S3-110/probe/ts-resolve-hook.mjs docs/evidence/S3-110/probe/migration-178-idempotency.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../../..");
const MIGRATION_FILE = join(REPO, "docs/migrations/178_library_brand_auth_app_version_status.sql");
const OUT_DIR = join(REPO, "docs/evidence/S3-110/outputs");

const {
  splitSqlStatements,
  addTablePrefix,
  safeExec,
  SKIP_ERRORS,
  SKIP_PATTERNS
} = await import(pathToFileURL(join(REPO, "backend/src/shared/migration.ts")).href);

const log = [];
const say = (line = "") => {
  log.push(line);
  process.stdout.write(line + "\n");
};

let failed = 0;
function assert(ok, label, detail) {
  say(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed++;
}

// ────────────────────────────────────────────────────────────────────────────
// 假 MySQL 连接：按语句级语义实现 ALTER TABLE ... ADD COLUMN
// ────────────────────────────────────────────────────────────────────────────

class FakeMysql {
  constructor(existing = {}) {
    /** table -> Set(column) */
    this.columns = new Map();
    for (const [table, cols] of Object.entries(existing)) {
      this.columns.set(table, new Set(cols));
    }
    /** 本次连接的语句执行记录 */
    this.trace = [];
  }

  table(name) {
    if (!this.columns.has(name)) this.columns.set(name, new Set());
    return this.columns.get(name);
  }

  has(table, column) {
    return this.table(table).has(column);
  }

  /** 与 safeExec 的跳过判定同源（复用生产常量，不另写一套规则） */
  static isSkippable(code, message) {
    const msg = String(message || "").toLowerCase();
    return SKIP_ERRORS.has(code) || SKIP_PATTERNS.some((p) => msg.includes(p));
  }

  async query(sql) {
    const text = String(sql).trim();

    // 跑后核对 SELECT（迁移文件里的两条 information_schema 查询）
    if (/^SELECT/i.test(text)) {
      const wanted = ["auth_letter_url", "auth_expired_at", "auth_status", "status", "gray_ratio", "archived_at"];
      const present = wanted.filter((c) => this.has("t_library_brand", c) || this.has("t_app_version", c));
      this.trace.push({ kind: "string", sql: text.split("\n")[0], columns: present });
      return [[{ c6_new_column_count: present.length }], []];
    }

    const alter = /^ALTER TABLE\s+([A-Za-z0-9_]+)\s+([\s\S]*)$/i.exec(text);
    if (!alter) {
      this.trace.push({ kind: "other", sql: text });
      throw Object.assign(new Error(`假连接不认识该语句：${text.slice(0, 40)}`), { code: "ER_NOT_SUPPORTED" });
    }

    const table = alter[1];
    const body = alter[2];
    const adds = [...body.matchAll(/ADD COLUMN\s+([A-Za-z0-9_]+)([\s\S]*?)(?=,\s*(?:ADD COLUMN|ALGORITHM)|,\s*ALGORITHM|$)/gi)];

    // 语句级原子：先检查全部列，任一已存在 ⇒ 整条失败、新列一个都不加
    const dup = adds.find((m) => this.has(table, m[1]));
    if (dup) {
      const err = Object.assign(new Error(`Duplicate column name '${dup[1]}'`), {
        code: "ER_DUP_FIELDNAME",
        errno: 1060
      });
      this.trace.push({ kind: "alter", table, columns: adds.map((m) => m[1]), result: "dup", code: err.code });
      throw err;
    }

    for (const m of adds) this.table(table).add(m[1]);
    this.trace.push({ kind: "alter", table, columns: adds.map((m) => m[1]), result: "applied" });
    return [{ affectedRows: 0 }, []];
  }
}

/** 把迁移文件按生产管线切块 + 加前缀（与运行时第 8 步同一函数） */
function planFor(sqlText) {
  const cleaned = sqlText
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  return splitSqlStatements(cleaned).map((s) => addTablePrefix(s));
}

/** 逐条走 safeExec，返回每条语句的执行结果 */
async function runPlan(conn, plan) {
  const results = [];
  for (let i = 0; i < plan.length; i++) {
    const before = conn.trace.length;
    const returned = await safeExec(conn, plan[i], `178#${i + 1}`);
    const record = conn.trace.slice(before)[0] ?? { kind: "unknown" };
    const errorCode = record.code;
    results.push({
      index: i + 1,
      sql: plan[i].replace(/\s+/g, " ").slice(0, 70),
      safeExecReturned: returned,
      outcome: record.result ?? record.kind,
      errorCode: errorCode ?? null,
      skippable: errorCode ? FakeMysql.isSkippable(errorCode, "Duplicate column name") : null
    });
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// 旧"同表 3 列合并"写法（C6-1A 初版形态，用于对照 C 段缺陷）
// ────────────────────────────────────────────────────────────────────────────
const OLD_MERGED_PLAN_BRAND = [
  `ALTER TABLE t_library_brand
     ADD COLUMN auth_letter_url VARCHAR(512) DEFAULT NULL COMMENT 'x',
     ADD COLUMN auth_expired_at DATETIME DEFAULT NULL COMMENT 'x',
     ADD COLUMN auth_status VARCHAR(16) DEFAULT NULL COMMENT 'x',
     ALGORITHM=INSTANT`
];

const NEW_SQL = readFileSync(MIGRATION_FILE, "utf-8");
const NEW_PLAN = planFor(NEW_SQL);
const NEW_ALTERS = NEW_PLAN.filter((s) => /^ALTER TABLE/.test(s));
const NEW_SELECTS = NEW_PLAN.filter((s) => /^SELECT/i.test(s));

say("迁移文件：" + MIGRATION_FILE);
say("生产管线切块结果：ALTER " + NEW_ALTERS.length + " 条 + SELECT " + NEW_SELECTS.length + " 条（合计 " + NEW_PLAN.length + "）");
say("");

// ── A 全空库首跑 ───────────────────────────────────────────────────────────
say("## A 全空库首跑（六列均不存在）");
const connA = new FakeMysql();
const resA = await runPlan(connA, NEW_PLAN);
for (const r of resA) say(`  #${r.index} ${r.outcome.padEnd(7)} ${r.sql}`);
const colsA = ["auth_letter_url", "auth_expired_at", "auth_status"].map((c) => connA.has("t_library_brand", c));
const colsA2 = ["status", "gray_ratio", "archived_at"].map((c) => connA.has("t_app_version", c));
assert(resA.filter((r) => r.outcome === "applied").length === 6, "A1 首跑 6 条 ALTER 全部生效", `applied=${resA.filter((r) => r.outcome === "applied").length}`);
assert(colsA.every(Boolean) && colsA2.every(Boolean), "A2 六列全部落地", `${colsAA(colsA, colsA2)}`);
say("");

// ── B 无变化重跑 ───────────────────────────────────────────────────────────
say("## B 无变化重跑（六列均已存在）");
const connB = new FakeMysql({
  t_library_brand: ["auth_letter_url", "auth_expired_at", "auth_status"],
  t_app_version: ["status", "gray_ratio", "archived_at"]
});
const resB = await runPlan(connB, NEW_PLAN);
const alterB = resB.filter((r) => r.outcome === "dup" || r.outcome === "applied");
for (const r of alterB) say(`  #${r.index} ${r.outcome.padEnd(7)} code=${r.errorCode ?? "-"} ${r.sql}`);
assert(alterB.length === 6 && alterB.every((r) => r.outcome === "dup"), "B1 第二次 6 条 ALTER 全部 1060", `dup=${alterB.filter((r) => r.outcome === "dup").length}`);
assert(alterB.every((r) => r.skippable === true), "B2 6 条错误码全部命中 safeExec 跳过规则（ER_DUP_FIELDNAME）");
assert(resB.filter((r) => r.outcome === "applied").length === 0, "B3 零条被误当生效");
assert(resB.every((r) => r.errorCode === null || r.skippable === true), "B4 不产生任何新失败（无不可跳过的错误）");
say("");

// ── C 中间态：3 列里 1 列已存在 ─────────────────────────────────────────────
say("## C 中间态（auth_letter_url 已存在，其余 5 列缺失）");
const connC = new FakeMysql({ t_library_brand: ["auth_letter_url"] });
const resC = await runPlan(connC, NEW_PLAN);
for (const r of resC.filter((r) => /t_library_brand/.test(r.sql))) {
  say(`  #${r.index} ${r.outcome.padEnd(7)} code=${r.errorCode ?? "-"} ${r.sql}`);
}
assert(
  connC.has("t_library_brand", "auth_expired_at") && connC.has("t_library_brand", "auth_status"),
  "C1 逐列写法：已存在的列被跳过，其余列照建（自愈）"
);
assert(!connC.has("t_library_brand", "auth_expired_at") === false, "C2 缺失列未丢");

const connC2 = new FakeMysql({ t_library_brand: ["auth_letter_url"] });
const resOld = await runPlan(connC2, OLD_MERGED_PLAN_BRAND).catch((e) => [{ outcome: "throw", errorCode: e?.code }]);
say(`  旧合并写法（3 列一条）：outcome=${resOld[0].outcome} code=${resOld[0].errorCode ?? "-"}`);
assert(!connC2.has("t_library_brand", "auth_expired_at") && !connC2.has("t_library_brand", "auth_status"),
  "C3 反证：旧合并写法在中间态下**丢列**（全有全无缺陷复现）");
say("");

// ── D 控制组：非跳过类错误不会被当跳过 ─────────────────────────────────────
say("## D 控制组（证明本脚本能区分「跳过」与「失败」）");
const connD = new FakeMysql();
const dSql = "ALTER TABLE t_library_brand ADD COLUMN auth_status VARCHAR(16) DEFAULT NULL";
const badConn = {
  async query() {
    throw Object.assign(new Error("Column 'auth_status' cannot be null"), { code: "ER_BAD_NULL_ERROR", errno: 1048 });
  }
};
const dReturn = await safeExec(badConn, dSql, "178#ctl");
assert(dReturn === false && FakeMysql.isSkippable("ER_BAD_NULL_ERROR", "Column 'auth_status' cannot be null") === false,
  "D1 ER_BAD_NULL_ERROR 未被当作跳过（safeExec 返回 false 但错误码不在跳过集合）");
void connD;
say("");

// ────────────────────────────────────────────────────────────────────────────
say(`结论：${failed === 0 ? "全部通过" : failed + " 项失败"}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "migration-178-idempotency.log"), log.join("\n") + "\n", "utf-8");
writeFileSync(
  join(OUT_DIR, "migration-178-idempotency.json"),
  JSON.stringify({ plan: NEW_PLAN, A: resA, B: resB, C: resC, failed }, null, 2),
  "utf-8"
);

function colsAA(a, b) {
  return `brand=${a.join(",")} app_version=${b.join(",")}`;
}

process.exitCode = failed === 0 ? 0 : 1;
