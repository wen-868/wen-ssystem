/**
 * B-2b 同族影响面扫描器（只读）
 *
 * 目标：找出全仓「表有 tenant_id 列（DDL 依据）且 INSERT 列清单不含 tenant_id」的写路径。
 * 用法：node docs/evidence/B-2b/probe/b2b-scan-tenant-id.mjs [--json]
 *
 * 设计说明（为什么这么扫）：
 *  1. 表集合来自 DDL 依据：`CREATE TABLE ... (含 tenant_id)` + `CALL add_column_if_not_exists('t','tenant_id',...)`；
 *  2. 写路径来自代码：正则匹配 `INSERT INTO <表> (<列清单>)`，逐条判断列清单是否含 tenant_id；
 *  3. 没有显式列清单的 INSERT 单列一类（依赖列顺序，风险不同）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["backend/src"];
const DDL_GLOBS = [
  "docs/init_database.sql",
  "docs/migrations",
  "backend/src/shared/migration.ts",
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");

// ---------- 1. 表集合（有 tenant_id 列的表） ----------
const tablesWithTenant = new Map(); // table -> [{file, line, kind}]

function addTable(table, file, line, kind, def) {
  const key = table.toLowerCase();
  if (!tablesWithTenant.has(key)) tablesWithTenant.set(key, []);
  tablesWithTenant.get(key).push({ table, file, line, kind, def });
}

function scanDdlFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  // CALL add_column_if_not_exists('t_xxx', 'tenant_id', "...")
  const callRe = /add_column_if_not_exists\(\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Za-z0-9_]+)'/g;
  let m;
  while ((m = callRe.exec(text)) !== null) {
    if (m[2].toLowerCase() !== "tenant_id") continue;
    const line = text.slice(0, m.index).split(/\r?\n/).length;
    const semi = text.indexOf(";", m.index);
    const def = text.slice(m.index, semi > 0 ? semi : m.index + 300).replace(/\s+/g, " ").trim();
    addTable(m[1], rel(file), line, "CALL add_column", def);
  }

  // CREATE TABLE 块
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\(/gi;
  while ((m = createRe.exec(text)) !== null) {
    const start = m.index + m[0].length - 1; // 指向 '('
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) continue;
    const body = text.slice(start, end);
    const defMatch = body.match(/^[ \t]*`?tenant_id`?[^\n]*/im);
    if (!defMatch) continue;
    const line = text.slice(0, m.index).split(/\r?\n/).length;
    const tl = lines[line - 1] ?? "";
    addTable(m[1], rel(file), line, "CREATE TABLE", defMatch[0].trim());
  }

  // ALTER TABLE ... ADD COLUMN tenant_id
  const alterRe = /ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s+ADD\s+(?:COLUMN\s+)?`?tenant_id`?/gi;
  while ((m = alterRe.exec(text)) !== null) {
    const line = text.slice(0, m.index).split(/\r?\n/).length;
    const end = text.indexOf(";", m.index);
    const def = text.slice(m.index, end > 0 ? end : m.index + 200).replace(/\s+/g, " ").trim();
    addTable(m[1], rel(file), line, "ALTER TABLE ADD COLUMN", def);
  }
}

for (const g of DDL_GLOBS) {
  const target = path.join(ROOT, g);
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!stat) continue;
  if (stat.isDirectory()) {
    for (const f of walk(target)) if (f.endsWith(".sql")) scanDdlFile(f);
  } else {
    scanDdlFile(target);
  }
}

// ---------- 2. 写路径（INSERT INTO） ----------
const inserts = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    if (!file.endsWith(".ts")) continue;
    const text = fs.readFileSync(file, "utf8");
    const re = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(\()?/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const table = m[1];
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      // 执行器：INSERT 文本之前的最近一次调用（用于判断是否走 queryWithTenant 的自动注入）
      const before = text.slice(Math.max(0, m.index - 240), m.index);
      const execMatch = before.match(
        /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?:<[^<>]{0,300}>)?\s*\(\s*[`'"]?\s*$/s
      );
      const executor = execMatch ? execMatch[1] : "(未知)";
      let cols = null;
      if (m[2]) {
        const start = m.index + m[0].length - 1;
        let depth = 0;
        let end = -1;
        for (let i = start; i < text.length; i++) {
          if (text[i] === "(") depth++;
          else if (text[i] === ")") {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        if (end > 0) {
          cols = text
            .slice(start + 1, end)
            .split(",")
            .map((c) => c.trim().replace(/^`|`$/g, "").replace(/\s+/g, ""))
            .filter(Boolean);
          re.lastIndex = end;
        }
      }
      inserts.push({ table, file: rel(file), line, cols, executor });
    }
  }
}

const isTest = (f) => f.includes("/__tests__/");
const normalized = (t) => t.toLowerCase();

const hasDefaultDefault = (defs) =>
  defs.some((d) => /default\s+'default'/i.test(d.def || ""));

const candidates = inserts.filter((i) => {
  const known = tablesWithTenant.get(normalized(i.table));
  if (!known) return false;
  if (!hasDefaultDefault(known)) return false; // 只统计 tenant_id 列带 DEFAULT 'default' 的表（静默写入才可能发生）
  if (!i.cols) return true; // 无列清单：单列一类
  return !i.cols.map((c) => c.toLowerCase()).includes("tenant_id");
});

const out = {
  generatedAt: new Date().toISOString(),
  tablesWithTenantId: tablesWithTenant.size,
  insertStatements: inserts.length,
  candidateCount: candidates.length,
  // 同族但被排除的：表有 tenant_id 列，但该列**没有** DEFAULT 'default'
  // ⇒ INSERT 漏列时丢的不是静默 'default'（MySQL 会报 NOT NULL 错，属另一类缺陷）
  excludedNoDefault: inserts
    .filter((i) => {
      const known = tablesWithTenant.get(normalized(i.table));
      if (!known || hasDefaultDefault(known)) return false;
      if (!i.cols) return true;
      return !i.cols.map((c) => c.toLowerCase()).includes("tenant_id");
    })
    .map((c) => `${c.table} ${c.file}:${c.line} [${c.executor}]${c.cols ? "" : " 无列清单"}`),
  candidates: candidates.map((c) => ({
    ...c,
    ddl: (tablesWithTenant.get(normalized(c.table)) || []).map((d) => `${d.file}:${d.line} (${d.kind})`),
    tenantDef: (tablesWithTenant.get(normalized(c.table)) || [])
      .filter((d) => /default\s+'default'/i.test(d.def || ""))
      .map((d) => `${d.file}:${d.line} → ${(d.def || "").slice(0, 120)}`),
    autoInjected: /WithTenant$/.test(c.executor),
    test: isTest(c.file),
    hasColumnList: Boolean(c.cols),
  })),
};

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
} else {
  console.log(`表(有 tenant_id 列) = ${out.tablesWithTenantId}；INSERT 语句 = ${inserts.length}；候选漏点 = ${out.candidateCount}`);
  console.log("");
  for (const c of out.candidates) {
    const tag = c.test ? "[测试]" : "[源码]";
    console.log(
      `${tag} ${c.table}  ${c.file}:${c.line}  [${c.executor}${c.autoInjected ? " 自动注入" : ""}]  ${c.hasColumnList ? "列清单不含 tenant_id" : "无列清单"}`
    );
    for (const d of c.ddl) console.log(`        DDL: ${d}`);
  }
}
