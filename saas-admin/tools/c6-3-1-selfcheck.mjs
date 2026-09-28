#!/usr/bin/env node
/**
 * R101-C6-3-1 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言三件事（派单卡 §三D③ 硬要求）：
 *   ① 「前端字面路径 ↔ 后端注册路径」逐字一致：前端只能出现卡内 5 条路径，
 *      且后端注册的这 5 条必须与前端用到的完全一致（少一条、多一条、拼错一个字符都判红）；
 *   ② 请求体形状一致：前端声明的请求体字段名 ↔ 后端 zod schema 的字段名（集合相等），
 *      且两个页面的"实际提交体"只写入声明过的字段（不许页面偷偷塞自拟字段）；
 *   ③ 迁移硬约束：184/185 两文件 CREATE TABLE IF NOT EXISTS + 显式 utf8mb4_0900_ai_ci +
 *      零 INSERT（零预置）+ 不得出现 utf8mb4_unicode_ci。
 *
 * 用法：
 *   node saas-admin/tools/c6-3-1-selfcheck.mjs            # 检查本仓库
 *   node saas-admin/tools/c6-3-1-selfcheck.mjs <repoRoot> # 检查指定根目录（供"改坏⇒红"反测的沙箱副本）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 5 条路径（唯一真相源 = 派单卡 §三A②/§三B②） ── */
const CARD_PATHS = [
  "/api/platform/config/feature-switches",
  "/api/platform/config/feature-switches/:param",
  "/api/platform/config/data-dict",
  "/api/platform/config/data-dict/:param/items",
  "/api/platform/config/data-dict/:param",
];

/* ── 请求体字段名契约（前端声明 ↔ 后端 zod） ── */
const FEATURE_SWITCH_BODY_KEYS = ["enabled", "defaultForNewTenant", "remark"];
const DICT_BODY_KEYS = ["items"];
const DICT_ITEM_KEYS = ["itemCode", "itemName", "sortNo", "status", "remark"];

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`缺少文件：${rel}（root=${ROOT}）`);
  return fs.readFileSync(abs, "utf8");
}

/** 递归列出目录下所有文件（跳过 node_modules/dist/.git） */
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

/** zod 选项键：出现在对象块里但不是字段名，必须排除（否则 schema 报错文案会把字段集污染） */
const ZOD_OPTION_KEYS = new Set([
  "invalid_type_error",
  "required_error",
  "errorMap",
  "message",
  "description",
  "fatal",
]);

/** 从块里取字段名（`enabled?: boolean` / `items: X` / `itemCode: z.string()` 三种写法都覆盖） */
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

/* ───────── ① 后端注册路径 ───────── */
const routesSource = read("backend/src/routes/platform-config.routes.ts");
const prefix = /prefix:\s*"([^"]+)"/.exec(routesSource)?.[1];
const declared = new Set();
for (const m of routesSource.matchAll(/platformConfigRouter\.(get|put|post|patch|delete)\(\s*"([^"]+)"/g)) {
  const rel = m[2];
  if (!/feature-switches|data-dict/.test(rel)) continue;
  declared.add(`${prefix}${rel === "/" ? "" : rel}`.replace(/:[A-Za-z0-9_]+/g, ":param"));
}

check(
  "①-a 后端注册路径恰好是卡内 5 条（前缀 /api/platform/config）",
  sameSet(declared, new Set(CARD_PATHS)),
  `backend=${JSON.stringify(sorted(declared))}`
);
check(
  "①-b 注册全部落在既有平台配置路由（不新开前缀）",
  prefix === "/api/platform/config",
  `prefix=${prefix}`
);

/* ───────── ② 前端字面路径 ───────── */
const feRoot = path.join(ROOT, "saas-admin", "src");
const pathHits = [];
const feLiterals = new Set();
const PATH_RE = /(?:\/api)?\/platform\/config\/(?:feature-switches|data-dict)(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g;

for (const abs of walk(feRoot)) {
  if (!/\.(ts|vue|js|mjs)$/.test(abs)) continue;
  const src = fs.readFileSync(abs, "utf8");
  const rel = path.relative(ROOT, abs);
  for (const m of src.matchAll(PATH_RE)) {
    const normalized = m[0]
      .replace(/\$\{[^}]*\}/g, ":param")
      .replace(/:[A-Za-z0-9_]+/g, ":param")
      .replace(/^\/platform\//, "/api/platform/");
    feLiterals.add(normalized);
    const line = src.slice(0, m.index).split("\n").length;
    pathHits.push(`${rel}:${line}  ${m[0]}  ⇒  ${normalized}`);
  }
}

check(
  "②-a 前端字面路径 ↔ 后端注册路径逐字一致（集合相等）",
  sameSet(feLiterals, declared),
  `frontend=${JSON.stringify(sorted(feLiterals))}`
);
check(
  "②-b 前端没有自拟变体（/data-dict/import 等）",
  ![...walk(feRoot)]
    .filter((f) => /\.(ts|vue|js|mjs)$/.test(f))
    .some((f) => fs.readFileSync(f, "utf8").includes("data-dict/import")),
  "rg -n \"data-dict/import\" saas-admin/src ⇒ 0"
);

/* ───────── ③ 请求体形状（前端声明 ↔ 后端 zod） ───────── */
const apiSource = read("saas-admin/src/api.ts");
const fsController = read("backend/src/controllers/platform/platform-feature-switch.controller.ts");
const dictController = read("backend/src/controllers/platform/platform-dict.controller.ts");

const feSwitchKeys = keysOf(balancedBlock(apiSource, "interface FeatureSwitchUpdateBody"));
const beSwitchKeys = keysOf(balancedBlock(fsController, "const updateBodySchema"));
check(
  "③-a 功能开关请求体字段集一致（前端 FeatureSwitchUpdateBody ↔ 后端 updateBodySchema）",
  sameSet(feSwitchKeys, beSwitchKeys),
  `frontend=${JSON.stringify(sorted(feSwitchKeys))} backend=${JSON.stringify(sorted(beSwitchKeys))}`
);
check(
  "③-b 功能开关请求体三项与卡内逐字（enabled/defaultForNewTenant/remark）",
  sameSet(beSwitchKeys, new Set(FEATURE_SWITCH_BODY_KEYS)),
  `backend=${JSON.stringify(sorted(beSwitchKeys))}`
);

const feDictBodyKeys = keysOf(balancedBlock(apiSource, "interface DataDictReplaceBody"));
const beDictBodyKeys = keysOf(balancedBlock(dictController, "const replaceBodySchema"));
check(
  "③-c 数据字典整包替换请求体字段集一致（items）",
  sameSet(feDictBodyKeys, beDictBodyKeys) && sameSet(beDictBodyKeys, new Set(DICT_BODY_KEYS)),
  `frontend=${JSON.stringify(sorted(feDictBodyKeys))} backend=${JSON.stringify(sorted(beDictBodyKeys))}`
);

const feDictItemKeys = keysOf(balancedBlock(apiSource, "interface DataDictItemBody"));
const beDictItemKeys = keysOf(balancedBlock(dictController, "const itemSchema"));
check(
  "③-d 字典项字段集一致（前端 DataDictItemBody ↔ 后端 itemSchema）",
  sameSet(feDictItemKeys, beDictItemKeys) && sameSet(beDictItemKeys, new Set(DICT_ITEM_KEYS)),
  `frontend=${JSON.stringify(sorted(feDictItemKeys))} backend=${JSON.stringify(sorted(beDictItemKeys))}`
);

/** 页面实际提交体只允许写声明过的字段 */
function pagePayloadKeys(rel, marker) {
  const src = read(rel);
  const block = balancedBlock(src, marker);
  const keys = new Set();
  for (const m of block.matchAll(/payload\.([A-Za-z_$][\w$]*)\s*=/g)) keys.add(m[1]);
  return keys;
}

const appVersionKeys = pagePayloadKeys("saas-admin/src/views/AppVersions.vue", "function buildSwitchPayload");
check(
  "③-e 版本页实际提交体只写声明过的字段（buildSwitchPayload ⊆ 声明集）",
  appVersionKeys.size > 0 && [...appVersionKeys].every((k) => feSwitchKeys.has(k)),
  `payload keys=${JSON.stringify(sorted(appVersionKeys))}`
);

const settingsKeys = pagePayloadKeys("saas-admin/src/views/Settings.vue", "function buildDictPayload");
check(
  "③-f 设置页实际提交体只写声明过的字段（buildDictPayload ⊆ 声明集）",
  settingsKeys.size > 0 && [...settingsKeys].every((k) => feDictBodyKeys.has(k)),
  `payload keys=${JSON.stringify(sorted(settingsKeys))}`
);

/* ───────── ④ 迁移硬约束（零预置 / 幂等 / 显式 collate） ───────── */
/** 统计前剥掉 SQL 注释行（否则注释里"INSERT 命中 0""IF NOT EXISTS 重跑跳过"这些说明文字会误计入） */
function stripSqlComments(sql) {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

for (const rel of ["docs/migrations/184_平台功能开关.sql", "docs/migrations/185_平台数据字典.sql"]) {
  const sql = stripSqlComments(read(rel));
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
  const inserts = [...sql.matchAll(/\bINSERT\b/gi)].length;
  const badCollate = [...sql.matchAll(/utf8mb4_unicode_ci/g)].length;
  const goodCollate = [...sql.matchAll(/utf8mb4_0900_ai_ci/g)].length;
  check(
    `④ ${rel.split("/").pop()}：IF NOT EXISTS ${tables} 条 / INSERT ${inserts} 条 / 0900_ai_ci ${goodCollate} 处 / unicode_ci ${badCollate} 处`,
    tables >= 1 && inserts === 0 && badCollate === 0 && goodCollate >= tables,
    "要求：至少 1 条 CREATE TABLE IF NOT EXISTS、INSERT=0、unicode_ci=0、显式 0900_ai_ci"
  );
}

/* ───────── 输出 ───────── */
console.log("\n—— 前端字面路径逐条（文件:行 ⇒ 归一化路径） ——");
for (const hit of pathHits) console.log(`   ${hit}`);
console.log(`—— 后端注册路径 ——\n   ${sorted(declared).join("\n   ")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
