/**
 * S3-206 同根因扫描器：找出「SQL 文本里出现 tenant_id ⇒ queryWithTenant 自动注入短路」的位置
 *
 * 背景（根因）：
 *   backend/src/config/database.ts 的 injectSelectTenant/injectUpdateTenant/injectInsertTenant 首行判断是
 *   `if (sql.toLowerCase().includes('tenant_id')) return sql;` —— 只要 SQL 文本里**任何位置**出现 tenant_id
 *   （例如 JOIN 条件 `ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id`、或 SELECT 列里带 tenant_id），
 *   自动注入就会被跳过；若该 SQL 本身没有真正的租户过滤谓词，就会**跨租户聚合/泄露**。
 *
 * 本脚本做什么：静态扫描后端源码里所有 queryWithTenant / queryOneWithTenant / executeWithTenant 调用点，
 *   取出第一个参数（SQL）文本，判定三件事：
 *     ① SQL 里是否出现 tenant_id 字样（= 会不会短路）；
 *     ② SQL 里是否有**真正的租户过滤谓词**（tenant_id = ? / tenant_id IN (...) / tenant_id = '字面量'）；
 *     ③ 第二个参数（params）里是否真的传了 tenantId。
 *   输出：短路且无显式过滤 ⇒ LEAK（P0 候选）；短路但有显式过滤 ⇒ OK；未短路 ⇒ AUTO（依赖注入，附歧义风险提示）。
 *
 * 用法：node docs/evidence/S3-206/scan-tenant-shortcircuit.mjs [仓库根目录]
 * 输出：stdout（人读）+ docs/evidence/S3-206/raw/scan-tenant-shortcircuit.json（机读全量）
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(process.argv[2] || "D:/Users/ZXQL/wt-agents/S3-206");
const SRC = path.join(REPO, "backend", "src");
const OUT = path.join(REPO, "docs", "evidence", "S3-206", "raw", "scan-tenant-shortcircuit.json");
const CALL_RE = /\b(queryWithTenant|queryOneWithTenant|executeWithTenant)\s*(?:<[^>()]*>)?\s*\(/g;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__" || name === "dist") continue;
      walk(p, acc);
    } else if (name.endsWith(".ts")) {
      acc.push(p);
    }
  }
  return acc;
}

/** 从 openIdx（指向 '('）起，返回该参数列表里第 argIndex 个参数的原文与结束位置 */
function readArg(text, openIdx, argIndex) {
  let depth = 1;
  let i = openIdx + 1;
  let argStart = -1;
  let cur = 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (argStart === -1 && depth === 1 && !/\s/.test(ch)) argStart = i;
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        if (cur === argIndex) return { arg: text.slice(argStart, i), end: i + 1 };
        return null;
      }
    } else if (ch === "," && depth === 1) {
      if (cur === argIndex) return { arg: text.slice(argStart, i), end: i + 1 };
      cur++;
      argStart = -1;
      continue;
    }
  }
  return null;
}

/** 把参数原文里的模板字面量/字符串字面量抽取出来（保留 ${} 插值占位，便于看结构） */
function literalOf(argText, fileText) {
  const t = argText.trim();
  if (!t) return { sql: "", kind: "empty" };
  if (t.startsWith("`") || t.startsWith('"') || t.startsWith("'")) {
    const quote = t[0];
    let out = "";
    for (let i = 1; i < t.length; i++) {
      const ch = t[i];
      if (ch === "\\") { out += t[i + 1] ?? ""; i++; continue; }
      if (ch === quote) break;
      if (quote === "`" && ch === "$" && t[i + 1] === "{") {
        let d = 1; let j = i + 2;
        for (; j < t.length && d > 0; j++) {
          if (t[j] === "{") d++;
          else if (t[j] === "}") d--;
        }
        out += "${}" + "  /*插值*/ ";
        i = j - 1;
        continue;
      }
      out += ch;
    }
    return { sql: out, kind: "literal" };
  }
  // 变量：尝试在同文件里找 `const <name> = <模板字面量>` 静态解析
  const name = t.split(/[\s(.,[]/)[0];
  const re = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*([`\"'])", "m");
  const m = re.exec(fileText);
  if (m) {
    const idx = m.index + m[0].length - 1;
    let d = 0; let out = "";
    for (let i = idx + 1; i < fileText.length; i++) {
      const ch = fileText[i];
      if (ch === "\\") { out += fileText[i + 1] ?? ""; i++; continue; }
      if (ch === m[1] && d === 0) break;
      if (m[1] === "`" && ch === "$" && fileText[i + 1] === "{") {
        let dd = 1; let j = i + 2;
        for (; j < fileText.length && dd > 0; j++) {
          if (fileText[j] === "{") dd++;
          else if (fileText[j] === "}") dd--;
        }
        out += "${}"; i = j - 1; continue;
      }
      out += ch;
    }
    return { sql: out, kind: "resolved-var:" + name };
  }
  return { sql: "", kind: "indirect:" + name, raw: argText.trim().slice(0, 120) };
}

// 真正的租户过滤谓词（要求绑参数或字面量；`a.tenant_id = b.tenant_id` 这类 JOIN 等值不算）
const FILTER_RE = /(?:[A-Za-z_][A-Za-z0-9_]*\.)?tenant_id\s*(?:=\s*(?:\?|'[^']*'|"[^"]*"|\d+)|(?:\bIN\b|NOT\s+IN)\s*\()/i;
const TENANT_TOKEN_RE = /tenant_id/i;
const JOIN_RE = /\bjoin\b/i;

const files = walk(SRC);
const rows = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(REPO, file).replace(/\\/g, "/");
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(text))) {
    const openIdx = CALL_RE.lastIndex - 1;
    const line = text.slice(0, m.index).split("\n").length;
    const a0 = readArg(text, openIdx, 0);
    if (!a0) continue;
    const lit = literalOf(a0.arg, text);
    const a1 = readArg(text, openIdx, 1);
    const paramsText = a1 ? a1.arg.trim() : "";
    // 整个调用表达式（含后续 tenantId 实参）——用于判断"租户值到底有没有真的传进来"
    const callEnd = (() => {
      let depth = 1;
      for (let i = openIdx + 1; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") { depth--; if (depth === 0) return i + 1; }
      }
      return text.length;
    })();
    const callText = text.slice(openIdx, callEnd).replace(/\s+/g, " ");
    const sql = (lit.sql || "").replace(/\s+/g, " ");
    const hasToken = TENANT_TOKEN_RE.test(sql);
    const hasFilter = FILTER_RE.test(sql);
    const paramsHasTenant = /tenantId|tenant_id/i.test(paramsText);
    const stmt = (/^\s*(\w+)/.exec(sql)?.[1] || "").toUpperCase();
    const whereIdx = sql.search(/\bwhere\b/i);
    const filterInWhere = whereIdx >= 0 && FILTER_RE.test(sql.slice(whereIdx));
    const insertCols = stmt === "INSERT" ? (/\(([^)]*)\)\s*values/i.exec(sql)?.[1] || "") : "";
    const callHasTenant = /tenantId|tenant_id/i.test(callText);
    const hasJoin = JOIN_RE.test(sql);
    let verdict;
    if (lit.kind.startsWith("indirect")) verdict = "INDIRECT（SQL 非字面量，需人工看）";
    else if (stmt === "INSERT") {
      if (/tenant_id/i.test(insertCols) && callHasTenant) verdict = "OK（INSERT 显式写 tenant_id 列 + 实参含租户值）";
      else if (/tenant_id/i.test(insertCols)) verdict = "**可疑：INSERT 写 tenant_id 列但实参未见租户值**";
      else verdict = "**可疑：INSERT 既无 tenant_id 列也未短路（注入会补列，需人工确认）**";
    } else if (!hasToken) {
      verdict = hasJoin ? "AUTO-INJECT（依赖自动注入；JOIN 场景注意列名歧义）" : "AUTO-INJECT（依赖自动注入）";
    } else if (filterInWhere) {
      verdict = callHasTenant ? "OK（WHERE 有显式租户过滤 + 实参含租户值）" : "**可疑：WHERE 有租户过滤但实参未见租户值**";
    } else {
      verdict = "**LEAK 候选：tenant_id 只出现在 JOIN/SELECT/SET 等处 ⇒ 注入短路且 WHERE 无真实租户过滤**";
    }
    rows.push({
      file: rel, line, fn: m[1], stmt, kind: lit.kind, hasToken, hasFilter, filterInWhere, hasJoin, paramsHasTenant, callHasTenant,
      whereClause: whereIdx >= 0 ? sql.slice(whereIdx).slice(0, 220) : null,
      callText: callText.slice(0, 220), verdict, sql: sql.slice(0, 700)
    });
  }
}

const leaks = rows.filter((r) => r.verdict.startsWith("**LEAK"));
const suspicious = rows.filter((r) => r.verdict.startsWith("**可疑"));
const autoJoin = rows.filter((r) => r.verdict.startsWith("AUTO-INJECT") && r.hasJoin);
const indirect = rows.filter((r) => r.kind.startsWith("indirect"));

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  repo: REPO,
  scannedFiles: files.length,
  callSites: rows.length,
  counts: {
    leak: leaks.length, suspicious: suspicious.length,
    autoInjectWithJoin: autoJoin.length, indirect: indirect.length,
    ok: rows.filter((r) => r.verdict.startsWith("OK")).length
  },
  rows
}, null, 2), "utf8");

console.log(`扫描文件 ${files.length} 个，调用点 ${rows.length} 个；LEAK 候选 ${leaks.length}、可疑 ${suspicious.length}、AUTO-INJECT+JOIN ${autoJoin.length}、非字面量 ${indirect.length}`);
console.log("\n=== LEAK 候选（SELECT/UPDATE/DELETE：tenant_id 只出现在 JOIN/SELECT/SET ⇒ 注入短路且 WHERE 无租户过滤）===");
for (const r of leaks) console.log(`${r.file}:${r.line}  ${r.fn}  [${r.stmt}]\n    WHERE: ${(r.whereClause || "(无 WHERE)").slice(0, 200)}\n    SQL: ${r.sql.slice(0, 220)}`);
console.log("\n=== 可疑（需人工判定）===");
for (const r of suspicious) console.log(`${r.file}:${r.line}  ${r.fn}  [${r.stmt}]  ${r.verdict}\n    ${r.callText.slice(0, 200)}`);
console.log("\n=== 非字面量（需人工看）===");
for (const r of indirect) console.log(`${r.file}:${r.line}  ${r.fn}  ${r.raw}`);
console.log(`\n全量结果：${OUT}`);
