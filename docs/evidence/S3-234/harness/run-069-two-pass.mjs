#!/usr/bin/env node
/**
 * S3-234 证据装置：069 幂等 + 两个分支（R1 的判据）。
 *
 * 装置做什么（三个用例，各自独立结论）：
 *   用例 A｜**两表都有 tenant_id**（真库建 scratch 库 + 造数）：
 *       跑 069 第一遍 ⇒ 租户内同名品牌被回填；**跨租户同名行必须仍为 NULL**（越界反测）；
 *       第二遍 ⇒ 受影响行数 0（幂等）。
 *   用例 B｜**t_product_spu 无 tenant_id**（本机夹具的真实形态）：
 *       跑 069 两遍 ⇒ 第 2 句走"整句跳过"分支、零错误码（这是修复前会整文件中止的那条路径）。
 *   用例 C｜**夹具库（已应用态）**：由外壳用**真实命令** `node scripts/run-migration.mjs <文件>` 跑两遍，
 *       本装置只负责打印跑前后读数（可选 `--caseC`）。
 *
 * 执行通道口径：用例 A/B/C 都用"整份文件当一条多语句查询下发"（= `scripts/run-migration.mjs` 的
 *   部署通道语义，**无** `addTablePrefix`）。启动期通道（逐语句 safeExec）另有 boot 装置覆盖。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/run-069-two-pass.mjs            # 跑 A + B
 *   node docs/evidence/S3-234/harness/run-069-two-pass.mjs --caseC    # 额外打印夹具库读数（跑前后各一次）
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(process.cwd());
const mysql = createRequire(path.join(repoRoot, "package.json"))("mysql2/promise");
const MIG = "docs/migrations/069_商品SPU增加品牌ID.sql";
const sqlText = fs.readFileSync(path.join(repoRoot, MIG), "utf-8");

const DB = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3409),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
};
const FIXTURE_DB = process.env.DB_NAME ?? "liquor_inventory";

const say = (s) => console.log(s);

/** 按部署通道语义执行一份迁移文件：一次 multipleStatements 查询；报错即整文件中止 */
async function runMigrationFile(conn, label) {
  try {
    const [results] = await conn.query(sqlText);
    const sets = Array.isArray(results) ? results : [results];
    let affected = 0;
    const placeholders = [];
    sets.forEach((set) => {
      if (Array.isArray(set)) {
        if (set.length && typeof set[0] === "object") placeholders.push(Object.values(set[0]).join(" | "));
        return;
      }
      if (set && typeof set === "object") affected += Number(set.affectedRows ?? 0);
    });
    say(`  [${label}] outcome=ok affectedRows合计=${affected} 回显=${placeholders.length} 条`);
    placeholders.forEach((p) => say(`        · ${p}`));
    return { outcome: "ok", affected };
  } catch (e) {
    say(`  [${label}] outcome=fail reason=${e.code ?? ""} ${e.message}`);
    return { outcome: "fail", affected: 0, reason: e.message };
  }
}

const readings = async (conn, table, withTenantColumn = true) =>
  withTenantColumn
    ? (
        await conn.query(
          `SELECT tenant_id, COUNT(*) rows_total, SUM(brand_id IS NOT NULL) filled FROM ${table} GROUP BY tenant_id ORDER BY tenant_id`,
        )
      )[0]
    : (
        await conn.query(
          `SELECT COUNT(*) rows_total, SUM(brand_id IS NOT NULL) filled FROM ${table}`,
        )
      )[0];

const structure = async (conn, db, table) =>
  (
    await conn.query(
      `SELECT (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${table}' AND COLUMN_NAME='brand_id') col_brand_id,
              (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${db}' AND TABLE_NAME='${table}' AND CONSTRAINT_NAME='fk_product_spu_brand') fk,
              (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME='${table}' AND INDEX_NAME='idx_product_spu_brand_id') idx`,
    )
  )[0];

async function scratchCase(name, withTenantColumn) {
  say("");
  say(`===== 用例 ${name}｜t_product_spu${withTenantColumn ? " 有" : " **无**"} tenant_id =====`);
  const admin = await mysql.createConnection(DB);
  await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await admin.query(`CREATE DATABASE \`${name}\` DEFAULT CHARSET utf8mb4`);
  await admin.end();
  const conn = await mysql.createConnection({ ...DB, database: name, multipleStatements: true });

  const tenantCol = withTenantColumn ? "tenant_id VARCHAR(36) NOT NULL DEFAULT 'default'," : "";
  await conn.query(
    `CREATE TABLE t_product_spu (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ${tenantCol} spu_code VARCHAR(64), name VARCHAR(128), brand VARCHAR(128), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await conn.query(
    `CREATE TABLE t_brand (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(128), tenant_id VARCHAR(36) NOT NULL DEFAULT 'default', PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await conn.query(`INSERT INTO t_brand (name, tenant_id) VALUES ('M1','default'), ('M2','other')`);
  // 造数：①本租户同名（应回填）②另一租户同名（应回填）③**跨租户同名**（brand=M1 属 default，商品属 other ⇒ 必须仍为 NULL）
  const insCols = withTenantColumn ? "(tenant_id, spu_code, name, brand)" : "(spu_code, name, brand)";
  const rowB = withTenantColumn ? ", ('other','S2','别租户同名','M2')" : ", ('S2','别租户同名','M2')";
  const rowC = withTenantColumn
    ? ", ('other','S3','跨租户同名(其余租户的品牌)','M1')"
    : ", ('S3','跨租户同名(其余租户的品牌)','M1')";
  const first = withTenantColumn ? "('default','S1','本租户同名','M1')" : "('S1','本租户同名','M1')";
  await conn.query(`INSERT INTO t_product_spu ${insCols} VALUES ${first}${rowB}${rowC}`);

  // 跑前只数行数：brand_id 列此刻还不存在（正是要被第 1 句守卫补上的那一列）
  const pre = (await conn.query("SELECT COUNT(*) rows_total FROM t_product_spu"))[0][0];
  say(`  跑前：${JSON.stringify(pre)}（brand_id 列尚不存在，等第 1 句守卫补）`);
  const p1 = await runMigrationFile(conn, "pass1");
  say(`  pass1 后：${JSON.stringify(await readings(conn, "t_product_spu", withTenantColumn))}｜结构 ${JSON.stringify(await structure(conn, name, "t_product_spu"))}`);
  const p2 = await runMigrationFile(conn, "pass2");
  say(`  pass2 后：${JSON.stringify(await readings(conn, "t_product_spu", withTenantColumn))}｜结构 ${JSON.stringify(await structure(conn, name, "t_product_spu"))}`);
  if (withTenantColumn) {
    const cross = (
      await conn.query(`SELECT brand_id FROM t_product_spu WHERE spu_code='S3'`)
    )[0][0];
    say(`  跨租户反测：S3（tenant_id=other，brand=M1 属 default）的 brand_id = ${cross.brand_id === null ? "NULL（未越界 ✓）" : `${cross.brand_id}（越界 ✗）`}`);
    const self = (await conn.query(`SELECT COUNT(*) c FROM t_product_spu WHERE brand_id IS NOT NULL`))[0][0].c;
    say(`  租户内回填：已回填 ${self} 行（期望 2：本租户 M1 + 别租户 M2）`);
  }
  await conn.end();
  say(`  结论：pass1=${p1.outcome}／pass2=${p2.outcome}`);
  return { p1, p2 };
}

if (process.argv.includes("--caseC")) {
  say("===== 用例 C｜夹具库（已应用态）读数 =====");
  const conn = await mysql.createConnection({ ...DB, database: FIXTURE_DB });
  say(`  结构 ${JSON.stringify(await structure(conn, FIXTURE_DB, "t_product_spu"))}`);
  say(`  数据 ${JSON.stringify(await readings(conn, "t_product_spu", false))}（夹具 t_product_spu 无 tenant_id ⇒ 不按租户分组）`);
  await conn.end();
}

await scratchCase("s3241_069_a", true);
await scratchCase("s3241_069_b", false);
say("");
say("== 两个用例跑完（原始输出即上方正文；退出码 0 = 装置本身无异常）");
