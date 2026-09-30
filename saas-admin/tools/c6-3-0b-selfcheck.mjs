#!/usr/bin/env node
/**
 * R101-C6-3-0b 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言四件事（派单卡 §三③ + §四②③）：
 *   ① 「前端字面路径 ↔ 后端注册路径」逐字一致：卡内 4 条路径必须一条不多、一条不少、一个字符不差；
 *      api.ts 里 `/platform/(admins|roles)` 的字面量必须全部落在已知白名单内（防自拟变体）；
 *      AdminPermissions.vue 里**零**端点字面量（路径只许待在 api.ts）。
 *   ② 请求体字段集：状态切换 {status} / 重置密码（无请求体）/ 邀请建号 / 新建角色 四条，逐条比对
 *      前端声明 ↔ 后端 zod schema，并断言页面实际提交体只写声明过的字段。
 *   ③ 一次性口令零泄漏：页面 0 处 localStorage / console.log，且"只显示一次"提示与复制按钮在位；
 *      口令相关的两个 api 函数不碰 localStorage / URL。
 *   ④ 后端状态枚举与前端类型口径一致（ACTIVE / DISABLED）。
 *
 * 用法：
 *   node saas-admin/tools/c6-3-0b-selfcheck.mjs            # 检查本仓库
 *   node saas-admin/tools/c6-3-0b-selfcheck.mjs <repoRoot> # 检查指定根目录（供"改坏⇒红"反测的沙箱副本）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 4 条路径（唯一真相源 = 派单卡 §一） ── */
const CARD_PATHS = [
  "/api/platform/admins/:param/status",
  "/api/platform/admins/:param/reset-password",
  "/api/platform/admins/invite",
  "/api/platform/roles",
];

/** api.ts 里 `/platform/(admins|roles)` 字面量的已知白名单（逐条给出存在理由） */
const API_PATH_WHITELIST = {
  "/api/platform/admins": "C6-3-0 管理员列表 GET（既有）",
  "/api/platform/admins/roles": "C6-2-T6 角色列表 GET（既有）",
  "/api/platform/roles/:param/permissions": "C6-2-T6 权限矩阵 GET|PUT（既有）",
  "/api/platform/admins/invite": "本单 POST 邀请建号",
  "/api/platform/admins/:param/reset-password": "本单 POST 重置密码",
  "/api/platform/admins/:param/status": "本单 PUT 启停",
  "/api/platform/roles": "本单 POST 新建自定义角色",
};

/** 请求体字段集（卡内钉死 → 脚本断言） */
const INVITE_BODY_KEYS = ["username", "name", "phone"];
const ROLE_BODY_KEYS = ["name", "code", "remark"];
const STATUS_BODY_KEYS = ["status"];

const PAGE = "saas-admin/src/views/platform/AdminPermissions.vue";
const API = "saas-admin/src/api.ts";
const PLATFORM_ROUTES = "backend/src/routes/platform.routes.ts";
const ROLE_ROUTES = "backend/src/routes/platform-role.routes.ts";
const PLATFORM_CONTROLLER = "backend/src/controllers/platform/platform.controller.ts";
const ROLE_CONTROLLER = "backend/src/controllers/platform/platform-role.controller.ts";

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

/** zod 选项键：出现在对象块里但不是字段名 */
const ZOD_OPTION_KEYS = new Set([
  "invalid_type_error",
  "required_error",
  "errorMap",
  "message",
  "description",
  "fatal",
]);

/** 从块里取字段名（`status: X` / `remark?: string` 两种写法都覆盖） */
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
function normPath(raw) {
  return raw
    .replace(/\$\{[^}]*\}/g, ":param")
    .replace(/:[A-Za-z0-9_]+/g, ":param")
    .replace(/\/$/, "")
    .replace(/^\/platform\//, "/api/platform/");
}

const PATH_RE = /(?:\/api)?\/platform\/(?:admins|roles)(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g;

/* ───────── ①-a 后端注册路径 ───────── */
const platformRoutesSrc = read(PLATFORM_ROUTES);
const platformPrefix = /prefix:\s*"([^"]+)"/.exec(platformRoutesSrc)?.[1];
const backendPaths = new Set();
for (const m of platformRoutesSrc.matchAll(/platformRouter\.(?:get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
  const rel = m[1];
  if (!/admins\/(?:invite|:id\/reset-password|:id\/status)/.test(rel)) continue;
  backendPaths.add(normPath(`${platformPrefix}${rel}`));
}

const roleRoutesSrc = read(ROLE_ROUTES);
/** platform-role.routes.ts 有 3 个 routeConfig，取以 /roles 结尾的那个（角色增删改的挂载前缀） */
const rolePrefixes = [...roleRoutesSrc.matchAll(/prefix:\s*"([^"]+)"/g)].map((m) => m[1]);
const rolePrefix = rolePrefixes.find((p) => p.endsWith("/roles"));
const roleCreateMatch = /platformRolesRouter\.post\(\s*"([^"]+)"/.exec(roleRoutesSrc);
if (roleCreateMatch && rolePrefix) {
  backendPaths.add(normPath(`${rolePrefix}${roleCreateMatch[1] === "/" ? "" : roleCreateMatch[1]}`));
}

check(
  "①-a 后端注册路径恰好是卡内 4 条（/api/platform 前缀）",
  sameSet(backendPaths, new Set(CARD_PATHS)),
  `backend=${JSON.stringify(sorted(backendPaths))}`
);
check(
  "①-b 注册前缀与卡内一致（platform + platform-role 两文件）",
  platformPrefix === "/api/platform" && rolePrefix === "/api/platform/roles",
  `platform=${platformPrefix} roles=${rolePrefix}`
);

/* ───────── ①-b 前端字面路径 ───────── */
const apiSrc = read(API);
const apiPaths = new Set();
const apiHits = [];
for (const m of apiSrc.matchAll(PATH_RE)) {
  const normalized = normPath(m[0]);
  apiPaths.add(normalized);
  const line = apiSrc.slice(0, m.index).split("\n").length;
  apiHits.push(`${API}:${line}  ${m[0]}  ⇒  ${normalized}`);
}

check(
  "①-c 4 条卡内路径全部在 api.ts 出现（一条不少）",
  CARD_PATHS.every((p) => apiPaths.has(p)),
  `missing=${JSON.stringify(CARD_PATHS.filter((p) => !apiPaths.has(p)))}`
);
const unknownApiPaths = [...apiPaths].filter((p) => !(p in API_PATH_WHITELIST));
check(
  "①-d api.ts 无自拟路径（全部落在已知白名单）",
  unknownApiPaths.length === 0,
  `unknown=${JSON.stringify(sorted(unknownApiPaths))}`
);

const pageSrc = read(PAGE);
const pagePaths = [...pageSrc.matchAll(PATH_RE)].map((m) => normPath(m[0]));
check(
  "①-e AdminPermissions.vue 零端点字面量（路径只许在 api.ts）",
  pagePaths.length === 0,
  `page=${JSON.stringify(sorted(new Set(pagePaths)))}`
);

/* ───────── ② 请求体字段集 ───────── */
const platformCtrlSrc = read(PLATFORM_CONTROLLER);
const roleCtrlSrc = read(ROLE_CONTROLLER);

// ②-a 启停：后端 {status} ↔ 前端 type + 提交体
const statusZodKeys = keysOf(
  balancedBlock(platformCtrlSrc.slice(platformCtrlSrc.indexOf("export const updateAdminStatus")), "z.object({")
);
/** 整个顶层函数源码（含参数类型标注），取到下一个顶层 `}` 为止 */
function topLevelFnSource(src, name) {
  const at = src.indexOf(name);
  if (at < 0) throw new Error(`未找到函数：${name}`);
  const rest = src.slice(at);
  const end = rest.indexOf("\n}\n");
  return end < 0 ? rest : rest.slice(0, end + 2);
}
const statusFnText = topLevelFnSource(apiSrc, "export function updatePlatformAdminStatus");
check(
  "②-a 启停请求体字段集一致（前端 {status} ↔ 后端 updateAdminStatus zod）",
  sameSet(statusZodKeys, new Set(STATUS_BODY_KEYS)) && /\{\s*status\s*\}/.test(statusFnText),
  `backend=${JSON.stringify(sorted(statusZodKeys))}`
);
check(
  "②-a2 启停状态枚举口径一致（ACTIVE / DISABLED 双向）",
  /z\.enum\(\["ACTIVE",\s*"DISABLED"\]\)/.test(platformCtrlSrc) &&
    /status:\s*"ACTIVE"\s*\|\s*"DISABLED"/.test(statusFnText),
  'backend=z.enum(["ACTIVE","DISABLED"])，前端= "ACTIVE" | "DISABLED"'
);

// ②-b 重置密码：无请求体
const resetFnBlock = balancedBlock(apiSrc.slice(apiSrc.indexOf("export function resetPlatformAdminPassword")), "{");
check(
  "②-b 重置密码无请求体（api 调用只带路径，无第二个入参）",
  /reset-password`\s*\)/.test(resetFnBlock) && !/reset-password`\s*,/.test(resetFnBlock),
  "POST /platform/admins/:id/reset-password 无 body"
);

// ②-c 邀请建号：前端声明 == 卡内字段集，且 ⊆ 后端 zod
const inviteFeKeys = keysOf(balancedBlock(apiSrc, "export interface InvitePlatformAdminBody"));
const inviteZodKeys = keysOf(
  balancedBlock(platformCtrlSrc.slice(platformCtrlSrc.indexOf("export const inviteAdmin")), "z.object({")
);
check(
  "②-c 邀请建号前端提交字段集 = 卡内钉死集 {username,name,phone}",
  sameSet(inviteFeKeys, new Set(INVITE_BODY_KEYS)),
  `frontend=${JSON.stringify(sorted(inviteFeKeys))}`
);
check(
  "②-d 邀请建号前端字段 ⊆ 后端 zod 字段（后端兼容 realName/email/role，多出的不算前端自拟）",
  [...inviteFeKeys].every((k) => inviteZodKeys.has(k)),
  `backend=${JSON.stringify(sorted(inviteZodKeys))}`
);
check(
  "②-e 邀请建号后端仍兼容 realName｜name（卡内 §一 口径）",
  inviteZodKeys.has("realName") && inviteZodKeys.has("name"),
  `backend keys=${JSON.stringify(sorted(inviteZodKeys))}`
);

// ②-f 新建角色：前端声明 == 后端 zod == 卡内 {name,code,remark}
const roleFeKeys = keysOf(balancedBlock(apiSrc, "export interface CreatePlatformRoleBody"));
const roleZodKeys = keysOf(balancedBlock(roleCtrlSrc, "const createBodySchema = z.object({"));
check(
  "②-f 新建角色请求体字段集一致（前端 ↔ 后端 createBodySchema）",
  sameSet(roleFeKeys, roleZodKeys),
  `frontend=${JSON.stringify(sorted(roleFeKeys))} backend=${JSON.stringify(sorted(roleZodKeys))}`
);
check(
  "②-g 新建角色字段集 = 卡内 {name,code,remark}（type 不由入参决定）",
  sameSet(roleZodKeys, new Set(ROLE_BODY_KEYS)),
  `backend=${JSON.stringify(sorted(roleZodKeys))}`
);

// ②-h 页面实际提交体只写声明过的字段（含简写属性 `{ name, code }`）
function payloadKeys(block) {
  const keys = new Set();
  for (const part of block.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const m = /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(token);
    if (m) keys.add(m[1]);
  }
  return keys;
}
function pagePayloadKeys(src, fnName) {
  const call = new RegExp(`${fnName}\\(\\{([\\s\\S]*?)\\}\\)`).exec(src);
  return call ? payloadKeys(call[1]) : new Set();
}
const invitePayloadKeys = pagePayloadKeys(pageSrc, "invitePlatformAdmin");
const rolePayloadKeys = pagePayloadKeys(pageSrc, "createPlatformRole");
check(
  "②-h 邀请页实际提交体只写声明过的字段（⊆ 声明集）",
  invitePayloadKeys.size > 0 && [...invitePayloadKeys].every((k) => inviteFeKeys.has(k)),
  `payload keys=${JSON.stringify(sorted(invitePayloadKeys))}`
);
check(
  "②-i 新建角色页实际提交体只写声明过的字段（⊆ 声明集）",
  rolePayloadKeys.size > 0 && [...rolePayloadKeys].every((k) => roleFeKeys.has(k)),
  `payload keys=${JSON.stringify(sorted(rolePayloadKeys))}`
);

/* ───────── ③ 一次性口令零泄漏 ───────── */
const passwordLeak = [...pageSrc.matchAll(/localStorage|console\.log/g)].map((m) => m[0]);
check(
  "③-a 页面 0 处 localStorage / console.log（口令相关代码路径无落盘、无打日志）",
  passwordLeak.length === 0,
  `hits=${JSON.stringify(sorted(new Set(passwordLeak)))}`
);
check(
  "③-b 页面有「只显示一次」明确提示 + 复制按钮（R2）",
  pageSrc.includes("只显示一次") && pageSrc.includes("navigator.clipboard"),
  "文案 + copyPassword()"
);
const pwdCarriers = passportCarrierCheck(apiSrc);
check(
  "③-c 邀请/重置两个 api 函数不落 localStorage、不写 URL（口令只在响应体与内存）",
  pwdCarriers,
  "api.ts 的 invite/reset 函数体内 0 处 localStorage/history/location"
);
function passportCarrierCheck(src) {
  const names = ["export function invitePlatformAdmin", "export function resetPlatformAdminPassword"];
  return names.every((name) => {
    const at = src.indexOf(name);
    if (at < 0) return false;
    const block = balancedBlock(src, name);
    return !/localStorage|history\.|location\.|document\.cookie/.test(block);
  });
}

/* ───────── 输出 ───────── */
console.log("\n—— api.ts 字面路径逐条（文件:行 ⇒ 归一化路径） ——");
for (const hit of apiHits) console.log(`   ${hit}`);
console.log(`—— 后端注册路径 ——\n   ${sorted(backendPaths).join("\n   ")}`);
console.log(`—— 卡内路径 ——\n   ${sorted(CARD_PATHS).join("\n   ")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
