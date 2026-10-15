#!/usr/bin/env node
/**
 * G37 门禁 · guard:tenant-injection（S3-207：收口总清单第 63 项**根因**的静态防线）
 *
 * 防的是什么（根因）：
 *   `backend/src/config/database.ts` 的租户注入器原先用**子串判断**决定是否跳过注入——
 *   `if (sql.toLowerCase().includes('tenant_id')) return sql;`
 *   ⇒ 只要 SQL 文本任何位置出现 `tenant_id` 字样（JOIN 的列对列等值 `a.tenant_id = b.tenant_id`、
 *     SELECT 列清单、INSERT 列清单、UPDATE 的 SET 子句……）就整体**跳过注入**；
 *     若该 SQL 本身没有真正的租户过滤谓词，就退化成**跨租户读取/聚合**（S3-206 实测：A 令牌读到 A+B）。
 *   S3-206 只在调用点把 `sales-ranking` 显式化，根因未治 ⇒ 下次谁再写 JOIN 都会重踩。
 *
 * 本门禁做什么：
 *   扫 `backend/src/**`（排除 `__tests__` / `dist` / `node_modules`）里所有
 *   `queryWithTenant` / `queryOneWithTenant` / `executeWithTenant` 调用点，取第一实参 SQL 文本，
 *   用**与运行时判据同形**的规则（`backend/src/shared/tenant-scope.ts`）判定"这句 SQL 是否带**绑定到调用者租户的条件**"：
 *     · SELECT        ⇒ 出现值谓词 `tenant_id = ? / = '字面量' / = 数字 / IN (值)`（含子查询内）；
 *                       `a.tenant_id = b.tenant_id` 这种**列对列**等值**不算**（这正是漏判的病灶）。
 *     · UPDATE/DELETE ⇒ 同上，且必须在**顶层 WHERE** 之后（`SET tenant_id = ?` 是"写租户列"，不算过滤）。
 *     · INSERT        ⇒ 列清单里显式写了 `tenant_id`（含 `INSERT IGNORE`）/ `SET tenant_id = 值` / INSERT…SELECT 的 SELECT 段有谓词。
 *     · 显式标记      ⇒ SQL 注释里带 `tenant-scope:self` / `tenant-scope:platform`（**必须登记**，见 MARKER_ALLOWLIST）。
 *   判成"有 tenant_id 字样、却没有上述任何条件"⇒ **红**：这正是"改前静默跳过、改后注入生效"的那一类
 *   （多表 JOIN 上会 `ER_NON_UNIQ_ERROR 1052` ⇒ 500，单表上会多一个正确谓词）。
 *
 * 为什么这么判（边界，别把它当"证明"）：
 *   1. 判据证的是**形状**（存在绑定到 tenant_id 列的值谓词），**不是取值**——无法从文本证明那个 `?` 绑的就是调用者租户。
 *      但相比旧判据（连形状都不看）这是**严格收紧**：新跳过集合 ⊂ 旧跳过集合。
 *   2. 静态扫描**看不见 `${}` 插值内容**（如 `WHERE ${where}`）⇒ 这类调用点必须逐条登记
 *      （INDIRECT_ALLOWLIST，要写结论 + 理由），未登记即红（漏登检测，仿 guard-tenant-status R3）。
 *   3. 本门禁是**静态近似**：它保证"源码里不再写无谓词的 tenant_id 写法"，运行期安全性由
 *      `shared/tenant-scope.ts` 兜底；两侧口径用**同一份语料** `backend/scripts/fixtures/tenant-scope-corpus.json`
 *      钉住（本脚本 `--self-test` 跑一遍，单测 `__tests__/shared/tenant-scope.test.ts` 再跑一遍）。
 *   4. WARN（不阻断、只打印）两类观察项：
 *      · `AUTO-INJECT+JOIN`：靠自动注入兜底，注入的是**无限定列名** `tenant_id = ?`，JOIN 第二张表也有该列时 1052。
 *      · `TOKEN-ONLY-IN-SUBQUERY`：谓词只出现在子查询里（顶层表未直接被限定），覆盖强度弱于显式谓词，供人工复核。
 *
 * 用法：
 *   node backend/scripts/guard-tenant-injection.mjs              # 语料自检 + 全仓扫描；0=绿 / 1=红
 *   node backend/scripts/guard-tenant-injection.mjs --self-test  # 只跑语料自检
 *   node backend/scripts/guard-tenant-injection.mjs --json       # 机读全量（stdout）
 *   node backend/scripts/guard-tenant-injection.mjs <仓库根>     # 指定仓库根（默认本文件上两级）
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "..", "..");

/** 显式标记（与 shared/tenant-scope.ts 保持一致） */
export const MARKER_SELF = "tenant-scope:self";
export const MARKER_PLATFORM = "tenant-scope:platform";

/** 与 shared/tenant-scope.ts 的 VALUE_PREDICATE_RE 同形（改一处必须改另一处，语料自检会抓） */
const VALUE_PREDICATE_RE =
  /(?:[a-z_][a-z0-9_]*\s*\.\s*)?tenant_id\s*(?:=\s*(?:\?|'[^']*'|"[^"]*"|\d+(?:\.\d+)?)|(?:not\s+)?in\s*\(\s*(?:\?|'|"|\d))/i;

/** 字符串字面量内容掏空（保留成对引号），反引号标识符去引号留内容；长度不变 */
export function maskSqlStrings(sql) {
  let out = "";
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) {
        if (quote === "`") out += " ";
        else if (quote === "'") out += "''";
        else out += '""';
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    out += ch;
  }
  return out;
}

export function statementOf(sql) {
  return (/^\s*([a-z]+)/i.exec(sql)?.[1] || "").toUpperCase();
}

export function hasTenantToken(sql) {
  return /tenant_id/i.test(sql);
}

/** 顶层（深度 0）里 `where` 的下标；找不到返回 -1 */
export function topLevelWhereIndex(masked) {
  let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /^where\b/i.test(masked.slice(i))) return i;
  }
  return -1;
}

/** 顶层（深度 0）里某关键字的下标；找不到返回 -1 */
function topLevelKeywordIndex(masked, kw) {
  let depth = 0;
  const re = new RegExp("^" + kw + "\\b", "i");
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && re.test(masked.slice(i))) return i;
  }
  return -1;
}

/**
 * 是否已带"绑定到调用者租户的条件"（true ⇒ 运行时可跳过注入）。
 * 与 `backend/src/shared/tenant-scope.ts` 的 `hasCallerTenantCondition` 同形。
 */
export function hasCallerTenantCondition(sql) {
  const stmt = statementOf(sql);
  const masked = maskSqlStrings(sql);

  if (stmt === "SELECT") return VALUE_PREDICATE_RE.test(masked);

  if (stmt === "UPDATE" || stmt === "DELETE") {
    const whereIdx = topLevelWhereIndex(masked);
    if (whereIdx < 0) return false;
    return VALUE_PREDICATE_RE.test(masked.slice(whereIdx));
  }

  if (stmt === "INSERT") {
    const m = /insert\s+(?:ignore\s+|low_priority\s+)?into\s+[`"[\]]?[a-z0-9_.]+[`"[\]]?\s*\(([^)]*)\)/i.exec(
      sql
    );
    if (m && /\btenant_id\b/i.test(m[1])) return true;
    const setIdx = topLevelKeywordIndex(masked, "set");
    if (setIdx >= 0) return VALUE_PREDICATE_RE.test(masked.slice(setIdx));
    const selIdx = topLevelKeywordIndex(masked, "select");
    if (selIdx >= 0) return VALUE_PREDICATE_RE.test(masked.slice(selIdx));
    return false;
  }
  return false;
}

export function markerOf(sql) {
  if (sql.includes(MARKER_SELF)) return MARKER_SELF;
  if (sql.includes(MARKER_PLATFORM)) return MARKER_PLATFORM;
  return null;
}

// ─────────────────────────── 登记表（改这里必须写理由） ───────────────────────────

/**
 * 显式标记登记：每个使用标记的调用点必须在此登记。
 * 用 file + `contains`（SQL 里一段稳定片段）定位，**不用行号**（行号会漂移 ⇒ 例外静默失效，见 guard-tenant-status R4 的教训）。
 */
const MARKER_ALLOWLIST = [
  {
    file: "jobs/report-aggregation.job.ts",
    contains: "SELECT DISTINCT tenant_id FROM t_sale_bill",
    marker: MARKER_PLATFORM,
    reason:
      "平台级汇总作业：需要**枚举全部租户**（该调用第 3 实参传空串，即「没有调用者租户」）。" +
      "它带 tenant_id 字样（SELECT 列）却没有租户过滤谓词 ⇒ 若不显式声明，收紧判据后会被注入 tenant_id = '' ⇒ 永远返回空集、作业静默失效。",
  },
];

/**
 * 非字面量/插值调用点登记：静态展不开 `${}`，必须在真库上跑过再登记结论。
 * verdict：ok-runtime（运行期确有谓词）/ ok-marker / unknown（转独立单）
 */
const INDIRECT_ALLOWLIST = [
  {
    file: "services/admin/batch-price.service.ts",
    contains: "SELECT COUNT(*) AS total FROM t_product_price pp",
    verdict: "ok-runtime",
    reason:
      "`WHERE ${where}` 静态展不开，但 previewBatchPriceAdjustment 的 conditions **首项就是** `pp.tenant_id = ?`（params 首项 = tenantId）" +
      "⇒ 插值后 SQL 含值谓词，运行期判据会跳过注入。真库证据：`raw/30-harness-fixed.txt` [5f][5g][5h]（A 令牌读数 = A 侧真值，B 的 SKU 命中 0 条）。",
  },
  {
    file: "config/database.ts",
    arg: "sql",
    verdict: "ok-passthrough",
    reason: "库内**透传**：queryOneWithTenant / executeWithTenant 把调用方的 SQL 原样转交给 queryWithTenant，本身没有独立 SQL ⇒ 由同一判据在入口处处理。",
  },
  {
    file: "services/admin/cart.service.ts",
    arg: "sql",
    verdict: "ok-passthrough",
    reason:
      "包装器：`conn ? conn.query : queryWithTenant(sql, ...)`。走 queryWithTenant 分支时由本判据处理；被包装的 SQL 均无 tenant_id 字样（依赖注入）。" +
      "⚠️ 走 `conn`（事务内）分支时**不经过注入器**，靠调用方显式谓词——属既有架构口径，已记入回执「范围外发现」。",
  },
  {
    file: "services/miniapp/checkout.service.ts",
    arg: "sql",
    verdict: "ok-passthrough",
    reason: "同 cart.service.ts 的 dbQuery 包装器（conn 分支 = 事务内显式谓词，否则走注入器）。",
  },
  {
    file: "services/admin/report-export.service.ts",
    arg: "sql",
    verdict: "ok-factory",
    reason:
      "SQL 由 reportQueries[report_type] 工厂产出（10 种报表）。逐条核对：每个工厂的 conditions **均以显式租户谓词开头**——" +
      "L20 `tenant_id = ?`、L35 `tenant_id = ?`、L49 `sbi.tenant_id = ?`、L65 `sb.tenant_id = ?`、L84 `ib.tenant_id = ?`、" +
      "L101 `tenant_id = ?`、L115 `tenant_id = ?`、L128 `sb.tenant_id = ?`、L151 直写 `WHERE tenant_id = ?`、L157 `lg.tenant_id = ?`" +
      "（带 JOIN 的一律限定别名）⇒ 运行期判据均能识别、不重复注入；未发现漏洞（S3-206 当时标为“值得单独复核”，本单复核完毕）。",
  },
  {
    file: "services/store/inventory.service.ts",
    arg: "totalSql",
    verdict: "ok-explicit",
    reason:
      "totalSql 的两个分支都是显式谓词：`SELECT COUNT(*) AS total FROM t_inventory_ledger WHERE tenant_id = ? [AND store_id = ?]`（同函数 L101 的明细 SQL 亦然）⇒ 非泄露。",
  },
  {
    file: "shared/field-sync.ts",
    arg: "targetSql",
    verdict: "ok-explicit",
    reason: "targetSql 拼装时已写死 `AND t.tenant_id = ?`（L335，占位符与 queryParams 第 3 项 tenantId 对齐）⇒ 非泄露。",
  },
];

// ─────────────────────────── 源码扫描 ───────────────────────────

const CALL_RE = /\b(queryWithTenant|queryOneWithTenant|executeWithTenant)\s*(?:<[^>()]*>)?\s*\(/g;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
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

/** 第一实参 → SQL 文本；`${}` 记为 ` ? ` 并把 interps 计数（静态展不开） */
function sqlOf(argText, fileText) {
  // 实参可以写成「注释行 + 字符串」（如 miniapp-order-sync.service.ts:61）⇒ 先剥掉前导注释再判
  const t = argText
    .replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)+/g, "")
    .trim();
  if (!t) return { sql: "", kind: "empty", interps: 0 };
  if (t.startsWith("`") || t.startsWith('"') || t.startsWith("'")) return extractLiteral(t);
  const name = t.split(/[\s(.,[]/)[0];
  const re = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*([`\"'])", "m");
  const m = re.exec(fileText);
  if (m) {
    const got = extractLiteral(fileText.slice(m.index + m[0].length - 1));
    return { ...got, kind: "resolved-var:" + name };
  }
  return { sql: "", kind: "indirect:" + name, interps: 0, raw: t.slice(0, 160), argText: name };
}

function extractLiteral(text) {
  const quote = text[0];
  let out = "";
  let interps = 0;
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      out += text[i + 1] ?? "";
      i++;
      continue;
    }
    if (ch === quote) break;
    if (quote === "`" && ch === "$" && text[i + 1] === "{") {
      let d = 1;
      let j = i + 2;
      for (; j < text.length && d > 0; j++) {
        if (text[j] === "{") d++;
        else if (text[j] === "}") d--;
      }
      out += " ? ";
      interps++;
      i = j - 1;
      continue;
    }
    out += ch;
  }
  return { sql: out.replace(/\s+/g, " ").trim(), kind: "literal", interps };
}

function scan(root) {
  const src = join(root, "backend", "src");
  const rows = [];
  for (const file of walk(src)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(src, file).split("\\").join("/");
    CALL_RE.lastIndex = 0;
    let m;
    while ((m = CALL_RE.exec(text))) {
      const openIdx = CALL_RE.lastIndex - 1;
      const line = text.slice(0, m.index).split("\n").length;
      // 跳过「函数定义」而不是调用点（`export async function queryWithTenant(` 等）
      const lineHead = text.slice(text.lastIndexOf("\n", m.index) + 1, m.index);
      if (/function\s*$/.test(lineHead)) continue;
      const a0 = readArg(text, openIdx, 0);
      if (!a0) continue;
      const lit = sqlOf(a0.arg, text);
      const sql = lit.sql || "";
      const stmt = statementOf(sql);
      const marker = markerOf(sql);
      const hasToken = hasTenantToken(sql);
      const cond = hasToken ? hasCallerTenantCondition(sql) : null;
      const hasJoin = /\bjoin\b/i.test(sql);
      const uncertain = lit.kind.startsWith("indirect") || (lit.interps || 0) > 0;
      const tokenInTop = hasToken && /tenant_id/i.test(maskSqlStrings(sql));
      let verdict;
      if (marker) verdict = "OK-MARKER";
      // 完全看不见 SQL（实参是变量/表达式，同文件也解析不出模板）⇒ 必须登记，否则红
      else if (lit.kind.startsWith("indirect")) verdict = "INDIRECT-NEEDS-REVIEW";
      // 字面量里没有 tenant_id 字样 ⇒ 依赖自动注入；带 `${}` 插值的 COUNT/筛选类 SQL 归此类（不阻断，见文件头 §边界 2/4）
      else if (!hasToken) verdict = hasJoin ? "WARN-AUTO-INJECT-JOIN" : "OK-AUTO-INJECT";
      else if (cond) verdict = tokenInTop ? "OK-TENANT-CONDITION" : "WARN-TOKEN-ONLY-IN-SUBQUERY";
      // 有字样、无条件、还带 `${}` 插值（如 `WHERE ${where}`）：静态判不了 ⇒ 必须登记
      else if (uncertain) verdict = "INDIRECT-NEEDS-REVIEW";
      else verdict = "BLOCK-MISSING-TENANT-CONDITION";
      rows.push({
        file: rel,
        line,
        stmt,
        kind: lit.kind,
        interps: lit.interps || 0,
        hasToken,
        cond,
        marker,
        hasJoin,
        verdict,
        argText: lit.argText || (lit.kind.startsWith("indirect") ? String(a0.arg).trim().slice(0, 40) : ""),
        sql: sql.slice(0, 300),
      });
    }
  }
  return rows;
}

// ─────────────────────────── 语料自检 ───────────────────────────

const CORPUS = join(HERE, "fixtures", "tenant-scope-corpus.json");

export function runSelfTest() {
  const cases = JSON.parse(readFileSync(CORPUS, "utf8"));
  const fails = [];
  for (const c of cases) {
    const got = hasCallerTenantCondition(c.sql);
    const expect = !!c.hasCallerTenantCondition;
    if (got !== expect) fails.push({ id: c.id, sql: c.sql, expect, got });
  }
  return { total: cases.length, fails };
}

// ─────────────────────────── 主流程 ───────────────────────────

function counts(rows) {
  const out = {};
  for (const r of rows) out[r.verdict] = (out[r.verdict] || 0) + 1;
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const st = runSelfTest();
  if (st.fails.length) {
    console.error(`RED 语料自检失败 ${st.fails.length}/${st.total}`);
    for (const f of st.fails) console.error(`  [${f.id}] expect=${f.expect} got=${f.got} :: ${f.sql}`);
    process.exit(1);
  }
  if (args.includes("--self-test")) {
    console.log(`GREEN 语料自检通过（${st.total} 例）`);
    process.exit(0);
  }

  const root = resolve(args.find((a) => !a.startsWith("--")) || DEFAULT_ROOT);
  const rows = scan(root);
  const by = (v) => rows.filter((r) => r.verdict === v);
  const blocking = by("BLOCK-MISSING-TENANT-CONDITION");
  const indirect = by("INDIRECT-NEEDS-REVIEW");
  const markers = by("OK-MARKER");
  const subqueryOnly = by("WARN-TOKEN-ONLY-IN-SUBQUERY");
  const warns = by("WARN-AUTO-INJECT-JOIN");

  // 登记表"失效"检查只在扫**项目自身根**时做：扫离线夹具树（反测）时登记项自然对不上，
  // 那不是失效而是"夹具里没有这些站点"，报了就是假红（会把反测判据本身变成噪声）。
  const scanningOwnRoot = root === resolve(DEFAULT_ROOT);

  const unregisteredMarkers = markers.filter(
    (r) => !MARKER_ALLOWLIST.some((a) => a.file === r.file && a.marker === r.marker && r.sql.includes(a.contains))
  );
  const staleMarkers = scanningOwnRoot
    ? MARKER_ALLOWLIST.filter(
        (a) => !markers.some((r) => r.file === a.file && r.marker === a.marker && r.sql.includes(a.contains))
      )
    : [];
  const indirectMatches = (r, a) =>
    a.file === r.file && (a.contains ? r.sql.includes(a.contains) : (r.argText || "").startsWith(a.arg || "\u0000"));
  const unregisteredIndirect = indirect.filter((r) => !INDIRECT_ALLOWLIST.some((a) => indirectMatches(r, a)));
  const staleIndirect = scanningOwnRoot
    ? INDIRECT_ALLOWLIST.filter((a) => !indirect.some((r) => indirectMatches(r, a)))
    : [];
  const red =
    blocking.length + unregisteredMarkers.length + staleMarkers.length + unregisteredIndirect.length + staleIndirect.length;

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          root,
          corpusSelfTest: st,
          counts: counts(rows),
          blocking,
          indirect,
          markers,
          subqueryOnly,
          warns,
          unregisteredMarkers,
          staleMarkers,
          unregisteredIndirect,
          staleIndirect,
        },
        null,
        1
      )
    );
    process.exit(red ? 1 : 0);
  }

  console.log("guard:tenant-injection（S3-207）");
  console.log(`  扫描根：${root}`);
  console.log(`  调用点：${rows.length}｜${Object.entries(counts(rows)).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`  语料自检：${st.total} 例通过`);

  if (blocking.length) {
    console.log(`\nRED 阻塞项（有 tenant_id 字样但没有绑定到调用者租户的条件）：${blocking.length} 条`);
    for (const r of blocking) console.log(`  ${r.file}:${r.line} [${r.stmt}] ${r.sql}`);
    console.log("  ⇒ 改前会被短路跳过（泄露/歧义 500 的温床）：要么补真谓词，要么登记显式标记。");
  }
  if (unregisteredMarkers.length) {
    console.log(`\nRED 未登记的显式标记：${unregisteredMarkers.length} 条`);
    for (const r of unregisteredMarkers) console.log(`  ${r.file}:${r.line} marker=${r.marker}`);
  }
  if (staleMarkers.length) {
    console.log(`\nRED 登记表里的标记已失效（SQL 改了或删了）：${staleMarkers.length} 条`);
    for (const a of staleMarkers) console.log(`  ${a.file} ${a.contains ? `contains="${a.contains}"` : `arg="${a.arg}"`}`);
  }
  if (unregisteredIndirect.length) {
    console.log(`\nRED 未登记的非字面量/插值调用点：${unregisteredIndirect.length} 条`);
    for (const r of unregisteredIndirect) console.log(`  ${r.file}:${r.line} kind=${r.kind} interps=${r.interps}`);
  }
  if (staleIndirect.length) {
    console.log(`\nRED 非字面量登记表失效：${staleIndirect.length} 条`);
    for (const a of staleIndirect) console.log(`  ${a.file} ${a.contains ? `contains="${a.contains}"` : `arg="${a.arg}"`}`);
  }
  if (markers.length) {
    console.log(`\n显式标记（已登记，每条打印理由）：${markers.length} 条`);
    for (const r of markers) {
      const a = MARKER_ALLOWLIST.find((x) => x.file === r.file && r.sql.includes(x.contains));
      console.log(`  ${r.file}:${r.line} marker=${r.marker} ⇒ ${a ? a.reason : "未登记"}`);
    }
  }
  if (warns.length) {
    console.log(`\nWARN（不阻断）自动注入 + JOIN ⇒ 注入无限定列名，第二张表也有 tenant_id 时会 1052：${warns.length} 条`);
    for (const r of warns) console.log(`  ${r.file}:${r.line} ${r.sql.slice(0, 110)}`);
  }
  if (subqueryOnly.length) {
    console.log(`\nWARN（不阻断）租户谓词只在子查询里（顶层表未被直接限定）：${subqueryOnly.length} 条`);
    for (const r of subqueryOnly) console.log(`  ${r.file}:${r.line} ${r.sql.slice(0, 110)}`);
  }
  if (indirect.length) {
    console.log(`\n已登记的插值调用点：${indirect.length} 条`);
    for (const r of indirect) {
      const a = INDIRECT_ALLOWLIST.find((x) => indirectMatches(r, x));
      console.log(`  ${r.file}:${r.line} arg=${r.argText || "(字面量)"} verdict=${a ? a.verdict : "未登记"}`);
    }
  }

  console.log(red ? `\nRED 共 ${red} 项待处理` : "\nGREEN 无阻塞项");
  process.exit(red ? 1 : 0);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("guard-tenant-injection.mjs")) main();
