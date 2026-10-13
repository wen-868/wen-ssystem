/**
 * S3-192（B 轨）：用**产品自己的迁移管线**在空库上建结构（不是手写 DDL）。
 *
 * 用法（在仓库根执行）：
 *   node docs/evidence/S3-192/harness/05-run-product-migrations.mjs
 * 环境：本机私有 MariaDB 127.0.0.1:3406（root/空口令）；库名默认 s3192_full。
 * 写闸门沿用产品默认（不设 MIGRATION_WRITE_GATE ⇒ block），由外部脚本按需传 allow。
 */
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3406";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "";
process.env.DB_NAME = process.env.DB_NAME || "s3192_full";
process.env.JWT_SECRET = process.env.JWT_SECRET || "s3192-local-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.USE_MOCK_DB = "false";

const { runMigrations } = await import("../../../../backend/dist/shared/migration.js");

console.log(`[S3-192] runMigrations 开始 db=${process.env.DB_NAME} writeGate=${process.env.MIGRATION_WRITE_GATE ?? "<未设置=block>"}`);
await runMigrations();
console.log("[S3-192] runMigrations 结束");
