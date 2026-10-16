#!/usr/bin/env node
/**
 * S3-232 证据装置：把迁移 204 的**每条语句的受影响行数**逐条打出来（幂等判据的机读证据）
 *
 * 为什么另写一个装置（而不是只看 run-migration.mjs 的 exit 0）：
 *   `scripts/run-migration.mjs` 把整份文件当**一条多语句查询**下发，只打印最后一条 SELECT 的结果，
 *   语句级"受影响行数"被丢掉 ⇒ "第二遍零变更"这句话在它那里**没有原始输出可核**。
 *   本装置用同一份文件、同一台库、同样的 multipleStatements 通道，把每个结果集的
 *   affectedRows / changedRows / info 逐条打出来：第一遍应为 1/1/14，第二遍应全为 0。
 *
 * 用法（仓库根执行）：node docs/evidence/S3-232/harness/run-204-idempotency.mjs [migrationFile]
 * 连接参数取环境变量（默认值 = 本机夹具库）：DB_HOST/DB_PORT/DB_USER/DB_NAME，
 *   口令为空（本机便携实例 root 无口令）——本装置**不打印任何连接凭据**。
 *
 * 边界（诚实标注）：本装置只证明**迁移 SQL 自身的幂等**，不替代"生产执行 + 只读复核"；
 *   生产实际执行仍须由凌舟用 `node scripts/run-migration.mjs docs/migrations/204_系统设置域权限点立码.sql`。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mysql = require("mysql2/promise");

const migrationFile = process.argv[2] ?? "docs/migrations/204_系统设置域权限点立码.sql";
const sqlContent = readFileSync(resolve(process.cwd(), migrationFile), "utf-8");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3399),
  user: process.env.DB_USER ?? "root",
  database: process.env.DB_NAME ?? "liquor_inventory",
  multipleStatements: true,
  connectTimeout: 10000,
});

try {
  const [results] = await conn.query(sqlContent);
  const sets = Array.isArray(results) ? results : [results];
  const summary = sets.map((set, index) => {
    if (Array.isArray(set)) {
      // SELECT：回一行结果
      return { statement: index + 1, kind: "select", rows: set.length, firstRow: set[0] ?? null };
    }
    const ok = set ?? {};
    return {
      statement: index + 1,
      kind: "write",
      affectedRows: ok.affectedRows ?? null,
      changedRows: ok.changedRows ?? null,
      info: ok.info ?? null,
    };
  });
  console.log(`文件: ${migrationFile}`);
  console.log(`库: ${process.env.DB_NAME ?? "liquor_inventory"} @ ${process.env.DB_HOST ?? "127.0.0.1"}:${process.env.DB_PORT ?? 3399}`);
  console.log(JSON.stringify(summary, null, 2));
  const writeSets = summary.filter((s) => s.kind === "write");
  const totalAffected = writeSets.reduce((sum, s) => sum + (s.affectedRows ?? 0), 0);
  console.log(`写语句 ${writeSets.length} 条；受影响行数合计 = ${totalAffected}`);
  console.log(`判定：${totalAffected === 0 ? "本遍零变更（幂等成立）" : "本遍有变更"}`);
} finally {
  await conn.end();
}
