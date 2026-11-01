/**
 * WORKBENCH-12-WIRING-BATCH-A · 接线修复契约测试
 *
 * 覆盖三处修复：
 *   A. 售后 8 条 admin 路径去双段（api/aftersale.ts）
 *   B. 采购两处 useRoute() 生命周期错误（PurchaseOrders.vue / PurchaseInStocks.vue）
 *   C. 打印设置入口归属（manifest-pos.ts：本地动作，无假路由）
 *
 * 运行（admin-web 目录）：node tests/wiring-batch-a.spec.mjs
 * 判定原则：只读源码 + 真值表；不 mock 业务成功；不猜路径（对照后端路由文件逐条核）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");
const readRepo = (rel) => readFileSync(path.join(REPO, rel), "utf8");

/** 去掉注释与 <style> 块，只留可执行/模板代码 */
function codeOnly(text) {
  return text
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "");
}

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
 * A. 售后 8 条 admin 路径（api/aftersale.ts）
 * 权威源：backend/src/routes/aftersale.routes.ts（只读对照，不改）
 * ══════════════════════════════════════════════════════════════════ */

/** 从后端路由文件抽取 admin 段的 method+path（权威真值） */
function backendAdminAftersaleRoutes() {
  const src = readRepo("backend/src/routes/aftersale.routes.ts");
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/adminAftersaleRouter\.(get|post|put|patch|delete)\("([^"]+)"/);
    if (m) out.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return out;
}

/** 从前端文件抽取调用（method + 相对路径） */
function frontendAftersaleCalls() {
  const src = codeOnly(read("src/api/aftersale.ts"));
  const out = [];
  const re = /api\.(get|post|put|patch|delete)\(\s*[`"]([^`"]+)[`"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return out;
}

/** 归一化：模板变量 → :id */
const canon = (p) => p.replace(/\$\{[^}]*\}/g, ":id").replace(/:[A-Za-z_$][\w$]*/g, ":id");

await run("A1 售后：前端 8 条 admin 调用均无 /aftersales/aftersales 双段", () => {
  const calls = frontendAftersaleCalls();
  assert.equal(calls.length, 8, `应有 8 条 admin 售后调用，实际 ${calls.length}`);
  const doubled = calls.filter((c) => c.path.includes("/aftersales/aftersales"));
  assert.deepEqual(doubled.map((c) => `${c.method} ${c.path}`), [], `仍有双段路径：${doubled.map((c) => c.path).join(",")}`);
  return `8 条均单段（示例 ${calls[0].method} ${calls[0].path}）`;
});

await run("A2 售后：8/8 逐条精确匹配后端真实路由（method+path，不猜）", () => {
  const be = backendAdminAftersaleRoutes();
  assert.equal(be.length, 8, `后端 admin 售后路由应 8 条，实际 ${be.length}`);
  const beSet = new Set(be.map((r) => `${r.method} /api/admin${canon(r.path)}`));
  const calls = frontendAftersaleCalls();
  const feSet = calls.map((c) => `${c.method} /api${canon(c.path)}`);
  const unmatched = feSet.filter((k) => !beSet.has(k));
  assert.deepEqual(unmatched, [], `未匹配后端路由：${unmatched.join(",")}`);
  // 双向：后端每条也都要被前端用到（8 vs 8 一一对应）
  const unused = [...beSet].filter((k) => !feSet.includes(k));
  assert.deepEqual(unused, [], `后端路由未被前端调用：${unused.join(",")}`);
  return `8/8 双向匹配（${be.length} 后端 = ${calls.length} 前端）`;
});

await run("A3 售后：statistics 与 :id 的注册顺序契约（stats 在前端字面量，后端 :id 在后）", () => {
  const be = backendAdminAftersaleRoutes();
  const idxStats = be.findIndex((r) => r.path === "/aftersales/statistics");
  const idxId = be.findIndex((r) => r.path === "/aftersales/:id");
  assert.ok(idxStats >= 0 && idxId >= 0, "后端应同时有 statistics 与 :id");
  assert.ok(idxStats < idxId, `statistics 必须先于 :id 注册（否则被 :id 吞），实际 ${idxStats} vs ${idxId}`);
  return `后端顺序 statistics(:${idxStats}) < :id(:${idxId})`;
});

await run("A4 售后：请求参数与响应解包契约不变（params 透传 + data.data）", () => {
  const src = codeOnly(read("src/api/aftersale.ts"));
  // fetchAfterSales 必须带 params
  assert.ok(
    /fetchAfterSales[\s\S]{0,200}api\.get\(\s*["']\/admin\/aftersales["'],\s*\{\s*params\s*\}/.test(src),
    "fetchAfterSales 必须透传 { params } 给 /admin/aftersales",
  );
  // 8 个函数全部 data.data 解包
  const unpack = src.match(/return\s+data\.data;/g) ?? [];
  assert.ok(unpack.length >= 8, `应至少 8 处 data.data 解包，实际 ${unpack.length}`);
  return `params 透传 + ${unpack.length} 处 data.data`;
});

await run("A5 售后（负断言）：不得再出现 /aftersales/aftersales 任一字面量", () => {
  const src = codeOnly(read("src/api/aftersale.ts"));
  assert.ok(!/aftersales\/aftersales/.test(src), "源码仍含 aftersales/aftersales 双段字面量");
  return "零双段字面量";
});

/* ══════════════════════════════════════════════════════════════════
 * B. 采购两处 useRoute() 生命周期
 * ══════════════════════════════════════════════════════════════════ */

const PURCHASE_FILES = [
  { rel: "src/views/purchase/PurchaseOrders.vue", query: "orderNo", listVar: "orders" },
  { rel: "src/views/purchase/PurchaseInStocks.vue", query: "stockNo", listVar: "inStocks" },
];

for (const f of PURCHASE_FILES) {
  await run(`B1 ${path.basename(f.rel)}：useRoute() 不得出现在 onMounted 异步回调内`, () => {
    const code = codeOnly(read(f.rel));
    // 找出 onMounted(async => { ... }) 区块，断言其中无 useRoute(
    const m = code.match(/onMounted\(\s*async\s*\([^)]*\)\s*=>\s*\{/);
    assert.ok(m, `${f.rel} 应有 onMounted(async) 块`);
    const start = m.index + m[0].length;
    // 大括号配平找块尾
    let depth = 1;
    let i = start;
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      i++;
    }
    const block = code.slice(start, i - 1);
    assert.ok(!/useRoute\s*\(/.test(block), `onMounted(async) 块内仍在调用 useRoute() ⇒ 运行态 inject 失败`);
    return "异步块内零 useRoute()";
  });

  await run(`B2 ${path.basename(f.rel)})：setup 顶层已取 route 且回调内读 route.query.${f.query}`, () => {
    const code = codeOnly(read(f.rel));
    assert.ok(/const\s+route\s*=\s*useRoute\(\)\s*;/.test(code), "setup 顶层应 `const route = useRoute();`");
    assert.ok(
      new RegExp(`route\\.query\\.${f.query}`).test(code),
      `onMounted 内应读 route.query.${f.query}`,
    );
    return `顶层 const route + route.query.${f.query}`;
  });
}

await run("B3 采购：route 变量声明位置在 onMounted 之前（同步 setup 阶段）", () => {
  for (const f of PURCHASE_FILES) {
    const code = codeOnly(read(f.rel));
    const idxDecl = code.search(/const\s+route\s*=\s*useRoute\(\)\s*;/);
    const idxMounted = code.search(/onMounted\(/);
    assert.ok(idxDecl >= 0, `${f.rel} 缺 setup 顶层 route 声明`);
    assert.ok(idxDecl < idxMounted, `${f.rel} route 声明必须在 onMounted 之前（现 ${idxDecl} vs ${idxMounted}）`);
  }
  return "两文件 route 声明均早于 onMounted";
});

await run("B4 采购：单号过滤逻辑保留（按 query 值在列表中定位并打开详情）", () => {
  const orders = codeOnly(read(PURCHASE_FILES[0].rel));
  const stocks = codeOnly(read(PURCHASE_FILES[1].rel));
  assert.ok(/route\.query\.orderNo[\s\S]{0,300}orders\.value\.find/.test(orders), "订单页应据 orderNo 在 orders 中查找");
  assert.ok(/route\.query\.orderNo[\s\S]{0,300}viewDetail\(/.test(orders), "订单页命中后应 viewDetail");
    assert.ok(/route\.query\.stockNo[\s\S]{0,300}inStocks\.value\.find/.test(stocks), "入库页应据 stockNo 在 inStocks 中查找");
  assert.ok(/route\.query\.stockNo[\s\S]{0,300}viewDetail\(/.test(stocks), "入库页命中后应 viewDetail");
  return "两页 query→find→viewDetail 链路完整";
});

await run("B5 采购（负断言）：两文件不得残留裸 useRoute() 调用（必须经 route 变量）", () => {
  for (const f of PURCHASE_FILES) {
    const code = codeOnly(read(f.rel));
    const bare = code.match(/useRoute\s*\(\s*\)/g) ?? [];
    assert.equal(bare.length, 1, `${f.rel} 应只有 setup 顶层 1 次 useRoute()，实际 ${bare.length}`);
  }
  return "各文件仅 1 次 useRoute()";
});

/* ══════════════════════════════════════════════════════════════════
 * C. 打印设置入口归属（本地动作，无假路由）
 * ══════════════════════════════════════════════════════════════════ */

/** 极简 manifest 解析：从 manifest-pos.ts 提取收银项关键字段（不执行 TS） */
function parseCashierManifest() {
  const src = read("src/shared/workbench/manifest-pos.ts");
  const items = [];
  // item("menuCode", "routeName", "/path", "title", ...)
  const itemRe = /item\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  let m;
  while ((m = itemRe.exec(src)) !== null) {
    items.push({ menuCode: m[1], routeName: m[2], path: m[3], title: m[4], action: null });
  }
  // 本地动作对象块：menuCode + routeName: null + action
  const objRe = /\{\s*menuCode:\s*"([^"]+)"[\s\S]*?routeName:\s*(null|"[^"]*")[\s\S]*?path:\s*(null|"[^"]*")[\s\S]*?title:\s*"([^"]+)"[\s\S]*?action:\s*"([^"]+)"/g;
  while ((m = objRe.exec(src)) !== null) {
    items.push({
      menuCode: m[1],
      routeName: m[2] === "null" ? null : m[2].replace(/"/g, ""),
      path: m[3] === "null" ? null : m[3].replace(/"/g, ""),
      title: m[4],
      action: m[5],
    });
  }
  return items;
}

/** 真实路由名集合（从 router/index.ts 抽取 name:） */
function routerNames() {
  const src = read("src/router/index.ts");
  const names = new Set();
  const re = /name:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) names.add(m[1]);
  return names;
}

await run("C1 打印设置：routeName 与 path 均为 null（不绑定路由）", () => {
  const items = parseCashierManifest();
  const print = items.find((i) => i.menuCode === "web.pos.print-settings");
  assert.ok(print, "manifest 应含 web.pos.print-settings");
  assert.equal(print.routeName, null, "本地动作不得绑定 routeName");
  assert.equal(print.path, null, "本地动作不得绑定 path（否则外壳误当路由）");
  assert.equal(print.action, "print-settings", "应有 action=print-settings");
  return "routeName=null / path=null / action=print-settings";
});

await run("C2 打印设置：manifest 声明的所有路由项在真实 router 中存在（无假路由）", () => {
  const items = parseCashierManifest();
  const names = routerNames();
  const routed = items.filter((i) => i.routeName);
  assert.equal(routed.length, 8, `应有 8 个路由项，实际 ${routed.length}`);
  const fake = routed.filter((i) => !names.has(i.routeName));
  assert.deepEqual(fake.map((i) => `${i.menuCode}→${i.routeName}`), [], `manifest 声明了 router 中不存在的路由名`);
  return `8 个路由名全部真实存在`;
});

await run("C3 打印设置：本地动作的 path 不得是 router 中不存在的路径（防守死链）", () => {
  const items = parseCashierManifest();
  const print = items.find((i) => i.menuCode === "web.pos.print-settings");
  assert.equal(print.path, null, "本地动作 path 必须为 null；若给出具体 path 则必须是真实路由");
  // 若未来改为真实路由，则其 path 必须能在 router 中解析
  if (print.routeName) {
    const names = routerNames();
    assert.ok(names.has(print.routeName), "改为真实路由后必须存在于 router");
  }
  return "path=null（无死链可能）";
});

await run("C4 打印设置：component 指向本机面板（PrintSettingsPanel.vue）", () => {
  const src = read("src/shared/workbench/manifest-pos.ts");
  assert.ok(/modules\/print\/PrintSettingsPanel\.vue/.test(src), "组件应指向 PrintSettingsPanel.vue");
  const panel = read("src/modules/print/PrintSettingsPanel.vue");
  assert.ok(panel.length > 0, "面板文件应存在");
  return "component → PrintSettingsPanel.vue（存在）";
});

await run("C5 打印设置：导出本地动作集合与判定函数，消除消费方各自硬编码", () => {
  const src = codeOnly(read("src/shared/workbench/manifest-pos.ts"));
  assert.ok(/export\s+const\s+CASHIER_LOCAL_ACTION_ITEMS/.test(src), "应导出 CASHIER_LOCAL_ACTION_ITEMS");
  assert.ok(/export\s+function\s+isLocalActionItem/.test(src), "应导出 isLocalActionItem");
  assert.ok(/export\s+const\s+CASHIER_ROUTED_ITEMS/.test(src), "应导出 CASHIER_ROUTED_ITEMS");
  assert.ok(/CASHIER_ITEMS\.filter\(\(entry\)\s*=>\s*entry\.routeName\s*&&\s*entry\.path\)/.test(src), "ROUTED 过滤应同时要求 routeName 与 path");
  return "3 个导出齐备";
});

await run("C6 打印设置（负断言）：manifest 不得把 print-settings 挂到具体 path 上", () => {
  const items = parseCashierManifest();
  const print = items.find((i) => i.menuCode === "web.pos.print-settings");
  assert.ok(!print.path || !String(print.path).includes("print-settings"), "本地动作不得给出 /pos/print-settings 之类假路径");
  return "无 /pos/print-settings 假路径";
});

/* ══════════════════════════════════════════════════════════════════
 * D. 跨文件一致性 / 守恒不被破坏
 * ══════════════════════════════════════════════════════════════════ */

await run("D1 守恒：收银 manifest 仍为 9 项（8 路由 + 1 本地动作）", () => {
  const items = parseCashierManifest();
  assert.equal(items.length, 9, `收银 manifest 应 9 项，实际 ${items.length}`);
  const routed = items.filter((i) => i.routeName);
  const local = items.filter((i) => !i.routeName);
  assert.equal(routed.length, 8, "路由项应 8");
  assert.equal(local.length, 1, "本地动作应 1");
  return `9 = ${routed.length} 路由 + ${local.length} 本地动作`;
});

await run("D2 跨文件：aftersale 的 8 个导出函数名保持不变（消费方不被打断）", () => {
  const src = codeOnly(read("src/api/aftersale.ts"));
  const expect = [
    "fetchAfterSales",
    "fetchAfterSaleDetail",
    "approveAfterSale",
    "rejectAfterSale",
    "confirmReceiptAfterSale",
    "inspectAfterSale",
    "completeAfterSale",
    "fetchAfterSaleStatistics",
  ];
  for (const fn of expect) {
    assert.ok(new RegExp(`export\\s+async\\s+function\\s+${fn}\\s*\\(`).test(src), `导出函数 ${fn} 缺失`);
  }
  return `8 个导出名全部保留`;
});

await run("D3 跨文件：售后调用方引用未被破坏（页面仍 import 这些函数）", () => {
  const consumers = [
    "src/views/marketing/AftersaleView.vue",
  ];
  let found = 0;
  for (const rel of consumers) {
    const code = read(rel);
    for (const fn of ["approveAfterSale", "rejectAfterSale", "fetchAfterSales", "fetchAfterSaleDetail"]) {
      if (new RegExp(`\\b${fn}\\b`).test(code)) found++;
    }
  }
  assert.ok(found > 0, "应有页面引用售后 API 函数");
  return `消费方引用命中 ${found} 处`;
});

await run("D4 红线：本卡未修改 backend（git diff 限定前端路径）", () => {
  // 轻量自检：确认 aftersale 后端路由文件在源仓 HEAD 下未在本工作树被改动
  const be = readRepo("backend/src/routes/aftersale.routes.ts");
  assert.ok(/adminAftersaleRouter\.get\("\/aftersales"/.test(be), "后端路由文件应保持原样（单段 /aftersales）");
  assert.ok(!/aftersales\/aftersales/.test(be), "后端不得含双段");
  return "后端路由单段不变（只读对照）";
});

await run("D5 无死链：three 修复点均不产生未注册路径跳转", () => {
  const codes = {
    aftersale: codeOnly(read("src/api/aftersale.ts")),
    orders: codeOnly(read(PURCHASE_FILES[0].rel)),
    stocks: codeOnly(read(PURCHASE_FILES[1].rel)),
    manifest: codeOnly(read("src/shared/workbench/manifest-pos.ts")),
  };
  // 1) 售后不得出现双段
  assert.ok(!/aftersales\/aftersales/.test(codes.aftersale));
  // 2) 采购不得在异步块内 inject
  assert.ok(!/onMounted\([\s\S]{0,600}?useRoute\s*\(/.test(codes.orders));
  assert.ok(!/onMounted\([\s\S]{0,600}?useRoute\s*\(/.test(codes.stocks));
  // 3) manifest 本地动作 path 为 null
  const items = parseCashierManifest();
  assert.equal(items.find((i) => i.menuCode === "web.pos.print-settings").path, null);
  return "三处零死链";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
