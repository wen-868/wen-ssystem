/**
 * S3-186 装置②：把目标库的**结构快照**落成 JSON（表 / 列 / 索引 / 存储过程残留）。
 *
 * 用法：node docs/evidence/S3-186/harness/snapshot.mjs <库名> <输出json路径>
 */
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const [, , dbName, outFile] = process.argv;
if (!dbName || !outFile) throw new Error("用法: snapshot.mjs <库名> <输出json路径>");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  multipleStatements: true,
});

const q = async (sql) => (await conn.query(sql))[0];

const tables = await q(
  `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
);
const columns = await q(
  `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
          COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION`
);
const indexes = await q(
  `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, INDEX_TYPE
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
);
const routines = await q(
  `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_NAME`
);

const snapshot = {
  db: dbName,
  takenAt: new Date().toISOString(),
  counts: {
    tables: tables.length,
    columns: columns.length,
    indexes: indexes.length,
    routines: routines.length,
  },
  tables,
  columns,
  indexes,
  routines,
};

writeFileSync(outFile, JSON.stringify(snapshot, null, 1), "utf8");
console.log(
  `SNAPSHOT OK db=${dbName} tables=${tables.length} columns=${columns.length} indexes=${indexes.length} routines=${routines.length}`
);
await conn.end();
