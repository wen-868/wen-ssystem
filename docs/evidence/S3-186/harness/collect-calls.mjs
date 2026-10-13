/**
 * S3-186 装置④：用**产品真实切分器**（dist/shared/migration.js 的 splitSqlStatements）
 * 从 docs/migrations/*.sql 里抽出全部 `CALL ...` 语句（顺序与 runMigrations 第 8 步一致）。
 *
 * 用法：node docs/evidence/S3-186/harness/collect-calls.mjs <输出json>
 * 环境：S3186_REPO_ROOT（默认取 cwd）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.S3186_REPO_ROOT || process.cwd();
const outFile = process.argv[2];
if (!outFile) throw new Error("用法: collect-calls.mjs <输出json>");

const mod = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);

const dir = join(root, "docs", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();

const calls = [];
const perFile = [];
for (const file of files) {
  const raw = readFileSync(join(dir, file), "utf8");
  // 与 runMigrations 第 8 步一致：只移除 USE 行，保留 DELIMITER 行
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  const statements = mod.splitSqlStatements(cleaned);
  let count = 0;
  statements.forEach((stmt, i) => {
    if (mod.firstKeyword(stmt) === "CALL") {
      calls.push({
        file,
        stmtIndex: i,
        stmt,
        prefixed: mod.addTablePrefix(stmt),
        target: mod.statementTarget(stmt),
      });
      count += 1;
    }
  });
  if (count > 0) perFile.push({ file, calls: count });
}

const byTarget = {};
for (const c of calls) byTarget[c.target] = (byTarget[c.target] || 0) + 1;

writeFileSync(
  outFile,
  JSON.stringify({ totalCalls: calls.length, perFile, byTarget, calls }, null, 1),
  "utf8"
);

console.log(`COLLECTED calls=${calls.length} files=${perFile.length}`);
console.log("按文件：" + perFile.map((p) => `${p.file}=${p.calls}`).join(" "));
console.log("按目标过程：" + Object.entries(byTarget).map(([k, v]) => `${k}=${v}`).join(" "));
