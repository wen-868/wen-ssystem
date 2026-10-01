import { pathToFileURL } from "node:url";
import { join } from "node:path";
const root = process.env.S3144_SCRATCH;
const { runMigrations } = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);
await runMigrations();
console.log("RUN_MIGRATIONS_RETURNED");
