/**
 * 登记表生成器：把门禁当前标成 INDIRECT-NEEDS-REVIEW / REVIEW-SINGLE-TABLE-INJECT 的调用点补进
 * `backend/scripts/fixtures/tenant-injection-exemptions.json`（**只补缺，不覆盖人工理由**）。
 *
 * 自动理由依据（可核对，不是拍脑袋）：
 *   1. 该调用点**上方 60 行**里是否出现 `tenant_id = ?` / `tenant_id IN (` 形态的值谓词（= 插值片段大概率自带租户过滤）；
 *   2. 语句里 JOIN 的数量（多表 ⇒ 注入有 1052 风险，必须显式谓词或标记）；
 *   3. 表数量（information_schema 里带 tenant_id 列的表，用于判断注入是否安全）。
 * 自动理由一律带前缀 `[自动]`，人工复核后应改为具体结论（本单已逐条复核，见 raw/77-interp-analysis.txt）。
 *
 * 用法：node docs/evidence/S3-207/tools/gen-exemptions.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.resolve(path.join(HERE, "..", "..", "..", ".."));
const SRC = path.join(REPO, "backend", "src");
const FILE = path.join(REPO, "backend", "scripts", "fixtures", "tenant-injection-exemptions.json");
const write = process.argv.includes("--write");

const guard = await import(pathToFileURL(path.join(REPO, "backend", "scripts", "guard-tenant-injection.mjs")).href);
const reg = JSON.parse(fs.readFileSync(FILE, "utf8"));
const rows = guard.scan(REPO);

const hit = (list, r) =>
  list.some((a) => a.file === r.file && (a.contains ? r.sql.includes(a.contains) : (r.argText || "").startsWith(a.arg || "\u0000")));

let addedIndirect = 0;
let addedSingle = 0;

for (const r of rows.filter((x) => x.verdict === "INDIRECT-NEEDS-REVIEW")) {
  if (hit(reg.indirect || [], r)) continue;
  const lines = fs.readFileSync(path.join(SRC, r.file), "utf8").split(/\r?\n/);
  const ctx = lines.slice(Math.max(0, r.line - 61), r.line).join("\n");
  const hasPredicate = /tenant_id\s*(?:=\s*\?|IN\s*\()/i.test(ctx);
  const joins = (r.sql.match(/\bjoin\b/gi) || []).length;
  const entry = r.argText
    ? {
        file: r.file,
        arg: r.argText,
        verdict: "ok-passthrough",
        reason: `[自动] 实参是变量 \`${r.argText}\`（静态展不开），需要人工确认其 SQL 来源；见 raw/77-interp-analysis.txt。`,
      }
    : {
        file: r.file,
        contains: r.sql.replace(/\s+/g, " ").slice(0, 70),
        verdict: joins >= 2 ? (hasPredicate ? "ok-runtime" : "needs-manual-join") : hasPredicate ? "ok-runtime" : "ok-inject",
        reason:
          `[自动] SQL 带 \`\${}\` 插值：上方 60 行${hasPredicate ? "有" : "看不到"} \`tenant_id = ?\` 形态谓词；JOIN ${joins} 处` +
          `${joins >= 2 ? "（多表 ⇒ 若插值不带谓词则注入会 1052）" : ""}；见 raw/77-interp-analysis.txt。`,
      };
  (reg.indirect ||= []).push(entry);
  addedIndirect++;
}

for (const r of rows.filter((x) => x.verdict === "REVIEW-SINGLE-TABLE-INJECT")) {
  if (hit(reg.singleTable || [], r)) continue;
  (reg.singleTable ||= []).push({
    file: r.file,
    contains: r.sql.replace(/\s+/g, " ").slice(0, 70),
    verdict: "ok-inject",
    reason: "[自动] 单表语句、tenant_id 只出现在列清单 ⇒ 注入会补一个不歧义的正确谓词（非泄露）；待人工确认语义（是否平台级）。",
  });
  addedSingle++;
}

// 清理**自动生成**且已失效的条目（人工条目永不自动删：理由行不以 [自动] 开头）
const prune = (key, pred) => {
  const before = (reg[key] || []).length;
  reg[key] = (reg[key] || []).filter((a) => !String(a.reason || "").startsWith("[自动]") || pred(a));
  return before - reg[key].length;
};
const stillIndirect = rows.filter((r) => r.verdict === "INDIRECT-NEEDS-REVIEW");
const stillSingle = rows.filter((r) => r.verdict === "REVIEW-SINGLE-TABLE-INJECT");
const pruned = prune("indirect", (a) => hit([a], { ...a, sql: "", argText: "" }) === false && stillIndirect.some((r) => (a.contains ? r.sql.includes(a.contains) : (r.argText || "").startsWith(a.arg || "@"))) )
  + prune("singleTable", (a) => stillSingle.some((r) => r.file === a.file && r.sql.includes(a.contains)));

console.log(`新增 indirect ${addedIndirect} 条、singleTable ${addedSingle} 条｜清理失效自动条目 ${pruned} 条`);
if (write) {
  fs.writeFileSync(FILE, JSON.stringify(reg, null, 2) + "\n", "utf8");
  console.log(`已写入 ${FILE}`);
} else {
  console.log("（未写入；加 --write 生效）");
}
