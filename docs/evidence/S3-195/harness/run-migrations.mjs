/**
 * S3-195：用**产品自己的迁移管线**在本机私有 MariaDB 空库上建结构（不是手写 DDL）。
 *
 * 用法（在 backend 目录执行，需先 `npm --workspace backend run build` 产出 dist）：
 *   $env:MIGRATION_WRITE_GATE='allow'; node ../docs/evidence/S3-195/harness/run-migrations.mjs
 * 环境：本机私有 MariaDB 127.0.0.1:3406（root/空口令，只碰 s3195_* 库）。
 * 配方来源：S3-192 的同名脚手架（docs/evidence/S3-192/harness/05-run-product-migrations.mjs）。
 */
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3406";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "";
process.env.DB_NAME = process.env.DB_NAME || "s3195_full";
process.env.JWT_SECRET = process.env.JWT_SECRET || "s3195-local-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.USE_MOCK_DB = "false";

const { runMigrations } = await import("../../../../backend/dist/shared/migration.js");

console.log(
  `[S3-195] runMigrations 开始 db=${process.env.DB_NAME} writeGate=${process.env.MIGRATION_WRITE_GATE ?? "<未设置=block>"}`
);
await runMigrations();
console.log("[S3-195] runMigrations 结束");
process.exit(0);
