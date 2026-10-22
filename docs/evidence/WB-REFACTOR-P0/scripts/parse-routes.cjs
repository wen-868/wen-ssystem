#!/usr/bin/env node
/*
 * parse-routes.cjs — WB-REFACTOR-P0 矩阵10（路由 · 菜单矩阵）可复跑复算脚本
 *
 * 只读解析三类真相源，不做任何写盘（除非显式 --out <dir>）：
 *   1) admin-web/src/router/index.ts          —— 路由声明（path/name/component/meta）
 *   2) admin-web/src/layouts/MainLayout.vue   —— 人工侧边栏导航（一级分组 → 二级项 → path）+ 收银台导航
 *   3) 原型 SECTORS（工作台电脑端 UI 原型_融合版.html:3013 + @3774-3914 fuse 扩容）
 *   4) backend menus 接口（routes/controller/service）+ t_sys_menu menuCode 种子（迁移 / 目录常量）
 *
 * 用法：
 *   node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs
 *   node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --out /tmp/wb10 [--root <repoRoot>] [--proto <htmlPath>] [--strict]
 *
 * --strict：任一「卡口径 vs 实算」差异非 0 时打印 STRICT_FAILED 并 EXIT=1（用于反测门禁）。
 *
 * 反测（证明它不是假门禁）：临时删掉 router/index.ts 任意一行路由，
 * ROUTE_DECLARATIONS 会 -1、TABLE_A 行数会 -1；把 MainLayout 某个 navTo 路径改成
 * 不存在的路径，MENU_UNMATCHED 会 +1。脚本一律如实报错数，不做兜底美化。
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* ---------- 参数与工作树定位 ---------- */

const argv = process.argv.slice(2);
function flagVal(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const WRITE_OUT = flagVal("--out", null);
const STRICT = argv.includes("--strict");
const ROOT = path.resolve(flagVal("--root", path.resolve(__dirname, "../../../..")));
const PROTO =
  flagVal("--proto", null) ||
  process.env.WB_PROTOTYPE ||
  "D:/Users/ZXQL/ZXQL-AI/docs/设计/智享全链_工作台电脑端_UI原型_融合版.html";

const ROUTER_REL = "admin-web/src/router/index.ts";
const LAYOUT_REL = "admin-web/src/layouts/MainLayout.vue";
const API_DIR_REL = "admin-web/src";
const MENU_ROUTES_REL = "backend/src/routes/menu-permission.routes.ts";
const MENU_CTRL_REL = "backend/src/controllers/admin/menu-permission.controller.ts";
const MENU_SVC_REL = "backend/src/services/admin/menu-permission.service.ts";
const MOBILE_CATALOG_REL = "backend/src/shared/app-mobile-menu-catalog.ts";
const MIG079_REL = "docs/migrations/079_权限矩阵.sql";

const UNKNOWN = "UNKNOWN";

function readRepo(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

/* ---------- 1) 路由解析 ---------- */

const staticImportRe = /^import\s+([A-Za-z0-9_$]+)\s+from\s+"([^"]+)"\s*;?\s*$/;

/**
 * 扫描一段 JS/TS 源码，按大括号配平切出「顶层对象字面量」。
 * 字符串（含转义）与注释（// 和 /* *\/）内的括号不计数——SECTORS/路由都是对象数组，
 * 逐行正则会漏掉跨行书写的对象（如 /login 的 name/component 各占一行），所以这里配平切块。
 */
function splitTopLevelObjects(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "{") {
      let depth = 0;
      let j = i;
      let inStr = false;
      let q = "";
      for (; j < src.length; j++) {
        const ch = src[j];
        if (inStr) {
          if (ch === "\\") { j++; continue; }
          if (ch === q) inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") { inStr = true; q = ch; continue; }
        if (ch === "/" && src[j + 1] === "/") { while (j < src.length && src[j] !== "\n") j++; continue; }
        if (ch === "/" && src[j + 1] === "*") { const e = src.indexOf("*/", j + 2); j = e < 0 ? src.length : e + 1; continue; }
        if (ch === "{" || ch === "[" || ch === "(") depth++;
        else if (ch === "}" || ch === "]" || ch === ")") {
          depth--;
          if (depth === 0 && ch === "}") break;
        }
      }
      out.push({ text: src.slice(i, j + 1), start: i });
      i = j + 1;
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    i++;
  }
  return out;
}

function childRegion(objText) {
  const k = objText.indexOf("children:");
  if (k < 0) return { own: objText, ownStartOffset: 0, childrenBody: null, childrenStart: -1 };
  const open = objText.indexOf("[", k);
  if (open < 0) return { own: objText, ownStartOffset: 0, childrenBody: null, childrenStart: -1 };
  let depth = 0;
  let inStr = false;
  let q = "";
  for (let j = open; j < objText.length; j++) {
    const ch = objText[j];
    if (inStr) {
      if (ch === "\\") { j++; continue; }
      if (ch === q) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; q = ch; continue; }
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return { own: objText.slice(0, k), ownStartOffset: 0, childrenBody: objText.slice(open + 1, j), childrenStart: open + 1 };
    }
  }
  return { own: objText.slice(0, k), ownStartOffset: 0, childrenBody: objText.slice(open + 1), childrenStart: open + 1 };
}

function routeFieldsFromOwn(own, absStart, fileText, staticComp, lineOfOffset) {
  const pm = own.match(/\bpath:\s*"([^"]+)"/);
  if (!pm) return null;
  const nm = own.match(/\bname:\s*"([^"]+)"/);
  const dyn = own.match(/\bcomponent:\s*\(\)\s*=>\s*import\(\s*"([^"]+)"\s*\)/);
  const stat = own.replace(/\bchildren:[\s\S]*$/, "").match(/\bcomponent:\s*([A-Za-z0-9_$]+)\b/);
  let comp = UNKNOWN;
  let compRaw = UNKNOWN;
  if (dyn) { comp = normalizeComp(dyn[1]); compRaw = dyn[1]; }
  else if (stat && stat[1] !== "children" && staticComp.has(stat[1])) { comp = staticComp.get(stat[1]); compRaw = stat[1]; }
  else if (stat) { comp = UNKNOWN; compRaw = stat[1]; }

  const metaM = own.match(/\bmeta:\s*\{([\s\S]*)\}/);
  const meta = metaM ? metaM[1] : "";
  const rolesM = meta.match(/\broles:\s*\[([\s\S]*?)\]/);
  const roles = rolesM
    ? rolesM[1].split(",").map((s) => s.replace(/["\s]/g, "")).filter(Boolean)
    : [];
  const titleM = meta.match(/\btitle:\s*"([^"]+)"/);
  const relPath = pm[1];
  const isTop = relPath.startsWith("/");
  const pOff = own.indexOf("path:");
  const objLine = lineOfOffset(absStart);
  const pathLine = pOff >= 0 ? lineOfOffset(absStart + pOff) : objLine;
  return {
    line: pathLine,
    objLine,
    declaredPath: relPath,
    fullPath: isTop ? relPath : "/" + relPath,
    isTop,
    routeName: nm ? nm[1] : UNKNOWN,
    component: comp,
    componentRaw: compRaw,
    title: titleM ? titleM[1] : UNKNOWN,
    roles,
    metaHidden: /hidden:\s*true/.test(meta),
    fullscreen: /fullscreen:\s*true/.test(meta),
    requiresAuth: /\brequiresAuth:\s*(true|false)/.test(meta) ? /\brequiresAuth:\s*(true|false)/.exec(meta)[1] : UNKNOWN,
    ref: null,
    commentGroup: UNKNOWN,
  };
}

function parseRouter() {
  const raw = readRepo(ROUTER_REL);
  if (!raw) return { rows: [], error: `${ROUTER_REL} 不存在` };
  const lines = raw.split(/\r?\n/);
  const lineOfOffset = (off) => raw.slice(0, off).split("\n").length;

  // 顶层静态 import 的标识符 → 文件（MainLayout / LoginView / NotFound）
  const staticComp = new Map();
  for (const l of lines) {
    const m = l.match(staticImportRe);
    if (m && /layouts|views/.test(m[2])) staticComp.set(m[1], normalizeComp(m[2]));
  }

  // 注释分组（// 1. 工作台 之类），按行号取最近的前置注释
  const commentMarks = [];
  lines.forEach((l, i) => {
    const cm = l.match(/^\s*\/\/\s*\d+\.\s*(.+?)\s*$/);
    if (cm) commentMarks.push({ line: i + 1, label: cm[1].trim() });
  });
  const groupFor = (lineNo) => {
    let g = "（无注释分组）";
    for (const c of commentMarks) if (c.line <= lineNo) g = c.label; else break;
    return g;
  };

  const arrIdx = raw.indexOf("const routes");
  const rows = [];
  const topBody = raw.slice(arrIdx);
  const topObjects = splitTopLevelObjects(topBody.slice(topBody.indexOf("[")));
  const baseOff = arrIdx + topBody.indexOf("[") + 1;

  for (const obj of topObjects) {
    const abs = baseOff + obj.start;
    const ownAndKids = childRegion(obj.text);
    const r = routeFieldsFromOwn(ownAndKids.own, abs, raw, staticComp, lineOfOffset);
    if (r) {
      r.ref = `${ROUTER_REL}:${r.line}`;
      r.commentGroup = groupFor(r.line);
      rows.push(r);
    }
    if (ownAndKids.childrenBody) {
      const childBase = abs + ownAndKids.childrenStart;
      for (const cobj of splitTopLevelObjects(ownAndKids.childrenBody)) {
        const cAbs = childBase + cobj.start;
        const cOwn = childRegion(cobj.text).own;
        const cr = routeFieldsFromOwn(cOwn, cAbs, raw, staticComp, lineOfOffset);
        if (cr) {
          cr.ref = `${ROUTER_REL}:${cr.line}`;
          cr.commentGroup = groupFor(cr.line);
          rows.push(cr);
        }
      }
    }
  }
  return { rows, error: null };
}

function normalizeComp(p) {
  // "../views/pos/SaleBillsView.vue" -> "views/pos/SaleBillsView.vue"
  return p.replace(/^\.\.\//, "").replace(/^\.\//, "");
}

/* ---------- 2) MainLayout 人工菜单解析 ---------- */

function parseLayout() {
  const raw = readRepo(LAYOUT_REL);
  if (!raw) return { groups: [], cashier: [], error: `${LAYOUT_REL} 不存在` };
  const lines = raw.split(/\r?\n/);

  const navStart = lines.findIndex((l) => /<nav\s+class="sidebar-nav"/.test(l));
  const navEnd = lines.findIndex((l) => /<\/nav>/.test(l) && navStart >= 0 && l.indexOf("</nav>") >= 0);
  const groups = [];
  if (navStart >= 0 && navEnd > navStart) {
    const region = lines.slice(navStart, navEnd + 1);
    let section = "";
    let cur = null;
    for (let i = 0; i < region.length; i++) {
      const l = region[i];
      const absLn = navStart + i + 1;
      const secM = l.match(/class="nav-section-label"[^>]*>([^<]+)</);
      if (secM) {
        section = secM[1].trim();
        continue;
      }
      if (/<div\s+class="nav-group">/.test(l)) {
        cur = { section, label: UNKNOWN, groupLine: absLn, items: [] };
        groups.push(cur);
      }
      const labM = l.match(/class="nav-label"[^>]*>([^<]+)</);
      if (labM && cur && cur.label === UNKNOWN) cur.label = labM[1].trim();
      const navM = l.match(/@click="navTo\('([^']+)'\)"[^>]*>([^<]*)/);
      if (navM && cur) {
        cur.items.push({
          path: navM[1],
          label: (navM[2] || "").trim(),
          line: absLn,
        });
      }
    }
    // 二级项标签为空（navTo 行尾无文本，如侧栏顶级「工作台」单项）→ 回落本分组 nav-label
    for (const g of groups) {
      for (const it of g.items) if (!it.label) it.label = g.label === UNKNOWN ? UNKNOWN : g.label;
    }
  }

  // 收银台导航（cashierNavItems）
  const cashier = [];
  const cStart = lines.findIndex((l) => /const\s+cashierNavItems\s*=/.test(l));
  if (cStart >= 0) {
    for (let i = cStart; i < Math.min(lines.length, cStart + 30); i++) {
      const m = lines[i].match(/\{\s*path:\s*"([^"]+)",\s*label:\s*"([^"]+)"(.*)$/);
      if (m) cashier.push({ path: m[1], label: m[2], line: i + 1 });
      if (/^\];/.test(lines[i]) && i > cStart) break;
    }
  }
  return { groups, cashier, error: null };
}

/* ---------- 3) 原型 SECTORS 解析 ---------- */

function extractBalanced(text, startIdx) {
  const open = text.indexOf("[", startIdx);
  if (open < 0) return null;
  let depth = 0;
  let inStr = false;
  let q = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === q) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; q = ch; continue; }
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") {
      depth--;
      if (depth === 0 && ch === "]") return text.slice(open, i + 1);
    }
  }
  return null;
}

function parseSectors() {
  const res = {
    ok: false,
    ref: UNKNOWN,
    sectors: [],
    pages: [],
    fusePages: [],
    parseError: null,
  };
  if (!fs.existsSync(PROTO)) {
    res.parseError = `原型文件不存在：${PROTO}`;
    return res;
  }
  const raw = fs.readFileSync(PROTO, "utf8");
  const lines = raw.split(/\r?\n/);
  let lineNo = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(const|var)\s+SECTORS\s*=/.test(lines[i])) { lineNo = i + 1; break; }
  }
  if (lineNo < 0) {
    res.parseError = "未找到 SECTORS 定义行";
    return res;
  }
  res.ref = `原型 html:${lineNo}`;
  const line = lines[lineNo - 1];
  const jsonTxt = extractBalanced(line, line.indexOf("="));
  if (!jsonTxt) {
    res.parseError = "SECTORS 括号未配平，解析失败";
    return res;
  }
  let data;
  try {
    data = JSON.parse(jsonTxt);
    res.ok = true;
  } catch (e) {
    res.parseError = "JSON.parse 失败：" + e.message;
    return res;
  }
  res.sectors = data.map((s) => ({ k: s.k, n: s.n, d: s.d, lv2Count: (s.lv2 || []).length }));
  for (const s of data) {
    for (const p of s.lv2 || []) {
      res.pages.push({
        sectorKey: s.k,
        sectorName: s.n,
        key: p.k,
        name: p.n,
        type: p.t || UNKNOWN,
        comp: p.c || UNKNOWN,
        api: p.a || UNKNOWN,
        rel: (p.rel || []).map((r) => r.p).join("|"),
        source: `原型 html:${lineNo}`,
      });
    }
  }

  // fuse 扩容（+24 页，运行时 push 进 SECTORS）
  let fuseStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/SECTORS\s*二级目录扩容/.test(lines[i])) { fuseStart = i; break; }
  }
  if (fuseStart >= 0) {
    let curSector = UNKNOWN;
    for (let i = fuseStart; i < Math.min(lines.length, fuseStart + 400); i++) {
      const l = lines[i];
      const g = l.match(/G\('([^']+)'\)\.lv2\.push\(/);
      if (g) curSector = g[1];
      const m = l.match(/^\s*\{k:'([^']+)',n:'([^']+)'(?:,[^{}]*?c:'([^']*)')?/);
      if (m) {
        res.fusePages.push({
          sectorKey: curSector,
          sectorName: (data.find((s) => s.k === curSector) || {}).n || UNKNOWN,
          key: m[1],
          name: m[2],
          type: "fuse",
          comp: m[3] || UNKNOWN,
          source: `原型 html:${i + 1}`,
        });
      }
      if (/^\s*\}\)\(\);/.test(l) && i > fuseStart + 5) break;
    }
  }
  return res;
}

/* ---------- 4) 后端菜单接口 + menuCode 种子 ---------- */

function parseBackendMenus() {
  const out = {
    endpointExists: false,
    refs: { routes: UNKNOWN, controller: UNKNOWN, service: UNKNOWN },
    menuCodes: [],
    adminWebMenusCalls: 0,
    adminWebMenuStoreRefs: 0,
  };
  const routesRaw = readRepo(MENU_ROUTES_REL);
  if (routesRaw) {
    const lines = routesRaw.split(/\r?\n/);
    const iPrefix = lines.findIndex((l) => /prefix:\s*"\/api\/admin\/menus"/.test(l));
    const iUser = lines.findIndex((l) => /get\("\/user"/.test(l));
    const iTree = lines.findIndex((l) => /get\("\/tree"/.test(l));
    if (iPrefix >= 0 && iUser >= 0) {
      out.endpointExists = true;
      out.refs.routes = `${MENU_ROUTES_REL}:${iUser + 1}(GET /user) / ${iPrefix + 1}(prefix) / ${
        iTree + 1
      }(GET /tree)`;
    }
  }
  const ctrlRaw = readRepo(MENU_CTRL_REL);
  if (ctrlRaw) {
    const lines = ctrlRaw.split(/\r?\n/);
    const idx = lines.findIndex((l) => /export const getUserMenus/.test(l));
    if (idx >= 0) out.refs.controller = `${MENU_CTRL_REL}:${idx + 1}`;
  }
  const svcRaw = readRepo(MENU_SVC_REL);
  let svcLines = null;
  if (svcRaw) {
    svcLines = svcRaw.split(/\r?\n/);
    const idx = svcLines.findIndex((l) => /export async function getUserMenus/.test(l));
    const idxSql = svcLines.findIndex((l) => /menu_code AS menuCode/.test(l));
    const idxTable = svcLines.findIndex((l) => /FROM t_sys_menu/.test(l));
    if (idx >= 0) {
      out.refs.service =
        `${MENU_SVC_REL}:${idx + 1}(getUserMenus) / ${idxSql + 1}(SELECT menu_code AS menuCode) / ${
          idxTable + 1
        }(FROM t_sys_menu)`;
    }
  }

  // menuCode 种子 A：权限矩阵类迁移（079 建表灌码 + 203/204/207 立码），只认写 t_sys_menu 的文件
  const MIGS = [
    MIG079_REL,
    "docs/migrations/203_销售单取消权限点.sql",
    "docs/migrations/204_系统设置域权限点立码.sql",
    "docs/migrations/207_四域权限点立码.sql",
  ];
  const reTyped = /\(\s*(?:\d+)\s*,\s*(?:NULL|\d+)\s*,\s*'([a-z0-9:_-]+)'\s*,\s*'([^']*)'\s*,\s*'(CATALOG|MENU|BUTTON)'\s*,\s*(NULL|'[^']*')/;
  const reButtonTuple = /\(\s*(?:\d+)\s*,\s*(?:\d+)\s*,\s*'([a-z0-9:_-]+)'\s*,\s*'([^']*)'\s*,\s*'BUTTON'/;
  const reUnionSelect = /SELECT\s+'([a-z][a-z0-9:_-]+)'(?:\s+AS\s+code)?\s*,\s*'([^']+)'/;
  const reButtonInline = /'([a-z][a-z0-9:_-]+)'\s*,\s*'([^']+)'\s*,\s*'BUTTON'/;
  for (const mig of MIGS) {
    const raw = readRepo(mig);
    if (!raw) continue;
    const lines = raw.split(/\r?\n/);
    lines.forEach((l, i) => {
      let m = l.match(reTyped) || l.match(reButtonTuple) || l.match(reUnionSelect) || l.match(reButtonInline);
      if (!m) return;
      const code = m[1];
      if (!/[a-z]+:/.test(code) && !/^(dashboard|goods|sale|purchase|customer|finance|marketing|store|trace|report|system|miniapp|pos)$/.test(code)) return;
      const type = m[3] || "BUTTON";
      const path = m[4] && m[4] !== "NULL" ? m[4].replace(/'/g, "") : UNKNOWN;
      out.menuCodes.push({
        code,
        name: m[2],
        menuType: type,
        path,
        source: "migration",
        ref: `${mig}:${i + 1}`,
      });
    });
  }

  // menuCode 种子 B：app-mobile 目录常量（TS）
  const catRaw = readRepo(MOBILE_CATALOG_REL);
  if (catRaw) {
    const lines = catRaw.split(/\r?\n/);
    const re = /\{\s*code:\s*"([^"]+)",\s*parent:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*path:\s*"([^"]+)"/;
    lines.forEach((l, i) => {
      const m = l.match(re);
      if (!m) return;
      out.menuCodes.push({
        code: m[1],
        name: m[3],
        menuType: "MENU(app-mobile catalog)",
        path: m[4],
        source: "app-mobile-menu-catalog",
        ref: `${MOBILE_CATALOG_REL}:${i + 1}`,
      });
    });
  }

  // admin-web 是否消费 /menus/user（关键：决定 menuCode 是否驱动 PC 菜单）
  const walk = (dir) => {
    let hits = 0;
    let storeHits = 0;
    let entries = [];
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      let ls;
      try {
        ls = fs.readdirSync(d, { withFileTypes: true });
      } catch (e) {
        continue;
      }
      for (const e of ls) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (["node_modules", "dist", ".git", "coverage"].includes(e.name)) continue;
          stack.push(p);
        } else if (/\.(ts|js|vue)$/.test(e.name)) {
          entries.push(p);
        }
      }
    }
    for (const f of entries) {
      let txt;
      try {
        txt = fs.readFileSync(f, "utf8");
      } catch (e) {
        continue;
      }
      if (/menus\/user|admin\/menus/.test(txt)) hits++;
      if (/\bmenuCode\b|\bmenu_code\b/.test(txt)) storeHits++;
    }
    return { hits, storeHits };
  };
  const adminHits = walk(path.join(ROOT, API_DIR_REL));
  out.adminWebMenusCalls = adminHits.hits;
  out.adminWebMenuStoreRefs = adminHits.storeHits;
  return out;
}

/* ---------- 5) 组装三表 ---------- */

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header, rows) {
  return [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

function build() {
  const router = parseRouter();
  const layout = parseLayout();
  const proto = parseSectors();
  const backend = parseBackendMenus();

  if (router.error) throw new Error(router.error);
  if (layout.error) throw new Error(layout.error);

  /* 菜单索引：path → {group,item} */
  const menuByPath = new Map();
  const menuItems = [];
  for (const g of layout.groups) {
    for (const it of g.items) {
      menuByPath.set(it.path, { group: g.label, section: g.section, label: it.label, line: it.line });
      menuItems.push({ group: g.label, section: g.section, ...it });
    }
  }
  const cashierByPath = new Map(layout.cashier.map((c) => [c.path, c]));

  /* 路由索引 */
  const byName = new Map();
  const byFullPath = new Map();
  const byComp = new Map();
  for (const r of router.rows) {
    if (r.routeName !== UNKNOWN && !byName.has(r.routeName)) byName.set(r.routeName, r);
    if (!byFullPath.has(r.fullPath)) byFullPath.set(r.fullPath, r);
    if (r.component !== UNKNOWN && !byComp.has(r.component)) byComp.set(r.component, r);
  }

  /* 表A */
  const compExistsAbs = (c) =>
    c !== UNKNOWN && fs.existsSync(path.join(ROOT, "admin-web/src", c));
  const tableA = router.rows.map((r) => {
    const menu = menuByPath.get(r.fullPath);
    const cash = cashierByPath.get(r.fullPath);
    const inMenu = !!(menu || cash);
    const primary = menu ? `${menu.section ? menu.section + " / " : ""}${menu.group}` : cash ? "收银台（cashierNavItems）" : "非菜单路由";
    const secondary = menu ? menu.label : cash ? cash.label : r.title === UNKNOWN ? UNKNOWN : r.title;
    const hiddenFlag = r.metaHidden ? "meta.hidden" : inMenu ? "否" : "是（非侧栏菜单）";
    return {
      line: r.line,
      primary,
      secondary,
      path: r.fullPath,
      name: r.routeName,
      component: r.component,
      compFileExists: r.component === UNKNOWN ? "无组件（父级/重定向）" : compExistsAbs(r.component) ? "存在" : "文件缺失",
      hidden: hiddenFlag,
      roles: r.roles.length ? r.roles.join("|") : "无",
      menuRef: menu
        ? `${LAYOUT_REL}:${menu.line}`
        : cash
        ? `${LAYOUT_REL}:${cash.line}`
        : "无（不在导航）",
      routeRef: r.ref,
      commentGroup: r.commentGroup,
      fullscreen: r.fullscreen,
      requiresAuth: r.requiresAuth,
    };
  });

  const menuPathsSeen = new Set([
    ...menuItems.map((m) => m.path),
    ...layout.cashier.map((c) => c.path),
  ]);
  const menuUnmatched = [...menuPathsSeen].filter((p) => !byFullPath.has(p));
  const menuMatchedRoutes = [...menuPathsSeen].filter((p) => byFullPath.has(p));

  const dupCompMap = new Map();
  for (const r of router.rows) {
    if (r.component === UNKNOWN) continue;
    if (!dupCompMap.has(r.component)) dupCompMap.set(r.component, []);
    dupCompMap.get(r.component).push(r);
  }
  const dupComps = [...dupCompMap.entries()].filter(([, v]) => v.length > 1);
  const uniqueComps = dupCompMap.size;
  // 「唯一页面组件」口径：剔除布局壳与登录/404 等非业务页组件
  const NON_PAGE_COMPS = ["layouts/MainLayout.vue", "views/LoginView.vue", "views/NotFound.vue"];
  const uniquePageComps = [...dupCompMap.keys()].filter((c) => !NON_PAGE_COMPS.includes(c)).length;

  /* 表B：双向差集 */
  const protoPages = [...proto.pages, ...proto.fusePages];
  const protoNames = new Set(protoPages.map((p) => p.key));
  const protoComps = new Set(protoPages.filter((p) => p.comp !== UNKNOWN).map((p) => p.comp));

  const b1 = protoPages.map((p) => {
    const byNameHit = byName.get(p.key);
    const byCompHit = p.comp !== UNKNOWN ? byComp.get(p.comp) : undefined;
    const route = byNameHit || byCompHit;
    let how = route ? (byNameHit ? "routeName 精确" : "组件文件") : "无";
    const compExists =
      route && route.component !== UNKNOWN
        ? fs.existsSync(path.join(ROOT, "admin-web/src", route.component))
          ? "存在"
          : "文件缺失"
        : p.comp !== UNKNOWN && fs.existsSync(path.join(ROOT, "admin-web/src", p.comp))
        ? "文件存在但无路由"
        : "无文件";
    return {
      sector: `${p.sectorKey}/${p.sectorName || ""}`,
      pageKey: p.key,
      pageName: p.name,
      type: p.type,
      protoComp: p.comp,
      protoRef: p.source,
      protoCompExists:
        p.comp !== UNKNOWN
          ? fs.existsSync(path.join(ROOT, "admin-web/src", p.comp)) ? "存在" : "不存在"
          : "原型未声明组件",
      match: route ? route.fullPath : UNKNOWN,
      routeName: route ? route.routeName : UNKNOWN,
      how,
      compExists,
      missing: route ? "" : "原型有·admin-web 无页面",
    };
  });

  const b2 = router.rows
    .filter((r) => !protoNames.has(r.routeName) && !(r.component !== UNKNOWN && protoComps.has(r.component)))
    .map((r) => ({
      path: r.fullPath,
      routeName: r.routeName,
      component: r.component,
      title: r.title,
      ref: r.ref,
      note: "admin-web 有·原型 SECTORS 未列",
    }));

  /* 表C：menuCode → routeName（按 menuCode 去重，保留首次出现 ref） */
  const codeDup = new Map();
  for (const m of backend.menuCodes) {
    if (!codeDup.has(m.code)) codeDup.set(m.code, m);
  }
  const c = [...codeDup.values()].map((m) => {
    const byPath = m.path !== UNKNOWN ? byFullPath.get(m.path) : undefined;
    const guessed = byPath || byName.get(m.code.replace(/:/g, "-"));
    return {
      menuCode: m.code,
      menuName: m.name,
      menuType: m.menuType,
      dbPath: m.path,
      routeName: guessed ? guessed.routeName : UNKNOWN,
      routePath: guessed ? guessed.fullPath : UNKNOWN,
      source: m.source,
      ref: m.ref,
      status: guessed ? "可对齐" : "menuCode 有码·admin-web 无同名/同路径路由",
      consumer: backend.adminWebMenusCalls === 0 ? "admin-web 未调用 /api/admin/menus/user" : "admin-web 有调用",
    };
  });
  const cAligned = c.filter((x) => x.status === "可对齐").length;
  const typeCount = {};
  for (const m of c) typeCount[m.menuType] = (typeCount[m.menuType] || 0) + 1;
  const MENU_CODE_TYPES = Object.entries(typeCount).map(([k, v]) => `${k}=${v}`).join(" ");

  /* 计数汇总 */
  const counts = {
    ROUTE_DECLARATIONS: router.rows.length,
    ROUTE_TOP_LEVEL: router.rows.filter((r) => r.isTop).length,
    ROUTE_CHILDREN: router.rows.filter((r) => !r.isTop).length,
    ROUTE_WITH_NAME: router.rows.filter((r) => r.routeName !== UNKNOWN).length,
    ROUTE_WITHOUT_NAME: router.rows.filter((r) => r.routeName === UNKNOWN).length,
    UNIQUE_COMPONENT_FILES: uniqueComps,
    UNIQUE_COMPONENT_FILES_PAGE_ONLY: uniquePageComps,
    UNIQUE_COMPONENT_EXCLUDED_NON_PAGE: NON_PAGE_COMPS.join("|"),
    COMPONENT_REUSED_DEFS: router.rows.filter((r) => r.component !== UNKNOWN).length - uniqueComps,
    ROUTE_META_HIDDEN: router.rows.filter((r) => r.metaHidden).length,
    ROUTE_FULLSCREEN: router.rows.filter((r) => r.fullscreen).length,
    ROUTE_NO_ROLES_META: router.rows.filter((r) => r.roles.length === 0).length,
    ROUTE_WITH_ROLES_META: router.rows.filter((r) => r.roles.length > 0).length,
    MENU_GROUP_COUNT: layout.groups.length,
    MENU_ITEM_COUNT: menuItems.length,
    CASHIER_NAV_ITEM_COUNT: layout.cashier.length,
    MENU_PATH_UNIQUE: menuPathsSeen.size,
    MENU_PATH_MATCHED_ROUTE: menuMatchedRoutes.length,
    MENU_PATH_UNMATCHED_ROUTE: menuUnmatched.length,
    ROUTE_VISIBLE_IN_MENU: router.rows.filter(
      (r) => menuByPath.get(r.fullPath) || cashierByPath.get(r.fullPath)
    ).length,
    ROUTE_HIDDEN_TOTAL_NON_MENU: router.rows.filter(
      (r) => r.metaHidden || !(menuByPath.get(r.fullPath) || cashierByPath.get(r.fullPath))
    ).length,
    PROTO_SECTOR_COUNT: proto.ok ? proto.sectors.length : UNKNOWN,
    PROTO_LV2_BASE: proto.ok ? proto.pages.length : UNKNOWN,
    PROTO_FUSE_PAGES: proto.ok ? proto.fusePages.length : UNKNOWN,
    PROTO_PAGES_TOTAL: proto.ok ? protoPages.length : UNKNOWN,
    PROTO_PAGE_MATCHED: b1.filter((x) => x.match !== UNKNOWN).length,
    PROTO_PAGE_MATCHED_BY_NAME: b1.filter((x) => x.how === "routeName 精确").length,
    PROTO_PAGE_MATCHED_BY_COMPONENT: b1.filter((x) => x.how === "组件文件").length,
    PROTO_PAGE_MISSING_IN_ADMIN: b1.filter((x) => x.match === UNKNOWN).length,
    PROTO_MISSING_WITH_COMP_FILE: b1.filter(
      (x) => x.match === UNKNOWN && x.protoComp !== UNKNOWN && fs.existsSync(path.join(ROOT, "admin-web/src", x.protoComp))
    ).length,
    ADMIN_ONLY_PAGES: b2.length,
    ROUTE_COMPONENT_FILE_MISSING: router.rows.filter(
      (x) => x.component !== UNKNOWN && !fs.existsSync(path.join(ROOT, "admin-web/src", x.component))
    ).length,
    BACKEND_MENU_ENDPOINT: backend.endpointExists ? "EXISTS" : "NOT_FOUND",
    BACKEND_MENU_CODES_PARSED: backend.menuCodes.length,
    BACKEND_MENU_CODES_UNIQUE: codeDup.size,
    BACKEND_MENU_CODES_CATALOG_ROWS: c.length,
    BACKEND_MENU_CODES_ALIGNED_TO_ROUTE: cAligned,
    BACKEND_MENU_CODES_UNALIGNED: c.length - cAligned,
    ADMIN_WEB_CALLS_MENUS_USER: backend.adminWebMenusCalls,
    ADMIN_WEB_MENU_CODE_REFERENCES: backend.adminWebMenuStoreRefs,
  };

  return { counts, tableA, b1, b2, c, proto, backend, layout, router, menuUnmatched, dupComps, menuCodeTypes: MENU_CODE_TYPES };
}

/* ---------- 6) 输出 ---------- */

function main() {
  const t0 = Date.now();
  const r = build();

  console.log(`# WB-REFACTOR-P0 矩阵10 复算脚本`);
  console.log(`ROOT=${ROOT}`);
  console.log(`PROTOTYPE=${PROTO}`);
  console.log(`router=${ROUTER_REL} layout=${LAYOUT_REL} proto=${r.proto.ref}${
    r.proto.parseError ? " PROTO_ERROR=" + r.proto.parseError : ""
  }`);
  console.log(`backend_endpoint=${r.backend.refs.routes}`);
  console.log(`backend_controller=${r.backend.refs.controller}`);
  console.log(`backend_service=${r.backend.refs.service}`);
  console.log(`\n## COUNTS`);
  for (const [k, v] of Object.entries(r.counts)) console.log(`${k}=${v}`);

  console.log(`\n## 与任务卡口径对照（卡：164 路由声明 / 155 唯一页面组件 / 103 原型二级页）`);
  const card = {
    ROUTE_DECLARATIONS: 164,
    UNIQUE_COMPONENT_FILES_PAGE_ONLY: 155,
    PROTO_LV2_BASE: 103,
    PROTO_FUSE_PAGES: 24,
  };
  const cardDrift = [];
  for (const [k, v] of Object.entries(card)) {
    const got = r.counts[k];
    const diff = got === UNKNOWN ? UNKNOWN : Number(got) - v;
    if (diff !== 0) cardDrift.push(`${k} 卡=${v} 实=${got} 差异=${diff}`);
    console.log(`${k}: 卡=${v} 实=${got} 差异=${diff}`);
  }
  console.log(
    `NOTE: 去重组件文件全集=${r.counts.UNIQUE_COMPONENT_FILES}（含 ${r.counts.UNIQUE_COMPONENT_EXCLUDED_NON_PAGE} 这 3 个非页面组件；剔除后=卡口径 ${r.counts.UNIQUE_COMPONENT_FILES_PAGE_ONLY}）；重复声明的组件文件数=${r.counts.COMPONENT_REUSED_DEFS}`
  );

  console.log(`\n## 原型 SECTORS 分版块计数（卡：dash4/sale8/order4/purchase8/inventory10/customer5/product8/retail10/finance11/report6/marketing9/system8/pos12）`);
  if (r.proto.ok) {
    const fuseBySector = new Map();
    for (const p of r.proto.fusePages) fuseBySector.set(p.sectorKey, (fuseBySector.get(p.sectorKey) || 0) + 1);
    for (const s of r.proto.sectors) {
      console.log(
        `SECTOR=${s.k} 名称=${s.n} 基础二级=${s.lv2Count} 运行时fuse追加=${fuseBySector.get(s.k) || 0} 合计=${
          s.lv2Count + (fuseBySector.get(s.k) || 0)
        }`
      );
    }
    const sumBase = r.proto.sectors.reduce((a, s) => a + s.lv2Count, 0);
    console.log(`SECTOR_LV2_SUM=${sumBase} FUSE_SUM=${r.proto.fusePages.length}`);
  } else {
    console.log(`SECTOR_LV2_SUM=${UNKNOWN}（${r.proto.parseError}）`);
  }

  if (r.menuUnmatched.length) {
    console.log(`\n## 菜单项无对应路由（缺口）`);
    r.menuUnmatched.forEach((p) => console.log(`MENU_ORPHAN=${p}`));
  }
  if (r.dupComps.length) {
    console.log(`\n## 组件被多条路由复用（共 ${r.dupComps.length} 个文件）`);
    r.dupComps.forEach(([c, rows]) =>
      console.log(`DUP_COMPONENT=${c} -> ${rows.map((x) => `${x.fullPath}@${ROUTER_REL}:${x.line}`).join(" , ")}`)
    );
  }

  console.log(`\n## menuCode 去重后形态分布（总数 ${r.counts.BACKEND_MENU_CODES_UNIQUE}，原始行 ${r.counts.BACKEND_MENU_CODES_PARSED}）`);
  console.log(`MENU_CODE_TYPES=${r.menuCodeTypes}`);

  console.log(`\n### CSV:TABLE_A`);
  console.log(csvOfA(r.tableA));

  console.log(`\n### CSV:TABLE_B1_PROTO_ONLY`);
  console.log(csvOfB1(r.b1));

  console.log(`\n### CSV:TABLE_B2_ADMIN_ONLY`);
  console.log(
    toCsv(
      ["path", "routeName", "组件文件", "meta.title", "ref", "结论"],
      r.b2.map((x) => [x.path, x.routeName, x.component, x.title, x.ref, x.note])
    )
  );

  console.log(`\n### CSV:TABLE_C_MENUCODE`);
  console.log(
    toCsv(
      ["menuCode", "menu_name", "menu_type", "DB path", "routeName", "route path", "状态", "消费方", "来源 ref"],
      r.c.map((x) => [x.menuCode, x.menuName, x.menuType, x.dbPath, x.routeName, x.routePath, x.status, x.consumer, x.ref])
    )
  );

  const json = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    prototype: PROTO,
    prototypeRef: r.proto.ref,
    prototypeParseError: r.proto.parseError,
    counts: r.counts,
    cardComparison: card,
    menuOrphans: r.menuUnmatched,
    duplicateComponents: r.dupComps.map(([c, rows]) => ({ component: c, paths: rows.map((x) => x.fullPath) })),
    tableA: r.tableA,
    tableB1: r.b1,
    tableB2: r.b2,
    tableC: r.c,
    protoSectors: r.proto.sectors,
  };

  if (WRITE_OUT) {
    fs.mkdirSync(WRITE_OUT, { recursive: true });
    fs.writeFileSync(path.join(WRITE_OUT, "table-a-routes.csv"), "\ufeff" + csvOfA(r.tableA), "utf8");
    fs.writeFileSync(path.join(WRITE_OUT, "table-b1-proto-only.csv"), "\ufeff" + csvOfB1(r.b1), "utf8");
    fs.writeFileSync(path.join(WRITE_OUT, "table-b2-admin-only.csv"), "\ufeff" + csvOfB2(r.b2), "utf8");
    fs.writeFileSync(path.join(WRITE_OUT, "table-c-menucode.csv"), "\ufeff" + csvOfC(r.c), "utf8");
    fs.writeFileSync(path.join(WRITE_OUT, "matrix10.json"), JSON.stringify(json, null, 2), "utf8");
    console.log(`\nWROTE_OUT=${WRITE_OUT} files=5`);
  } else {
    console.log(`\n### JSON:SUMMARY`);
    console.log(JSON.stringify(json.counts));
  }
  console.log(`\nELAPSED_MS=${Date.now() - t0}`);
  if (STRICT) {
    if (cardDrift.length) {
      console.log(`\nSTRICT_FAILED=${cardDrift.length}`);
      for (const d of cardDrift) console.log(`DRIFT ${d}`);
      process.exitCode = 1;
    } else {
      console.log(`\nSTRICT_PASS=0 卡口径与实算全部一致`);
    }
  }
}

function csvOfA(rows) {
  return toCsv(
    ["一级菜单", "二级菜单", "path", "routeName", "组件文件", "组件文件存在", "hidden?", "权限/roles meta", "route ref", "菜单 ref"],
    rows.map((x) => [x.primary, x.secondary, x.path, x.name, x.component, x.compFileExists, x.hidden, x.roles, x.routeRef, x.menuRef])
  );
}
function csvOfB1(rows) {
  return toCsv(
    ["原型版块", "页 key", "页说明", "t", "原型组件", "原型 ref", "原型组件文件是否存在", "对齐 path", "对齐 routeName", "对齐方式", "结论"],
    rows.map((x) => [x.sector, x.pageKey, x.pageName, x.type, x.protoComp, x.protoRef, x.protoCompExists, x.match, x.routeName, x.how, x.missing || `admin-web 有（${x.compExists}）`])
  );
}
function csvOfB2(rows) {
  return toCsv(
    ["path", "routeName", "组件文件", "meta.title", "ref", "结论"],
    rows.map((x) => [x.path, x.routeName, x.component, x.title, x.ref, x.note])
  );
}
function csvOfC(rows) {
  return toCsv(
    ["menuCode", "menu_name", "menu_type", "DB path", "routeName", "route path", "状态", "消费方", "来源 ref"],
    rows.map((x) => [x.menuCode, x.menuName, x.menuType, x.dbPath, x.routeName, x.routePath, x.status, x.consumer, x.ref])
  );
}

try {
  main();
} catch (e) {
  console.error(`PARSE_FAILED=${e.message}`);
  process.exit(1);
}
