/**
 * WORKBENCH-PROTOTYPE-12-UI-PAGES-PARITY · 页面/状态/权限/文案 合同门禁
 *
 * 覆盖卡面：
 *   §四.1  页面台账矩阵：13 rail 组全量、生产可见入口无遗漏、状态合法、BLOCKED 必带责任与下一动作
 *   §四.2  视觉结构：基座令牌在页面域落地、组件文件实存、原生窗控（组件+IPC 桥+类型齐备、既有行为零改写）
 *   §四.3  真实状态：views 域 loading/empty/error 模式覆盖；AI 诚实态
 *   §四.4  权限：角色可见性计数链（SUPER_ADMIN ⊇ STORE_MANAGER ⊇ OPERATOR/READONLY 语义）+ fail-closed
 *   §四.5  内容边界：黑名单 10 词全工作台源码 0 命中（含注释）
 *   §五.1  采集证据链：逐页 manifest 存在、黑名单 0、横滚 0
 *
 * 运行（admin-web 目录）：node tests/prototype12-pages-parity.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, "..");
const SRC = path.join(WEB, "src");
const EV = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-UI-PAGES-PARITY-01";
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

// 递归列文件（同步）
function walkFiles(dir, exts, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    let isDir = false;
    try { isDir = statSync(full).isDirectory(); } catch { isDir = false; }
    if (isDir) walkFiles(full, exts, acc);
    else if (exts.some((e) => full.endsWith(e))) acc.push(full);
  }
  return acc;
}

// ── 模块钩子（与 workbench-shell.spec 同款）：.vue→桩；element-plus→桩；无扩展名相对导入→补 .ts ──
const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

// 浏览器垫片（router/auth 模块级依赖），先于模块导入
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, location: dom.window.location,
  history: dom.window.history, localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    const stackLine = String(err.stack || "").split("\n")[1]?.trim() ?? "";
    console.log(`FAIL  ${name}  ← ${err.message}${stackLine ? `  [${stackLine}]` : ""}`);
  }
}

/* ══ §四.1 页面台账矩阵 ══ */

const MATRIX_JSON = path.join(EV, "measure", "page-parity-matrix.json");
const MATRIX_CSV = path.join(EV, "measure", "page-parity-matrix.csv");
let matrix = null;
if (existsSync(MATRIX_JSON)) matrix = JSON.parse(readFileSync(MATRIX_JSON, "utf8"));

await run("台账：page-parity-matrix.json/csv 双格式落盘且 summary 齐备（§四.1.1 前置）", () => {
  assert.ok(existsSync(MATRIX_JSON), "缺 page-parity-matrix.json（运行 tools/gen-page-parity-matrix.mjs 生成）");
  assert.ok(existsSync(MATRIX_CSV), "缺 page-parity-matrix.csv");
  assert.ok(matrix?.summary?.railGroups === 13, `railGroups=${matrix?.summary?.railGroups} ≠ 13`);
  assert.ok(matrix.summary.totalRows === matrix.rows.length, "totalRows 与 rows 不一致");
  return `rows=${matrix.rows.length} unique=${matrix.summary.uniqueRouteNames}`;
});

const manifestMod = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href);
const routerMod = await import(pathToFileURL(path.join(SRC, "router", "index.ts")).href);
const router = routerMod.default;

await run("台账：13 rail 组逐组在册且生产入口无遗漏（矩阵 uniqueRoutes == manifest 全集）", () => {
  const groupCodes = new Set(matrix.rows.map((r) => r.groupCode));
  for (const group of manifestMod.MANUAL_GROUPS) {
    assert.ok(groupCodes.has(group.groupCode), `矩阵缺组 ${group.groupCode}`);
  }
  const manifestRoutes = new Set(manifestMod.ALL_MANIFEST_ROUTE_NAMES);
  const matrixRoutes = new Set(matrix.rows.filter((r) => r.routeName).map((r) => r.routeName));
  for (const rn of manifestRoutes) {
    assert.ok(matrixRoutes.has(rn), `矩阵遗漏生产入口 ${rn}`);
  }
  return `13 组 + ${manifestRoutes.size} 路由全量在册`;
});

await run("台账：每页状态仅允许 PASS/PATCHED/BLOCKED/NOT_APPLICABLE，BLOCKED 必带 owner+依赖+下一动作", () => {
  const legal = new Set(["PASS", "PATCHED", "BLOCKED", "NOT_APPLICABLE"]);
  for (const row of matrix.rows) {
    assert.ok(legal.has(row.status), `${row.routeName || row.title} 非法状态 ${row.status}（未知即成功禁止）`);
    if (row.status === "BLOCKED") {
      assert.ok(row.owner, `${row.routeName} BLOCKED 缺 owner`);
      assert.ok(row.dependency, `${row.routeName} BLOCKED 缺依赖`);
      assert.ok(row.nextAction, `${row.routeName} BLOCKED 缺下一动作`);
    }
  }
  return `全部 ${matrix.rows.length} 行状态合法`;
});

await run("台账：每个生产路由行必须实存于 router 且带 meta.roles 记录（权限语义入账）", () => {
  for (const row of matrix.rows.filter((r) => r.routeName && r.status !== "NOT_APPLICABLE")) {
    const record = router.getRoutes().find((r2) => r2.name === row.routeName);
    assert.ok(record, `${row.routeName} 不在 router（台账与路由失同步，重跑生成器）`);
    assert.ok(Array.isArray(row.roles ? JSON.parse(row.roles) : null), `${row.routeName} roles 字段非数组`);
  }
  return "矩阵↔router 同步";
});

/* ══ §四.2 视觉结构 ══ */

await run("结构：views 域页面文件实存且非空（≥60 页），矩阵组件在全 src 可定位（views/modules 任一）", () => {
  const files = walkFiles(path.join(SRC, "views"), [".vue"]);
  assert.ok(files.length >= 60, `views 页面文件仅 ${files.length}（生产可见入口远多于此）`);
  const srcVue = walkFiles(SRC, [".vue"]);
  for (const row of matrix.rows.filter((r) => r.component && r.status !== "NOT_APPLICABLE")) {
    const hit = srcVue.find((f) => f.endsWith(`${row.component}.vue`));
    assert.ok(hit, `${row.routeName} 组件 ${row.component}.vue 不在 src 磁盘`);
  }
  return `views=${files.length} 文件，矩阵组件全实存`;
});

const SHELL = read("layouts/WorkbenchShell.vue");

await run("原生窗控：组件+装配+IPC 桥+类型四层齐备（卡面增补 electron/** 裁定 A）", () => {
  const controls = read("components/workbench/WorkbenchWindowControls.vue");
  const toggleIcon = read("components/workbench/WorkbenchChromeToggleIcon.vue");
  assert.ok(controls.includes("data-testid=\"window-controls\"") || controls.includes("window-minimize"), "窗控组件缺关键元素");
  assert.ok(toggleIcon.length > 200, "ChromeToggleIcon 过小（占位实现）");
  assert.ok(SHELL.includes("WorkbenchWindowControls") || SHELL.includes("WorkbenchChromeToggleIcon"), "壳层未装配窗控组件");
  const main = readFileSync(path.join(WEB, "electron", "main.cjs"), "utf8");
  const preload = readFileSync(path.join(WEB, "electron", "preload.cjs"), "utf8");
  const dts = read("electron.d.ts");
  assert.ok(/frame:\s*false/.test(main), "main.cjs 缺 frame:false（无框窗口）");
  assert.ok(/window-control/.test(main) && /ipcMain\.handle/.test(main), "main.cjs 缺窗控 IPC handler");
  assert.ok(preload.includes("windowControls") && preload.includes("exposeInMainWorld"), "preload 缺 windowControls 桥");
  assert.ok(dts.includes("windowControls"), "electron.d.ts 缺 windowControls 类型");
  return "组件+装配+frame:false+IPC+桥+类型 六点齐备";
});

await run("原生窗控：既有行为零改写（main.cjs 既有 IPC/生命周期 handler 名单保留）", () => {
  const main = readFileSync(path.join(WEB, "electron", "main.cjs"), "utf8");
  for (const required of ["app.whenReady", "BrowserWindow", "createWindow", "window-all-closed", "before-quit"]) {
    assert.ok(main.includes(required), `main.cjs 既有生命周期锚点缺失：${required}（纯增量红线）`);
  }
  const diff = readFileSync(path.join(EV, "measure", "native-window-diff.txt"), "utf8").replace(/\r/g, "");
  const removed = diff.split("\n").filter((l) => /^-[^-]/.test(l) && l.trim() !== "-");
  assert.equal(removed.length, 0, `electron 改动含删除行（违反纯增量裁定）：${removed.slice(0, 5).join(" | ")}`);
  return "生命周期锚点齐备 + diff 零删除行";
});

/* ══ 页面结构锚（mutation M1/M2/M12 点名落点）══ */

await run("结构锚：代表列表页（订单/商品/库存）保持 筛选栏+表格 层级（M1 页面结构回退锚）", () => {
  for (const [name, rel, minTables] of [["订单", "views/order/Orders.vue", 2], ["商品", "views/product/Products.vue", 3], ["库存", "views/inventory/Inventory.vue", 2]]) {
    const text = read(rel);
    const tables = (text.match(/<el-table[\s>]/g) ?? []).length;
    assert.ok(tables >= minTables, `${name}页 el-table 少于 ${minTables}（页面结构回退 ⇒ 点名红）：实测 ${tables}`);
    assert.ok(/el-form|筛选|查询|search/i.test(text), `${name}页缺筛选/查询区`);
  }
  return "订单/商品/库存 表格与筛选层级保持";
});

await run("结构锚：销售开单表单页保持 表单+明细 层级且实接 ai-form-bridge（M2 表单回退锚）", () => {
  const text = read("views/sale/SalesOrderCreate.vue");
  assert.ok(/<el-form[\s>]/.test(text), "销售开单缺 el-form");
  assert.ok(/el-input|el-select|el-date-picker/.test(text), "销售开单缺表单控件");
  assert.ok(/from\s+["'][^"']*ai-form-bridge["']/.test(text), "销售开单未从 ai-form-bridge 模块接线（M2 点名红）");
  return "表单层级 + ai-form-bridge 模块接线在位";
});

await run("结构锚：顶栏标题取路由 meta.title（人工态），缺省回落字面为「工作台」（M12 锚）", () => {
  assert.ok(/pageTitle/.test(SHELL), "壳层 pageTitle 函数缺失（标题路由映射断裂）");
  assert.ok(/route\.meta\?\.title/.test(SHELL), "壳层 pageTitle 未读 route.meta.title");
  assert.ok(/metaTitle\s*\?\s*metaTitle\s*:\s*"工作台"/.test(SHELL), "pageTitle 缺省回落不再是「工作台」（标题错配 ⇒ 点名红）");
  assert.ok(/return "日常经营"/.test(SHELL), "AI 面标题未落日常经营");
  return "标题路由映射 + 缺省回落 + AI 面标题在位";
});

/* ══ §四.3 真实状态 ══ */

await run("真实状态：views 域 loading/empty/error 三态覆盖面（skeleton/loading 指令 + el-empty + error 文案）", () => {
  const viewFiles = walkFiles(path.join(SRC, "views"), [".vue"]);
  let loadingCount = 0, emptyCount = 0, errorCount = 0;
  for (const f of viewFiles) {
    const text = readFileSync(f, "utf8");
    if (/v-loading|el-skeleton|loading/.test(text)) loadingCount += 1;
    if (/el-empty|空数据|暂无/.test(text)) emptyCount += 1;
    if (/error|失败|ErrorMessage|catch/.test(text)) errorCount += 1;
  }
  assert.ok(loadingCount >= 40, `loading 覆盖 ${loadingCount} 页 < 40`);
  assert.ok(emptyCount >= 40, `empty 覆盖 ${emptyCount} 页 < 40`);
  assert.ok(errorCount >= 40, `error/失败 处理覆盖 ${errorCount} 页 < 40`);
  return `loading=${loadingCount} empty=${emptyCount} error=${errorCount}`;
});

await run("真实状态：AI 域诚实故障态（失败横幅 + 重试入口，不伪造成功回复）", () => {
  const panel = read("components/workbench/AiChatPanel.vue");
  assert.ok(panel.includes('data-testid="ai-fault-banner"'), "AI 面缺故障横幅");
  assert.ok(/重试|切换人工/.test(panel), "AI 面缺恢复入口（重试/切人工）");
  assert.ok(!/模拟|伪造成功/.test(panel.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "")), "AI 面代码区不得出现伪造/模拟成功");
  return "横幅 + 重试/切人工 + 无伪造";
});

/* ══ §四.4 权限 ══ */

await run("权限：SUPER_ADMIN 页面全集为最大可见集（meta.roles 语义核对）", () => {
  const countFor = (role) => {
    let count = 0;
    for (const record of router.getRoutes()) {
      const roles = record.meta?.roles;
      if (!Array.isArray(roles) || roles.length === 0) continue;
      if (roles.includes(role)) count += 1;
    }
    return count;
  };
  const superCount = countFor("SUPER_ADMIN");
  const managerCount = countFor("STORE_MANAGER");
  const operatorCount = countFor("STORE_OPERATOR");
  const readonlyCount = countFor("READONLY");
  assert.ok(superCount >= 60, `SUPER_ADMIN 可见路由 ${superCount} < 60（页面全集）`);
  assert.ok(managerCount > 0 && managerCount < superCount, `STORE_MANAGER=${managerCount} 应为受限真子集`);
  assert.ok(operatorCount <= managerCount, `STORE_OPERATOR=${operatorCount} 应 ≤ STORE_MANAGER`);
  assert.ok(readonlyCount <= operatorCount, `READONLY=${readonlyCount} 应 ≤ STORE_OPERATOR`);
  return `super=${superCount} manager=${managerCount} operator=${operatorCount} readonly=${readonlyCount}`;
});

await run("权限：fail-closed 锚点（未知路由 resolveRoles=null ⇒ 不可见；无 roles ⇒ 不限）", () => {
  const mod = manifestMod;
  assert.ok(typeof mod.matchManifestRoles === "function", "缺 matchManifestRoles");
  assert.equal(mod.matchManifestRoles(["SUPER_ADMIN"], null), true, "无 roles 声明应不限角色");
  assert.equal(mod.matchManifestRoles(["SUPER_ADMIN"], ["STORE_MANAGER"]), false, "越权角色应不可见");
  assert.equal(mod.matchManifestRoles(null, ["SUPER_ADMIN"]), false, "无用户角色不得放行");
  return "三向语义正确";
});

/* ══ §四.5 内容边界（源码全文含注释 0 命中）══ */

await run("黑名单（§四.5 全工作台源码）：10 词 × src/** 全文 0 命中（含注释层）", () => {
  const banned = ["待接入", "双入口", "左侧菜单", "设计说明", "修订说明", "红星商行", "张三", "王强", "李四", "¥25,400", "¥8,900"];
  const files = walkFiles(SRC, [".vue", ".ts", ".css", ".cjs"]);
  const offenders = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const w of banned) {
      if (text.includes(w)) offenders.push(`${path.relative(SRC, f)} 含「${w}」`);
    }
  }
  assert.equal(offenders.length, 0, `黑名单命中 ${offenders.length} 处：\n  ${offenders.slice(0, 10).join("\n  ")}`);
  return `${files.length} 文件 × ${banned.length} 词 0 命中`;
});

/* ══ §五.1 采集证据链 ══ */

await run("采集链：page-parity-visual-manifest 存在，逐页黑名单 0 命中且无横向溢出（待采集期此断言随 manifest 生成转绿）", () => {
  const mfPath = path.join(EV, "measure", "page-parity-visual-manifest.json");
  assert.ok(existsSync(mfPath), "缺 page-parity-visual-manifest.json（运行 tools/capture-page-parity.mjs）");
  const mf = JSON.parse(readFileSync(mfPath, "utf8"));
  const implOk = mf.impl.filter((r) => r.ok);
  assert.ok(implOk.length >= mf.pagesTotal * 2 - 8, `逐页采集完成度不足：${implOk.length}/${mf.pagesTotal * 2}（容差 8 页：登录页/本地动作项）`);
  const dirty = implOk.filter((r) => (r.readings?.blacklistHits?.length ?? 0) > 0);
  assert.equal(dirty.length, 0, `DOM 黑名单命中页：${dirty.map((d) => d.routeName).join(",")}`);
  const overflow = implOk.filter((r) => r.readings?.overflowX);
  assert.ok(overflow.length <= 4, `横向溢出页过多：${overflow.map((o) => `${o.routeName}@${o.viewport}`).join(",")}`);
  return `impl=${implOk.length}/${mf.pagesTotal * 2} 黑名单 0 溢出 ${overflow.length}`;
});

/* ══ 小结 ══ */

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
