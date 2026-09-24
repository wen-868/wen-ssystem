/**
 * S3-57 交付物 3b：**真库空库验收脚本**（三段：建空库 → 跑 runner → 查 information_schema.ROUTINES）
 *
 * ⚠ 状态：**待凌舟在本机/服务器执行**。本工作区无 MySQL、无 Docker、无外网（127.0.0.1:3306 不通），
 *   本脚本**未在本沙箱运行过**，脚本里的"期望输出"是设计要求，不是已通过证据。
 *
 * 用法（本机/服务器有 MySQL 时）：
 *   cd <repo>
 *   $env:D1B_DB_HOST="127.0.0.1"; $env:D1B_DB_PORT="3306"; $env:D1B_DB_USER="root"; $env:D1B_DB_PASSWORD="***"
 *   node docs/evidence/D1-S3-57/tools/d1b-empty-db-092-verify.mjs                # 模式 A：空库跑完整 runMigrations()
 *   node docs/evidence/D1-S3-57/tools/d1b-empty-db-092-verify.mjs --mode=092     # 模式 B：空库只跑 092_租户ID.sql
 *
 * 三段（脚本实际执行的 SQL 与顺序）：
 *   ① 建空库（固定库名 d1_s3_57_verify，**只对这一个专属库做 DROP/CREATE**）：
 *        DROP DATABASE IF EXISTS d1_s3_57_verify;
 *        CREATE DATABASE d1_s3_57_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
 *   ② 空库跑 runner：模式 A 调真实 `runMigrations()`（176 个迁移文件全都跑，092 在其中）；
 *      模式 B 读 `docs/migrations/092_租户ID.sql`，按调用点口径只去 USE 行，用**导出实现**
 *      `splitSqlStatements` 切分后逐条 `safeExec` 下发（等价于外部迁移段第 8 步，但不套写闸门）。
 *   ③ 查信息库：
 *        SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES
 *        WHERE ROUTINE_SCHEMA = 'd1_s3_57_verify' ORDER BY ROUTINE_NAME;
 *        SELECT COUNT(*) AS routines FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'd1_s3_57_verify';
 *
 * 期望输出（关键行）：
 *   [1] 空库已建：d1_s3_57_verify
 *   [2] 迁移 runner 执行完成（092_租户ID.sql 已跑）
 *   [3] information_schema.ROUTINES 残留 0 行（期望 0 行）
 *   PASS：无残留辅助存储过程
 * 判定口径：092 开头 `CREATE PROCEDURE add_column_if_not_exists / add_index_if_not_exists`，
 *   结尾 `DROP PROCEDURE IF EXISTS` 两条**必须真正下发**（修复前被 `continue` 跳过 ⇒ 本步会看到 2 行残留）。
 */
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  REPO_ROOT,
  TEST_DIR,
  createRuntime,
  readRealMigrationSource,
} from "../../MIG-5b/tools/mig5b-harness.mjs";

const VERIFY_DB = "d1_s3_57_verify";
const HELPER_ROUTINES = ["add_column_if_not_exists", "add_index_if_not_exists", "add_col_if_not_exists"];
const mode = process.argv.includes("--mode=092") ? "092" : "full";

const DB_HOST = process.env.D1B_DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.D1B_DB_PORT || 3306);
const DB_USER = process.env.D1B_DB_USER || "root";
const DB_PASSWORD = process.env.D1B_DB_PASSWORD || "";

const require = createRequire(join(REPO_ROOT, "package.json"));
const mysql = require("mysql2/promise");

async function main() {
  // ---------- ① 建空库 ----------
  let admin;
  try {
    admin = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
    });
  } catch (e) {
    console.log(`无法连接 MySQL（${DB_HOST}:${DB_PORT}）：${e.message}`);
    console.log("本脚本按设计**不在无 MySQL 的沙箱内执行**；请在凌舟本机/服务器上跑（见文件头用法）。");
    process.exitCode = 2;
    return;
  }
  await admin.query(`DROP DATABASE IF EXISTS \`${VERIFY_DB}\``);
  await admin.query(
    `CREATE DATABASE \`${VERIFY_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
  );
  console.log(`[1] 空库已建：${VERIFY_DB}`);
  await admin.end();

  // ---------- ② 空库跑 runner ----------
  process.env.DB_HOST = DB_HOST;
  process.env.DB_PORT = String(DB_PORT);
  process.env.DB_USER = DB_USER;
  process.env.DB_PASSWORD = DB_PASSWORD;
  process.env.DB_NAME = VERIFY_DB;
  process.env.USE_MOCK_DB = "false";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "d1b-verify-secret";
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  delete process.env.MIGRATION_WRITE_GATE; // 默认 block（与生产默认一致）

  const runtime = createRuntime({
    migrationSource: readRealMigrationSource(),
    testSource: "export {};",
    testPath: join(TEST_DIR, "d1b-virtual.test.ts"),
  });
  const migrationModule = runtime.loadMigrationModule();

  if (mode === "092") {
    const { readFileSync } = require("node:fs");
    const raw = readFileSync(join(REPO_ROOT, "docs", "migrations", "092_租户ID.sql"), "utf8");
    const cleaned = raw
      .split("\n")
      .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
      .join("\n");
    const statements = migrationModule.splitSqlStatements(cleaned);
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: VERIFY_DB,
      multipleStatements: true,
    });
    let dispatched = 0;
    for (const stmt of statements) {
      const ok = await migrationModule.safeExec(conn, migrationModule.addTablePrefix(stmt), "092");
      if (ok) dispatched += 1;
    }
    const procedures = statements.filter((s) => s.includes("CREATE PROCEDURE")).length;
    const drops = statements.filter((s) => /^DROP PROCEDURE IF EXISTS/i.test(s.trim())).length;
    await conn.end();
    console.log(
      `[2] 只跑 092_租户ID.sql 完成：拆出 ${statements.length} 条语句（CREATE PROCEDURE ${procedures} 条 / DROP PROCEDURE ${drops} 条），成功下发 ${dispatched} 条`
    );
  } else {
    await migrationModule.runMigrations();
    console.log("[2] 迁移 runner 执行完成（092_租户ID.sql 已跑）");
  }

  // ---------- ③ 查 information_schema.ROUTINES ----------
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: VERIFY_DB,
  });
  const [rows] = await conn.query(
    "SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME",
    [VERIFY_DB]
  );
  const [countRows] = await conn.query(
    "SELECT COUNT(*) AS routines FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?",
    [VERIFY_DB]
  );
  await conn.end();

  const routines = rows.map((r) => `${r.ROUTINE_NAME}(${r.ROUTINE_TYPE})`);
  const leftovers = routines.filter((name) => HELPER_ROUTINES.some((h) => name.startsWith(h)));
  console.log(`[3] information_schema.ROUTINES 残留 ${countRows[0].routines} 行（期望 0 行）`);
  console.log(`    明细：${routines.length ? routines.join("、") : "（无）"}`);
  if (leftovers.length > 0) {
    console.log(`FAIL：辅助存储过程仍残留 → ${leftovers.join("、")}`);
    process.exitCode = 1;
    return;
  }
  console.log("PASS：无残留辅助存储过程");
}

await main();
