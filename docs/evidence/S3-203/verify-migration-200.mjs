#!/usr/bin/env node
/**
 * S3-203 证据装置：在**本机 MySQL 8 空库副本**上验证迁移 200（不碰生产）
 *
 * 做四件事（每件都落原始输出）：
 *   ① 建最小同构副本：表 DDL **原样取自仓库**（t_sys_user 取 backend/src/shared/migration.ts 的内嵌 DDL；
 *      t_platform_admin 取 docs/migrations/080_平台管理员.sql），并灌入迁移前的账号行
 *      （哈希取仓内历史迁移 075/127 的真实值；store_manager 另置 login_fail_count=21 复刻生产被爆破态）；
 *   ② 跑**第一遍**迁移 200：逐条打印 affectedRows（应命中）；
 *   ③ 跑**第二遍**：逐条打印 affectedRows（UPDATE 应全为 0 = 幂等零变更）；
 *   ④ 口令语义复核：用与 backend/src/shared/password.ts 同口径的 bcrypt 校验 ——
 *      新口令匹配、旧公开口令不匹配；并复核 demo 已停用。
 *
 * 用法（本机）：node docs/evidence/S3-203/verify-migration-200.mjs
 * 依赖：mysql2 / bcryptjs 来自工作树 node_modules（不新增依赖）
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const outDir = join(here, "outputs");
mkdirSync(outDir, { recursive: true });

const DB = {
  host: process.env.S3203_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.S3203_DB_PORT ?? 3408),
  user: process.env.S3203_DB_USER ?? "root",
  password: process.env.S3203_DB_PASSWORD ?? "",
};
const DB_NAME = "s3203_account_scope";
const PREFIX = "v2$";
const verify = (pw, hash) => bcrypt.compareSync(pw, hash.slice(PREFIX.length));

/** 从仓库文件里按表名抠出 CREATE TABLE 块（保证副本 DDL 与仓库逐字一致，不手抄） */
function extractCreateTable(text, table) {
  const start = text.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  if (start < 0) throw new Error(`未找到 CREATE TABLE ${table} 定义`);
  let depth = 0;
  let i = text.indexOf("(", start);
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const end = text.indexOf(";", i);
  // migration.ts 里的 DDL 是**模板字符串**：截到闭合反引号为止，避免把 JS 尾巴带进 SQL
  return text.slice(start, end + 1).split("`")[0];
}

const sysUserDdl = extractCreateTable(
  readFileSync(join(repoRoot, "backend/src/shared/migration.ts"), "utf8"),
  "t_sys_user"
);
const platformAdminDdl = extractCreateTable(
  readFileSync(join(repoRoot, "docs/migrations/080_平台管理员.sql"), "utf8"),
  "t_platform_admin"
);
const migrationSql = readFileSync(join(repoRoot, "docs/migrations/200_账号口径统一.sql"), "utf8");

/** 迁移前状态：哈希取仓内历史迁移的真实值（075 = admin/store 三个账号，127 = 门店两账号） */
const OLD_ADMIN_HASH = "v2$$2b$12$biWP7DS78S7ZGnRr7j44lOUVoRHQsWSkMWws3Y6yoZTtA3j/zWECq"; // 075
const OLD_STORE_HASH = "v2$$2b$12$onxTslZGnbLqxNBA0GExa.I/UCHfvJ4enB5qVWpbyhkj3j9FOg7I6"; // 127
const OLD_PLATFORM_HASH = OLD_ADMIN_HASH;

/** 迁移目标哈希（与迁移文件同值，用于复核） */
const NEW_ADMIN_HASH = "v2$$2b$12$v8wQ/Iwwz7md5Rqc9dkwKu4YVwTrbWWHR01xset3KFGkkY5RyU7Fm";
const NEW_SM_HASH = "v2$$2b$12$DTeP0h4Cyx7rcEiN.xJTz.N0joBOwbGUYkAyVJX8QHXbC/L.BA8cm";
const NEW_SO_HASH = "v2$$2b$12$B7OJyHZo.RIyBf11xcybgufSj/cGRpxZGg3WZXdI7J2IkrA8SShlq";
const NEW_DEMO_HASH = "v2$$2b$12$uqawxSVS3p.52cEABMQHNePTmEymW5bS/18JjrUe0SBqkvcbWFNZ2";

/** 明文只从环境变量取（脚本自身不含明文；本次运行由调用方注入） */
const ADMIN_PW = process.env.S3203_ADMIN_PW ?? "";
const SM_PW = process.env.S3203_SM_PW ?? "";
const SO_PW = process.env.S3203_SO_PW ?? "";
const OLD_PUBLIC_PW = "Demo@2026";

const log = [];
const say = (line) => {
  console.log(line);
  log.push(line);
};

// multipleStatements=true：与官方执行通道 scripts/run-migration.mjs 完全同语义（整文件下发），
// 且 mysql2 会按语句顺序返回**逐条结果** ⇒ 可以直接拿到每条 UPDATE 的 affectedRows。
const conn = await mysql.createConnection({ ...DB, multipleStatements: true, connectTimeout: 10000 });
say(`# 目标库：${DB.user}@${DB.host}:${DB.port}（本机副本库，非生产）`);

await conn.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
await conn.query(`CREATE DATABASE ${DB_NAME}`);
await conn.query(`USE ${DB_NAME}`);
await conn.query(sysUserDdl);
await conn.query(platformAdminDdl);
say(`# 副本已建：t_sys_user（DDL 取自 backend/src/shared/migration.ts）、t_platform_admin（DDL 取自 080）`);

await conn.query(
  `INSERT INTO t_sys_user (id, tenant_id, username, password_hash, real_name, status, login_fail_count, locked_until)
   VALUES (1, 'default', 'admin', ?, '系统管理员', 1, 0, NULL),
          (2, 'default', 'store_manager', ?, '默认店长', 1, 21, NULL),
          (3, 'default', 'store_operator', ?, '默认店员', 1, 0, NULL),
          (4, 'demo', 'demo', ?, '演示账号', 1, 0, NULL)`,
  [OLD_ADMIN_HASH, OLD_STORE_HASH, OLD_STORE_HASH, OLD_ADMIN_HASH]
);
await conn.query(
  `INSERT INTO t_platform_admin (id, username, password_hash, real_name, role, status)
   VALUES (1, 'admin', ?, '平台管理员', 'PLATFORM_SUPER_ADMIN', 1)`,
  [OLD_PLATFORM_HASH]
);
say("# 迁移前账号行已灌入（store_manager.login_fail_count=21 复刻生产被爆破态）");

const MIGRATION_STATEMENT_COUNT = 5; // 与 s3-203-migration-200.test.ts（用 runner 自身的 splitter）断言一致
say(`# 迁移 200 以官方通道语义整文件下发（本文件语句数 ${MIGRATION_STATEMENT_COUNT}，切分口径见同名 vitest 用例）`);

async function runPass(label) {
  say(`\n## ${label}`);
  const results = await conn.query(migrationSql);
  const list = Array.isArray(results) ? results : [results];
  say(`- 返回结果段 ${list.length} 个（有序对应文件内语句）`);
  list.forEach((res, idx) => {
    if (Array.isArray(res)) {
      // mysql2 在 multipleStatements 下把「ResultSetHeader + 行数组」混在同一个数组里：
      // 只挑真正的数据行打印，避免把列元数据刷进日志
      const writes = res.filter((x) => x && typeof x === "object" && "affectedRows" in x);
      const rows = res.filter((x) => x && typeof x === "object" && "src" in x);
      writes.forEach((w) => {
        say(`  [${idx + 1}] 写语句 ⇒ affectedRows=${w.affectedRows}, info="${w.info ?? ""}"`);
      });
      if (rows.length > 0) {
        say(`  [${idx + 1}] 验证 SELECT ⇒ ${rows.length} 行`);
        for (const row of rows) say(`      ${JSON.stringify(row)}`);
      }
    } else {
      say(`  [${idx + 1}] 写语句 ⇒ affectedRows=${res.affectedRows}, changedRows=${res.changedRows ?? "-"}`);
    }
  });
  return list;
}

async function snapshot() {
  const [rows] = await conn.query(
    `SELECT tenant_id, username, status, password_hash, login_fail_count, locked_until FROM t_sys_user ORDER BY id`
  );
  const [admins] = await conn.query(`SELECT username, status, password_hash FROM t_platform_admin ORDER BY id`);
  return { users: rows, platformAdmins: admins };
}

const pass1Results = await runPass("第一遍迁移");
const pass1State = await snapshot();

const pass2Results = await runPass("第二遍迁移（幂等：UPDATE 应全为 affectedRows=0）");
const pass2State = await snapshot();

/** 从 multipleStatements 的结果里抽出「写语句」的 affectedRows（顺序即文件内语句顺序） */
const writeRowsOf = (list) =>
  list
    .flatMap((r) => (Array.isArray(r) ? r : [r]))
    .filter((x) => x && typeof x === "object" && "affectedRows" in x)
    .map((x) => Number(x.affectedRows));

const pass1WriteRows = writeRowsOf(pass1Results);
const pass2WriteRows = writeRowsOf(pass2Results);
say(`\n# 第一遍写语句 affectedRows = ${JSON.stringify(pass1WriteRows)}（期望 4 条且全 >0）`);
say(`# 第二遍写语句 affectedRows = ${JSON.stringify(pass2WriteRows)}（期望 4 条且全为 0）`);

say("\n## 口令语义复核（bcrypt，与 backend/src/shared/password.ts 同口径）");
const checks = {
  admin_new_password_matches: verify(ADMIN_PW, NEW_ADMIN_HASH),
  admin_old_public_password_rejected: !verify(OLD_PUBLIC_PW, NEW_ADMIN_HASH),
  store_manager_new_password_matches: verify(SM_PW, NEW_SM_HASH),
  store_manager_old_public_password_rejected: !verify(OLD_PUBLIC_PW, NEW_SM_HASH),
  store_operator_new_password_matches: verify(SO_PW, NEW_SO_HASH),
  store_operator_old_public_password_rejected: !verify(OLD_PUBLIC_PW, NEW_SO_HASH),
  db_admin_hash_is_target: pass1State.users[0].password_hash === NEW_ADMIN_HASH,
  db_store_manager_hash_is_target: pass1State.users[1].password_hash === NEW_SM_HASH,
  db_store_operator_hash_is_target: pass1State.users[2].password_hash === NEW_SO_HASH,
  db_demo_disabled: Number(pass1State.users[3].status) === 0,
  db_demo_hash_is_random_target: pass1State.users[3].password_hash === NEW_DEMO_HASH,
  db_platform_admin_hash_is_target: pass1State.platformAdmins[0].password_hash === NEW_ADMIN_HASH,
  store_manager_lock_counters_reset:
    Number(pass1State.users[1].login_fail_count) === 0 && pass1State.users[1].locked_until === null,
  second_pass_zero_change: JSON.stringify(pass1State) === JSON.stringify(pass2State),
  second_pass_writes_zero_rows: pass2WriteRows.length === 4 && pass2WriteRows.every((n) => n === 0),
  first_pass_writes_all_lines: pass1WriteRows.length === 4 && pass1WriteRows.every((n) => n > 0),
};
say(JSON.stringify(checks, null, 2));

const failed = Object.entries(checks).filter(([, v]) => v !== true);
say(failed.length === 0 ? "\nPASS：全部断言通过" : `\nFAIL：${failed.map(([k]) => k).join(", ")}`);

writeFileSync(join(outDir, "10-migration-200-run.log"), log.join("\n") + "\n", "utf8");
writeFileSync(
  join(outDir, "11-migration-200-result.json"),
  JSON.stringify({ checks, pass1State, pass2State }, null, 2),
  "utf8"
);

await conn.end();
process.exit(failed.length === 0 ? 0 : 1);
