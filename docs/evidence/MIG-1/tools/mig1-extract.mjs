/**
 * MIG-1 提取引擎：复演 `backend/src/shared/migration.ts:894-931` 的**外部迁移 runner** 语句切分规则，
 * 找出「因『以注释开头的整块语句被整体丢弃』缺陷而**当前不会执行**、修复后**首次会执行**」的语句，
 * 逐条给出：文件:行 / 语句类型 / 目标表 / 风险等级(L1~L4) / 是否需要人工确认。
 *
 * 两个口径（都输出，互不掩盖）：
 *   口径A（复现 C2-4 的算法，与"118 文件 / CREATE 239 / ALTER 50 / 其它 58"同源）：
 *     丢弃块中的"真实内容" = 只剥掉**以 `--` 开头的行**；块内若含 CREATE TABLE/ALTER TABLE/INSERT INTO/UPDATE/DELETE FROM 才计入。
 *   口径B（本单 MIG-1 的正式清单口径，更严）：
 *     丢弃块中的"真实内容" = 剥掉 `--`、`#`、块注释（slash-star 开头、星号续行）三类注释行后的剩余内容；
 *     只要剩余内容非空即计入，并按真实语句类型分类（含 REPLACE INTO、SET 等 A 口径漏掉的形状）。
 *
 * 用法：
 *   node docs/evidence/MIG-1/tools/mig1-extract.mjs [--rev <git sha>] [--outdir docs/evidence/MIG-1]
 * 退出码：0 = 生成成功且内置反测通过；1 = 反测失败/未生成。
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // docs/evidence/MIG-1/tools
export const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
export const MIGRATIONS_DIR = join(REPO_ROOT, "docs", "migrations");

// ────────────────────────────────────────────────────────────────────────────
// 1. 复演 runner 的预处理与切分（与 migration.ts:899-912 逐行对齐）
// ────────────────────────────────────────────────────────────────────────────

/** 预处理：删掉以 USE / DELIMITER 开头的行；同时记录每个保留行在**原文件**中的行号。 */
export function buildCleaned(sql) {
  const rawLines = sql.split("\n");
  const kept = [];
  rawLines.forEach((text, idx) => {
    const t = text.trim().toUpperCase();
    if (t.startsWith("USE ") || t.startsWith("DELIMITER ")) return;
    kept.push({ line: idx + 1, text });
  });
  const cleaned = kept.map((k) => k.text).join("\n");
  const offsets = [];
  let off = 0;
  for (const k of kept) {
    offsets.push({ start: off, line: k.line });
    off += k.text.length + 1; // +1 = 重新拼回 "\n"
  }
  return { cleaned, offsets };
}

/** 把 cleaned 文本按 ";" 切成块（保留每块在 cleaned 中的起止偏移）。 */
export function splitChunks(cleaned) {
  const out = [];
  let start = 0;
  for (;;) {
    const i = cleaned.indexOf(";", start);
    if (i === -1) {
      if (start < cleaned.length) out.push({ start, end: cleaned.length, text: cleaned.slice(start) });
      break;
    }
    out.push({ start, end: i, text: cleaned.slice(start, i) });
    start = i + 1;
  }
  return out;
}

/** cleaned 偏移 → 原文件行号（二分）。 */
export function lineOfOffset(offsets, off) {
  if (!offsets.length) return 1;
  let lo = 0;
  let hi = offsets.length - 1;
  let ans = offsets[0].line;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid].start <= off) {
      ans = offsets[mid].line;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

const COMMENT_LINE = /^(--|#)/;
const BLOCK_OPEN = /^\/\*/;
const BLOCK_CONT = /^\*/;

/**
 * 拆解一个块。
 * @param mode "A" = 只把 `--` 行当注释（复现 C2-4）；"B" = `--` / `#` / 块注释 都当注释（本单正式口径）
 */
export function analyzeChunk(text, blockStartLine, mode = "B") {
  const lines = text.split("\n");
  const realLines = [];
  let firstRealLine = -1;
  let inBlockComment = false;
  lines.forEach((l, i) => {
    const t = l.trim();
    let isComment = false;
    if (mode === "A") {
      isComment = t === "" || t.startsWith("--");
    } else if (inBlockComment) {
      isComment = true;
      if (t.includes("*/")) inBlockComment = false;
    } else if (t === "" || COMMENT_LINE.test(t)) {
      isComment = true;
    } else if (BLOCK_OPEN.test(t)) {
      isComment = true;
      if (!t.includes("*/")) inBlockComment = true;
    } else if (BLOCK_CONT.test(t)) {
      isComment = true;
    }
    if (!isComment) {
      realLines.push(l);
      if (firstRealLine < 0) firstRealLine = i;
    }
  });
  const realSql = realLines.join("\n").trim();
  return {
    realSql,
    firstRealLine: firstRealLine < 0 ? blockStartLine : blockStartLine + firstRealLine,
    startsWithDashComment: text.trimStart().startsWith("--"),
  };
}

const SKIP_PROCEDURE = (s) => s.includes("CREATE PROCEDURE") || s.includes("DROP PROCEDURE");
const SKIP_DROP_TABLE = (s) => /DROP\s+TABLE/i.test(s);

/**
 * 复演 runner：返回 { executed, dropped }，dropped 里带原因。
 * 修复后（PR #13 的规则：先剥注释行再切分/过滤），原本被丢的块会进入执行路径。
 */
export function simulateRunner(sql, mode = "B") {
  const { cleaned, offsets } = buildCleaned(sql);
  const executed = [];
  const dropped = [];
  for (const c of splitChunks(cleaned)) {
    const text = c.text.trim();
    if (!text) continue;
    const lead = c.text.length - c.text.trimStart().length;
    const blockStartLine = lineOfOffset(offsets, c.start + lead);
    const info = analyzeChunk(text, blockStartLine, mode);
    const rec = {
      blockStartLine,
      realLine: info.firstRealLine,
      text,
      realSql: info.realSql,
      skippedByRunner: info.realSql
        ? SKIP_PROCEDURE(info.realSql)
          ? "procedure"
          : SKIP_DROP_TABLE(info.realSql)
            ? "drop_table"
            : null
        : null,
    };
    if (info.startsWithDashComment) {
      dropped.push({ reason: "注释开头整块被丢弃", hasReal: info.realSql.length > 0, ...rec });
      continue;
    }
    if (rec.skippedByRunner) continue;
    executed.push(rec);
  }
  return { executed, dropped };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. 表名 / 语句类型 / 风险等级
// ────────────────────────────────────────────────────────────────────────────

/** 复演 addTablePrefix（migration.ts:80-104 的子集） */
export function addTablePrefix(sql) {
  const patterns = [
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([a-z_][a-z0-9_]*)/gi,
    /(ALTER\s+TABLE\s+)([a-z_][a-z0-9_]*)/gi,
    /(INSERT\s+(?:IGNORE\s+)?INTO\s+)([a-z_][a-z0-9_]*)/gi,
    /(REPLACE\s+INTO\s+)([a-z_][a-z0-9_]*)/gi,
    /((?:^|\n)\s*UPDATE\s+)([a-z_][a-z0-9_]*)/gim,
    /(DELETE\s+FROM\s+)([a-z_][a-z0-9_]*)/gi,
    /(RENAME\s+TABLE\s+)([a-z_][a-z0-9_]*)/gi,
    /(DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?)([a-z_][a-z0-9_]*)/gi,
  ];
  let out = sql;
  for (const p of patterns) {
    out = out.replace(p, (m, prefix, name) =>
      name.startsWith("t_") || name.startsWith("information_schema") || name.startsWith("mysql")
        ? m
        : prefix + "t_" + name
    );
  }
  return out;
}

/** 从（已加前缀的）语句里提取表名清单，按重要度排序；第一个即"目标表"。 */
export function extractTables(sql) {
  const prefixed = addTablePrefix(sql);
  const found = [];
  const push = (n) => {
    if (n && !found.includes(n)) found.push(n);
  };
  for (const m of prefixed.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/ALTER\s+TABLE\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/REPLACE\s+INTO\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/(?:^|\n)\s*UPDATE\s+`?([a-z_][a-z0-9_]*)`?/gim)) push(m[1]);
  for (const m of prefixed.matchAll(/DELETE\s+FROM\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  for (const m of prefixed.matchAll(/RENAME\s+TABLE\s+`?([a-z_][a-z0-9_]*)`?/gi)) push(m[1]);
  return found;
}

/** 语句类型（派单要求：CREATE / ALTER / INSERT / UPDATE / 其它） */
export function stmtType(sql) {
  const first = sql.trim().split("\n")[0].trim();
  if (/^CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX|FULLTEXT\s+INDEX|VIEW|DATABASE)/i.test(first)) return "CREATE";
  if (/^ALTER\s+TABLE/i.test(first)) return "ALTER";
  if (/^(INSERT|REPLACE)/i.test(first)) return "INSERT";
  if (/^UPDATE/i.test(first)) return "UPDATE";
  if (/^DELETE/i.test(first)) return "DELETE";
  if (/^DROP/i.test(first)) return "DROP";
  if (/^TRUNCATE/i.test(first)) return "TRUNCATE";
  if (/^(SET|PREPARE|EXECUTE|DEALLOCATE)/i.test(first)) return "SET/动态DDL";
  if (/^CREATE\s+PROCEDURE/i.test(first)) return "PROCEDURE";
  const kw = /^[A-Za-z_]+/.exec(first);
  return kw ? "其它(" + kw[0].toUpperCase() + ")" : "其它";
}

/** 幂等保护检测 */
export function idempotency(sql) {
  if (/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(sql)) return "CREATE TABLE IF NOT EXISTS";
  if (/CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i.test(sql)) return "CREATE INDEX IF NOT EXISTS";
  if (/INSERT\s+IGNORE/i.test(sql)) return "INSERT IGNORE";
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(sql)) return "ON DUPLICATE KEY UPDATE";
  if (/WHERE\s+NOT\s+EXISTS/i.test(sql)) return "WHERE NOT EXISTS";
  if (/information_schema/i.test(sql) && /IF\s*\(/i.test(sql)) return "information_schema 前置判空";
  return null;
}

/**
 * 风险等级：L1 幂等可重复 / L2 会改结构 / L3 会改数据 / L4 其它高风险（DROP、TRUNCATE、无 WHERE 的写、ALTER DROP …）
 * 判定顺序：L4 → L3 → L2 → L1。
 */
export function riskOf(sql) {
  const s = sql.replace(/--[^\n]*/g, " ");
  const writeHead = /^\s*(UPDATE|DELETE)\b/i.test(s);
  const noWhereWrite = writeHead && !/\bWHERE\b/i.test(s);
  if (
    /^\s*DROP\s+/i.test(s) ||
    /^\s*TRUNCATE\b/i.test(s) ||
    /^\s*RENAME\s+TABLE/i.test(s) ||
    /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+(COLUMN|INDEX|KEY|PRIMARY|FOREIGN)\b/i.test(s) ||
    noWhereWrite ||
    /^\s*(GRANT|REVOKE)\b/i.test(s)
  ) {
    return { level: "L4", why: "破坏性/不可逆（DROP / TRUNCATE / RENAME / 无 WHERE 写 / 权限变更）" };
  }
  if (/^\s*(INSERT|REPLACE|UPDATE|DELETE)\b/i.test(s) || /\b(INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO)\b/i.test(s)) {
    const idem = idempotency(s);
    return { level: "L3", why: idem ? "会改数据（幂等保护：" + idem + "）" : "会改数据（无幂等保护）" };
  }
  const idem = idempotency(s);
  if (idem) return { level: "L1", why: "幂等可重复（" + idem + "）" };
  if (
    /^\s*ALTER\s+TABLE/i.test(s) ||
    /^\s*CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX|FULLTEXT\s+INDEX|VIEW|DATABASE)/i.test(s)
  ) {
    return { level: "L2", why: "会改结构（无幂等保护，重复执行会报错）" };
  }
  if (/^\s*(SET|PREPARE|EXECUTE|DEALLOCATE|COMMIT|START\s+TRANSACTION|SELECT|LOCK|UNLOCK)\b/i.test(s)) {
    return { level: "L1", why: "会话变量/事务控制语句，本身不改结构也不改数据（可能为后续动态 DDL 铺路）" };
  }
  return { level: "L2", why: "无法归类，保守按改结构看待" };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 全量扫描
// ────────────────────────────────────────────────────────────────────────────

const C2_4_TEXT = /^CREATE\s+TABLE|^ALTER\s+TABLE|^INSERT\s+INTO|^UPDATE\s+|^DELETE\s+FROM/im;

/** 扫描一个目录下所有 .sql（runner 排除 add_tenant_id.sql） */
export function scan(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
    .sort();
  const fileReports = [];
  const countsA = { files: 0, create: 0, alter: 0, other: 0 };
  const countsB = { files: 0, byType: {}, byLevel: {}, needConfirm: 0, skippedByRunner: {} };
  const filesA = new Set();
  const diff = { filesOnlyInB: [], filesOnlyInA: [], createNonTable: [], dropNotSkipped: [], callEntries: [] };

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const simA = simulateRunner(sql, "A");
    const simB = simulateRunner(sql, "B");

    // 口径A（复现 C2-4）
    const lostA = simA.dropped.filter((d) => d.hasReal && C2_4_TEXT.test(d.realSql));
    const cA = lostA.filter((d) => /^CREATE\s+TABLE/im.test(d.realSql)).length;
    const aA = lostA.filter((d) => /^ALTER\s+TABLE/im.test(d.realSql)).length;
    if (lostA.length) {
      countsA.files += 1;
      countsA.create += cA;
      countsA.alter += aA;
      countsA.other += lostA.length - cA - aA;
      filesA.add(file);
    }

    // 口径B（本单正式清单）
    const entries = [];
    for (const d of simB.dropped) {
      if (!d.hasReal) continue; // 纯注释块：丢了无害
      const type = stmtType(d.realSql);
      const risk = riskOf(d.realSql);
      const tables = extractTables(d.realSql);
      const idem = idempotency(d.realSql);
      const needConfirm = risk.level === "L1" ? false : true;
      const e = {
        file,
        line: d.realLine,
        blockStartLine: d.blockStartLine,
        type,
        tables,
        targetTable: tables[0] ?? null,
        risk: risk.level,
        riskWhy: risk.why,
        idempotent: idem,
        needConfirm,
        skippedByRunner: d.skippedByRunner,
        sql: d.realSql.replace(/\s+/g, " ").trim(),
      };
      entries.push(e);
      countsB.byType[type] = (countsB.byType[type] ?? 0) + 1;
      countsB.byLevel[e.risk] = (countsB.byLevel[e.risk] ?? 0) + 1;
      if (needConfirm) countsB.needConfirm += 1;
      if (d.skippedByRunner) {
        countsB.skippedByRunner[d.skippedByRunner] = (countsB.skippedByRunner[d.skippedByRunner] ?? 0) + 1;
      }
      if (e.type === "CREATE" && !/^CREATE\s+TABLE/i.test(e.sql)) diff.createNonTable.push(e);
      if (e.type === "DROP" && !e.skippedByRunner) diff.dropNotSkipped.push(e);
      if (/^CALL\b/i.test(e.sql)) diff.callEntries.push(e);
    }
    if (entries.length) {
      countsB.files += 1;
      fileReports.push({ file, entries });
    }
  }
  const filesB = new Set(fileReports.map((f) => f.file));
  diff.filesOnlyInB = [...filesB].filter((f) => !filesA.has(f)).sort();
  diff.filesOnlyInA = [...filesA].filter((f) => !filesB.has(f)).sort();
  return { filesScanned: files.length, countsA, countsB, fileReports, diff };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. 反测（先证明提取器会红）
// ────────────────────────────────────────────────────────────────────────────

export function falsify() {
  const out = [];
  const fail = [];
  const cases = [
    {
      name: "① 注释在前 + CREATE TABLE（历史缺陷形状）",
      sql: "-- 编号: 999\n-- 说明: 注释在前\nCREATE TABLE IF NOT EXISTS bad_shape (id BIGINT);\n",
      expect: { executed: 0, lostReal: 1, lostCreate: 1 },
    },
    {
      name: "② 注释在前 + INSERT（数据写入形状）",
      sql: "-- 种子数据\nINSERT INTO sys_config (k, v) VALUES ('a', 'b');\n",
      expect: { executed: 0, lostReal: 1, lostCreate: 0 },
    },
    {
      name: "③ 语句在前 + 注释在后（正确写法，不应被判丢）",
      sql: "CREATE TABLE IF NOT EXISTS ok_shape (id BIGINT);\n\n-- 注释在后\n",
      expect: { executed: 1, lostReal: 0, lostCreate: 0 },
    },
    {
      name: "④ 纯注释块（丢了无害，不应计入清单）",
      sql: "-- 仅注释\n-- 无语句;\n\nCREATE TABLE IF NOT EXISTS ok2 (id BIGINT);\n",
      expect: { executed: 1, lostReal: 0, lostCreate: 0 },
    },
    {
      name: "⑤ CREATE PROCEDURE 块（块本身被丢且 runner 显式跳过；但块尾 'END' 会被当成独立语句执行 ⇒ DELIMITER 感知属 PR #18 范围）",
      sql: "-- 存储过程\nCREATE PROCEDURE p1() BEGIN SELECT 1; END;\n",
      expect: { executed: 1, lostReal: 1, lostCreate: 0 },
    },
  ];
  for (const c of cases) {
    const sim = simulateRunner(c.sql, "B");
    const lost = sim.dropped.filter((d) => d.hasReal);
    const got = {
      executed: sim.executed.length,
      lostReal: lost.length,
      lostCreate: lost.filter((d) => /^CREATE\s+TABLE/im.test(d.realSql)).length,
    };
    const ok =
      got.executed === c.expect.executed &&
      got.lostReal === c.expect.lostReal &&
      got.lostCreate === c.expect.lostCreate;
    out.push(
      "  " +
        (ok ? "✓" : "✗") +
        " " +
        c.name +
        " ⇒ 执行 " +
        got.executed +
        " / 丢真语句 " +
        got.lostReal +
        " / 其中建表 " +
        got.lostCreate +
        "（期望 " +
        c.expect.executed +
        "/" +
        c.expect.lostReal +
        "/" +
        c.expect.lostCreate +
        "）"
    );
    if (!ok) fail.push(c.name);
  }
  return { lines: out, failures: fail };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 渲染
// ────────────────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderChecklist(data, meta) {
  const L = [];
  L.push("# MIG-1 逐条预期清单：迁移 runner 丢块缺陷修复后**首次会被执行**的语句");
  L.push("");
  L.push("> 生成时间：" + meta.generatedAt + "　|　仓库起点：`" + meta.rev + "`　|　生成器：`docs/evidence/MIG-1/tools/mig1-extract.mjs`");
  L.push("> 复演对象：`backend/src/shared/migration.ts:894-931`（外部迁移段）的语句切分规则。");
  L.push("> 口径定义、风险分级规则、与 C2-4 口径的差异说明见 `docs/evidence/MIG-1/README.md`。");
  L.push("");
  L.push("## 一、总量");
  L.push("");
  L.push("| 口径 | 受影响文件 | CREATE | ALTER | 其它 | 合计 |");
  L.push("|---|---:|---:|---:|---:|---:|");
  L.push(
    "| A（复现 C2-4） | " +
      data.countsA.files +
      " | " +
      data.countsA.create +
      " | " +
      data.countsA.alter +
      " | " +
      data.countsA.other +
      " | " +
      (data.countsA.create + data.countsA.alter + data.countsA.other) +
      " |"
  );
  const byType = data.countsB.byType;
  const bTotal = Object.values(byType).reduce((x, y) => x + y, 0);
  L.push(
    "| B（本单正式逐条口径） | " +
      data.countsB.files +
      " | " +
      (byType["CREATE"] ?? 0) +
      " | " +
      (byType["ALTER"] ?? 0) +
      " | " +
      (bTotal - (byType["CREATE"] ?? 0) - (byType["ALTER"] ?? 0)) +
      " | " +
      bTotal +
      " |"
  );
  L.push("");
  L.push("扫描文件 " + data.filesScanned + " 个（runner 规则：文件名以 .sql 结尾，且排除 add_tenant_id.sql）。");
  L.push("");
  L.push("口径 B 按语句类型：" + Object.entries(byType).map(([k, v]) => k + " " + v).join(" / "));
  L.push("");
  L.push("口径 B 按风险等级：" + Object.entries(data.countsB.byLevel).map(([k, v]) => k + " " + v).join(" / "));
  L.push("");
  const skipped = Object.entries(data.countsB.skippedByRunner);
  if (skipped.length) {
    L.push(
      "其中由 runner 显式跳过（**即使修复也不会执行**）：" +
        skipped.map(([k, v]) => (k === "drop_table" ? "DROP TABLE 保护" : "存储过程") + " " + v).join(" / ")
    );
    L.push("");
  }
  // 口径差异（必须解释，禁止硬凑数字）
  const diff = data.diff;
  L.push("## 一之二、口径 A 与口径 B 的差异（必须解释，不硬凑数字）");
  L.push("");
  L.push(
    "口径 A 只剥 `--` 注释行、且要求块内含 `CREATE TABLE/ALTER TABLE/INSERT INTO/UPDATE/DELETE FROM` 字样，因此**漏掉了**下面这些真实语句形状；口径 B 全部计入。"
  );
  L.push("");
  L.push(
    "- 口径 B 比 A 多出的文件 **" +
      diff.filesOnlyInB.length +
      "** 个（" +
      (diff.filesOnlyInB.join("、") || "无") +
      "）；口径 A 有而 B 没有的文件 **" +
      diff.filesOnlyInA.length +
      "** 个（" +
      (diff.filesOnlyInA.join("、") || "无") +
      "）。"
  );
  L.push("- CREATE 类中非建表语句 **" + diff.createNonTable.length + "** 条：" + (diff.createNonTable.map((e) => "`" + e.file + ":" + e.line + "` " + esc(e.sql.slice(0, 60))).join("；") || "无"));
  L.push(
    "- 存储过程调用 `CALL` **" +
      diff.callEntries.length +
      "** 条（涉及 " +
      [...new Set(diff.callEntries.map((e) => e.file))].length +
      " 个文件）——A 口径完全漏掉；这类语句修复后会真的执行，而它们依赖的存储过程**被 runner 显式跳过**（见 `风险汇总.md` §四）。"
  );
  L.push("- DROP 类语句 **" + data.countsB.byType["DROP"] + "** 条，其中未被 runner 的 `DROP TABLE` 保护拦住的 **" + diff.dropNotSkipped.length + "** 条：" + (diff.dropNotSkipped.map((e) => "`" + e.file + ":" + e.line + "` " + esc(e.sql.slice(0, 70))).join("；") || "无"));
  L.push("");
  L.push("## 二、逐条清单（按文件）");
  L.push("");
  L.push(
    "列含义：`行` = 真实语句所在行（原文件行号）；`类型` = CREATE/ALTER/INSERT/UPDATE/…；`目标表` = addTablePrefix 后的真实表名；`风险` = L1 幂等可重复 / L2 会改结构 / L3 会改数据 / L4 其它高风险；`人工` = 是否需要人工确认。"
  );
  L.push("");
  for (const f of data.fileReports) {
    L.push("### " + f.file + "（" + f.entries.length + " 条）");
    L.push("");
    L.push("| # | 行 | 类型 | 目标表 | 风险 | 人工 | 语句摘要 |");
    L.push("|---:|---:|---|---|:--:|:--:|---|");
    f.entries.forEach((e, i) => {
      const skip = e.skippedByRunner ? "（runner 跳过：" + (e.skippedByRunner === "drop_table" ? "DROP TABLE 保护" : "存储过程") + "）" : "";
      L.push(
        "| " +
          (i + 1) +
          " | " +
          e.line +
          " | " +
          e.type +
          skip +
          " | " +
          esc(e.targetTable ?? "—") +
          " | " +
          e.risk +
          " | " +
          (e.needConfirm ? "是" : "否") +
          " | " +
          esc(e.sql.slice(0, 160)) +
          " |"
      );
    });
    L.push("");
  }
  return L.join("\n");
}

export function renderRisk(data, meta) {
  const L = [];
  const all = data.fileReports.flatMap((f) => f.entries);
  L.push("# MIG-1 风险汇总");
  L.push("");
  L.push("> 生成时间：" + meta.generatedAt + "　|　仓库起点：`" + meta.rev + "`");
  L.push("> 数据来源：`docs/evidence/MIG-1/expected.json`（由 `tools/mig1-extract.mjs` 生成），口径 B。");
  L.push("");
  L.push("## 一、按风险等级计数");
  L.push("");
  L.push("| 等级 | 含义 | 条数 | 需人工确认 |");
  L.push("|---|---|---:|---:|");
  const cnt = (lv) => all.filter((e) => e.risk === lv).length;
  const need = (lv) => all.filter((e) => e.risk === lv && e.needConfirm).length;
  L.push("| L1 | 幂等可重复 | " + cnt("L1") + " | " + need("L1") + " |");
  L.push("| L2 | 会改结构 | " + cnt("L2") + " | " + need("L2") + " |");
  L.push("| L3 | 会改数据 | " + cnt("L3") + " | " + need("L3") + " |");
  L.push("| L4 | 其它高风险（DROP/TRUNCATE/无 WHERE 写…） | " + cnt("L4") + " | " + need("L4") + " |");
  L.push("");
  const runnerSkipped = all.filter((e) => e.skippedByRunner);
  if (runnerSkipped.length) {
    L.push(
      "> 另有 " +
        runnerSkipped.length +
        " 条被丢块含 DROP TABLE / 存储过程，**修复后仍不会执行**（runner 显式跳过），单独点名见 §四。"
    );
    L.push("");
  }
  const sections = [
    ["L4", "二"],
    ["L3", "三"],
  ];
  for (const [lv, num] of sections) {
    const items = all.filter((e) => e.risk === lv);
    L.push("## " + num + "、" + lv + " 逐条点名（" + items.length + " 条）");
    L.push("");
    if (!items.length) {
      L.push("无。");
      L.push("");
      continue;
    }
    L.push("| # | 文件:行 | 目标表 | 语句摘要 | 备注 |");
    L.push("|---:|---|---|---|---|");
    items.forEach((e, i) => {
      L.push(
        "| " +
          (i + 1) +
          " | `" +
          e.file +
          ":" +
          e.line +
          "` | " +
          esc(e.targetTable ?? "—") +
          " | " +
          esc(e.sql.slice(0, 150)) +
          " | " +
          esc(e.riskWhy) +
          (e.skippedByRunner ? "；runner 跳过" : "") +
          " |"
      );
    });
    L.push("");
  }
  L.push("## 四、被丢块中由 runner 显式跳过的语句（" + runnerSkipped.length + " 条，修复后仍不执行）");
  L.push("");
  if (!runnerSkipped.length) {
    L.push("无。");
    L.push("");
  }
  L.push("| # | 文件:行 | 类型 | 目标表 | 跳过原因 | 语句摘要 |");
  L.push("|---:|---:|---|---|---|---|");
  runnerSkipped.forEach((e, i) => {
    L.push(
      "| " +
        (i + 1) +
        " | `" +
        e.file +
        ":" +
        e.line +
        "` | " +
        e.type +
        " | " +
        esc(e.targetTable ?? "—") +
        " | " +
        (e.skippedByRunner === "drop_table" ? "DROP TABLE 保护" : "存储过程") +
        " | " +
        esc(e.sql.slice(0, 120)) +
        " |"
    );
  });
  L.push("");
  const l2 = all.filter((e) => e.risk === "L2");
  const l2t = [...new Set(l2.map((e) => e.targetTable))].filter(Boolean).sort();
  L.push("## 五、L2 涉及的目标表（去重 " + l2t.length + " 张）");
  L.push("");
  L.push(l2t.map((t) => "`" + t + "`").join("、") || "无");
  L.push("");
  const l3t = [...new Set(all.filter((e) => e.risk === "L3").map((e) => e.targetTable))].filter(Boolean).sort();
  L.push("## 六、L3 涉及的目标表（去重 " + l3t.length + " 张）");
  L.push("");
  L.push(l3t.map((t) => "`" + t + "`").join("、") || "无");
  L.push("");
  return L.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// 6. CLI
// ────────────────────────────────────────────────────────────────────────────

function argVal(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function main() {
  const outdir = resolve(REPO_ROOT, argVal("--outdir", "docs/evidence/MIG-1"));
  const meta = { generatedAt: new Date().toISOString(), rev: argVal("--rev", "unknown") };
  const lines = [];
  lines.push("[MIG-1/extract] 复演 backend/src/shared/migration.ts:894-931 的外部迁移切分规则");
  lines.push("               仓库根：" + REPO_ROOT);
  lines.push("               迁移目录：" + MIGRATIONS_DIR);
  lines.push("");
  lines.push("== 反测（先证明提取器会红） ==");
  const f = falsify();
  lines.push(...f.lines);
  lines.push("");
  if (f.failures.length) {
    lines.push("反测失败 " + f.failures.length + " 项：" + f.failures.join(" / "));
    lines.push("RESULT: FAILURES");
    lines.push("EXIT=1");
    process.stdout.write(lines.join("\n") + "\n");
    process.exit(1);
  }
  lines.push("反测全部通过：注释在前的块会被判为「丢语句」，语句在前的正确写法不会被误判，纯注释块不计入。");
  lines.push("");

  const data = scan();
  lines.push("== 口径 A（复现 C2-4：只把 `--` 行当注释） ==");
  lines.push(
    "  扫描 SQL 文件 " +
      data.filesScanned +
      " 个；受影响文件 " +
      data.countsA.files +
      " 个；CREATE TABLE " +
      data.countsA.create +
      " / ALTER TABLE " +
      data.countsA.alter +
      " / 其它 " +
      data.countsA.other
  );
  lines.push("");
  lines.push("== 口径 B（本单正式逐条口径：`--` / `#` / `/* */` 均视为注释） ==");
  const bTotal = Object.values(data.countsB.byType).reduce((a, b) => a + b, 0);
  lines.push("  受影响文件 " + data.countsB.files + " 个；逐条合计 " + bTotal + " 条");
  lines.push("  按类型：" + Object.entries(data.countsB.byType).map(([k, v]) => k + " " + v).join(" / "));
  lines.push(
    "  按风险：" +
      Object.entries(data.countsB.byLevel).map(([k, v]) => k + " " + v).join(" / ") +
      "（需人工确认 " +
      data.countsB.needConfirm +
      " 条）"
  );
  const skipped = Object.entries(data.countsB.skippedByRunner);
  lines.push(
    skipped.length
      ? "  runner 显式跳过（修复后仍不执行）：" + skipped.map(([k, v]) => k + " " + v).join(" / ")
      : "  runner 显式跳过：0"
  );
  lines.push("");
  lines.push("== 口径差异（A 漏、B 计入） ==");
  lines.push("  口径 B 多出的文件 " + data.diff.filesOnlyInB.length + " 个：" + (data.diff.filesOnlyInB.join(", ") || "无"));
  lines.push("  口径 A 多出的文件 " + data.diff.filesOnlyInA.length + " 个：" + (data.diff.filesOnlyInA.join(", ") || "无"));
  lines.push("  非建表 CREATE " + data.diff.createNonTable.length + " 条 / CALL " + data.diff.callEntries.length + " 条 / 未被 DROP TABLE 保护拦住的 DROP " + data.diff.dropNotSkipped.length + " 条");
  lines.push("");

  mkdirSync(outdir, { recursive: true });
  mkdirSync(join(outdir, "outputs"), { recursive: true });
  const json = {
    meta,
    ruleSimulated: "backend/src/shared/migration.ts:894-931（外部迁移段）",
    filesScanned: data.filesScanned,
    countsA: data.countsA,
    countsB: data.countsB,
    diff: data.diff,
    files: data.fileReports,
  };
  writeFileSync(join(outdir, "expected.json"), JSON.stringify(json, null, 2), "utf8");
  writeFileSync(join(outdir, "预期清单.md"), renderChecklist(data, meta) + "\n", "utf8");
  writeFileSync(join(outdir, "风险汇总.md"), renderRisk(data, meta) + "\n", "utf8");
  lines.push("已生成：");
  lines.push("  " + join(outdir, "expected.json"));
  lines.push("  " + join(outdir, "预期清单.md"));
  lines.push("  " + join(outdir, "风险汇总.md"));
  lines.push("RESULT: ALL PASS");
  lines.push("EXIT=0");
  const text = lines.join("\n") + "\n";
  writeFileSync(join(outdir, "outputs", "01-extract.txt"), text, "utf8");
  process.stdout.write(text);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
