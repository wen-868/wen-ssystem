#!/usr/bin/env node
/**
 * R101-C6-3-3 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言六件事：
 *   ① 「前端调用路径 ↔ 后端注册路径」逐字一致：8 条端点（方法 + 路径）集合相等，
 *      少一条、多一条、拼错一个字符都判红；
 *   ② 请求体字段集一致：前端 interface ↔ 后端 zod schema（集合相等），逐项对 5 个请求体；
 *   ③ 页面（AgentManagement.vue）实际提交体只写声明过的字段（不许页面偷偷塞自拟字段）；
 *   ④ 前端全仓没有自拟/未注册的 /platform/agents 路径；
 *   ⑤ 迁移 186/187 硬约束：CREATE TABLE IF NOT EXISTS + INSERT=0（零预置）+ 每个文本列显式
 *      COLLATE utf8mb4_0900_ai_ci + 不得出现 utf8mb4_unicode_ci + 不得建物理外键；
 *   ⑥ 零涉钱结构自证：迁移不得出现金额/结算/提现类列名，新增后端文件不得碰
 *      t_subscription* / t_platform_config（R8）。
 *
 * 用法：
 *   node saas-admin/tools/c6-3-3-selfcheck.mjs            # 检查本仓库
 *   node saas-admin/tools/c6-3-3-selfcheck.mjs <repoRoot> # 检查指定根目录（供"改坏⇒红"反测的沙箱副本）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 8 条端点（唯一真相源 = 派单卡 §四 + §二"详情"字面要求） ── */
const CARD_ENDPOINTS = [
  "GET /api/platform/agents",
  "POST /api/platform/agents",
  "GET /api/platform/agents/:param",
  "PUT /api/platform/agents/:param",
  "POST /api/platform/agents/:param/status",
  "GET /api/platform/agents/levels",
  "POST /api/platform/agents/levels",
  "PUT /api/platform/agents/levels/:param",
];

/* ── 请求体字段名契约（前端 interface ↔ 后端 zod schema 标记） ── */
const BODY_CONTRACTS = [
  { label: "代理商新建体", fe: "interface AgentCreateBody", be: "const createBodySchema" },
  { label: "代理商更新体", fe: "interface AgentUpdateBody", be: "const updateBodySchema" },
  { label: "状态流转体", fe: "interface AgentStatusBody", be: "const statusBodySchema" },
  { label: "层级新建体", fe: "interface AgentLevelCreateBody", be: "const levelCreateBodySchema" },
  { label: "层级更新体", fe: "interface AgentLevelUpdateBody", be: "const levelUpdateBodySchema" },
];

const ROUTES_FILE = "backend/src/routes/platform-agent.routes.ts";
const AGENT_CONTROLLER = "backend/src/controllers/platform/platform-agent.controller.ts";
const LEVEL_CONTROLLER = "backend/src/controllers/platform/platform-agent-level.controller.ts";
const API_FILE = "saas-admin/src/api.ts";
const PAGE_FILE = "saas-admin/src/views/marketing/AgentManagement.vue";
const MIGRATIONS = ["docs/migrations/186_平台代理商档案.sql", "docs/migrations/187_平台代理商层级.sql"];

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

/** zod 选项键：出现在对象块里但不是字段名，必须排除（否则会把 zod 报错文案当字段） */
const ZOD_OPTION_KEYS = new Set([
  "invalid_type_error",
  "required_error",
  "errorMap",
  "message",
  "description",
  "fatal",
  // 三元表达式 / 字面量出现在块里时会被冒号正则误判成"字段名"，一并排除
  "undefined",
  "null",
  "true",
  "false",
]);

function keysOf(block) {
  const keys = new Set();
  for (const m of block.matchAll(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*\??\s*:/g)) {
    if (ZOD_OPTION_KEYS.has(m[1])) continue;
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

/* ───────── ① 后端注册端点（方法 + 路径） ───────── */
const routesSource = read(ROUTES_FILE);
const prefix = /prefix:\s*"([^"]+)"/.exec(routesSource)?.[1];
const registered = new Set();
for (const m of routesSource.matchAll(/platformAgentRouter\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
  const rel = m[2];
  const full = normalizePath(`${prefix}${rel === "/" ? "" : rel}`);
  registered.add(`${m[1].toUpperCase()} ${full}`);
}
check(
  "①-a 后端注册端点恰好是卡内 8 条（方法 + 路径逐字）",
  sameSet(registered, new Set(CARD_ENDPOINTS)),
  `backend=${JSON.stringify(sorted(registered))}`
);
check("①-b 前缀声明为 /api/platform/agents（不新开前缀）", prefix === "/api/platform/agents", `prefix=${prefix}`);
check(
  "①-c 注册顺序：/levels 端点排在 /:id 之前（否则 GET /levels 会被 /:id 抢走）",
  routesSource.indexOf('"/levels"') > -1 &&
    routesSource.indexOf('"/levels"') < routesSource.indexOf('"/:id"')
);

/* ───────── ② 前端调用端点（api.ts） ───────── */
const apiSource = read(API_FILE);
const feCalls = new Set();
for (const m of apiSource.matchAll(/api\.(get|post|put|patch|delete)<[\s\S]*?>\(\s*[`"]([^`"]+)[`"]/g)) {
  const normalized = normalizePath(m[2]);
  // 本单只校代理商域：同一文件里还有大量其它平台端点的调用，不属于本单契约
  if (!normalized.startsWith("/api/platform/agents")) continue;
  feCalls.add(`${m[1].toUpperCase()} ${normalized}`);
}
check(
  "②-a 前端 api.ts 调用端点 ↔ 后端注册端点逐字一致（集合相等）",
  sameSet(feCalls, registered),
  `frontend=${JSON.stringify(sorted(feCalls))}`
);

/* ───────── ③ 前端全仓不得出现自拟/未注册路径 ───────── */
const feRoot = path.join(ROOT, "saas-admin", "src");
const PATH_RE = /(?:\/api)?\/platform\/agents(?:\/levels|\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g;
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
  "③ 前端出现的 /platform/agents 路径全部已在后端注册（无自拟变体）",
  [...seenPaths].every((p) => registeredPaths.has(p)),
  `unregistered=${JSON.stringify([...seenPaths].filter((p) => !registeredPaths.has(p)))}`
);

/* ───────── ④ 请求体字段集（前端 interface ↔ 后端 zod） ───────── */
const controllerSource = `${read(AGENT_CONTROLLER)}\n${read(LEVEL_CONTROLLER)}`;
for (const contract of BODY_CONTRACTS) {
  const feKeys = keysOf(balancedBlock(apiSource, contract.fe));
  const beKeys = keysOf(balancedBlock(controllerSource, contract.be));
  check(
    `④ ${contract.label}字段集一致（${contract.fe} ↔ ${contract.be}）`,
    feKeys.size > 0 && sameSet(feKeys, beKeys),
    `frontend=${JSON.stringify(sorted(feKeys))} backend=${JSON.stringify(sorted(beKeys))}`
  );
}

/* ───────── ⑤ 页面实际提交体只写声明过的字段 ───────── */
const pageSource = read(PAGE_FILE);
function objectLiteralKeys(source, marker) {
  const block = balancedBlock(source, marker);
  return keysOf(block);
}
/** 截取 [startMarker, endMarker) 之间的片段（用于把校验限定在单个函数体内，避免同名变量串味） */
function sliceBetween(source, startMarker, endMarker) {
  const from = source.indexOf(startMarker);
  if (from < 0) throw new Error(`未找到标记：${startMarker}`);
  const to = endMarker ? source.indexOf(endMarker, from) : -1;
  return to < 0 ? source.slice(from) : source.slice(from, to);
}
const declaredCreate = keysOf(balancedBlock(apiSource, "interface AgentCreateBody"));
const declaredUpdate = keysOf(balancedBlock(apiSource, "interface AgentUpdateBody"));
const declaredLevelCreate = keysOf(balancedBlock(apiSource, "interface AgentLevelCreateBody"));
const declaredLevelUpdate = keysOf(balancedBlock(apiSource, "interface AgentLevelUpdateBody"));

const pageCreateKeys = objectLiteralKeys(pageSource, "await createAgent(");
const pageLevelCreateKeys = objectLiteralKeys(pageSource, "await createAgentLevel(");
// 代理商更新：只取 saveAgent() 函数体内的 `body.X = ...`（saveLevel() 里也有同名 body 变量，必须分域）
const saveAgentSource = sliceBetween(pageSource, "async function saveAgent(", "async function changeStatus(");
const pageAgentUpdateKeys = new Set([...saveAgentSource.matchAll(/body\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]));
// 层级更新：saveLevel() 里除 `body.X = ...` 外，还有一组"字段名来自数组"的赋值：(body as any)[field] = next
const saveLevelSource = sliceBetween(pageSource, "async function saveLevel(", "/* ── ①-c");
const pageLevelUpdateKeys = new Set([
  ...[...saveLevelSource.matchAll(/body\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]),
  ...[...saveLevelSource.matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((m) => m[1]),
]);
const levelNumericLiteralKeys = new Set(
  [...pageLevelUpdateKeys].filter((k) => declaredLevelUpdate.has(k))
);

check(
  "⑤-a 建档提交体字段 ⊆ AgentCreateBody 声明集",
  pageCreateKeys.size > 0 && [...pageCreateKeys].every((k) => declaredCreate.has(k)),
  `payload=${JSON.stringify(sorted(pageCreateKeys))}`
);
check(
  "⑤-b 新建层级提交体字段 ⊆ AgentLevelCreateBody 声明集",
  pageLevelCreateKeys.size > 0 && [...pageLevelCreateKeys].every((k) => declaredLevelCreate.has(k)),
  `payload=${JSON.stringify(sorted(pageLevelCreateKeys))}`
);
check(
  "⑤-c 代理商更新提交体字段 ⊆ AgentUpdateBody 声明集",
  pageAgentUpdateKeys.size > 0 && [...pageAgentUpdateKeys].every((k) => declaredUpdate.has(k)),
  `payload=${JSON.stringify(sorted(pageAgentUpdateKeys))}`
);
check(
  "⑤-d 层级更新提交体字段（含数组驱动的数值字段） ⊆ AgentLevelUpdateBody 声明集",
  levelNumericLiteralKeys.size > 0 && [...levelNumericLiteralKeys].every((k) => declaredLevelUpdate.has(k)),
  `payload=${JSON.stringify(sorted(pageLevelUpdateKeys))}`
);

/* ───────── ⑥ 迁移硬约束 ───────── */
/**
 * 统计前剥掉 SQL 注释行（否则注释里"INSERT 命中 0"这类说明文字会误计入）。
 *
 * ⚠️ 必须先归一 CRLF：本仓 core.autocrlf=true ⇒ **检出的工作区文件是 CRLF**，
 *    而 `/--.*$/` 里的 `$` 在 CRLF 行尾**不匹配**（`.` 不吃 `\r`）⇒ 注释剥不掉、
 *    会把注释里的 "INSERT 命中 0" 计入，导致**在正常检出上假红**（凌舟 2026-10-01 实测：
 *    本单提交前（LF 工作区）FAIL 0，rebase 后（CRLF 工作区）FAIL 3）。
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

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
    .filter((line) => /(amount|money|settle|withdraw|balance)/i.test(line));
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
    `⑥-c ${rel.split("/").pop()}：无金额/结算/提现类列（零涉钱）`,
    moneyColumns.length === 0,
    `命中=${JSON.stringify(moneyColumns.map((l) => l.trim().split(/\s+/)[0]))}`
  );
}
check("⑥-d 两个迁移文件合计恰好 2 张新表", totalCreateTables === 2, `count=${totalCreateTables}`);

/* ───────── ⑦ 零涉钱：新增后端文件不碰既有敏感域 ───────── */
const backendNewFiles = [
  ROUTES_FILE,
  AGENT_CONTROLLER,
  LEVEL_CONTROLLER,
  "backend/src/services/platform/platform-agent.service.ts",
  "backend/src/services/platform/platform-agent-level.service.ts",
];
const forbidden = ["t_subscription", "t_platform_config", "t_profit", "t_settlement", "t_withdraw"];
const offenders = [];
for (const rel of backendNewFiles) {
  const src = read(rel);
  for (const word of forbidden) {
    if (src.includes(word)) offenders.push(`${rel}:${word}`);
  }
}
check(
  "⑦ 新增后端文件不出现 t_subscription* / t_platform_config / 台账·结算·提现表",
  offenders.length === 0,
  `命中=${JSON.stringify(offenders)}`
);

/* ───────── 输出 ───────── */
console.log("\n—— 前端 /platform/agents 字面逐条（文件:行 ⇒ 归一化路径） ——");
for (const hit of pathHits) console.log(`   ${hit}`);
console.log(`—— 后端注册端点 ——\n   ${sorted(registered).join("\n   ")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
