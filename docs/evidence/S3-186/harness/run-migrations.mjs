/**
 * S3-186 装置①：按**产品真实路径**跑一遍启动期迁移（backend/dist/shared/migration.js 的 runMigrations()）。
 *
 * 用法（cwd = 仓库根，环境变量见 run-case.ps1）：
 *   node docs/evidence/S3-186/harness/run-migrations.mjs
 *
 * 读环境变量：S3186_REPO_ROOT / DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / JWT_SECRET / MIGRATION_WRITE_GATE
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.env.S3186_REPO_ROOT;
if (!root) throw new Error("必须设置 S3186_REPO_ROOT");

const mod = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);
await mod.runMigrations();
console.log("RUN_MIGRATIONS_RETURNED");
