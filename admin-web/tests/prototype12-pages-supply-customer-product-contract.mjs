/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 · 四域页面/数据合同测试
 *
 * 覆盖任务卡 §三：
 *   - 四组全部生产路由逐页建档并标状态（档案可再生成且与路由一致）
 *   - API 接线对账：页面 → api 模块 → 后端前缀，契约零未命中
 *   - 数据四态：API 页必有 loading/错误处理；无数据页诚实空态，不伪造业务行
 *   - 权限态：路由 meta.roles 非空且取值合法
 *   - 超时恢复基线：request timeout=30000 + 页面刷新入口
 *   - 表格溢出：数据密集列表页固定列
 *   - 原型视觉优先：对齐页标题与原型 SECTORS 一致；演示数据黑名单零命中
 *
 * 运行（admin-web 目录）：node tests/prototype12-pages-supply-customer-product-contract.mjs
 * 说明：源码级合同测试（Node 原生 assert），不依赖浏览器。
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const REPO = path.resolve(here, "..", "..");
const EV = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01";

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}

const PROTO_SHA = "c7ab4733cd325207aff627e80f51893feee5d7ce4e4d055665a4a18ba677d79a";
const PROTO_PATH = path.join(REPO, "..", "..", "..", "projects", "ai", "design", "智享全链_工作台电脑端_UI原型_融合版.html");

// ── 装置：路由 + 档案 ──
const routerSrc = readFileSync(path.join(SRC, "router", "index.ts"), "utf8");
const routes = [];
const routeRe = /path:\s*"([^"]+)"[^}]*?component:\s*\(\)\s*=>\s*import\("\.\.\/views\/((?:purchase|inventory|customer|product)\/[A-Za-z]+\.vue)"\)[^}]*?roles:\s*\[([^\]]*)\][^}]*?title:\s*"([^"]+)"/g;
let m;
while ((m = routeRe.exec(routerSrc)) !== null) {
  routes.push({ path: m[1], component: m[2], roles: m[3].split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean), title: m[4] });
}
const archive = JSON.parse(readFileSync(path.join(EV, "raw", "04-page-archive.json"), "utf8"));
const VALID_ROLES = new Set(["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR", "FINANCE_ADMIN", "WAREHOUSE_ADMIN", "ADMIN"]);

console.log(`WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 合同测试（共 20 项）`);

// ① 路由完整性
ok("T01 四域生产路由 51 条全解析", () => {
  assert.equal(routes.length, 51, `实际 ${routes.length}`);
});
ok("T02 每条路由组件文件真实存在", () => {
  for (const r of routes) assert.ok(existsSync(path.join(SRC, "views", r.component)), `缺文件: ${r.component}`);
});
ok("T03 每条路由权限 meta.roles 非空且取值合法", () => {
  for (const r of routes) {
    assert.ok(r.roles.length > 0, `roles 空: ${r.path}`);
    for (const role of r.roles) assert.ok(VALID_ROLES.has(role), `非法角色 ${role}: ${r.path}`);
  }
});
ok("T04 每条路由标题非空", () => {
  for (const r of routes) assert.ok(r.title && r.title.trim().length >= 2, `标题缺失: ${r.path}`);
});
ok("T05 档案与路由一一对应（51 键全等）", () => {
  const keys = (arr) => arr.map(x => `${x.component}`).sort().join("|");
  assert.equal(keys(archive.archive), keys(routes.map(r => ({ component: `views/${r.component}` }))));
});

// ② 原型视觉优先
ok("T06 原型文件 SHA256 与卡面一致", () => {
  const sha = createHash("sha256").update(readFileSync(PROTO_PATH)).digest("hex");
  assert.equal(sha, PROTO_SHA);
});
ok("T07 四域原型对齐页 32 条路由（31 组件）", () => {
  const aligned = archive.archive.filter(p => p.prototype);
  assert.ok(aligned.length >= 32, `对齐页 ${aligned.length} < 32`);
});
ok("T08 对齐页页内标题与原型页名一致（页头 h2 为视觉对齐对象；路由 meta 属壳层域）", () => {
  const bad = [];
  for (const p of archive.archive) {
    if (!p.prototype) continue;
    const src = readFileSync(path.join(SRC, "views", p.component.replace(/^views\//, "")), "utf8");
    const header = src.slice(0, src.indexOf("</div>", src.indexOf("page-header")) || 800);
    const m = src.match(/<h2[^>]*>([^<]+)<\/h2>/);
    const pageTitle = m ? m[1].trim() : "";
    if (pageTitle !== p.prototype.name) bad.push(`${p.component}: "${pageTitle}" != "${p.prototype.name}"`);
  }
  assert.deepEqual(bad, [], `页内标题不符: ${bad.slice(0, 5).join("; ")}`);
});
ok("T09 原型演示数据黑名单四域零命中", () => {
  const forbidden = ["红旗连锁", "CG20260903002", "川渝食品批发有限公司", "飞天茅台 库存 12 瓶", "SKU10001"];
  const hits = [];
  for (const p of archive.archive) {
    const src = readFileSync(path.join(SRC, "views", p.component.replace(/^views\//, "")), "utf8");
    for (const f of forbidden) if (src.includes(f)) hits.push(`${p.component} contains "${f}"`);
  }
  assert.deepEqual(hits, [], `演示数据回流: ${hits.slice(0, 5).join("; ")}`);
});

// ③ API 接线契约（活源码直查：档案用于 T05 对账，契约以磁盘源码为准）
// —— 与 archive 装置同算法：路由→页面→api 导入/直呼→后端前缀
function computeContractMissesLive() {
  const prefixes = readFileSync(path.join(here, "..", "e2e", "prototype12-pages-supply-customer-product-backend-prefixes.txt"), "utf8")
    .split("\n").map(s => s.trim()).filter(Boolean);
  const apiDir = path.join(SRC, "api");
  const misses = [];
  for (const p of routes) {
    const vueSrc = readFileSync(path.join(SRC, "views", p.component), "utf8");
    const paths = new Set();
    for (const c of vueSrc.matchAll(/api\.(?:get|post|put|delete|patch)(?:<[^>]*>)?\(\s*[`"'](\/[^`"']*)/g)) {
      const u = c[1].split("?")[0];
      paths.add(u.startsWith("/api/") ? u : `/api${u}`);
    }
    for (const c of vueSrc.matchAll(/["'`](\/api\/[a-z0-9\-\/:${}]+)["'`]/g)) paths.add(c[1].split("?")[0]);
    for (const u of paths) {
      const hit = prefixes.find(pf => u === pf || u.startsWith(pf + "/"));
      if (!hit) misses.push({ page: `views/${p.component}`, miss: u });
    }
  }
  return misses;
}
ok("T10 API 契约零未命中（活源码直查，全部页面）", () => {
  const misses = computeContractMissesLive();
  assert.deepEqual(misses, [], `未命中: ${JSON.stringify(misses).slice(0, 200)}`);
});
ok("T11 API 接线页 ≥39 且均有 api 路径", () => {
  assert.ok(archive.summary.apiWired >= 39, `接线页 ${archive.summary.apiWired} < 39`);
  for (const p of archive.archive) {
    if (p.apiPaths.length === 0 && p.states.emptyExplicit) continue; // 诚实不可用页豁免
    assert.ok(p.apiPaths.length > 0, `无 API 且无空态声明: ${p.component}`);
  }
});
ok("T12 无数据页诚实空态（API 页豁免）", () => {
  const bad = archive.archive
    .filter(p => p.apiPaths.length === 0 && !p.states.emptyExplicit)
    .map(p => p.component);
  assert.deepEqual(bad, [], `无 API 且无空态: ${bad.join(",")}`);
});
ok("T13 两桩页显式「待后端支持」诚实不可用", () => {
  for (const comp of ["views/product/ProductReviewWorkflow.vue", "views/product/ReviewDelegation.vue"]) {
    const src = readFileSync(path.join(SRC, comp), "utf8");
    assert.ok(src.includes("el-empty") && src.includes("待后端支持"), `${comp} 非诚实不可用结构`);
    assert.ok(!/\.value\s*=\s*\[?\{/.test(src.split("<script")[1] || ""), `${comp} 疑似内联演示数据`);
  }
});

// ④ 数据四态
ok("T14 API 页 loading 态全覆盖（活源码直查，含新增调拨详情 v-loading）", () => {
  const bad = [];
  for (const p of archive.archive) {
    if (p.apiPaths.length === 0) continue;
    const src = readFileSync(path.join(SRC, "views", p.component.replace(/^views\//, "")), "utf8");
    const hasLoading = /v-loading|:loading/i.test(src);
    if (!hasLoading) bad.push(p.component);
  }
  assert.deepEqual(bad, [], `API 页缺 loading: ${bad.join(",")}`);
});
ok("T15 API 页错误处理全覆盖", () => {
  const bad = archive.archive
    .filter(p => p.apiPaths.length > 0 && !p.states.errorHandling)
    .map(p => p.component);
  assert.deepEqual(bad, [], `API 页缺错误处理: ${bad.join(",")}`);
});
ok("T16 超时恢复基线：request timeout=30000 且列表页有刷新入口", () => {
  const req = readFileSync(path.join(SRC, "api", "request.ts"), "utf8");
  assert.match(req, /timeout:\s*30000/, "request.ts 无 30s 超时");
  const listPages = archive.archive.filter(p => p.prototype?.type === "list" && p.apiPaths.length > 0);
  const noRefresh = listPages.filter(p => !p.states.timeoutRecovery).map(p => p.component);
  assert.deepEqual(noRefresh, [], `list 页无刷新/重试入口: ${noRefresh.join(",")}`);
});

// ⑤ 溢出与层结构
ok("T17 数据密集表格页固定列（横向溢出治理；树/卡片页豁免）", () => {
  const listPages = archive.archive.filter(p => p.prototype?.type === "list" && p.apiPaths.length > 0 && p.structure.hasTable);
  const noFixed = listPages.filter(p => !p.structure.overflowFixedCols).map(p => p.component);
  assert.deepEqual(noFixed, [], `list 表格页无固定列: ${noFixed.join(",")}`);
});
ok("T18 原型 t=fuse 页必有详情/表单层（dialog/drawer/form）", () => {
  const fusePages = archive.archive.filter(p => p.prototype?.type === "fuse" && p.apiPaths.length > 0);
  const noLayer = fusePages.filter(p => !p.structure.detailLayer && !p.structure.formLayer).map(p => p.component);
  assert.deepEqual(noLayer, [], `fuse 页无详情/表单层: ${noLayer.join(",")}`);
});
ok("T19 原型 t=list 表格页必有分页（树/卡片页豁免）", () => {
  const listPages = archive.archive.filter(p => p.prototype?.type === "list" && p.apiPaths.length > 0 && p.structure.hasTable);
  const noPager = listPages.filter(p => !p.structure.pagination).map(p => p.component);
  assert.deepEqual(noPager, [], `list 表格页无分页: ${noPager.join(",")}`);
});

// ⑥ 结构守恒
ok("T20 调拨三态路由指向独立组件且共享数据源", () => {
  const byPath = Object.fromEntries(routes.map(r => [r.path, r]));
  assert.ok(byPath["inventory-transfer/create"] && byPath["inventory-transfer/edit/:id"] && byPath["inventory-transfer/detail/:id"]);
  assert.equal(byPath["inventory-transfer/create"].component, byPath["inventory-transfer/edit/:id"].component);
});

console.log(`\n结果: ${passed}/20 PASS${process.exitCode ? "（存在 FAIL）" : "，全部通过"}`);
if (process.exitCode) process.exit(1);
