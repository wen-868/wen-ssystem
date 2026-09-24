/**
 * S3-109 反测脚本：把 docs/migrations/151_points_columns_fill.sql 逐条打到**真实 MariaDB** 上，
 * 复刻 migration.ts 第 8 步外部迁移管线（按 ';' 切块 → trim → 丢弃以 '--' 开头的块 → 跳过 SKIP_ERRORS）。
 *
 * 目的：用原始输出证明
 *   ① 旧形（redeem_ratio DECIMAL(6,4) DEFAULT 100）⇒ 该 ALTER 报 Invalid default value（失败）
 *   ② 旧形下紧随其后的 3 条 ALTER 依赖 redeem_ratio ⇒ 全部 ER_BAD_FIELD_ERROR 被跳过（连带打掉 4 列）
 *   ③ 新形（DECIMAL(10,2) DEFAULT 100）⇒ 15 条语句全过，4 列在 information_schema 中齐全且位置正确
 *
 * 用法：node s3-109-reverse-test.mjs --sql <迁移文件> --label <old|new> [--host 127.0.0.1] [--port 3399] [--user root]
 * 只读边界：只在专用临时实例（自带 datadir / 非 3306）上建**临时库** s3_109_probe_<label>，不触碰任何现有库。
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const sqlFile = arg("sql");
const label = arg("label", "run");
const host = arg("host", "127.0.0.1");
const port = Number(arg("port", "3399"));
const user = arg("user", "root");
const password = arg("password", "");
const dbName = `s3_109_probe_${label}`.replace(/[^0-9A-Za-z_]/g, "_");

if (!sqlFile) {
  console.error("缺少 --sql <迁移文件>");
  process.exit(2);
}

/** 与 backend/src/shared/migration.ts 对齐的跳过错误码（即生产“跳过”名单） */
const SKIP_ERRORS = new Set([
  "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_DUP_ENTRY",
  "ER_NO_SUCH_TABLE", "ER_TABLE_EXISTS_ERROR",
  "ER_BAD_TABLE_ERROR", "ER_BAD_FIELD_ERROR",
  "ER_CANT_CREATE_TABLE", "ER_ERROR_ON_RENAME",
  "ER_GET_ERRNO", "ER_IO_WRITE_ERROR",
  "ER_SP_DOES_NOT_EXIST", "ER_PARSE_ERROR",
  "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
]);

const log = (...parts) => console.log(...parts);

/** 复刻 migration.ts 第 8 步的切块与过滤（splitSqlStatements 口径：整行注释先剥离，再按 ';' 切块） */
function splitStatements(raw) {
  const stripped = raw
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (t.length === 0) return true;
      if (/^(USE|DELIMITER)\b/i.test(t)) return false;
      // 整行注释（`--` / `#`）剥离：等同 splitSqlStatements 对 chunk 开头整行注释的处理，
      // 且避免注释里的半角 `;` 被误当语句边界（踩坑[63] 的旧行为已在新实现中修掉）
      if (t.startsWith("--") || t.startsWith("#")) return false;
      return true;
    })
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^DROP\s+TABLE/i.test(s));
}

/** 071 里 t_points_record / t_points_rule 的基线 DDL（= 生产上 151 执行前的表形态） */
function baselineDdl() {
  const src = readFileSync(
    new URL("../../../migrations/071_客户积分.sql", import.meta.url),
    "utf-8",
  );
  const blocks = src
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /CREATE TABLE IF NOT EXISTS t_points_(record|rule)\b/.test(s));
  if (blocks.length !== 2) throw new Error(`基线 DDL 提取失败，命中 ${blocks.length} 条`);
  return blocks.map((b) => {
    const i = b.indexOf("CREATE TABLE");
    return b.slice(i);
  });
}

async function main() {
  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: false });
  const [verRows] = await conn.query("SELECT VERSION() AS v, @@sql_mode AS m, @@port AS p");
  const version = verRows[0].v;
  const sqlMode = verRows[0].m;
  const serverPort = verRows[0].p;

  log("================================================================");
  log(`S3-109 反测 · label=${label}`);
  log(`server  : ${version} @ ${host}:${serverPort}`);
  log(`sql_mode: ${sqlMode}`);
  log(`sql file: ${sqlFile}`);
  log("================================================================");

  const ddl = baselineDdl();
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.query(`CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`);
  await conn.query(`USE \`${dbName}\``);
  for (const b of ddl) await conn.query(b);
  log(`[setup] 临时库 ${dbName} 已建（t_points_record / t_points_rule 取自 071 基线 DDL）`);

  const stmts = splitStatements(readFileSync(sqlFile, "utf-8"));
  log(`[pipeline] 切块后待执行语句 ${stmts.length} 条（整行注释先剥离 + 按 ';' 切块，与 migration.ts splitSqlStatements 同口径）`);
  log("");

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  for (let i = 0; i < stmts.length; i += 1) {
    const stmt = stmts[i].replace(/\s+/g, " ");
    const short = stmt.length > 150 ? `${stmt.slice(0, 150)}...` : stmt;
    try {
      await conn.query(stmts[i]);
      ok += 1;
      log(`  [${String(i + 1).padStart(2)}] OK      ${short}`);
    } catch (err) {
      const isSkip = SKIP_ERRORS.has(err.code);
      if (isSkip) skipped += 1;
      else failed += 1;
      log(`  [${String(i + 1).padStart(2)}] ${isSkip ? "跳过" : "失败"}    errno=${err.errno} code=${err.code} sqlState=${err.sqlState}`);
      log(`        sqlMessage: ${err.sqlMessage}`);
      log(`        sql       : ${short}`);
    }
  }

  log("");
  log(`[汇总] 成功 ${ok} / 失败 ${failed} / 跳过(在生产即静默丢弃) ${skipped}`);
  log("");

  const [cols] = await conn.query(
    `SELECT ORDINAL_POSITION AS pos, COLUMN_NAME AS name, COLUMN_TYPE AS type,
            IFNULL(COLUMN_DEFAULT,'NULL') AS def
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_points_rule'
      ORDER BY ORDINAL_POSITION`,
    [dbName],
  );
  log(`[information_schema.COLUMNS] ${dbName}.t_points_rule —— ${cols.length} 列`);
  for (const c of cols) {
    log(`  ${String(c.pos).padStart(2)}  ${c.name.padEnd(20)} ${c.type.padEnd(14)} default=${c.def}`);
  }

  const want = ["redeem_ratio", "min_redeem_amount", "max_redeem_ratio", "expire_days"];
  const have = cols.map((c) => c.name);
  const missing = want.filter((w) => !have.includes(w));
  log("");
  log(`[断言] 本单 4 列存在性: ${missing.length === 0 ? "4/4 全部建成" : `缺 ${missing.length} 列 -> ${missing.join(", ")}`}`);
  log(`[断言] redeem_ratio 类型: ${have.includes("redeem_ratio") ? cols.find((c) => c.name === "redeem_ratio").type : "(不存在)"}`);

  const [mkt] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_points_rule'
        AND COLUMN_NAME IN ('earn_ratio','redeem_ratio','min_redeem_amount','max_redeem_ratio','expire_days')`,
    [dbName],
  );
  log(`[断言] 151 需补的 5 列（earn_ratio + 本单 4 列）已存在 ${mkt[0].n}/5`);

  // ---- 生产功能面：复刻 marketing-points.service.ts:95-107 的“积分规则保存” INSERT ----
  log("");
  log("[DML] 复刻 marketing-points.service.ts:95 的 INSERT INTO t_points_rule (earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled, tenant_id)");
  try {
    await conn.query(
      `INSERT INTO t_points_rule (earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 100, 0, 0.5, 365, 0, "probe"],
    );
    const [rows] = await conn.query(
      `SELECT id, earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled
         FROM t_points_rule WHERE tenant_id = 'probe'`,
    );
    log(`  保存结果: OK，落库行 = ${JSON.stringify(rows[0])}`);
    const [calc] = await conn.query(
      `SELECT MIN(FLOOR(250 / redeem_ratio)) AS redeem_amount_yuan_for_250_points FROM t_points_rule WHERE tenant_id='probe'`,
    );
    log(`  语义校验: 250 积分按 redeem_ratio 可抵 ${calc[0].redeem_amount_yuan_for_250_points} 元（= floor(250/100)，与 marketing-points.service.ts:289 口径一致）`);
  } catch (err) {
    log(`  保存结果: 失败 errno=${err.errno} code=${err.code} sqlState=${err.sqlState}`);
    log(`  sqlMessage: ${err.sqlMessage}`);
  }

  await conn.query(`DROP DATABASE \`${dbName}\``);
  log(`[cleanup] 临时库 ${dbName} 已删除`);
  await conn.end();

  const expectFour = label === "new";
  const pass = expectFour ? missing.length === 0 : missing.length === 4;
  log("");
  log(`[结论] label=${label} 期望 4 列${expectFour ? "齐全" : "全缺"} -> ${pass ? "符合预期 PASS" : "不符合预期 FAIL"}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(3);
});
