import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL(resolve(process.cwd(), "backend/dist/shared/migration.js")).href);
const { splitSqlStatements } = mod;
const sql = readFileSync("docs/migrations/205_角色权限种子.sql", "utf-8");
const chunks = splitSqlStatements(sql);
console.log("chunk 总数 =", chunks.length);
function codeHead(s) {
  for (const l of s.split("\n")) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith("--") || t.startsWith("#") || t.startsWith("/*")) continue;
    return t.slice(0, 90);
  }
  return "(仅注释)";
}
chunks.forEach((c, i) => console.log(String(i + 1).padStart(2, "0"), "|", codeHead(c), "| len=", c.length));
