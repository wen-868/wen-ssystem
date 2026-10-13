#!/usr/bin/env node
/**
 * G36 门禁 · guard:route-prefix（S3-189 ③，收口总清单第 36 项）
 *
 * 防的是什么（根因）：「重复前缀 / 真重复端点」的阻断原先**只存在于启动期**
 *   （`backend/src/shared/auto-routes.ts` 的 `setupRoutes`，S3-179 落地）：
 *     · 未登记的重复前缀 ⇒ `failStartup` 阻断；
 *     · 同 method + 同完整路径被多个文件注册（真重复端点）⇒ 一律阻断（无白名单）。
 *   后果：CI 里只有在"真的把服务启起来"时才会暴露，且**没有可单独运行的检查**——
 *   一次 `node` 就能发现的注册冲突，非得等启动失败。本脚本把它变成可独立复跑的机械判据。
 *
 * 判据/白名单来源（🔴 唯一一份，禁止第二套）：
 *   本脚本 import 的是 `backend/src/shared/route-prefix-rules.js`
 *   —— 与启动期 `auto-routes.ts` 是**同一个文件、同一个函数**（`classifyRoutePrefixes`）
 *   与同一张白名单（`DUPLICATE_PREFIX_ALLOWLIST`）。该模块是普通 ESM `.js`（零依赖），
 *   既能被裸 `node` 加载（本脚本），也会随 `tsc`（allowJs）进 `dist/` 供启动期使用。
 *
 * ⚠️ 已知边界（写在明处，不藏着）：本脚本是**静态源码扫描**，启动期是**运行期 router 栈扫描**。
 *   两者判据同一份，但"输入"来源不同：
 *     · 静态扫描按 `routeConfig(s)` 文本 + `<routerVar>.<method>("path")` 文本还原端点；
 *       启动期读的是 Express 真实的 `router.stack`（含运行时动态注册）。
 *     · 用 `router.use()` 挂子路由的子树，两边都**枚举不出端点**（Express 4 不暴露挂载 scope 字符串）；
 *       启动期把它登记进 `nestedRouterFiles`，本脚本同样登记（不静默通过）。
 *   ⇒ 启动期仍是**权威**；本脚本用于"不用起服务就能先跑一遍"。二者的重复前缀/未登记前缀
 *     结论已用 `_s3189-evidence/parity-*.log` 逐条比对（同一台机器、同一份源码）。
 *
 * 用法：
 *   node backend/scripts/guard-route-prefix.mjs            # 人类可读报告，退出码 0=绿 / 1=红
 *   node backend/scripts/guard-route-prefix.mjs --json     # 机读 JSON（仍按退出码判红绿）
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DUPLICATE_PREFIX_ALLOWLIST,
  classifyRoutePrefixes,
  joinRoutePath,
} from "../src/shared/route-prefix-rules.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(HERE, "..", "src", "routes");
const JSON_MODE = process.argv.includes("--json");

/** Express 认得的 HTTP 方法（与启动期 ROUTE_METHODS 同口径） */
const METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

/** 字符下标 → 1-based 行号 */
function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

/** 跳过一个字符串字面量（含模板串的朴素处理），返回结束引号的下标 */
function skipString(src, i) {
  const quote = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i;
    i++;
  }
  return i;
}

/** 从 openIdx（指向 open）起按括号配平取整段，跳过字符串与注释 */
function balancedSlice(src, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(src, i);
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { text: src.slice(openIdx, i + 1), start: openIdx, end: i };
    }
  }
  return null;
}

/** 在一段文本里，按顶层逗号切分实参 */
function splitTopLevel(text, separator) {
  const parts = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(text, i);
      current += text.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      const close = ch === "(" ? ")" : ch === "[" ? "]" : "}";
      const slice = balancedSlice(text, i, ch, close);
      if (slice) {
        current += slice.text;
        i = slice.end;
        continue;
      }
    }
    if (ch === separator) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/**
 * 取一段数组字面量文本里的**顶层对象字面量**及其偏移。
 * ⚠️ 必须跳过注释：`platform-app-version.routes.ts:25-27` 在两个配置对象之间夹了三行注释，
 *    用"按逗号切分再判断是否以 { 开头"的写法会把第二个配置连同前导注释整段丢掉（少 1 条注册，
 *    实测 202 vs 启动期 203），故改为直接按括号配平扫描对象。
 */
function topLevelObjects(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(text, i) + 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      continue;
    }
    if (ch === "{") {
      const slice = balancedSlice(text, i, "{", "}");
      if (!slice) break;
      out.push({ start: i, text: slice.text });
      i = slice.end + 1;
      continue;
    }
    i++;
  }
  return out;
}

/** 取 `routeConfigs` 数组 / `routeConfig` 对象里的配置项（静态文本级） */
function readConfigObject(objectText) {
  const prefix = /prefix\s*:\s*["']([^"']*)["']/.exec(objectText);
  const router = /router\s*:\s*([A-Za-z_$][\w$]*)/.exec(objectText);
  const auth = /auth\s*:\s*["']([A-Za-z]+)["']/.exec(objectText);
  return { prefix: prefix ? prefix[1] : null, routerVar: router ? router[1] : null, auth: auth ? auth[1] : null };
}

function collectConfigs(src, file) {
  const plural = /\brouteConfigs\s*[:=]/.exec(src);
  if (plural) {
    // ⚠️ 必须从 `=` 之后找 `[`：声明带类型注解（`routeConfigs: RouteConfig[] = [`），
    //    第一个 `[` 是 `RouteConfig[]` 的方括号，不是数组字面量。
    const eqIdx = src.indexOf("=", plural.index);
    const arrIdx = eqIdx >= 0 ? src.indexOf("[", eqIdx) : -1;
    const arr = arrIdx >= 0 ? balancedSlice(src, arrIdx, "[", "]") : null;
    if (arr) {
      const configs = [];
      for (const obj of topLevelObjects(arr.text)) {
        const cfg = readConfigObject(obj.text);
        if (cfg.prefix) configs.push({ ...cfg, line: lineOf(src, arr.start + obj.start) });
      }
      if (configs.length > 0) return configs;
    }
  }

  const single = /\brouteConfig\s*[:=]/.exec(src);
  if (single) {
    const eqIdx = src.indexOf("=", single.index);
    const objIdx = eqIdx >= 0 ? src.indexOf("{", eqIdx) : -1;
    const obj = objIdx >= 0 ? balancedSlice(src, objIdx, "{", "}") : null;
    if (obj) {
      const cfg = readConfigObject(obj.text);
      if (cfg.prefix) return [{ ...cfg, line: lineOf(src, objIdx) }];
    }
  }

  // 与启动期一致的兜底：无 routeConfig(s) ⇒ 从文件名推断前缀，且无法按 router 变量区分归属
  const base = file.replace(/\.routes\.ts$/, "").replace(/\.routes\.js$/, "");
  return [{ prefix: `/api/${base}`, routerVar: null, auth: null, line: 1, inferred: true }];
}

/** 收集 `<receiver>.<method>("path")` 形式的端点注册 */
function collectRegistrations(src) {
  const out = [];
  const re = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\.(${METHODS.join("|")})\\s*\\(`, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = lineOf(src, m.index);
    if (/^\s*(import|\/\/|\*)/.test(src.split(/\r?\n/)[line - 1] || "")) continue;
    const openIdx = m.index + m[0].length - 1;
    const args = balancedSlice(src, openIdx, "(", ")");
    const literal = args ? /["']([^"'\n]*)["']/.exec(args.text) : null;
    out.push({
      receiver: m[1],
      method: m[2].toUpperCase(),
      path: literal ? literal[1] : null,
      line,
    });
  }
  return out;
}

/** 收集"挂了子路由"的 receiver（`x.use(..., subRouter)`，其中 subRouter 在本文件里当接收者用过） */
function collectNestedReceivers(src) {
  const receivers = new Set(
    Array.from(src.matchAll(/\b([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*\s*\(/g)).map((m) => m[1])
  );
  const nested = new Set();
  const useRe = /\b([A-Za-z_$][\w$]*)\.use\s*\(/g;
  let m;
  while ((m = useRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const args = balancedSlice(src, openIdx, "(", ")");
    if (!args) continue;
    for (const part of splitTopLevel(args.text.slice(1, -1), ",")) {
      const token = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(token) && token !== m[1] && receivers.has(token)) nested.add(m[1]);
    }
  }
  return nested;
}

if (!existsSync(ROUTES_DIR)) {
  console.error(`找不到路由目录：${ROUTES_DIR}`);
  process.exit(1);
}

const files = readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".routes.ts") || f.endsWith(".routes.js"))
  .sort();

const entries = [];
/** 静态扫描里"无 routeConfig(s)、按文件名推断前缀"的文件（与启动期兜底同口径，列出以求透明） */
const inferredFiles = [];
for (const file of files) {
  const src = readFileSync(join(ROUTES_DIR, file), "utf8");
  const registrations = collectRegistrations(src);
  const nestedReceivers = collectNestedReceivers(src);
  for (const cfg of collectConfigs(src, file)) {
    const endpoints = registrations
      .filter((r) => (cfg.routerVar ? r.receiver === cfg.routerVar : true))
      .filter((r) => r.path !== null)
      .map((r) => `${r.method} ${joinRoutePath(cfg.prefix, r.path)}`);
    const nestedRouter = cfg.routerVar ? nestedReceivers.has(cfg.routerVar) : nestedReceivers.size > 0;
    entries.push({ prefix: cfg.prefix, file, endpoints, nestedRouter });
    if (cfg.inferred) inferredFiles.push(file);
  }
}

const report = classifyRoutePrefixes(entries);
const allowlistInUse = report.duplicatePrefixes.map((d) => ({
  prefix: d.prefix,
  count: d.files.length,
  files: d.files,
  reason: DUPLICATE_PREFIX_ALLOWLIST[d.prefix] ?? null,
}));
const ok = report.unlistedDuplicatePrefixes.length === 0 && report.duplicateEndpoints.length === 0;

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      {
        ok,
        scannedFiles: files.length,
        registrations: entries.length,
        duplicatePrefixes: report.duplicatePrefixes,
        unlistedDuplicatePrefixes: report.unlistedDuplicatePrefixes,
        duplicateEndpoints: report.duplicateEndpoints,
        nestedRouterFiles: report.nestedRouterFiles,
        // S3-195 ③：根前缀被多文件共享（**只出声、不判红**，不参与 ok 判定）
        sharedRootPrefixes: report.sharedRootPrefixes,
        allowlistInUse,
        allowlistSize: Object.keys(DUPLICATE_PREFIX_ALLOWLIST).length,
        // 静态扫描的原始账目（供与启动期做一致性比对；启动期是权威）
        configs: entries.map((e) => ({ file: e.file, prefix: e.prefix, endpoints: e.endpoints.length })),
        inferredFiles,
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 1);
}

console.log(
  `[guard:route-prefix] 静态扫描 ${files.length} 个路由文件 / ${entries.length} 条 prefix 注册（判据与白名单来自 src/shared/route-prefix-rules.js）`
);
for (const item of allowlistInUse) {
  console.log(`   · 放行 ${item.prefix} (${item.count}次) ← ${item.reason ?? "⚠️ 白名单缺理由（不应发生）"}`);
}
// S3-195 ③：根前缀被多文件共享 ⇒ 只说、不判红（与启动期同一份判据，见 src/shared/route-prefix-rules.js）
if (report.sharedRootPrefixes.length > 0) {
  console.warn(
    `   · ⚠️ 根前缀共享告警（只出声、不判红）${report.sharedRootPrefixes.length} 条：` +
      report.sharedRootPrefixes.map((d) => `${d.prefix} (${d.files.length}次)`).join("、") +
      ` —— 根前缀的声明式认证会覆盖整段 /api/**（含兄弟文件的公开端点与不存在的子路径）；` +
      `请核对是否已按「只声明自己拥有的路径段」收窄。`
  );
}
if (report.nestedRouterFiles.length > 0) {
  console.log(
    `   · 已知边界：以下文件用 router.use 挂了子路由，其子树端点静态枚举不到（启动期同样只登记）：${report.nestedRouterFiles.join(", ")}`
  );
}

if (!ok) {
  console.error(`\n❌ G36 违规：`);
  for (const d of report.unlistedDuplicatePrefixes) {
    console.error(
      `   未登记的重复前缀 ${d.prefix} (${d.files.length}次: ${d.files.join(", ")}) ⇒ 若属「多文件共用同一前缀、路径段互不重叠」的合法写法，` +
        `请在 backend/src/shared/route-prefix-rules.js 的 DUPLICATE_PREFIX_ALLOWLIST 中逐条登记理由；否则请合并或改名。`
    );
  }
  for (const d of report.duplicateEndpoints) {
    console.error(
      `   真重复端点 ${d.endpoint}（${d.files.join(" + ")}）⇒ 同一 method + 同一完整路径只能由一个路由文件注册（后者永不执行），请删除重复注册。`
    );
  }
  process.exit(1);
}

console.log(
  `✅ G36 通过：重复前缀 ${report.duplicatePrefixes.length} 个（均已逐条登记理由，白名单 ${Object.keys(DUPLICATE_PREFIX_ALLOWLIST).length} 条）、` +
    `未登记重复前缀 0 个、真重复端点 0 个`
);
