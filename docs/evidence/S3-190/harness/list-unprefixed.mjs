/**
 * S3-190 装置③：逐条列出 docs/migrations/*.sql 里"表名缺 t_ 前缀"的补列/补索引语句。
 *
 * 判据：行形如 `SET @s3186_tbl = '<表名>', @s3186_name = '<列/索引名>';`，且 <表名> 不以 `t_` 开头。
 * 输出：文件:行号 | 原表名 | 应有表名 | 列/索引名（机器可核对，供回传卡逐条引用）。
 *
 * 用法：node docs/evidence/S3-190/harness/list-unprefixed.mjs [仓库根]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = resolve(process.argv[2] || process.env.S3190_REPO_ROOT || process.cwd());
const dir = join(repo, "docs", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const rows = [];
for (const file of files) {
  const lines = readFileSync(join(dir, file), "utf8").split("\n");
  lines.forEach((raw, i) => {
    const m = raw.match(/^SET @s3186_tbl = '([a-z0-9_]+)', @s3186_name = '([a-z0-9_]+)';\s*$/);
    if (!m) return;
    const [, table, name] = m;
    if (table.startsWith("t_")) return;
    rows.push({ file, line: i + 1, table, expected: `t_${table}`, name });
  });
}

console.log("文件\t行号\t原表名\t应有表名\t列/索引名");
for (const r of rows) console.log(`${r.file}\t${r.line}\t${r.table}\t${r.expected}\t${r.name}`);
console.log(`合计 = ${rows.length} 条`);

const perFile = {};
for (const r of rows) perFile[r.file] = (perFile[r.file] || 0) + 1;
console.log(
  "按文件：" + Object.entries(perFile).map(([f, n]) => `${f}=${n}`).join(" ") || "（无）"
);
