#!/usr/bin/env node
/**
 * R101-C6-3-2a 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言：
 *   ① 后端注册端点（方法 + 路径）恰好等于卡内 4 条，少一条 / 多一条 / 拼错一字都判红；
 *   ② 前端 api.ts 调用的 /platform/promo-codes 端点集合 ↔ 后端注册集合相等；
 *   ③ saas-admin/src 全仓出现的 /platform/promo-codes 字面全部已注册（无自拟变体）；
 *   ④ 请求体字段集一致：前端 interface PromoCodeCreateBody ↔ 后端 zod createBodySchema；
 *   ⑤ 页面 ChannelPromotion.vue 实际提交体字段 ⊆ 声明集（不许页面偷偷塞自拟字段）；
 *   ⑥ 迁移 188/189 硬约束：各恰好 1 条 CREATE TABLE IF NOT EXISTS、INSERT=0（零预置）、
 *      无 utf8mb4_unicode_ci、不建物理外键、每个文本列显式 COLLATE utf8mb4_0900_ai_ci、
 *      零金额（无 金额/分润/佣金/结算/提现 类列名）。
 *
 * 用法：
 *   node saas-admin/tools/c6-3-2a-selfcheck.mjs             # 检查本仓库
 *   node saas-admin/tools/c6-3-2a-selfcheck.mjs <repoRoot>   # 检查指定根目录（供"改坏⇒红"反测）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 4 条端点（唯一真相源 = 派单卡 §四，路径逐字） ── */
const CARD_ENDPOINTS = [
  "GET /api/platform/promo-codes",
  "POST /api/platform/promo-codes",
  "POST /api/platform/promo-codes/:param/disable",
  "GET /api/platform/promo-codes/:param/attributions",
];

const ROUTES_FILE = "backend/src/routes/platform-promo-code.routes.ts";
const CONTROLLER_FILE = "backend/src/controllers/platform/platform-promo-code.controller.ts";
const API_FILE = "saas-admin/src/api.ts";
const PAGE_FILE = "saas-admin/src/views/marketing/ChannelPromotion.vue";
const MIGRATIONS = ["docs/migrations/188_平台渠道推广码.sql", "docs/migrations/189_租户归因明细.sql"];

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`缺少文件：${rel}（root=${ROOT}）`);
  return fs.readFileSync(abs, "utf8");
}

/** 递归列出目录下所有文件（跳过 node_modules/dist/.git/.vite） */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".vite"].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** 路径归一：/platform/x/${id} 与 /api/platform/x/:id 都归一为 /api/platform/x/:param */
function normalizePath(raw) {
  let s = String(raw).trim();
  if (/^\/platform\//.test(s)) s = `/api${s}`;
  if (!s.startsWith("/api/")) s = `/api${s.startsWith("/") ? s : `/${s}`}`;
  return s.replace(/\$\{[^}]*\}/g, ":param").replace(/:[A-Za-z0-9_]+/g, ":param");
}

/** 取 marker 之后第一个 `{...}` 平衡块（用于抠出 interface / z.object 的字段名） */
function balancedBlock(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`未找到标记：${marker}`);
  const open = source.indexOf("{", at);
  if (open < 0) throw new Error(`标记后没有对象块：${marker}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`对象块未闭合：${marker}`);
}

/** zod 选项键 / 字面量：出现在对象块里但不是字段名，必须排除 */
const NON_FIELD_KEYS = new Set([
  "invalid_type_error",
  "required_error",
  "errorMap",
  "message",
  "description",
  "fatal",
  "undefined",
  "null",
  "true",
  "false",
]);

function keysOf(block) {
  const keys = new Set();
  for (const m of block.matchAll(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*\??\s*:/g)) {
    if (NON_FIELD_KEYS.has(m[1])) continue;
    keys.add(m[1]);
  }
  return keys;
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function sorted(arr) {
  return [...arr].sort();
}

/** 统计前剥掉 SQL 注释行；必须先归一 CRLF（core.autocrlf=true ⇒ 工作区是 CRLF，
 *  否则 `--.*$` 不吃 `\r`，注释里的说明文字会被误计入造成假红）。 */
function stripSqlComments(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

try {
  /* ───────── ① 后端注册端点（方法 + 路径） ───────── */
  const routesSource = read(ROUTES_FILE);
  const prefix = /prefix:\s*"([^"]+)"/.exec(routesSource)?.[1];
  const registered = new Set();
  // 路由变量名不写死（后端可用 platformPromoCodeRouter / promoCodeRouter 等）
  for (const m of routesSource.matchAll(/[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    const rel = m[2];
    const full = normalizePath(`${prefix}${rel === "/" ? "" : rel}`);
    registered.add(`${m[1].toUpperCase()} ${full}`);
  }
  check(
    "①-a 后端注册端点恰好是卡内 4 条（方法 + 路径逐字）",
    sameSet(registered, new Set(CARD_ENDPOINTS)),
    `backend=${JSON.stringify(sorted(registered))}`
  );
  check("①-b 前缀声明为 /api/platform/promo-codes（不新开前缀）", prefix === "/api/platform/promo-codes", `prefix=${prefix}`);

  /* ───────── ② 前端调用端点（api.ts） ───────── */
  const apiSource = read(API_FILE);
  const feCalls = new Set();
  for (const m of apiSource.matchAll(/api\.(get|post|put|patch|delete)<[\s\S]*?>\(\s*[`"]([^`"]+)[`"]/g)) {
    const normalized = normalizePath(m[2]);
    // 本单只校推广码域：同一文件还有大量其它平台端点调用，不属于本单契约
    if (!normalized.startsWith("/api/platform/promo-codes")) continue;
    feCalls.add(`${m[1].toUpperCase()} ${normalized}`);
  }
  check(
    "② 前端 api.ts 调用端点 ↔ 后端注册端点逐字一致（集合相等）",
    sameSet(feCalls, registered),
    `frontend=${JSON.stringify(sorted(feCalls))}`
  );

  /* ───────── ③ 前端全仓不得出现自拟/未注册路径 ───────── */
  const feRoot = path.join(ROOT, "saas-admin", "src");
  const PATH_RE = /(?:\/api)?\/platform\/promo-codes(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g;
  const seenPaths = new Set();
  const pathHits = [];
  for (const abs of walk(feRoot)) {
    if (!/\.(ts|vue|js|mjs)$/.test(abs)) continue;
    const src = fs.readFileSync(abs, "utf8");
    const rel = path.relative(ROOT, abs);
    for (const m of src.matchAll(PATH_RE)) {
      const normalized = normalizePath(m[0]);
      seenPaths.add(normalized);
      const line = src.slice(0, m.index).split("\n").length;
      pathHits.push(`${rel}:${line}  ${m[0]}  ⇒  ${normalized}`);
    }
  }
  const registeredPaths = new Set([...registered].map((e) => e.split(" ")[1]));
  check(
    "③ 前端出现的 /platform/promo-codes 路径全部已在后端注册（无自拟变体）",
    [...seenPaths].every((p) => registeredPaths.has(p)),
    `unregistered=${JSON.stringify([...seenPaths].filter((p) => !registeredPaths.has(p)))}`
  );

  /* ───────── ④ 请求体字段集（前端 interface ↔ 后端 zod） ───────── */
  const controllerSource = read(CONTROLLER_FILE);
  const feKeys = keysOf(balancedBlock(apiSource, "interface PromoCodeCreateBody"));
  const beKeys = keysOf(balancedBlock(controllerSource, "const createBodySchema"));
  check(
    "④ 生成体字段集一致（interface PromoCodeCreateBody ↔ const createBodySchema）",
    feKeys.size > 0 && sameSet(feKeys, beKeys),
    `frontend=${JSON.stringify(sorted(feKeys))} backend=${JSON.stringify(sorted(beKeys))}`
  );

  /* ───────── ⑤ 页面实际提交体只写声明过的字段 ───────── */
  const pageSource = read(PAGE_FILE);
  const pageCreateKeys = keysOf(balancedBlock(pageSource, "await createPromoCode("));
  check(
    "⑤-a 生成提交体字段 ⊆ PromoCodeCreateBody 声明集",
    pageCreateKeys.size > 0 && [...pageCreateKeys].every((k) => feKeys.has(k)),
    `payload=${JSON.stringify(sorted(pageCreateKeys))}`
  );
  check(
    "⑤-b 页面停用/归因走已注册端点函数（disablePromoCode / listPromoCodeAttributions 均在 api.ts 调用）",
    pageSource.includes("disablePromoCode") &&
      pageSource.includes("listPromoCodeAttributions") &&
      feCalls.has("POST /api/platform/promo-codes/:param/disable") &&
      feCalls.has("GET /api/platform/promo-codes/:param/attributions")
  );
  check(
    "⑤-c 页面数据层零金额：表单/请求体标识符不含 commission/profit/amount/settle/withdraw/money",
    !/(commission|profit|amount|settle|withdraw|money|firstOrderPoints)/i.test(pageSource),
    `命中=${JSON.stringify(
      (pageSource.match(/(commission|profit|amount|settle|withdraw|money|firstOrderPoints)/gi) ?? []).slice(0, 8)
    )}`
  );

  /* ───────── ⑥ 迁移硬约束 ───────── */
  let totalCreateTables = 0;
  for (const rel of MIGRATIONS) {
    const sql = stripSqlComments(read(rel));
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
    const inserts = [...sql.matchAll(/\bINSERT\b/gi)].length;
    const badCollate = [...sql.matchAll(/utf8mb4_unicode_ci/g)].length;
    const foreignKeys = [...sql.matchAll(/\b(FOREIGN KEY|REFERENCES)\b/gi)].length;
    const varcharLines = sql.split("\n").filter((line) => /VARCHAR\s*\(/i.test(line));
    const varcharWithoutCollate = varcharLines.filter((line) => !/COLLATE\s+utf8mb4_0900_ai_ci/i.test(line));
    const moneyColumns = sql
      .split("\n")
      .filter((line) => /^\s*[A-Za-z_][\w]*\s+(BIGINT|INT|DECIMAL|VARCHAR)/i.test(line))
      .filter((line) => /(amount|money|settle|withdraw|balance|profit_rate)/i.test(line));
    totalCreateTables += tables;

    check(
      `⑥-a ${rel.split("/").pop()}：IF NOT EXISTS ${tables} 条 / INSERT ${inserts} 条 / unicode_ci ${badCollate} 处 / 外键 ${foreignKeys} 处`,
      tables === 1 && inserts === 0 && badCollate === 0 && foreignKeys === 0,
      "要求：恰好 1 条 CREATE TABLE IF NOT EXISTS、INSERT=0、unicode_ci=0、不建物理外键"
    );
    check(
      `⑥-b ${rel.split("/").pop()}：${varcharLines.length} 个文本列全部显式 COLLATE utf8mb4_0900_ai_ci`,
      varcharLines.length > 0 && varcharWithoutCollate.length === 0,
      `缺少 collate 的行数=${varcharWithoutCollate.length}`
    );
    check(
      `⑥-c ${rel.split("/").pop()}：无金额/结算/提现/分润类列（零涉钱）`,
      moneyColumns.length === 0,
      `命中=${JSON.stringify(moneyColumns.map((l) => l.trim().split(/\s+/)[0]))}`
    );
  }
  check("⑥-d 两个迁移文件合计恰好 2 张新表", totalCreateTables === 2, `count=${totalCreateTables}`);

  /* ───────── 输出 ───────── */
  console.log("\n—— 前端 /platform/promo-codes 字面逐条（文件:行 ⇒ 归一化路径） ——");
  for (const hit of pathHits) console.log(`   ${hit}`);
  console.log(`—— 后端注册端点 ——\n   ${sorted(registered).join("\n   ")}`);
} catch (err) {
  check(`致命错误：${err instanceof Error ? err.message : String(err)}`, false);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
