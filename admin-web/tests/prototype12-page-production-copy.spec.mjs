/**
 * WORKBENCH-PROTOTYPE-12-PAGE-PRODUCTION-COPY-01 · 页面与打印样例文案收口 门禁用例
 *
 * 覆盖卡面硬验收 §四：
 *   1. 允许路径源码「产品可见字符串」对 S5 COPY_BLACKLIST（10 项）0 命中（注释剥离后扫描，逐文件点名）；
 *   2. sampleVars：打印预览单一源——字段结构完整可渲染、值全部明显中性（无真实商户/品牌/人名/手机号/单号）；
 *      恢复任何演示值（如红星商行）会被本 spec 点名判红（mutation 证据 M3 依赖此行为）；
 *   3. 语义保持：库存四态/支付七态/结算闸口/重试语义原样（只改文案，不改状态机）；
 *   4. 演示人员不进生产：调拨详情/订单异常页无演示操作人与演示兜底数据；未选择 ⇒ 明确空态；
 *   5. sampleVars 消费面 = 打印模板预览（编辑器/模板页），不进业务提交链。
 *
 * 运行（admin-web 目录）：node tests/prototype12-page-production-copy.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

/**
 * 测试环境 shim（沿用 wb-d-pos.spec.mjs 口径）：api/request.ts 顶层读 import.meta.env（Vite 注入），
 * Node 原生 ESM 求值即抛——运行环境差异非产品缺陷；桩内真实请求函数一律抛错（默认依赖被调用=测试忘注入）。
 */
const STUB_POS_API =
  "data:text/javascript," +
  [
    "const refused=(n)=>async()=>{throw new Error('测试环境未注入 ' + n + '，禁止真实请求');};",
    "export const searchStoreProducts=refused('searchStoreProducts');",
    "export const createStoreSaleBill=refused('createStoreSaleBill');",
    "export const createStoreOfflinePayment=refused('createStoreOfflinePayment');",
    "export const payStoreSaleBillByCode=refused('payStoreSaleBillByCode');",
    "export const fetchStorePaymentChannels=refused('fetchStorePaymentChannels');",
  ].join("");
const STUB_REQUEST_API =
  "data:text/javascript,export const getErrorMessage=(e,d)=>String((e&&e.message)||d||e);";

// 模块钩子：无扩展名相对导入 → 补 .ts；api/request 桩（import.meta.env 差异）；.vue 桩（与 wb-d-pos 同一套 harness）
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      return { url: "data:text/javascript,export default{render(){return null}}", shortCircuit: true, format: "module" };
    }
    if (/\/api\/pos(\.ts)?$/.test(specifier)) {
      return { url: STUB_POS_API, shortCircuit: true, format: "module" };
    }
    if (/\/api\/request(\.ts)?$/.test(specifier)) {
      return { url: STUB_REQUEST_API, shortCircuit: true, format: "module" };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// 浏览器环境垫片：api/pos → stores/auth 在模块求值期读 localStorage（与 wb-d-pos 同一套 jsdom 引导）
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  history: dom.window.history,
  localStorage: dom.window.localStorage,
  navigator: dom.window.navigator,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

/** S5 COPY_BLACKLIST（10 项，与 prototype12-visual.spec.mjs 骨架逐字对齐） */
const COPY_BLACKLIST = [
  "双入口左侧菜单",
  "待接入",
  "未接入",
  "不伪造成功",
  "端点缺失",
  "设计说明",
  "红星商行",
  "张三",
  "¥25,400",
  "¥8,900",
];

/** 本卡允许路径内的产品源码文件（test 文件不在 dist 扫描面） */
const PRODUCT_FILES = [
  "views/pos/CashierView.vue",
  "views/marketing/MarketingMaterial.vue",
  "views/inventory/InventoryTransferDetail.vue",
  "views/order/OrderExceptionView.vue",
  "modules/print/sampleVars.ts",
  "shared/workbench/wb-pos-catalogue.ts",
  "shared/workbench/wb-pos-checkout.ts",
  "components/workbench/WbSettingsCenter.vue",
  "shared/workbench/wb-settings.ts",
  "views/LoginView.vue",
];

/** 剥离注释，只留「产品可见字符串」扫描面（模板注释/块注释/整行行注释；不动字符串字面量） */
function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/** sampleVars 禁止再现的演示值（恢复任一项 ⇒ 点名红；mutation M3 依赖） */
const DEMO_FORBIDDEN = [
  "红星商行",
  "五粮液",
  "剑南春",
  "飞天茅台",
  "张三",
  "演示账号",
  "13900000000",
  "6901234567890",
  "ZX20260812001",
  "XS202608120001",
];

/** 原始 sampleVars 的完整字段结构（打印预览依赖；缺任一键 ⇒ 预览失效） */
const SAMPLE_VARS_REQUIRED_KEYS = [
  "storeName", "storePhone", "storeAddress", "headerName", "headerPhone", "headerAddress",
  "billNo", "billDate", "operatorName", "auditorName", "salesmanName", "customerName", "customerPhone",
  "saleType", "billStatus", "items", "itemsRows", "totalAmount", "discountAmount", "paidAmount",
  "receivedAmount", "changeAmount", "paymentMethod", "amountChinese", "memberBalance", "remarkBlock",
  "signRoles", "footerText", "reportTitle", "reportPeriod", "reportHeaders", "productName", "skuName",
  "barcode", "price", "unit", "shiftNo", "receiverName", "saleCount", "cashAmount", "wechatAmount",
  "alipayAmount", "balanceAmount",
];

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    const stackLine = String(err.stack || "").split("\n")[1]?.trim() ?? "";
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}${stackLine ? `  [${stackLine}]` : ""}`);
  }
}

/* ── 1. 源码产品可见字符串黑名单（逐文件点名，恢复演示值即判红）── */

await run("允许路径 10 个产品文件：S5 COPY_BLACKLIST 10 项零命中（注释剥离，逐文件点名）", () => {
  const hits = [];
  for (const rel of PRODUCT_FILES) {
    const visible = stripComments(read(rel));
    for (const term of COPY_BLACKLIST) {
      if (visible.includes(term)) hits.push(`${rel} ← 「${term}」`);
    }
  }
  assert.deepEqual(hits, [], `产品可见字符串命中黑名单：\n${hits.join("\n")}`);
  return `10 文件 × 10 词 = 0 命中`;
});

/* ── 2. sampleVars：预览单一源——结构完整 + 值中性 + 不进业务提交链 ── */

await run("sampleVars 字段结构完整：PrintVars 必需键一个不缺（打印预览不失效）", async () => {
  const mod = await import(pathToFileURL(path.join(SRC, "modules/print/sampleVars.ts")).href);
  const vars = mod.sampleVars();
  const missing = SAMPLE_VARS_REQUIRED_KEYS.filter((key) => !(key in vars));
  assert.deepEqual(missing, [], `sampleVars 缺字段：${missing.join(",")}`);
  assert.ok(typeof vars.items === "string" && vars.items.includes("<tr>") && vars.items.includes("示例商品A"), "items 表格行必须可渲染且含示例商品");
  assert.equal(vars.itemsRows.length >= 2, true, "明细行须≥2 行以支撑多行预览");
  for (const row of vars.itemsRows) {
    for (const key of ["name", "spec", "barcode", "unit", "qty", "price", "amount", "trace"]) {
      assert.ok(row[key] !== undefined && row[key] !== "", `itemsRows 行缺字段 ${key}`);
    }
  }
  return `${SAMPLE_VARS_REQUIRED_KEYS.length} 键齐备 + 表格/明细可渲染`;
});

await run("sampleVars 值全部明显中性：无真实商户/品牌/人名/手机号/单号（恢复演示值 ⇒ 点名红）", async () => {
  const mod = await import(pathToFileURL(path.join(SRC, "modules/print/sampleVars.ts")).href);
  const source = read("modules/print/sampleVars.ts");
  const vars = mod.sampleVars();
  const serialized = JSON.stringify(vars);
  for (const term of DEMO_FORBIDDEN) {
    assert.ok(!source.includes(term), `sampleVars 源码含演示值「${term}」（恢复演示样例 ⇒ 本断言点名红）`);
    assert.ok(!serialized.includes(term), `sampleVars 预览输出含演示值「${term}」`);
  }
  assert.ok(!/^1[3-9]\d{9}$/.test(vars.customerPhone), `customerPhone 不得是看似真实的手机号：${vars.customerPhone}`);
  assert.ok(vars.customerName.includes("示例"), `客户名应为明显示例占位：${vars.customerName}`);
  assert.ok(vars.operatorName.includes("示例"), `操作人应为明显示例占位：${vars.operatorName}`);
  assert.ok(vars.itemsRows.every((r) => r.barcode.includes("0000000")), "条码必须为明显占位（含连续零段），不得形如真实 EAN");
  return "源码+输出双扫描零演示值；占位全部「示例」前缀";
});

await run("sampleVars 消费面 = 打印模板预览三组件，不进业务提交/视图数据链", () => {
  const importerFiles = [
    "modules/print/PrintTemplateDesigner.vue",
    "modules/print/PrintTemplatesView.vue",
    "modules/print/PrintTemplateEditor.vue",
  ];
  for (const rel of importerFiles) {
    assert.ok(read(rel).includes('from "./sampleVars"'), `打印预览组件 ${rel} 应消费 sampleVars`);
  }
  const businessViews = ["views/pos/CashierView.vue", "views/order/OrderExceptionView.vue", "views/inventory/InventoryTransferDetail.vue", "views/marketing/MarketingMaterial.vue"];
  for (const rel of businessViews) {
    assert.ok(!read(rel).includes("sampleVars"), `业务视图 ${rel} 不得消费打印样例数据`);
  }
  return "3 预览组件消费 / 4 业务视图零消费";
});

/* ── 3. 语义保持：只改文案，不改状态机 ── */

await run("库存四态语义不变：unavailable/low/out/ok 判定与闸口原样（只换角标文案）", async () => {
  const catalogue = await import(pathToFileURL(path.join(SRC, "shared/workbench/wb-pos-catalogue.ts")).href);
  assert.equal(catalogue.resolveStockState(null).state, "unavailable");
  assert.equal(catalogue.resolveStockState(null).text, "暂无库存读数");
  assert.equal(catalogue.resolveStockState(0).state, "out");
  assert.equal(catalogue.resolveStockState(0).blockAdd, true, "真实缺货仍阻止加购");
  assert.equal(catalogue.resolveStockState(null).blockAdd, false, "无库存读数仍不阻止加购（服务端出库校验兜底）");
  assert.equal(catalogue.resolveStockState(5).state, "low");
  assert.equal(catalogue.resolveStockState(50).state, "ok");
  return "四态 + 闸口 + 新文案全部落位";
});

await run("支付七态徽标与结算闸口不变：unavailable 徽标改「暂不可用」，可重试态集合不变", async () => {
  const checkout = await import(pathToFileURL(path.join(SRC, "shared/workbench/wb-pos-checkout.ts")).href);
  const states = ["idle", "submitting", "success", "partial", "unverified", "failure", "cancelled", "unavailable"];
  for (const key of states) {
    assert.ok(key in checkout.POS_STATE_BADGES, `缺徽标 ${key}`);
  }
  assert.equal(checkout.POS_STATE_BADGES.unavailable, "暂不可用");
  assert.equal(checkout.POS_STATE_BADGES.failure, "收款失败");
  for (const s of ["failure", "partial", "unverified", "unavailable"]) {
    assert.equal(checkout.canRetryPosCheckout(s), true, `${s} 必须可重试`);
  }
  for (const s of ["idle", "submitting", "success", "cancelled"]) {
    assert.equal(checkout.canRetryPosCheckout(s), false, `${s} 不应可重试`);
  }
  return "8 态齐备 + 重试闸口原样";
});

/* ── 4. 演示人员不进生产：调拨详情 / 订单异常 ── */

await run("调拨详情：无演示兜底数据、无演示操作人；未选择 ⇒ 明确空态", () => {
  const src = stripComments(read("views/inventory/InventoryTransferDetail.vue"));
  for (const term of [...DEMO_FORBIDDEN, "李经理", "库管员王", "朝阳门店库管", "使用 mock 数据"]) {
    assert.ok(!src.includes(term), `调拨详情不得含演示内容「${term}」`);
  }
  assert.ok(src.includes("调拨详情加载失败"), "接口失败须有可辨错误文案");
  assert.ok(src.includes('creatorName || "未记录"'), "操作人只认真实字段，缺真实记录 ⇒ 未记录");
  assert.ok(src.includes('"未记录"'), "缺真实操作人的节点须如实「未记录」");
  return "mock 兜底移除 + 操作人只认真实字段/未记录";
});

await run("订单异常：处理人选项零演示人员；关联订单金额/时间零伪造（无 Math.random/硬编码样例）", () => {
  const src = stripComments(read("views/order/OrderExceptionView.vue"));
  for (const term of ["张三", "李四", "王五"]) {
    assert.ok(!src.includes(term), `订单异常页不得含演示人员「${term}」`);
  }
  assert.ok(!/Math\.random\(/.test(src), "订单金额不得用随机数伪造");
  assert.ok(!src.includes("2026-07-01 09:30:00"), "下单时间不得硬编码演示值");
  assert.ok(src.includes("暂无可选人员名单"), "无人员名单时分配框须如实空态提示");
  return "演示人员/伪造金额/硬编码时间全部清零";
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
