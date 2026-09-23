/**
 * B-2b 影响面扫描器（只读）
 *
 * ⚠️ 口径声明（2026-09-23，同工作区另一执行者补记）：
 *   本脚本是**另一执行者**的初版扫描器，口径比 canonical 版窄一步——
 *   它只读 `docs/migrations/*.sql` + `backend/src/shared/migration.ts`，
 *   **没有**读 `docs/init_database.sql`（因此漏掉 `t_report_permission_matrix`
 *   这类只在 init_database.sql / 专项迁移里出现的表）。
 *   canonical 扫描器＝ `docs/evidence/B-2b/probe/b2b-scan-tenant-id.mjs`
 *   （表集合 253、INSERT 669），**数字一律以 canonical 版为准**。
 *   本脚本保留的价值＝**独立第二实现**，用于交叉核对 canonical 版的命中集：
 *   两边对"真漏点（事务内 conn / 普通 query，无自动注入）"的判定完全一致，
 *   差异仅为本脚本少 1 条（`t_report_permission_matrix`，见上）。
 *
 * 目的：全仓找出「列定义为 tenant_id NOT NULL DEFAULT 'default'（或 ''）」
 *       **且** INSERT 列清单不含 tenant_id」的写路径。
 *
 * 输入：docs/migrations/*.sql（DDL 依据） + backend/src/shared/migration.ts（运行时兜底 DDL）
 *       backend/src/**\/*.ts（写路径）
 * 输出：docs/evidence/B-2b/scan-tenant-writes.json（结构化） + stdout 摘要
 *
 * 用法：node docs/evidence/B-2b/probe/scan-tenant-writes.mjs
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

/** 递归收集文件 */
function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      walk(full, filter, out);
    } else if (filter(full)) {
      out.push(full);
    }
  }
  return out;
}

/** 解析 DDL：表 -> tenant_id 列定义（含 DEFAULT 值） */
function scanDdl() {
  const ddl = new Map(); // table -> [{ file, line, def }]
  const push = (table, file, line, def) => {
    if (!ddl.has(table)) ddl.set(table, []);
    ddl.get(table).push({ file, line, def });
  };

  // 1) 迁移脚本：CALL add_column_if_not_exists('t_x', 'tenant_id', "...")
  const sqlFiles = walk(path.join(repoRoot, "docs/migrations"), (f) => f.endsWith(".sql"));
  for (const file of sqlFiles) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      const line = i + 1;
      const m = text.match(
        /add_column_if_not_exists\(\s*'([^']+)'\s*,\s*'tenant_id'\s*,\s*"([^"]*)"/i,
      );
      if (m) push(m[1], rel, line, m[2]);
    });
  }

  // 2) 迁移脚本 + migration.ts：CREATE TABLE / ALTER TABLE 里的 tenant_id 列定义
  const createFiles = [
    ...sqlFiles,
    path.join(repoRoot, "backend/src/shared/migration.ts"),
  ];
  for (const file of createFiles) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    let current = null;
    lines.forEach((text, i) => {
      const line = i + 1;
      const create = text.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i);
      if (create) current = create[1];
      const alter = text.match(/ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i);
      if (alter) current = alter[1];
      const col = text.match(/^\s*`?tenant_id`?\s+(VARCHAR\(36\)[^,\n]*)/i);
      if (col && current) push(current, rel, line, col[1].trim());
    });
  }
  return ddl;
}

/** 解析写路径：backend/src 下所有 INSERT INTO */
function scanInserts() {
  const files = walk(path.join(repoRoot, "backend/src"), (f) => f.endsWith(".ts"));
  const rows = [];
  for (const file of files) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split(/\r?\n/);

    // 逐字符扫描，兼容跨行列表与模板字符串
    const re = /INSERT\s+(?:IGNORE\s+)?INTO\s+`?([A-Za-z0-9_]+)`?\s*/gi;
    let m;
    while ((m = re.exec(src)) !== null) {
      const table = m[1];
      const startIdx = m.index;
      const startLine = src.slice(0, startIdx).split(/\r?\n/).length;
      const rest = src.slice(m.index + m[0].length);

      let kind;
      let columns = null;
      // 先剥离紧跟在表名后的 SQL 行注释（`-- ...`），否则列清单会被注释挡住
      const head = rest
        .slice(0, 1200)
        .split(/\r?\n/)
        .map((l) => l.replace(/--.*$/, ""))
        .join("\n");
      const paren = head.match(/^\s*\(([\s\S]*?)\)\s*(VALUES|SELECT|SET)\b/i);
      const set = head.match(/^\s*SET\b/i);
      if (paren) {
        kind = "columns";
        columns = paren[1]
          .split(",")
          .map((c) => c.trim().replace(/^`|`$/g, "").replace(/\s+/g, " "))
          .filter(Boolean);
      } else if (set) {
        kind = "set";
      } else if (/^\s*(VALUES|SELECT)\b/i.test(head)) {
        kind = "values-only";
      } else {
        kind = "unknown";
      }

      rows.push({
        file: rel,
        line: startLine,
        table,
        kind,
        hasTenantId: columns ? columns.includes("tenant_id") : null,
        columns,
        snippet: lines[startLine - 1]?.trim().slice(0, 160) ?? "",
      });
    }
  }
  return rows;
}

/** 判定：DDL 依据行里是否带 DEFAULT 'default' / ''（即"省略该列不报错，静默落默认值"） */
function defaultEvidence(entries, table) {
  const list = entries.get(table) ?? [];
  const withDefault = list.filter((e) => /DEFAULT\s+''|DEFAULT\s+'default'/i.test(e.def));
  return withDefault;
}

const ddl = scanDdl();
const inserts = scanInserts();

const affected = [];
const tablesWithDefault = new Set();
for (const row of inserts) {
  const ev = defaultEvidence(ddl, row.table);
  if (ev.length === 0) continue;
  tablesWithDefault.add(row.table);
  if (row.kind === "columns" && row.hasTenantId) continue;
  affected.push({
    table: row.table,
    file: row.file,
    line: row.line,
    kind: row.kind,
    hasTenantId: row.hasTenantId,
    ddlEvidence: ev.map((e) => `${e.file}:${e.line} → ${e.def}`),
  });
}

const tablesWithDefaultAll = [...tablesWithDefault].sort();
const affectedTables = [...new Set(affected.map((a) => a.table))].sort();
const isTest = (f) => f.includes("/__tests__/") || f.includes("/__mocks__/");

const productionAffected = affected.filter((a) => !isTest(a.file));
const testAffected = affected.filter((a) => isTest(a.file));

const summary = {
  generatedAt: new Date().toISOString(),
  totals: {
    tablesWithTenantDefault: tablesWithDefaultAll.length,
    insertPathsTotal: inserts.length,
    affectedWritePaths: affected.length,
    affectedTables: affectedTables.length,
    affectedProductionWritePaths: productionAffected.length,
    affectedTestWritePaths: testAffected.length,
  },
  tablesWithTenantDefault: tablesWithDefaultAll,
  affectedTables,
  affected,
  productionAffected,
  testAffected,
};

const outFile = path.join(repoRoot, "docs/evidence/B-2b/scan-tenant-writes.json");
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), "utf8");

console.log(JSON.stringify(summary.totals, null, 2));
console.log("\n受影响表：\n - " + affectedTables.join("\n - "));
console.log(`\n【生产代码】受影响写路径 ${productionAffected.length} 条：`);
for (const a of productionAffected) {
  console.log(` - ${a.file}:${a.line} → ${a.table} [${a.kind}] hasTenantId=${a.hasTenantId}`);
}
console.log(`\n【测试/替身】受影响写路径 ${testAffected.length} 条（不在修复范围，仅供核对）：`);
for (const a of testAffected) {
  console.log(` - ${a.file}:${a.line} → ${a.table} [${a.kind}]`);
}
console.log(`\n结构化输出：${path.relative(repoRoot, outFile)}`);
