#!/usr/bin/env node
/**
 * S3-235 证据装置：逐语句打印 `docs/migrations/205_角色权限种子.sql` 的受影响行数
 *
 * 为什么另写装置（而不是只看 run-migration.mjs 的 exit 0）：
 *   `scripts/run-migration.mjs` 把整份文件当**一条多语句查询**下发，只打印最后一条 SELECT 的结果，
 *   语句级 affectedRows / changedRows 被丢掉 ⇒"第二遍零变更"这句话在那里**没有原始输出可核**。
 *   本装置用同一份文件、同一台库、同样的 multipleStatements 通道，把每个写语句的
 *   affectedRows / changedRows 逐条打出来。
 *
 * 用法（仓库根执行；连接参数取环境变量，**不打印任何凭据**）：
 *   DB_HOST=127.0.0.1 DB_PORT=3421 DB_USER=root DB_NAME=liq235_green \
 *     node docs/evidence/S3-235/tools/run-205-idempotency.mjs [migrationFile]
 *
 * 边界（诚实标注）：本装置只证明**迁移 SQL 自身的幂等/非破坏**；
 *   它不替代"后端启动链（写闸门）"与"灾备实际切换"的验证——那两条见本单 README §三/§四。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mysql = require("mysql2/promise");

const migrationFile = process.argv[2] ?? "docs/migrations/205_角色权限种子.sql";
const sqlContent = readFileSync(resolve(process.cwd(), migrationFile), "utf-8");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3421),
  user: process.env.DB_USER ?? "root",
  database: process.env.DB_NAME ?? "liq235_green",
  multipleStatements: true,
  connectTimeout: 10000,
});

try {
  const [results] = await conn.query(sqlContent);
  const sets = Array.isArray(results) ? results : [results];
  const writeSets = [];
  const summary = sets.map((set, index) => {
    if (Array.isArray(set)) {
      const first = set[0] ?? null;
      return { statement: index + 1, kind: "select", rows: set.length, result: first?.result ?? first };
    }
    const ok = set ?? {};
    const row = {
      statement: index + 1,
      kind: "write",
      affectedRows: ok.affectedRows ?? null,
      changedRows: ok.changedRows ?? null,
      info: ok.info ?? null,
    };
    writeSets.push(row);
    return row;
  });

  console.log(`文件: ${migrationFile}`);
  console.log(`库: ${process.env.DB_NAME ?? "liq235_green"} @ ${process.env.DB_HOST ?? "127.0.0.1"}:${process.env.DB_PORT ?? 3421}`);
  console.log(JSON.stringify(summary, null, 2));
  const touched = writeSets.filter((s) => (s.affectedRows ?? 0) > 0 || (s.changedRows ?? 0) > 0);
  console.log(`写语句 ${writeSets.length} 条；命中行（affectedRows>0 或 changedRows>0）的语句 = ${touched.length} 条`);
  console.log(
    `判定：${touched.length === 0
      ? "本遍零变更（幂等成立：既没有插入、也没有改动任何行）"
      : `本遍有变更（语句序号 ${touched.map((s) => s.statement).join(", ")}）`}`
  );
} finally {
  await conn.end();
}
