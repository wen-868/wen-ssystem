/**
 * 复核工具②：对"字面量里有 tenant_id 字样、但没有可见值谓词、且带 `${}` 插值"的调用点（门禁标 INDIRECT-NEEDS-REVIEW），
 * 自动回看该调用点**上方 60 行**里插值变量（`${where}` / `${conditions.join(...)}` 等）的构造，判断插值内容里是否含租户谓词：
 *   · 构造里出现 `tenant_id` 的谓词 ⇒ 运行期会跳过注入（与旧行为一致）⇒ 判定 ok-runtime
 *   · 构造里**没有** ⇒ 运行期会注入（单表补正确谓词；多表 JOIN 可能 1052）⇒ 需要人工确认（判定 needs-manual）
 *
 * 用法：node docs/evidence/S3-207/tools/analyze-interp.mjs [仓库根]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(process.argv[2] || path.join(HERE, "..", "..", "..", ".."));
const SRC = path.join(REPO, "backend", "src");

const guard = await import(pathToFileURL(path.join(REPO, "backend", "scripts", "guard-tenant-injection.mjs")).href);
const rows = guard.scan(REPO).filter((r) => r.verdict === "INDIRECT-NEEDS-REVIEW");

const out = [];
for (const r of rows) {
  const file = path.join(SRC, r.file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const lo = Math.max(0, r.line - 61);
  const ctx = lines.slice(lo, r.line).join("\n");
  // 插值里的变量名（`${where}`、`${conditions.join(" AND ")}` 等）
  const interps = [...r.sql.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim());
  const varNames = [...new Set(interps.map((s) => (s.match(/^[A-Za-z_$][\w$]*/) || [""])[0]).filter(Boolean))];
  const tenantInCtx = /tenant_id/.test(ctx);
  const tenantPredicateInCtx = /tenant_id\s*(?:=\s*\?|IN\s*\()/i.test(ctx);
  const joins = (r.sql.match(/\bjoin\b/gi) || []).length;
  const verdict = tenantPredicateInCtx ? "ok-runtime（上方构造里有 tenant_id 值谓词）" : "needs-manual（上方看不到租户谓词）";
  out.push(
    [
      `${r.file}:${r.line}  join=${joins} interps=[${interps.join(" | ")}]`,
      `  变量：${varNames.join(", ") || "(无)"}｜上方 60 行含 tenant_id：${tenantInCtx}｜含 tenant_id 值谓词：${tenantPredicateInCtx}`,
      `  判定：${verdict}`,
      `  SQL：${r.sql.slice(0, 400)}`,
    ].join("\n")
  );
}
const p = path.join(REPO, "docs", "evidence", "S3-207", "raw", "77-interp-analysis.txt");
fs.writeFileSync(p, out.join("\n\n"), "utf8");
const ok = out.filter((s) => s.includes("ok-runtime")).length;
console.log(`INDIRECT ${rows.length} 条 → ${p}`);
console.log(`  上方构造里有租户值谓词（ok-runtime）：${ok}｜需要人工确认：${rows.length - ok}`);
for (const s of out) if (s.includes("needs-manual")) console.log("  NEEDS-MANUAL " + s.split("\n")[0]);
