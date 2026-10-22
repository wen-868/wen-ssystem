#!/usr/bin/env node
/*
 * parse-actions.cjs — WB-REFACTOR-P0 矩阵30（页面动作 → 真实 API → DTO → 权限码 → AI 工具 → 读写/确认/审计）
 *
 * 设计约束（上一名子代理爆掉的根因 = 逐文件通读 157 个 vue）：本脚本一律**批量正则抽取**，
 * 不做人工式全文语义阅读；所有数字由脚本产出，markdown 表格由脚本直接生成，禁止手改。
 *
 * 四类真相源：
 *   a) admin-web/src/api.ts + admin-web/src/api/*.ts      → 前端封装函数 → method + path
 *   b) backend/src/routes/*.routes.ts                     → prefix + router.<method>(path, ...中间件, handler)
 *        权限挂码机制（实测）：requirePermission("码")   ← backend/src/middleware/rbac-auth.ts:6
 *                              requirePlatformPermission("码") ← backend/src/middleware/platform-rbac.ts:307
 *   c) admin-web/src/views/**\/*.vue                      → 只 grep 三类模式：封装调用 / @click 按钮 / 权限关键字
 *   d) 关联 a+b+c → 写动作逐条、读动作按域合并
 *
 * 用法：
 *   node docs/evidence/WB-REFACTOR-P0/scripts/parse-actions.cjs
 *   node ... --out /tmp/wb30            # 额外落 CSV（矩阵产物目录外，仓库只允许 2 个产出文件）
 *   node ... --md <path>                # 生成 30-action-permission-matrix.md
 *   node ... --root <repoRoot> --ai-tools <dir>
 *
 * 反测（证明它不是假门禁）：
 *   1) 临时把 admin-customer.routes.ts 某行 requirePermission("customer:create") 删掉 → NCODE（无码写动作）会 +1；
 *   2) 临时把某个 api/*.ts 封装函数名改名 → 该动作的调用页会变成 0 命中（VIEW_CALLED 下降）；
 *   3) 临时给某 controller 加一句 INSERT INTO t_operation_log → AUDIT_COVERED 会 +1。
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* ---------------- 参数 ---------------- */
const argv = process.argv.slice(2);
const flagVal = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const ROOT = path.resolve(flagVal("--root", path.resolve(__dirname, "../../../..")));
const OUT_DIR = flagVal("--out", null);
const MD_OUT = flagVal("--md", null);
const AI_TOOLS_DIR = path.resolve(
  flagVal("--ai-tools", "D:/Users/ZXQL/ZXQL-AI/src/tools/definitions")
);
const AI_BASE_SRC = path.resolve(flagVal("--ai-base", "D:/Users/ZXQL/ZXQL-AI/src"));

const UNKNOWN = "UNKNOWN";

/* ---------------- 工具函数 ---------------- */
const readCache = new Map();
function readAbs(abs) {
  if (!abs) return null;
  if (readCache.has(abs)) return readCache.get(abs);
  let txt = null;
  try {
    txt = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  } catch (e) {
    txt = null;
  }
  readCache.set(abs, txt);
  return txt;
}
function readRepo(rel) {
  return readAbs(path.join(ROOT, rel));
}
function walk(absDir, filter, acc) {
  acc = acc || [];
  if (!absDir || !fs.existsSync(absDir)) return acc;
  for (const name of fs.readdirSync(absDir)) {
    const abs = path.join(absDir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, filter, acc);
    else if (filter(abs)) acc.push(abs);
  }
  return acc;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function lineOf(text, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}
/** 路径归一：`${id}`/`:id`/`{id}` → `:p`，去尾斜杠，统一 /api 前缀 */
function normPath(p) {
  let s = String(p || "").trim();
  if (!s) return null;
  s = s.replace(/\$\{[^}]*\}/g, ":p").replace(/\{[^}]*\}/g, ":p");
  s = s.replace(/\/+$/g, "");
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.startsWith("/api")) s = "/api" + s;
  s = s.replace(/[?#].*$/, "");
  return s || "/api";
}
/** 分段匹配（参数段互配） */
function segMatch(a, b) {
  const sa = a.split("/").filter(Boolean);
  const sb = b.split("/").filter(Boolean);
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i++) {
    const pa = sa[i].startsWith(":") || sa[i].startsWith("*");
    const pb = sb[i].startsWith(":") || sb[i].startsWith("*");
    if (pa || pb) continue;
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}
/** 最长公共前缀匹配（后端路由带子段时兜底，如 /admin/members/:id 对 /admin/members） */
function looseMatch(routePath, callPath) {
  if (segMatch(routePath, callPath)) return 0;
  const r = routePath.split("/").filter(Boolean);
  const c = callPath.split("/").filter(Boolean);
  let i = 0;
  while (i < Math.min(r.length, c.length)) {
    if (r[i].startsWith(":") || c[i].startsWith(":")) break;
    if (r[i] !== c[i]) break;
    i++;
  }
  return i >= 2 && i === c.length ? i : -1;
}
const singular = (s) =>
  s.replace(/ies$/, "y").replace(/(ss|us|is)$/, "$1").replace(/s$/, "");
const VERB = { post: "create", put: "update", patch: "patch", delete: "delete" };
const SCOPE_TOKENS = new Set([
  "admin",
  "platform",
  "store",
  "miniapp",
  "app",
  "retail",
  "consumer",
  "open",
  "tenant",
  "internal",
]);

/** 域：去 /api、去 scope 前缀后的首个静态段（单数化） */
function domainOf(np) {
  const segs = np.split("/").filter(Boolean).slice(1);
  let d = segs.find((s) => !s.startsWith(":") && !SCOPE_TOKENS.has(s)) || "misc";
  return singular(d);
}
/** 动作：末段静态词优先，否则 method 动词 */
function actionOf(np, method) {
  const segs = np.split("/").filter(Boolean);
  const statics = segs.filter((s) => !s.startsWith(":"));
  const last = statics[statics.length - 1] || "";
  const tail = last.replace(/-/g, "_");
  if (tail && !["api", "admin", "platform", "store", "v1", "v2"].includes(tail))
    return VERB[method] === tail ? tail : tail + "_" + (VERB[method] || method);
  return VERB[method] || method;
}

const OUT = [];
const say = (s) => OUT.push(s);
function countToken(needle) {
  let n = 0;
  for (const abs of routeFiles) {
    const txt = readAbs(abs);
    if (!txt) continue;
    let i = -1;
    while ((i = txt.indexOf(needle, i + 1)) >= 0) n++;
  }
  return n;
}

/* =======================================================
 * a) 前端封装函数 → method + path
 * ======================================================= */
const apiDirAbs = path.join(ROOT, "admin-web/src/api");
const apiFiles = [path.join(ROOT, "admin-web/src/api.ts")]
  .concat(fs.existsSync(apiDirAbs) ? walk(apiDirAbs, (f) => /\.ts$/.test(f)) : [])
  .sort();

const wrappers = []; // {name, method, raw, np, rel, line}
const callRe =
  /(?:^|[^A-Za-z0-9_$.])(?:api|http|client|request|axios)\.(get|post|put|patch|delete)(?:<[\s\S]{0,200}?>)?\s*\(\s*([`"'])((?:\\.|(?!\2)[^\\])*)\2/g;
const fnRe = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
const constFnRe = /^\s*export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/;
const objRe = /^\s*export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*\{/;
const objMemberRe = /^\s*([A-Za-z0-9_$]+)\s*:\s*(?:async\s*)?\(/;
const bareCallRe =
  /(?:^|[^A-Za-z0-9_$.])(?:api|http|client|request)\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*([A-Za-z_$][\w$.]*)\s*[,)]/;

let unresolvedPathCalls = 0;
for (const abs of apiFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const lines = txt.split("\n");
  let cur = null;
  let curObj = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = fnRe.exec(line) || constFnRe.exec(line);
    if (m) {
      cur = { name: m[1], line: i + 1 };
      curObj = null;
      continue;
    }
    m = objRe.exec(line);
    if (m) {
      curObj = m[1];
      cur = null;
      continue;
    }
    if (curObj) {
      m = objMemberRe.exec(line);
      if (m) cur = { name: curObj + "." + m[1], line: i + 1 };
      if (/^\s*\};?\s*$/.test(line)) curObj = null;
    }
    callRe.lastIndex = 0;
    let fm;
    while ((fm = callRe.exec(line))) {
      const np = normPath(fm[3]);
      if (!np) continue;
      wrappers.push({
        name: cur ? cur.name : UNKNOWN,
        method: fm[1],
        raw: fm[3],
        np,
        rel,
        line: i + 1,
      });
      if (cur) cur = null; // 一函数只认首个主调用
    }
    if (bareCallRe.test(line)) unresolvedPathCalls++;
  }
}
// 去重（同名多条保留全部，主条 = 首条）
const wrapperMain = new Map();
for (const w of wrappers) if (!wrapperMain.has(w.name)) wrapperMain.set(w.name, w);

/* =======================================================
 * b) 后端路由 + 挂码 + handler/DTO + 审计
 * ======================================================= */
const routesDirAbs = path.join(ROOT, "backend/src/routes");
const routeFiles = fs.existsSync(routesDirAbs)
  ? walk(routesDirAbs, (f) => /\.routes\.(ts|js)$/.test(f)).sort()
  : [];

const routes = []; // {method, np, full, perm, permSrc, ctrlRel, handlerRel, file, line, auth}
const routeCallRe =
  /(?:^|[^A-Za-z0-9_$.])([A-Za-z0-9_$]+)\.((?:get|post|put|patch|delete|all|use))\s*\(\s*([`"'])((?:\\.|(?!\3)[^\\])*)\3/g;
const permAdminRe = /requirePermission\s*\(\s*(["'])([^"']+)\1\s*\)/;
const permPlatRe = /requirePlatformPermission\s*\(\s*(["'])([^"']+)\1\s*\)/;
const permAdminConstRe = /require(?:Platform)?Permission\s*\(\s*([A-Z][A-Z0-9_]{3,})\s*\)/;
// 常量码索引：export const PERM_XXX = "域:动:作"（在 backendFiles 扫盘后填充）
const constCodeIndex = new Map();
const starImportRe = /import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+["']([^"']+)["']/g;
const namedImportRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;

/** TS/JS 相对导入补扩展名：../services/x → backend/src/services/x.ts（否则命中不了索引） */
function relModule(absDir, spec) {
  const base = path
    .relative(ROOT, path.resolve(absDir, spec))
    .replace(/\\/g, "/");
  const cands = [base, base + ".ts", base + ".js", base + "/index.ts", base + "/index.js"];
  for (const c of cands) if (fs.existsSync(path.join(ROOT, c))) return c;
  return base;
}

const AUDIT_RE =
  /INSERT\s+INTO\s+`?(t_operation_log|t_sys_operation_log|t_audit_log|t_sys_audit_log|t_platform_audit_log|platform_audit_log)`?/i;
// 全后端审计写点索引（一次扫盘）
const backendFiles = walk(path.join(ROOT, "backend/src"), (f) =>
  /\.(ts|js)$/.test(f)
);
const auditFiles = new Set();
const importGraph = new Map();
for (const abs of backendFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  if (AUDIT_RE.test(txt)) auditFiles.add(rel);
  const deps = [];
  let im;
  starImportRe.lastIndex = 0;
  const allImportRe =
    /(?:from|import)\s+["'](\.[^"']+)["']|(?:require|import)\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
  while ((im = allImportRe.exec(txt))) {
    deps.push(relModule(path.dirname(abs), im[1] || im[2]));
  }
  importGraph.set(rel, deps);
}
starImportRe.lastIndex = 0;
namedImportRe.lastIndex = 0;
// 填充常量码索引（PERM_XXX = "域:动作"）
for (const abs of backendFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const lns = txt.split("\n");
  for (let i = 0; i < lns.length; i++) {
    const m = /^export\s+const\s+([A-Z][A-Z0-9_]+)\s*=\s*["']([^"']+)["']/.exec(lns[i]);
    if (m && /PERM|PERMISSION|CODE/.test(m[1]))
      constCodeIndex.set(m[1], { code: m[2], ref: rel + ":" + (i + 1) });
  }
}

// 全局审计中间件探测：middleware/ 下是否存在写 t_operation_log 的文件
const mwAuditHits = backendFiles
  .filter((f) => /[\\/]middleware[\\/]/.test(f) && AUDIT_RE.test(readAbs(f) || ""))
  .map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));

function auditProbe(rel) {
  // 1 跳：controller 本身；2 跳：controller 引入的 service；3 跳：service→service
  if (auditFiles.has(rel)) return rel;
  const hop1 = importGraph.get(rel) || [];
  for (const a of hop1) if (auditFiles.has(a)) return a;
  for (const a of hop1) {
    for (const b of importGraph.get(a) || []) if (auditFiles.has(b)) return b;
  }
  return null;
}

/* DTO / zod schema 索引（扫全部后端文件，不止 *.schema.ts） */
const schemaFiles = walk(path.join(ROOT, "backend/src"), (f) => /\.schema\.ts$/.test(f));
const schemaIndex = new Map(); // SchemaName → rel:line
const firstZline = new Map(); // rel → rel:line（该文件首个 z.object(）
const firstParseLine = new Map(); // rel → rel:line（该文件首个 .parse(）
for (const abs of backendFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = /^export\s+const\s+([A-Za-z0-9_$]*(?:Schema|schema))\b/.exec(ln);
    if (m && !schemaIndex.has(m[1])) schemaIndex.set(m[1], rel + ":" + (i + 1));
    const z1 =
      /^(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*(?:z\.object|z\.array\()/m.exec(ln);
    if (z1 && !schemaIndex.has(z1[1])) schemaIndex.set(z1[1], rel + ":" + (i + 1));
    if (!firstZline.has(rel) && /\bz\.object\(/.test(ln)) firstZline.set(rel, rel + ":" + (i + 1));
    if (!firstParseLine.has(rel) && /\.parse\(/.test(ln)) firstParseLine.set(rel, rel + ":" + (i + 1));
  }
}

const routePrefixMissing = [];
let authNoneRoutes = 0;
for (const abs of routeFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  // 每个 Router 变量各自的 prefix（双/多配置文件：routeConfigs 数组，25 个文件）
  const varPrefix = new Map();
  const cfgRe =
    /\{\s*prefix\s*:\s*["']([^"']+)["']\s*,\s*router\s*:\s*([A-Za-z0-9_$]+)/g;
  let cgf;
  while ((cgf = cfgRe.exec(txt))) varPrefix.set(cgf[2], cgf[1]);
  const pm = /prefix\s*:\s*["']([^"']+)["']/.exec(txt);
  const sm = /router\s*:\s*([A-Za-z0-9_$]+)/.exec(txt);
  let filePrefix = pm ? pm[1] : null;
  if (filePrefix && sm && !varPrefix.has(sm[1])) varPrefix.set(sm[1], filePrefix);
  if (!filePrefix) {
    const base = path.basename(rel).replace(/\.routes\.(ts|js)$/, "");
    filePrefix = "/api/" + base; // auto-routes.ts:54 inferPrefix 兜底口径
    routePrefixMissing.push(rel + " → " + filePrefix);
  }
  const am = /auth\s*:\s*["']([^"']+)["']/.exec(txt);
  if (am && am[1] === "none") authNoneRoutes++;
  // 变量名 → 文件；命名导入 → 文件
  const varMap = new Map();
  let im;
  starImportRe.lastIndex = 0;
  while ((im = starImportRe.exec(txt))) {
    varMap.set(im[1], relModule(path.dirname(abs), im[2]));
  }
  namedImportRe.lastIndex = 0;
  while ((im = namedImportRe.exec(txt))) {
    const target = relModule(path.dirname(abs), im[2]);
    for (const raw of im[1].split(",")) {
      const nm = raw.trim().split(/\s+as\s+/).pop();
      if (nm && /^[A-Za-z0-9_$]+$/.test(nm)) varMap.set(nm, target);
    }
  }
  starImportRe.lastIndex = 0;
  namedImportRe.lastIndex = 0;

  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*)/.test(line)) continue;
    routeCallRe.lastIndex = 0;
    const rm = routeCallRe.exec(line);
    if (!rm) continue;
    const method = rm[2];
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    const recv = rm[1];
    const routePath = rm[4];
    const prefix = varPrefix.get(recv) || filePrefix;
    // 语句体 = 本行（多行中间件则向后最多 6 行，按括号配平）
    let stmt = line;
    let bal = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    let j = i;
    while (bal > 0 && j + 1 < lines.length && j < i + 6) {
      j++;
      stmt += "\n" + lines[j];
      bal += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
    }
    const pmm = permAdminRe.exec(stmt) || permPlatRe.exec(stmt);
    let perm = pmm ? pmm[2] : null;
    let permMech = pmm
      ? stmt.includes("requirePlatformPermission")
        ? "requirePlatformPermission"
        : "requirePermission"
      : null;
    let permRef = pmm ? rel + ":" + (i + 1) : null;
    if (!perm) {
      // 等价挂码写法：requirePermission(PERM_XXX) 常量引用
      const cmm = permAdminConstRe.exec(stmt);
      if (cmm) {
        const resolved = constCodeIndex.get(cmm[1]);
        perm = resolved ? resolved.code : "常量未解析:" + cmm[1];
        permMech = stmt.includes("requirePlatformPermission")
          ? "requirePlatformPermission(常量)"
          : "requirePermission(常量)";
        permRef = resolved ? resolved.ref : rel + ":" + (i + 1);
      }
    }
    const tail = stmt.slice(stmt.lastIndexOf(routePath) + routePath.length);
    const handlerM = /([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)\s*[,)]/.exec(tail);
    let handlerVar = handlerM ? handlerM[1] : null;
    const handlerName = handlerM ? handlerM[2] : null;
    // 兜底：中间件包了一层（asyncHandler/inline）时取该文件唯一 controller 星号导入
    if (!handlerVar) {
      const ctrlVars = [...varMap.entries()].filter(([, v]) =>
        /\/controllers\//.test(v)
      );
      if (ctrlVars.length === 1) handlerVar = ctrlVars[0][0];
    }
    const full = normPath(
      (prefix.replace(/\/$/, "") + "/" + routePath.replace(/^\//, "")).replace(/\/{2,}/g, "/")
    );
    routes.push({
      method,
      np: full,
      routePath,
      prefix,
      perm,
      permMech,
      permRef,
      stmt,
      ctrlRel: handlerVar ? varMap.get(handlerVar) || null : null,
      handlerName,
      rel,
      line: i + 1,
      auth: am ? am[1] : "requireAuthWithTenant(默认)",
    });
  }
}

const routeIndex = new Map(); // "METHOD np" → [routes]
for (const r of routes) {
  const k = r.method.toUpperCase() + " " + r.np;
  if (!routeIndex.has(k)) routeIndex.set(k, []);
  routeIndex.get(k).push(r);
}
function resolveRoute(method, np) {
  const M = method.toUpperCase();
  const exact = routeIndex.get(M + " " + np);
  if (exact) return { route: exact[0], mismatch: false };
  const segHits = [];
  const prefixHits = [];
  for (const r of routes) {
    if (r.method.toUpperCase() !== M) continue;
    if (segMatch(r.np, np)) segHits.push(r);
    else {
      const s = looseMatch(r.np, np);
      if (s >= 3) prefixHits.push({ r, s });
    }
  }
  const pick = (arr) => {
    arr.sort(
      (a, b) => (b.perm ? 1 : 0) - (a.perm ? 1 : 0) || a.np.localeCompare(b.np)
    );
    return arr[0];
  };
  if (segHits.length) return { route: pick(segHits), mismatch: false };
  if (prefixHits.length) {
    prefixHits.sort((a, b) => b.s - a.s || a.r.np.localeCompare(b.r.np));
    return { route: prefixHits[0].r, mismatch: false };
  }
  // ③ 末端对齐兜底：前端封装路径多/少一段（如 /aftersales/aftersales/:id/approve）
  const segs = np.split("/").filter(Boolean);
  for (let cut = 1; cut < segs.length - 2; cut++) {
    const cand = normPath("/" + segs.slice(cut).join("/"));
    for (const r of routes) {
      if (r.method.toUpperCase() !== M) continue;
      if (segMatch(r.np, cand))
        return { route: r, mismatch: "前端路径多一段，末端对齐命中 " + r.np };
    }
  }
  for (let i = 1; i < segs.length - 2; i++) {
    const cand = normPath(
      "/" + segs.slice(0, i).concat(segs.slice(i + 1)).join("/")
    );
    for (const r of routes) {
      if (r.method.toUpperCase() !== M) continue;
      if (segMatch(r.np, cand))
        return { route: r, mismatch: "前端路径多一段（中间段），末端对齐命中 " + r.np };
    }
  }
  return { route: null, mismatch: false };
}

function dtoRefOf(route) {
  if (!route) return { ref: UNKNOWN, kind: "no-route" };
  const ctrlRel = route.ctrlRel;
  const ctrlTxt = ctrlRel ? readRepo(ctrlRel) : null;
  const pool = (route.stmt || "") + "\n" + (ctrlTxt || "");
  const names = new Set();
  const re = /\b([A-Za-z0-9_$]*(?:Schema|schema))\b/g;
  let m;
  while ((m = re.exec(pool))) names.add(m[1]);
  const cand = [...names].filter((n) => schemaIndex.has(n));
  if (cand.length) {
    const hn = (route.handlerName || "").toLowerCase();
    cand.sort((a, b) => {
      const sa = hn && a.toLowerCase().includes(hn.slice(0, 6)) ? 0 : 1;
      const sb = hn && b.toLowerCase().includes(hn.slice(0, 6)) ? 0 : 1;
      return sa - sb || a.localeCompare(b);
    });
    return { ref: schemaIndex.get(cand[0]), kind: "schema-ref" };
  }
  if (!ctrlRel) return { ref: UNKNOWN, kind: "no-controller" };
  // 兜底：controller 自身内联 zod / .parse，再退一跳看 service
  if (firstZline.has(ctrlRel)) return { ref: firstZline.get(ctrlRel), kind: "inline-controller" };
  if (firstParseLine.has(ctrlRel))
    return { ref: firstParseLine.get(ctrlRel), kind: "parse-controller" };
  for (const dep of importGraph.get(ctrlRel) || []) {
    if (firstZline.has(dep)) return { ref: firstZline.get(dep), kind: "inline-service" };
  }
  for (const dep of importGraph.get(ctrlRel) || []) {
    if (firstParseLine.has(dep)) return { ref: firstParseLine.get(dep), kind: "parse-service" };
  }
  return { ref: UNKNOWN, kind: "no-validation-found" };
}

/* =======================================================
 * c) views 三类 grep
 * ======================================================= */
const viewsAbs = path.join(ROOT, "admin-web/src/views");
const viewFiles = fs.existsSync(viewsAbs) ? walk(viewsAbs, (f) => /\.vue$/.test(f)).sort() : [];
const wrapperNames = [...wrapperMain.keys()].filter((n) => n !== UNKNOWN && /^[A-Za-z0-9_$]+$/.test(n));
const callSiteRe = new RegExp("\\b(" + wrapperNames.map(esc).join("|") + ")\\s*\\(", "g");
const clickRe = /@click(?:\.prevent|\.stop)?="([^"]*)"/;
const permKeywordRe =
  /hasPermission|v-permission|v-auth|\bpermissionCode\b|v-if="[^"]*(?:[Pp]erm|can[A-Z]|[Rr]ole|isAdmin|authoriz)/;
const funcDeclRe = /^\s*(?:const|let|async function|function)\s+([A-Za-z0-9_$]+)/;

const usedBy = new Map(); // wrapper name → [{ref, handler, label}]
const clickByFile = new Map(); // file → [{handler,label,line}]
const permGrepHits = []; // {ref, kind}
let permHitsByFile = new Map();

for (const abs of viewFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const lines = txt.split("\n");
  let lastFn = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fmm = funcDeclRe.exec(line);
    if (fmm) lastFn = fmm[1];
    callSiteRe.lastIndex = 0;
    let cm;
    while ((cm = callSiteRe.exec(line))) {
      const nm = cm[1];
      if (!usedBy.has(nm)) usedBy.set(nm, []);
      usedBy.get(nm).push({
        ref: rel + ":" + (i + 1),
        handler: lastFn || UNKNOWN,
      });
    }
    const clk = clickRe.exec(line);
    if (clk) {
      const zh = /[一-龥][一-龥 A-Za-z0-9（）()\/]{0,14}/.exec(line);
      const handler = (clk[1].match(/([A-Za-z0-9_$]+)\s*\(/) || [])[1] || clk[1].slice(0, 24);
      if (!clickByFile.has(rel)) clickByFile.set(rel, []);
      clickByFile.get(rel).push({ handler, label: zh ? zh[0].trim() : "", line: i + 1 });
    }
    if (permKeywordRe.test(line)) {
      permGrepHits.push({ ref: rel + ":" + (i + 1), kind: /hasPermission/.test(line) ? "hasPermission" : "v-if/perm" });
      permHitsByFile.set(rel, (permHitsByFile.get(rel) || 0) + 1);
    }
  }
}
// 按钮文本回填：按 handler 名在同文件 @click 里找 label
function buttonLabelFor(file, handler) {
  const arr = clickByFile.get(file);
  if (!arr) return "";
  const hit = arr.find((a) => a.handler === handler);
  return hit ? (hit.label ? hit.label + "@" + hit.line : hit.handler + "@" + hit.line) : "";
}

/* 全仓 hasPermission 定义 vs 调用点（系统性缺口②口径） */
const webSrcFiles = walk(path.join(ROOT, "admin-web/src"), (f) =>
  /\.(ts|vue|tsx)$/.test(f)
);
let hpDefRefs = [];
let hpCallRefs = [];
let hpExposeRefs = []; // store return 列表里的裸标识符暴露（不是调用点）
for (const abs of webSrcFiles) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/\bhasPermission\b/.test(lines[i])) continue;
    const isDef =
      /function\s+hasPermission\b|hasPermission\s*[:=]|const\s+hasPermission\b/.test(lines[i]);
    const isExpose = /^\s*hasPermission\s*,?\s*$/.test(lines[i]);
    if (isDef) hpDefRefs.push(rel + ":" + (i + 1));
    else if (isExpose) hpExposeRefs.push(rel + ":" + (i + 1));
    else hpCallRefs.push(rel + ":" + (i + 1));
  }
}
const appStoreRel = "admin-web/src/stores/app.ts";
const appStoreTxt = readRepo(appStoreRel) || "";
const appStoreHasDef = /hasPermission/.test(appStoreTxt);
const hpCallInViews = hpCallRefs.filter((r) => r.includes("/views/"));

/* =======================================================
 * AI 工具注册表（底座）→ method/path
 * ======================================================= */
const toolFilesList = fs.existsSync(AI_TOOLS_DIR)
  ? walk(AI_TOOLS_DIR, (f) => /\.tool\.ts$/.test(f) && !/\.spec\.ts$/.test(f)).sort()
  : [];
const tools = []; // {name, rel, paths:[{method,np}], confirmRef}
const toolPathRe =
  /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[A-Za-z0-9_\/:.\-{}$]*)/gi;
const confirmDeclRe =
  /requiresConfirmation|requireConfirmation|needConfirm|isWrite|readOnly\s*:\s*false|write\s*:\s*true|preview/i;
for (const abs of toolFilesList) {
  const txt = readAbs(abs);
  if (!txt) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const name = path.basename(abs).replace(/\.tool\.ts$/, "");
  const set = [];
  let m;
  toolPathRe.lastIndex = 0;
  while ((m = toolPathRe.exec(txt))) {
    const np = normPath(m[2]);
    if (np) set.push({ method: m[1].toUpperCase(), np });
  }
  tools.push({
    name,
    rel,
    paths: set,
    hasConfirmDecl: confirmDeclRe.test(txt),
  });
}
const toolIndex = new Map();
for (const t of tools)
  for (const p of t.paths) {
    const k = p.method + " " + p.np;
    if (!toolIndex.has(k)) toolIndex.set(k, []);
    toolIndex.get(k).push(t);
  }
function aiToolFor(method, np) {
  const exact = toolIndex.get(method.toUpperCase() + " " + np);
  if (exact) return exact;
  const out = [];
  for (const t of tools)
    for (const p of t.paths)
      if (p.method === method.toUpperCase() && segMatch(p.np, np)) out.push(t);
  return out.length ? out : null;
}

/* 确认链（预览→确认→执行→撤销）在底座的路由注册 ref */
let confirmChainRefs = [];
if (fs.existsSync(AI_BASE_SRC)) {
  for (const abs of walk(AI_BASE_SRC, (f) =>
    /\.(ts|js)$/.test(f) && !/\.spec\.|\.test\./.test(f)
  )) {
    const txt = readAbs(abs);
    if (!txt) continue;
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const lines = txt.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (
        /confirmations|\/confirm\b|\/revoke\b|preview/i.test(lines[i]) &&
        /@(?:Get|Post|Put|Delete)\s*\(|\brouter\.(?:get|post)|\bapp\.(?:get|post)|(?:GET|POST)\s+\/api\//.test(
          lines[i]
        )
      )
        confirmChainRefs.push(rel + ":" + (i + 1));
    }
  }
}
confirmChainRefs = confirmChainRefs.slice(0, 6);

/* =======================================================
 * d) 关联：写动作逐条 + 读动作按域
 * ======================================================= */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const writeRows = [];
const readByDomain = new Map(); // domain → {total, viewCalled, samples[]}
let writeCallsUnresolved = 0;
const seenWrite = new Set();

for (const [name, w] of wrapperMain) {
  const sites = usedBy.get(name) || [];
  const methodUp = w.method.toUpperCase();
  const res = resolveRoute(w.method, w.np);
  const route = res.route;
  const note =
    typeof res.mismatch === "string" && res.mismatch
      ? res.mismatch + "（前端封装实际写的是 `" + w.np + "`）"
      : "";
  const domain = domainOf(route ? route.np : w.np);
  if (!WRITE_METHODS.has(methodUp)) {
    // 读：按域合并
    const rec = readByDomain.get(domain) || { total: 0, viewCalled: 0, samples: [], routes: 0 };
    rec.total++;
    if (sites.length) {
      rec.viewCalled++;
      if (rec.samples.length < 2)
        rec.samples.push(sites[0].ref + " " + name + "()");
    }
    readByDomain.set(domain, rec);
    continue;
  }
  if (!sites.length) continue; // 只统计被 views 调用的写动作
  const key = methodUp + " " + (route ? route.np : w.np);
  if (seenWrite.has(key)) continue;
  seenWrite.add(key);
  if (!route) writeCallsUnresolved++;
  const np = route ? route.np : w.np;
  const perm = route ? (route.perm ? route.perm : "无码") : UNKNOWN;
  const permNote = route
    ? route.perm
      ? route.permMech + " @ " + (route.permRef || route.rel + ":" + route.line)
      : "无（路由未挂权限中间件） " + route.rel + ":" + route.line
    : UNKNOWN + "（前端路径在本仓 routes 里无对应注册）";
  const dtoRes = dtoRefOf(route);
  const ai = aiToolFor(methodUp, np);
  const auditTarget = route ? auditProbe(route.ctrlRel) : null;
  const audit = route
    ? auditTarget
      ? "有 " + auditTarget
      : "无（controller/service 未见 t_operation_log 写入）"
    : UNKNOWN;
  const confirm = ai
    ? ai.some((t) => t.hasConfirmDecl)
      ? "有（AI 侧 preview→confirm 链）"
      : "部分（工具在册，未见确认声明）"
    : "无（页面直调，不经确认链）";
  const pageRefs = sites
    .slice(0, 3)
    .map(
      (s) =>
        s.ref +
        (buttonLabelFor(s.ref.split(":")[0], s.handler)
          ? "「" + buttonLabelFor(s.ref.split(":")[0], s.handler) + "」"
          : " handler=" + s.handler)
    )
    .join(" / ");
  const aid = domain + "." + actionOf(np, methodUp.toLowerCase());
  writeRows.push({
    aid,
    np,
    methodUp,
    domain,
    pageRefs,
    wrapper: name + " @ " + w.rel + ":" + w.line,
    dto: dtoRes.ref,
    dtoKind: dtoRes.kind,
    perm,
    permNote,
    note,
    ai,
    aiRef: ai ? ai.map((t) => t.name + " @ " + t.rel).slice(0, 2).join(" / ") : "无",
    confirm,
    audit,
    routeRef: route ? route.rel + ":" + route.line : UNKNOWN,
  });
}
// actionId 去重
const aidCount = new Map();
for (const r of writeRows) {
  aidCount.set(r.aid, (aidCount.get(r.aid) || 0) + 1);
}
const aidSeen = new Map();
for (const r of writeRows) {
  if ((aidCount.get(r.aid) || 0) > 1) {
    const n = (aidSeen.get(r.aid) || 0) + 1;
    aidSeen.set(r.aid, n);
    r.aidShown = r.aid + "#" + n;
  } else r.aidShown = r.aid;
}
writeRows.sort((a, b) => a.domain.localeCompare(b.domain) || a.np.localeCompare(b.np));

/* 后端全量口径（分母，供比例说明） */
const backendWriteRoutes = routes.filter((r) => WRITE_METHODS.has(r.method.toUpperCase()));
const backendWriteWithPerm = backendWriteRoutes.filter((r) => r.perm);
const backendGetRoutes = routes.filter((r) => r.method.toLowerCase() === "get");

const viewWriteRowsNoPerm = writeRows.filter((r) => r.perm === "无码");
const viewWriteRowsUnknown = writeRows.filter((r) => r.perm === UNKNOWN);
const viewWriteRowsAuditNo = writeRows.filter((r) => String(r.audit).startsWith("无"));
const viewWriteRowsAuditYes = writeRows.filter((r) => String(r.audit).startsWith("有"));
const viewWriteRowsAuditUnknown = writeRows.filter((r) =>
  String(r.audit).startsWith(UNKNOWN)
);
const writeRowsPathMismatch = writeRows.filter((r) => r.note);
const viewWriteRowsAi = writeRows.filter((r) => r.ai && r.ai.length);
const viewWriteRowsConfirm = writeRows.filter((r) => String(r.confirm).startsWith("有"));

/* =======================================================
 * 输出：stdout 计数 + CSV + markdown
 * ======================================================= */
const P = (k, v) => say(k + "=" + v);
P("ROOT", ROOT);
P("API_FILES_SCANNED", apiFiles.length);
P("FRONTEND_WRAPPER_CALLS", wrappers.length);
P("FRONTEND_UNIQUE_WRAPPERS", wrapperMain.size);
P("FRONTEND_UNRESOLVED_PATH_CALLS", unresolvedPathCalls);
P("BACKEND_ROUTE_FILES", routeFiles.length);
P("BACKEND_ROUTES_TOTAL", routes.length);
P("BACKEND_GET_ROUTES", backendGetRoutes.length);
P("BACKEND_WRITE_ROUTES", backendWriteRoutes.length);
P("BACKEND_WRITE_ROUTES_WITH_PERM", backendWriteWithPerm.length);
P("BACKEND_WRITE_ROUTES_NO_PERM", backendWriteRoutes.length - backendWriteWithPerm.length);
P("REQUIRE_PERMISSION_TOKENS", countToken("requirePermission("));
P("REQUIRE_PLATFORM_PERMISSION_TOKENS", countToken("requirePlatformPermission("));
P("ROUTE_PREFIX_INFERRED_FALLBACKS", routePrefixMissing.length);
P("AUTH_NONE_CONFIG_FILES", authNoneRoutes);
P("BACKEND_CONST_PERM_CODES_INDEXED", constCodeIndex.size);
P("BACKEND_SCHEMA_FILES", schemaFiles.length);
P("BACKEND_ZOD_SCHEMA_SYMBOLS_INDEXED", schemaIndex.size);
{
  const k = new Map();
  for (const r of writeRows) k.set(r.dtoKind, (k.get(r.dtoKind) || 0) + 1);
  P(
    "WRITE_ACTIONS_DTO_KINDS",
    [...k.entries()].sort().map(([a, b]) => a + "=" + b).join(" | ")
  );
  const ka = new Map();
  for (const r of writeRows) {
    const t = String(r.audit).startsWith("有")
      ? "有"
      : String(r.audit).startsWith("无")
      ? "无"
      : UNKNOWN;
    ka.set(t, (ka.get(t) || 0) + 1);
  }
  P("WRITE_ACTIONS_AUDIT_KINDS", [...ka.entries()].map(([a, b]) => a + "=" + b).join(" | "));
  P(
    "WRITE_ACTIONS_WITH_CONTROLLER",
    writeRows.filter((r) => r.dtoKind !== "no-route" && r.dtoKind !== "no-controller").length
  );
}
P("WRITE_ACTIONS_DTO_FOUND", writeRows.filter((r) => r.dto !== UNKNOWN).length);
P("WRITE_ACTIONS_DTO_UNKNOWN", writeRows.filter((r) => r.dto === UNKNOWN).length);
P("VIEW_FILES_SCANNED", viewFiles.length);
P("VIEW_WRAPPER_CALL_SITES", [...usedBy.values()].reduce((a, b) => a + b.length, 0));
P("VIEW_PERMISSION_KEYWORD_HITS", permGrepHits.length);
P("HASPERMISSION_DEFS", hpDefRefs.length + " [" + hpDefRefs.slice(0, 3).join(" | ") + "]");
P("HASPERMISSION_CALLS_ALL", hpCallRefs.length);
P("HASPERMISSION_STORE_EXPOSE_LINES", hpExposeRefs.length + " [" + hpExposeRefs.join(" | ") + "]");
P("HASPERMISSION_CALL_REFS", hpCallRefs.slice(0, 6).join(" | ") || "无");
P("HASPERMISSION_CALLS_IN_VIEWS", hpCallInViews.length);
P("APP_STORE_HAS_DEFINITION", appStoreHasDef);
P("AI_TOOL_FILES", tools.length);
P("AI_TOOLS_WITH_API_PATH_DECL", tools.filter((t) => t.paths.length).length);
P("AI_TOOL_PATH_ENTRIES", toolIndex.size);
P("CONFIRM_CHAIN_REFS", confirmChainRefs.length + " [" + confirmChainRefs.join(" | ") + "]");
P("AUDIT_WRITE_SITE_FILES", auditFiles.size);
P("MIDDLEWARE_AUDIT_WRITE_FILES", mwAuditHits.length + " [" + mwAuditHits.join(" | ") + "]");
P("WRITE_ACTIONS_VIEW_CALLED", writeRows.length);
P("WRITE_ACTIONS_UNRESOLVED_ROUTE", writeCallsUnresolved);
P("WRITE_ACTIONS_NO_PERM", viewWriteRowsNoPerm.length);
P("WRITE_ACTIONS_PERM_UNKNOWN", viewWriteRowsUnknown.length);
P("WRITE_ACTIONS_WITH_PERM", writeRows.length - viewWriteRowsNoPerm.length - viewWriteRowsUnknown.length);
P("WRITE_ACTIONS_AI_COVERED", viewWriteRowsAi.length);
P("WRITE_ACTIONS_CONFIRM_CHAIN", viewWriteRowsConfirm.length);
P("WRITE_ACTIONS_NO_AUDIT", viewWriteRowsAuditNo.length);
P("WRITE_ACTIONS_HAS_AUDIT", viewWriteRowsAuditYes.length);
P("WRITE_ACTIONS_AUDIT_UNKNOWN", viewWriteRowsAuditUnknown.length);
P("WRITE_ACTIONS_PATH_MISMATCH", writeRowsPathMismatch.length);
P("READ_DOMAINS", readByDomain.size);
P("MD_TABLE_BODY_ROWS", writeRows.length + "写 + " + readByDomain.size + "读域（域小计行见下方 MD_ROW_BREAKDOWN）");

/* --- CSV --- */
const csvEsc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const csvHeader = [
  "actionId",
  "pageRefs",
  "wrapper",
  "method",
  "path",
  "dtoRef",
  "permissionCode",
  "permMechRef",
  "readWrite",
  "aiTool",
  "writeConfirm",
  "audit",
  "routeRef",
  "pathMismatch",
].join(",");
const csvLines = [csvHeader];
for (const r of writeRows) {
  csvLines.push(
    [
      r.aid,
      r.pageRefs,
      r.wrapper,
      r.methodUp,
      r.np,
      r.dto,
      r.perm,
      r.permNote,
      "W",
      r.aiRef,
      r.confirm,
      r.audit,
      r.routeRef,
      r.note || "",
    ]
      .map(csvEsc)
      .join(",")
  );
}
for (const [d, rec] of [...readByDomain.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  csvLines.push(
    [
      "read." + d,
      "（按域合并）",
      rec.samples.join(" / ") || UNKNOWN,
      "GET",
      "该域 " + rec.total + " 个 GET 封装，被页面调用 " + rec.viewCalled + " 个",
      UNKNOWN,
      "读侧不逐条展开",
      UNKNOWN,
      "R",
      "批量判定",
      "不适用（读操作）",
      "不适用（读操作）",
      UNKNOWN,
      "",
    ]
      .map(csvEsc)
      .join(",")
  );
}
const CSV = csvLines.join("\n") + "\n";

/* --- markdown --- */
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "n/a");
function mdEscape(s) {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
const md = [];
md.push("| actionId | 页面+按钮 ref | 前端封装 | method path | DTO ref | permissionCode | read/write | AI 工具现状 | 写确认 | 审计 |");
md.push("|---|---|---|---|---|---|---|---|---|---|");
for (const r of writeRows) {
  md.push(
    "| " +
      [
        mdEscape(r.aidShown),
        mdEscape(r.pageRefs || UNKNOWN),
        mdEscape(r.wrapper),
        mdEscape("`" + r.methodUp + " " + r.np + "`") +
          " ← " +
          mdEscape(r.routeRef) +
          (r.note ? " ⚠" + mdEscape(r.note) : ""),
        mdEscape(r.dto),
        mdEscape(r.perm === "无码" ? "**无码**" : r.perm === UNKNOWN ? UNKNOWN : "`" + r.perm + "`") +
          " ｜ " + mdEscape(r.permNote),
        "W",
        mdEscape(r.ai && r.ai.length ? "有：" + r.aiRef : "无"),
        mdEscape(r.confirm),
        mdEscape(r.audit),
      ].join(" | ") +
      " |"
  );
}
const domainTotal = new Map();
for (const r of writeRows) domainTotal.set(r.domain, (domainTotal.get(r.domain) || 0) + 1);
md.push("");
md.push("## 3. 读操作矩阵（按域合并，每域一行 + 抽样 ref×2）");
md.push("");
md.push("| 域 | 该域 GET 数（前端封装） | 被页面调用 | 抽样 ref×2 | 后端 GET 路由数 | 判定 |");
md.push("|---|---|---|---|---|---|");
const backendGetByDomain = new Map();
for (const r of backendGetRoutes) {
  const d = domainOf(r.np);
  backendGetByDomain.set(d, (backendGetByDomain.get(d) || 0) + 1);
}
for (const [d, rec] of [...readByDomain.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md.push(
    "| " +
      [
        d,
        String(rec.total),
        String(rec.viewCalled),
        mdEscape(rec.samples.join(" / ") || UNKNOWN),
        String(backendGetByDomain.get(d) || 0),
        "读操作不逐条展开；权限侧同样无按码显隐（见文末缺口②）",
      ].join(" | ") +
      " |"
  );
}

/* 每域小计 */
md.push("");
md.push("### 每域小计（写动作）");
md.push("");
md.push("| 域 | 写动作数 | 无码数 | 无审计数 | AI 已覆盖 |");
md.push("|---|---|---|---|---|");
const domAgg = new Map();
for (const r of writeRows) {
  const a = domAgg.get(r.domain) || { n: 0, noperm: 0, noaudit: 0, ai: 0 };
  a.n++;
  if (r.perm === "无码") a.noperm++;
  if (String(r.audit).startsWith("无")) a.noaudit++;
  if (r.ai && r.ai.length) a.ai++;
  domAgg.set(r.domain, a);
}
let tn = 0,
  tp = 0,
  ta = 0,
  tai = 0;
for (const [d, a] of [...domAgg.entries()].sort((x, y) => y[1].n - x[1].n)) {
  tn += a.n;
  tp += a.noperm;
  ta += a.noaudit;
  tai += a.ai;
  md.push("| " + d + " | " + a.n + " | " + a.noperm + " | " + a.noaudit + " | " + a.ai + " |");
}
md.push("| **合计** | **" + tn + "** | **" + tp + "** | **" + ta + "** | **" + tai + "** |");
say(
  "MD_ROW_BREAKDOWN=" +
    writeRows.length +
    "写 + " +
    readByDomain.size +
    "读域 + " +
    domAgg.size +
    "域小计 + 1合计"
);

/* 落 CSV 文件（仅当 --out，且落在仓库产物目录之外，保证仓库只多出 2 个产出文件） */
if (OUT_DIR) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "30-action-permission-matrix.csv"), CSV);
}

const FRONTMATTER = [
  "# 矩阵30｜页面动作 → 真实 API → DTO → 权限码 → AI 工具 → 读写/确认/审计",
  "",
  "> 派工：WB-REFACTOR-P0 · 矩阵 30。产出文件：本文件 + `scripts/parse-actions.cjs`。",
  "> **所有数字由脚本产出，禁止手改**；复跑命令：",
  "> `node docs/evidence/WB-REFACTOR-P0/scripts/parse-actions.cjs --md docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md --out /tmp/wb30`",
  "> 表格本体即脚本 `--md` 输出，人工不增删行。",
  "",
  "## 口径（脚本判定规则，非人工判断）",
  "",
  "- 权限挂码机制：**MECHANISM=FOUND** —— `requirePermission(码)`（定义 `backend/src/middleware/rbac-auth.ts:6`，routes 侧命中 " +
    countToken("requirePermission(") +
    " 处）+ 平台侧 `requirePlatformPermission(码)`（定义 `backend/src/middleware/platform-rbac.ts:307`，命中 " +
    countToken("requirePlatformPermission(") + " 处）。",
  "- 路由解析：`backend/src/routes/*.routes.ts` 的 `routeConfig.prefix` + `router.<method>(path, ...中间件, handler)`；" +
    "prefix 缺失时按 `backend/src/shared/auto-routes.ts:54 inferPrefix` 兜底（计数 " +
    routePrefixMissing.length + "）。",
  "- DTO ref：脚本先扫全后端把 zod 符号建索引（`export const *Schema` + `const X = z.object(/z.array(`，共 " +
    schemaIndex.size +
    " 个符号，独立 `*.schema.ts` 文件仅 " +
    schemaFiles.length +
    " 个）；再按 ①路由语句/controller 里引用的 schema 符号 → ②controller 文件首个 `z.object(` → ③controller 首个 `.parse(` → ④一跳 service 首个 `z.object(` → ⑤一跳 service 首个 `.parse(` 顺序定位 `文件:行号`；全部落空写 UNKNOWN（分类计数见 stdout `WRITE_ACTIONS_DTO_KINDS`），不猜。",
  "- 审计口径：全局审计中间件探测 = " +
    (mwAuditHits.length
      ? mwAuditHits.join(" | ")
      : "backend/src/middleware/ 下 0 个文件写审计表 ⇒ **无全局写审计中间件**") +
    "；实际留痕是服务层内联 `INSERT INTO t_operation_log`（样例 `backend/src/services/admin/sys-user.service.ts:175`），" +
    "全仓命中 " +
    auditFiles.size +
    " 个文件。判定：controller 本体或 controller→service（最多 2 跳）命中该 INSERT ⇒ 有（附 ref）；否则 无；路由未解析 ⇒ UNKNOWN。",
  "- AI 工具现状：底座注册表 `ZXQL-AI/src/tools/definitions/*.tool.ts`（排除 `.spec.`），共 " +
    tools.length +
    " 个工具；工具文件以注释/字面量自陈 `METHOD /api/...`，脚本抽到 " +
    toolIndex.size +
    " 条 method+path，与本页动作做**分段匹配**（参数段互配）。命中=有，未命中=无；匹配依据是工具自陈的 API 目标，不是名称相似度猜测。",
  "- 写确认：底座确认链（预览→确认→执行→撤销）路由注册 ref 见 stdout `CONFIRM_CHAIN_REFS`（" +
    (confirmChainRefs.join(" | ") || "UNKNOWN") +
    "）；admin-web 侧封装 `admin-web/src/api/ai.ts:265 confirmAiOperation / :276 cancelAiOperation / :285 revokeAiOperation`。" +
    "页面直调的 REST 写动作不经过该链路，故仅当该动作在 AI 工具集合内且工具声明确认链时判「有」，否则判「无（页面直调）」。",
  "- 读/写分列：写动作逐条展开；读动作按域合并（每域一行 + 抽样 ref×2）——上一名子代理逐文件通读 157 个 vue 爆掉，本矩阵改为脚本批量抽取。",
  "",
  "## 1. 脚本实测计数（stdout 原样抄录，未手改）",
  "",
  "```",
  ...OUT.slice(),
  "```",
  "",
  "## 2. 写动作矩阵（逐条）",
  "",
].join("\n");

const SUMMARY = [
  "",
  "## 4. 总合计与系统性缺口",
  "",
  "- 写动作（被 views 调用的 POST/PUT/PATCH/DELETE 封装）：**" +
    tn +
    " 条**，覆盖 " +
    domAgg.size +
    " 个域；读操作按域合并为 " +
    readByDomain.size +
    " 行。",
  "- 后端全量写路由：" +
    backendWriteRoutes.length +
    " 条，其中带权限码 " +
    backendWriteWithPerm.length +
    " 条、无码 " +
    (backendWriteRoutes.length - backendWriteWithPerm.length) +
    " 条 ⇒ **缺口①：写接口无权限码比例 = " +
    pct(backendWriteRoutes.length - backendWriteWithPerm.length, backendWriteRoutes.length) +
    "**（全量口径）。",
  "- 被页面真实调用的写动作里：无码 " +
    viewWriteRowsNoPerm.length +
    " 条、UNKNOWN（前端路径对不上后端路由，接线不明）" +
    viewWriteRowsUnknown.length +
    " 条、有码 " +
    (writeRows.length - viewWriteRowsNoPerm.length - viewWriteRowsUnknown.length) +
    " 条 ⇒ 矩阵内无码比例 = " +
    pct(viewWriteRowsNoPerm.length, writeRows.length) +
    "，含接线不明合计 " +
    pct(viewWriteRowsNoPerm.length + viewWriteRowsUnknown.length, writeRows.length) +
    "。",
  "- 审计：无审计写点 " +
    ta +
    " / " +
    tn +
    " ⇒ **无审计比例 = " +
    pct(ta, tn) +
    "**；命中 t_operation_log（controller→service 2 跳内）" +
    viewWriteRowsAuditYes.length +
    " 条、审计 UNKNOWN（路由未解析）" +
    viewWriteRowsAuditUnknown.length +
    " 条。",
  "- 前端封装路径与后端注册对不齐（末端对齐才命中，即封装多写/少写一段）：" +
    writeRowsPathMismatch.length +
    " 条 —— 这类动作在矩阵里已按后端真实路径挂码，但**前端写的是另一个串**，属接线缺陷。",
  "- AI 工具可覆盖写动作：" +
    tai +
    " / " +
    tn +
    "（" +
    pct(tai, tn) +
    "），其中走 preview/confirm 链 " +
    viewWriteRowsConfirm.length +
    " 条。",
  "",
  "### 缺口①（写接口无权限码）",
  "全量 " +
    backendWriteRoutes.length +
    " 条写路由中 " +
    (backendWriteRoutes.length - backendWriteWithPerm.length) +
    " 条未挂任何权限中间件，只有认证（`routeConfig.auth` 默认 `requireAuthWithTenant`）而无授权 ⇒ 同租户任意登录用户可写。" +
    "已接线样例（有码）：`backend/src/routes/admin-customer.routes.ts:15` `requirePermission(码) → customer:create`。",
  "",
  "### 缺口②（前端无按码显隐）",
  "`hasPermission` 定义 ref = " +
    (hpDefRefs.length ? hpDefRefs.join(" | ") : "无") +
    "；**真实调用点 " +
    hpCallRefs.length +
    " 处**" +
    (hpCallRefs.length ? "（ref：" + hpCallRefs.slice(0, 4).join(" | ") + "）" : "（全仓 0 处，唯一另一处命中是 store return 里的裸标识符暴露 " + hpExposeRefs.join(" | ") + "，不构成调用）") +
    "，其中 `admin-web/src/views/**` 内 " +
    hpCallInViews.length +
    " 处；`admin-web/src/stores/app.ts` 内是否定义 hasPermission = " +
    appStoreHasDef +
    "。views 侧权限相关关键字（hasPermission / v-if 带 perm·can·role）命中 " +
    permGrepHits.length +
    " 处，分布在 " +
    permHitsByFile.size +
    " 个文件 ⇒ 按钮显隐不按权限码判定（派工卡假设的 `stores/app.ts:hasPermission` 全仓 0 调用点，实测结论以本行为准）。",
  "",
  "## 5. 自检",
  "",
  "- 行数守恒：写动作表 " +
    writeRows.length +
    " 行 = stdout `WRITE_ACTIONS_VIEW_CALLED`；读域行 " +
    readByDomain.size +
    " 行 = stdout `READ_DOMAINS`；每域小计 " +
    domAgg.size +
    " 行 + 合计 1 行。",
  "- 复跑一致性：脚本无随机源、无时间戳，两次运行 stdout 必须逐字相同。",
  "- **反测＝待执行（本单红线禁改业务代码，故未在工作树里做）**，由 #11 收口时墨按下列造错各跑一次并核对读数变化：" +
    "① 删任一路由行的 `requirePermission(...)` ⇒ `WRITE_ACTIONS_NO_PERM` +1；" +
    "② 给某 controller 加一句 `INSERT INTO t_operation_log` ⇒ 对应动作审计由「无」变「有」；" +
    "③ 改 `admin-web/src/api/*.ts` 某封装函数名 ⇒ `VIEW_WRAPPER_CALL_SITES` 下降。" +
    "本脚本因此**不得视为已验收门禁**，只是读数器。",
  "",
  "## 6. CSV（机读产物）",
  "",
  "同数据量的 CSV 由脚本 `--out <dir>` 写出（`30-action-permission-matrix.csv`，13 列）。" +
    "按派工卡『产出只允许 2 个文件』约束，默认不落仓库，示例：`--out /tmp/wb30`。",
  "",
].join("\n");

if (MD_OUT) {
  const body = FRONTMATTER + md.join("\n") + "\n" + SUMMARY + "\n";
  fs.mkdirSync(path.dirname(path.resolve(ROOT, MD_OUT)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, MD_OUT), body, "utf8");
  say("MD_WRITTEN=" + MD_OUT + " bytes=" + body.length);
}

/* stdout：先计数（OUT 数组），再表格主体，最后 CSV 尾部（若有 --out 只提示路径） */
const OUT_SLICE = OUT.slice();
process.stdout.write(OUT.join("\n") + "\n");
if (OUT_DIR) process.stdout.write("CSV_WRITTEN=" + path.join(OUT_DIR, "30-action-permission-matrix.csv") + "\n");
process.stdout.write(
  "AUDIT_WRITE_FILES_LIST_SAMPLE=" + [...auditFiles].slice(0, 5).join(" | ") + "\n"
);
process.stdout.write("PREFIX_INFERRED_LIST=" + routePrefixMissing.slice(0, 5).join(" | ") + "\n");
process.stdout.write(
  "TOP_NO_PERM_WRITE_SAMPLES=" +
    writeRows
      .filter((r) => r.perm === "无码")
      .slice(0, 8)
      .map((r) => r.methodUp + " " + r.np)
      .join(" | ") +
    "\n"
);

/* 调试（不影响任何计数，仅 stdout 末尾）：--debug <路径子串> */
const DBG = flagVal("--debug", null);
if (DBG) {
  process.stdout.write("DEBUG_BACKEND_ROUTES[" + DBG + "]\n");
  for (const r of routes.filter((x) => x.np.includes(DBG)).slice(0, 20))
    process.stdout.write(
      "  " +
        r.method.toUpperCase() +
        " " +
        r.np +
        " perm=" +
        (r.perm || "无码") +
        " @" +
        r.rel +
        ":" +
        r.line +
        "\n"
    );
  process.stdout.write("DEBUG_FRONTEND_WRAPPERS[" + DBG + "]\n");
  for (const w of wrappers.filter((x) => x.np.includes(DBG)).slice(0, 20))
    process.stdout.write(
      "  " +
        w.method.toUpperCase() +
        " " +
        w.np +
        " " +
        w.name +
        " @" +
        w.rel +
        ":" +
        w.line +
        " sites=" +
        (usedBy.get(w.name) || []).length +
        "\n"
    );
}
