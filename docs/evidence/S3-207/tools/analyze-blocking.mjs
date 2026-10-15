/**
 * 复核工具：把门禁的 BLOCK 清单（"有 tenant_id 字样但没有绑定到调用者租户的条件"）逐条摊开，
 * 并用**真库 schema** 判断"收紧判据后注入会怎样"：
 *   · 该 SQL 里出现 ≥2 张**带 tenant_id 列**的表 ⇒ 注入的是无限定列名 `tenant_id = ?` ⇒ **1052 歧义（会 500）** ⇒ 必须显式补谓词
 *   · 只有 1 张带 tenant_id 的表 ⇒ 注入安全（补一个正确谓词），但要确认该查询**不是平台级跨租户**意图
 *
 * 用法：node docs/evidence/S3-207/tools/analyze-blocking.mjs [仓库根] [库名]
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(process.argv[2] || path.join(HERE, "..", "..", "..", ".."));
const DB = process.argv[3] || "s3207_main";

const guard = await import(pathToFileURL(path.join(REPO, "backend", "scripts", "guard-tenant-injection.mjs")).href);
const rows = guard.scan(REPO).filter((r) => r.verdict === "BLOCK-MISSING-TENANT-CONDITION");

const db = await mysql.createConnection({ host: "127.0.0.1", port: 3408, user: "root", password: "", database: DB });
const cols = (await db.query(
  "SELECT TABLE_NAME AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'tenant_id'",
  [DB]
))[0];
const haveTenant = new Set(cols.map((c) => c.t));

/** 从 SQL 里抽表名（FROM/JOIN 后的标识符，去别名） */
function tables(sql) {
  const out = new Set();
  const re = /\b(?:from|join)\s+`?([a-z0-9_]+)`?(\s+(?:as\s+)?([a-z0-9_]+))?/gi;
  let m;
  const kw = /^(on|where|group|order|limit|left|inner|join|having|and|or)$/i;
  while ((m = re.exec(sql))) {
    out.add(m[1]);
    if (m[3] && !kw.test(m[3])) out.add(m[1]); // 别名忽略，只留表名
  }
  return [...out];
}

const lines = [];
for (const r of rows) {
  const ts = tables(r.sql);
  const withTenant = ts.filter((t) => haveTenant.has(t));
  const risk = withTenant.length >= 2 ? "1052-会500（必须显式补谓词）" : "注入安全（补一个正确谓词）";
  lines.push(
    `${r.file}:${r.line}  [${r.stmt}] join=${r.hasJoin}\n` +
      `  表：${ts.join(", ")}｜带 tenant_id 的表：${withTenant.join(", ") || "(无)"}\n` +
      `  判定：${risk}\n  SQL（截断 600）：${r.sql.slice(0, 600)}\n`
  );
}
const outPath = path.join(REPO, "docs", "evidence", "S3-207", "raw", "74-blocking-analysis.txt");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`BLOCK ${rows.length} 条 → ${outPath}`);
console.log(`其中 1052 风险（≥2 张带 tenant_id 表）：${lines.filter((l) => l.includes("1052-会500")).length} 条`);
await db.end();
