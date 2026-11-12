/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 · 逐页档案生成装置
 *
 * 产出：四域全部生产路由的逐页档案（路由/组件/原型键/API 接线对账/四态/溢出/详情表单层）。
 * 输出：中央 evidence raw/04-page-archive.json（--out 可覆盖）。
 * 只读采集：不改任何生产文件。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const SRC = path.join(WT, "admin-web", "src");
const OUT = process.argv[2] || "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01/raw/04-page-archive.json";
const PREFIXES = process.argv[3] || path.join(HERE, "prototype12-pages-supply-customer-product-backend-prefixes.txt");
const PROTO = process.argv[4] || "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01/raw/01-prototype-sectors-4domain.json";

const DOMAINS = ["purchase", "inventory", "customer", "product"];

// ── 1. 路由解析 ──
const routerSrc = fs.readFileSync(path.join(SRC, "router", "index.ts"), "utf8");
const routes = [];
const routeRe = /path:\s*"([^"]+)"[^}]*?component:\s*\(\)\s*=>\s*import\("\.\.\/views\/((?:purchase|inventory|customer|product)\/[A-Za-z]+\.vue)"\)[^}]*?roles:\s*\[([^\]]*)\][^}]*?title:\s*"([^"]+)"/g;
let m;
while ((m = routeRe.exec(routerSrc)) !== null) {
  routes.push({ path: m[1], component: m[2], roles: m[3].split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean), title: m[4] });
}

// ── 2. 原型规格映射（按组件路径） ──
const proto = JSON.parse(fs.readFileSync(PROTO, "utf8"));
const protoByComponent = {};
for (const [k, s] of Object.entries(proto)) {
  for (const p of s.lv2 || []) {
    if (p.c) protoByComponent[p.c] = { sector: k, key: p.k, name: p.n, type: p.t, api: p.a || "" };
  }
}

// ── 3. 后端前缀（对账基准） ──
const prefixes = fs.readFileSync(PREFIXES, "utf8").split("\n").map(s => s.trim()).filter(Boolean);

// ── 4. api 模块调用路径索引（含桶文件具名导出解析） ──
const apiDir = path.join(SRC, "api");
const apiCallsByModule = {};
const nameToModule = {};
for (const f of fs.readdirSync(apiDir).filter(x => x.endsWith(".ts") && x !== "request.ts")) {
  const src = fs.readFileSync(path.join(apiDir, f), "utf8");
  const calls = [...src.matchAll(/api\.(get|post|put|delete|patch)(?:<[^>]*>)?\(\s*[`"'](\/[^`"']*)/g)].map(x => x[2]);
  apiCallsByModule[f] = [...new Set(calls)];
  for (const nm of src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g)) {
    nameToModule[nm[1]] = f;
  }
}
// 桶文件：src/api.ts / src/api/index.ts
function resolveApiPaths(vueSrc) {
  const named = new Set();
  for (const im of vueSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*?api(?:\.ts|\/index\.ts)?["']/g)) {
    for (const part of im[1].split(",")) {
      const nm = part.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z0-9_]+$/.test(nm) && nm !== "api") named.add(nm);
    }
  }
  const mods = new Set();
  const paths = new Set();
  for (const nm of named) {
    const mod = nameToModule[nm];
    if (mod) {
      mods.add(mod);
      for (const c of apiCallsByModule[mod] || []) paths.add(`/api${c}`);
    } else if (/^(get|post|put|delete|patch)$/i.test(nm)) {
      mods.add("request.ts（直呼）");
    }
  }
  const inline = [...vueSrc.matchAll(/["'`](\/api\/[a-z0-9\-\/:${}]+)["'`]/g)].map(x => x[1]);
  for (const i of inline) paths.add(i);
  // 页内直呼 api.get("/admin/...") 形态：相对 baseURL=/api，规范化为 /api/...
  for (const c of vueSrc.matchAll(/api\.(?:get|post|put|delete|patch)(?:<[^>]*>)?\(\s*[`"'](\/[^`"']*)/g)) {
    const p = c[1];
    if (p.startsWith("/api/")) paths.add(p); else paths.add(`/api${p}`);
  }
  return { importedNames: [...named], modules: [...mods], apiPaths: [...paths].sort() };
}
function checkContract(apiPaths) {
  const hits = [], misses = [];
  for (const p of apiPaths) {
    const clean = p.split("?")[0];
    const cand = prefixes.find(pf => clean === pf || clean.startsWith(pf + "/") || clean.startsWith(pf + "?"));
    if (cand) hits.push(clean); else misses.push(clean);
  }
  return { hits, misses };
}

const archive = [];
for (const r of routes) {
  const abs = path.join(SRC, "views", r.component);
  const vueSrc = fs.readFileSync(abs, "utf8");
  const { modules, apiPaths, importedNames } = resolveApiPaths(vueSrc);
  const contract = checkContract(apiPaths);
  const states = {
    loading: /v-loading/.test(vueSrc),
    loadingRef: /:[a-z]*loading|Loading\.value\s*=\s*(true|false)|loading\s*=\s*ref/i.test(vueSrc),
    emptyExplicit: /el-empty|empty-text|暂无数据|暂无/.test(vueSrc),
    errorHandling: /ElMessage\.error|ElNotification|catch\s*\(/.test(vueSrc),
    timeoutRecovery: /刷新|重新加载|retry|重试/.test(vueSrc),
  };
  const structure = {
    hasTable: /<el-table/.test(vueSrc) || /<DataTable/.test(vueSrc),
    overflowFixedCols: /fixed="(left|right)"|fixed/.test(vueSrc),
    detailLayer: /el-dialog|el-drawer/.test(vueSrc),
    formLayer: /el-form/.test(vueSrc),
    pagination: /el-pagination/.test(vueSrc) || /<DataTable[^>]*:total/.test(vueSrc.replace(/\n/g, " ")),
  };
  archive.push({
    domain: r.component.split("/")[0],
    route: r.path, title: r.title, roles: r.roles,
    component: `views/${r.component}`,
    prototype: protoByComponent[`views/${r.component}`] || null,
    apiModules: modules, apiPaths, importedNames,
    apiContract: contract,
    states, structure,
    lineCount: vueSrc.split("\n").length,
  });
}

const summary = {
  totalRoutes: archive.length,
  byDomain: DOMAINS.reduce((acc, d) => ({ ...acc, [d]: archive.filter(p => p.domain === d).length }), {}),
  prototypeAligned: archive.filter(p => p.prototype).length,
  apiWired: archive.filter(p => p.apiPaths.length > 0).length,
  honestUnavailable: archive.filter(p => p.apiPaths.length === 0 && p.states.emptyExplicit).length,
  contractMisses: archive.filter(p => p.apiContract.misses.length > 0).map(p => ({ page: p.component, misses: p.apiContract.misses })),
  statesGaps: archive.filter(p => !p.states.loadingRef && !p.states.loading).map(p => p.component),
};

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), summary, archive }, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
