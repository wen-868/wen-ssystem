/**
 * 逐条核对"多表 + `${}` 插值"调用点：把它们**本函数内**的 where/conditions 构造行（含 tenant_id 的行）打出来，
 * 用于人工判定"插值片段到底带不带租户谓词"（门禁的自动理由只是启发式，必须人工定论）。
 * 用法：node docs/evidence/S3-207/tools/verify-interp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(path.join(HERE, "..", "..", "..", ".."));
const SRC = path.join(REPO, "backend", "src");

const g = await import(pathToFileURL(path.join(REPO, "backend", "scripts", "guard-tenant-injection.mjs")).href);
const rows = g.scan(REPO).filter((r) => r.verdict === "INDIRECT-NEEDS-REVIEW" && /\bjoin\b/i.test(r.sql));

const out = [];
for (const r of rows) {
  const lines = fs.readFileSync(path.join(SRC, r.file), "utf8").split(/\r?\n/);
  const lo = Math.max(0, r.line - 46);
  const win = lines.slice(lo, r.line - 1).map((t, k) => [lo + k + 1, t]);
  const filtered = win.filter(([, t]) => /conditions|where|tenant_id|params\.push/.test(t));
  out.push(
    `${r.file}:${r.line}\n` +
      filtered.map(([n, t]) => `    ${n}: ${t.trim()}`).join("\n") +
      `\n  SQL: ${r.sql.slice(0, 200)}\n`
  );
}
const p = path.join(REPO, "docs", "evidence", "S3-207", "raw", "7A-verify-interp.txt");
fs.writeFileSync(p, out.join("\n"), "utf8");
console.log(`${rows.length} 条多表插值调用点 → ${p}`);
