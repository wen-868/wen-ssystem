/**
 * WORKBENCH-10-UIUX-PARITY-F1 · D.3 收银台断言
 *
 * 卡 §三.D.3 口径：分类、加购、数量、清空、支付弹层 + 完整反馈。
 * 「完整反馈」在这里落到可验证的硬底线：
 *   1. 交易七态互斥可辨（submitting/success/partial/unverified/failure/cancelled/unavailable）；
 *   2. **成功只能由服务端 collectionStatus=PAID 得出**；请求 2xx 但没回结清状态 ⇒ unverified，
 *      前端绝不自称「收款成功」（卡 §六「不假交易成功态」）；
 *   3. 前置缺口（空车 / 金额非法 / 通道未配置 / 无付款码）拦在发请求之前：零请求零建单
 *      —— 用调用计数证明，而不是看文案；
 *   4. 失败保留单号 ⇒ 重试沿用同单，不产生第二张销售单；
 *   5. 清车只跟随 success。
 *
 * 运行（admin-web 目录）：node tests/wb-d-pos.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

/**
 * 测试环境 shim（沿用 tests/ai-status-truth.spec.mjs 的口径）：
 * `api/request.ts` 顶层读 `import.meta.env.VITE_API_BASE`（Vite 注入），Node 原生 ESM 下为
 * undefined ⇒ 求值即抛。这是**运行环境差异**，不是产品缺陷。
 * 桩里的真实请求函数一律抛错：默认依赖被调用 = 测试忘注入 dep，判红而不是偷偷发请求。
 * 「接线指向真实端点实现」由下方用例直接读 api/pos.ts、api/hardware.ts 源码来证明，不靠桩。
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
      if (readCandidate(candidate)) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});
function readCandidate(url) {
  try {
    return readFileSync(fileURLToPath(url), "utf8").length >= 0;
  } catch {
    return false;
  }
}

// ── 浏览器环境（api/pos.ts → stores/auth.ts 在模块求值期读 localStorage）────
// 与 tests/workbench-shell.spec.mjs 同一套 jsdom 引导，不另起第二种口径。
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

const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const toUrl = (rel) => new URL("file:///" + path.join(SRC, rel).replace(/\\/g, "/")).href;

const catalogue = await import(toUrl("shared/workbench/wb-pos-catalogue.ts"));
const checkout = await import(toUrl("shared/workbench/wb-pos-checkout.ts"));
const cashierSrc = read("views/pos/CashierView.vue");

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

/** 调用计数探针：既证明走了哪条链，也证明「没走」哪条链 */
function spyDeps(overrides = {}) {
  const calls = { createBill: 0, payOffline: 0, payByCode: 0 };
  return {
    calls,
    deps: {
      createBill: async () => {
        calls.createBill += 1;
        return { billNo: "XS-SPY-1", receivableAmount: 88 };
      },
      payOffline: async () => {
        calls.payOffline += 1;
        return { collectionStatus: "PAID", receivedAmount: 88 };
      },
      payByCode: async () => {
        calls.payByCode += 1;
        return { collectionStatus: "PAID", receivedAmount: 88 };
      },
      ...overrides,
    },
  };
}
const ITEMS = [{ skuId: 7, quantity: 1, unitPrice: 88, availableQty: 20 }];
const READY_WECHAT = { state: "ready", channels: { wechat: { ready: true } }, message: "" };

/* ── 1. 库存：0 缺货 vs 未知待接入，绝不同形 ── */
await run("库存未知 ⇒ 待接入（qty=null），绝不折算成 0；0 ⇒ 真实缺货", () => {
  for (const unknown of [null, undefined, "", Number.NaN, "abc"]) {
    const view = catalogue.resolveStockState(unknown);
    assert.equal(view.state, "unavailable", `${String(unknown)} 必须判待接入`);
    assert.equal(view.qty, null, `${String(unknown)} 不得折算成 0（会被读成缺货）`);
    assert.equal(view.blockAdd, false, "待接入无从判定，不能替顾客拒绝加购");
  }
  const out = catalogue.resolveStockState(0);
  assert.equal(out.state, "out");
  assert.equal(out.blockAdd, true, "真实缺货必须阻止加购");
  assert.equal(catalogue.resolveStockState(5).state, "low");
  assert.equal(catalogue.resolveStockState(11).state, "ok");
  return "5 例待接入 + out/low/ok 分档";
});

await run("加购闸口只认真实缺货；无库存行被识别为待接入", () => {
  assert.equal(catalogue.canAddToCart(null), false);
  assert.equal(catalogue.canAddToCart({ availableQty: 0 }), false);
  assert.equal(catalogue.canAddToCart({ availableQty: null }), true);
  assert.equal(catalogue.canAddToCart({ availableQty: 3 }), true);
  assert.equal(catalogue.hasStockRow({ availableQty: undefined }), false, "无库存行须被识别（弹层要预警出库 409）");
  assert.equal(catalogue.hasStockRow({ availableQty: 0 }), true, "0 是有库存行（真实缺货），不是缺失");
  return "6 判正确";
});

/* ── 2. 分类条 ── */
await run("分类条：全部恒首位，计数来自当前商品集，脏分类不入列", () => {
  const tabs = catalogue.buildPosCatTabs(
    [{ id: 3, name: "饮料" }, { id: 0, name: "脏数据" }, { categoryId: 5, categoryName: "零食" }],
    [{ categoryId: 3 }, { categoryId: 3 }, { categoryId: 5 }, { categoryId: 9 }],
  );
  assert.equal(tabs[0].id, 0);
  assert.equal(tabs[0].name, "全部");
  assert.equal(tabs[0].count, 4);
  assert.equal(tabs.length, 3, "id=0 的分类无主键，不得入列");
  assert.deepEqual(tabs.slice(1).map((t) => [t.id, t.name, t.count]), [[3, "饮料", 2], [5, "零食", 1]]);
  assert.deepEqual(catalogue.buildPosCatTabs(null, null), [{ id: 0, name: "全部", count: 0 }], "无数据只出「全部」，不编分类");
  return "全部4 / 饮料2 / 零食1";
});

await run("目录与分类读取失败 ⇒ 待接入零条目；空结果如实为空", async () => {
  const boom = await catalogue.loadPosCatalogue({}, async () => { throw new Error("HTTP 500"); });
  assert.equal(boom.state, "unavailable");
  assert.deepEqual(boom.records, [], "失败不得带回任何条目");
  assert.ok(boom.message.includes("HTTP 500"), "原因要可追，不能吞成「加载失败」");

  const empty = await catalogue.loadPosCatalogue({}, async () => ({ records: [] }));
  assert.equal(empty.state, "ready", "空是结果，不是故障");
  assert.match(empty.message, /商品目录为空/);

  const weird = catalogue.normalizeCategoryRows({ nope: 1 });
  assert.deepEqual(weird.rows, []);
  assert.match(weird.message, /待接入/);
  assert.deepEqual(catalogue.normalizeCategoryRows({ records: [{ id: 1 }] }).rows, [{ id: 1 }]);
  return "500→待接入 / []→空 / 异形→待接入";
});

/* ── 3. 支付方式与能力门槛 ── */
await run("弹层三按钮与原型逐字一致；付款码门槛只限线上方式", () => {
  assert.deepEqual(checkout.POS_PAY_BUTTONS.map((btn) => btn.dataP), ["现金支付", "微信支付", "支付宝"]);
  assert.deepEqual(checkout.POS_PAY_BUTTONS.map((btn) => btn.method), ["CASH", "WECHAT", "ALIPAY"]);
  assert.equal(checkout.requiresAuthCode("CASH"), false);
  assert.equal(checkout.requiresAuthCode("BALANCE"), false);
  for (const method of ["WECHAT", "ALIPAY", "SCAN"]) {
    assert.equal(checkout.requiresAuthCode(method), true, `${method} 必须扫顾客付款码`);
  }
  const AUTH_CODE = checkout.AUTH_CODE_PATTERN;
  assert.ok(AUTH_CODE instanceof RegExp, "AUTH_CODE_PATTERN 导出的就是校验用正则本体");
  assert.equal(AUTH_CODE.source, "^\\d{16,24}$", "码长口径 16–24 位不得漂");
  assert.equal(AUTH_CODE.test("1234567890123456"), true);
  assert.equal(AUTH_CODE.test("123456789012345678901234"), true, "24 位在口径内");
  assert.equal(AUTH_CODE.test("123456789012345"), false, "15 位不足");
  assert.equal(AUTH_CODE.test("1234567890123456789012345"), false, "25 位超长");
  assert.equal(AUTH_CODE.test("1234 5678 9012 3456"), false, "含空格不放行");
  assert.equal(AUTH_CODE.test("123456789012345a"), false, "非数字不放行");
  return "3 按钮 + 门槛 3/5 + 码长 3 通 4 拒";
});

await run("通道探测：空返回体与请求失败都落待接入，不猜 ready", async () => {
  const emptyProbe = await checkout.probePosChannels(async () => null);
  assert.equal(emptyProbe.state, "unavailable");
  assert.equal(emptyProbe.channels, null);
  const boomProbe = await checkout.probePosChannels(async () => { throw new Error("HTTP 404"); });
  assert.equal(boomProbe.state, "unavailable");
  assert.ok(boomProbe.message.includes("/store/payment/channels"), "缺因要点名端点");
  const okProbe = await checkout.probePosChannels(async () => ({ wechat: { ready: true } }));
  assert.equal(okProbe.state, "ready");
  return "null/404→待接入，有体→ready";
});

await run("能力判定四径：线下直记 / 探测中 / 通道未配置 / 真 ready，均可追端点", () => {
  const cash = checkout.resolvePayCapability(null, "CASH");
  assert.equal(cash.state, "ready");
  assert.equal(cash.endpoint, "POST /store/sale-bills/:billNo/offline-payment");

  const loading = checkout.resolvePayCapability({ state: "loading", channels: null, message: "" }, "WECHAT");
  assert.equal(loading.state, "unavailable");
  assert.match(loading.reason, /探测中/, "探测中要说「暂不能扣款」而不是失败");

  const off = checkout.resolvePayCapability({ ...READY_WECHAT, channels: { wechat: { ready: false } } }, "WECHAT");
  assert.equal(off.state, "unavailable");
  assert.match(off.reason, /wechat\.ready=false/, "要写清缺哪条通道");

  const on = checkout.resolvePayCapability(
    { state: "ready", channels: { wechat: { ready: true, label: "微信服务商版" } }, message: "" },
    "WECHAT",
  );
  assert.equal(on.state, "ready");
  assert.equal(on.channelLabel, "微信服务商版", "通道名取服务端回读，不前端自封");
  return "ready/探测中/明细/真 ready";
});

/* ── 4. 前置缺口零请求 ── */
await run("空车 / 金额非法 / 通道不可用 / 未扫码 ⇒ 零请求零建单（计数证明）", async () => {
  const cases = [
    ["金额非法", { amount: 0, items: ITEMS, method: "CASH" }],
    ["空购物车", { amount: 88, items: [], method: "CASH" }],
    ["通道未配置", { amount: 88, items: ITEMS, method: "WECHAT", channelProbe: { state: "unavailable", channels: null, message: "未配置" } }],
    ["未扫付款码", { amount: 88, items: ITEMS, method: "SCAN", channelProbe: READY_WECHAT }],
  ];
  for (const [name, req] of cases) {
    const spy = spyDeps();
    const res = await checkout.submitPosCheckout(req, spy.deps);
    assert.equal(res.state, "unavailable", `${name} 应拦在请求前，实得 ${res.state}`);
    const total = spy.calls.createBill + spy.calls.payOffline + spy.calls.payByCode;
    assert.equal(total, 0, `${name} 不得发出任何请求，实发 ${total}`);
    assert.ok(res.message.trim().length > 0, `${name} 要说明拦下原因`);
  }
  return "4 类缺口 × 零请求";
});

/* ── 5. 成功态由服务端驱动 ── */
await run("成功只来自 PAID，金额以服务端应收为权威；缺状态 ⇒ 待核对，不自称成功", async () => {
  const okSpy = spyDeps();
  const ok = await checkout.submitPosCheckout({ amount: 100, items: ITEMS, method: "CASH" }, okSpy.deps);
  assert.equal(ok.state, "success");
  assert.equal(ok.collectionStatus, "PAID");
  assert.equal(ok.billNo, "XS-SPY-1");
  assert.equal(ok.amount, 88, "服务端应收 88 权威，覆盖前端合计 100");
  assert.ok(ok.message.includes("XS-SPY-1"), "成功文案须带真实单号可核对");
  assert.equal(okSpy.calls.createBill, 1);
  assert.equal(okSpy.calls.payOffline, 1);
  assert.equal(ok.billCreated, true);

  const noStatus = spyDeps({ payOffline: async () => ({ receivedAmount: 88 }) });
  const unverified = await checkout.submitPosCheckout({ amount: 88, items: ITEMS, method: "CASH" }, noStatus.deps);
  assert.equal(unverified.state, "unverified", "请求成功但无结清状态 ⇒ 绝不自称 success");
  assert.match(unverified.message, /到账未确认/);
  assert.equal(checkout.canRetryPosCheckout(unverified.state), true, "待核对必须给出重试入口");
  return "success 由 PAID + 权威金额；缺状态→unverified";
});

await run("部分到账 / 失败都留单号，重试沿用同单不二次建单", async () => {
  const partSpy = spyDeps({ payOffline: async () => ({ collectionStatus: "PARTIAL", receivedAmount: 30 }) });
  const part = await checkout.submitPosCheckout({ amount: 88, items: ITEMS, method: "CASH" }, partSpy.deps);
  assert.equal(part.state, "partial");
  assert.match(part.message, /仅部分到账/);
  assert.equal(checkout.canRetryPosCheckout("partial"), true);

  const failSpy = spyDeps({ payOffline: async () => { throw new Error("库存不足（HTTP 409）"); } });
  const fail = await checkout.submitPosCheckout({ amount: 88, items: ITEMS, method: "CASH" }, failSpy.deps);
  assert.equal(fail.state, "failure");
  assert.equal(fail.billNo, "XS-SPY-1", "已建单号必须留给重试");
  assert.match(fail.message, /409/, "服务端原因要透出");

  const retrySpy = spyDeps();
  const retry = await checkout.submitPosCheckout({ amount: 88, items: ITEMS, method: "CASH", billNo: "XS-SPY-1" }, retrySpy.deps);
  assert.equal(retrySpy.calls.createBill, 0, "带单号重试不得二次建单（防重复销售单）");
  assert.equal(retrySpy.calls.payOffline, 1);
  assert.equal(retry.billCreated, false);
  return "partial/failure/重试零建单";
});

await run("取消不发请求、不清单号；七态徽标互斥可辨", () => {
  const cancelled = checkout.cancelPosCheckout({ method: "SCAN", amount: 88, billNo: "XS-SPY-1" });
  assert.equal(cancelled.state, "cancelled");
  assert.match(cancelled.message, /未发起扣款/);
  assert.equal(cancelled.billNo, "XS-SPY-1", "已建单号要留痕");
  assert.equal(checkout.canRetryPosCheckout("cancelled"), false, "取消不是失败，不给重试");

  const labelled = Object.entries(checkout.POS_STATE_BADGES).filter(([, text]) => text !== "");
  assert.equal(labelled.length, 7, "除 idle 外七态都要有徽标");
  assert.equal(new Set(labelled.map(([, text]) => text)).size, 7, "七态徽标文案必须互不相同");
  assert.equal(checkout.POS_STATE_BADGES.idle, "", "idle 不该有徽标");
  for (const key of ["submitting", "success", "partial", "unverified", "failure", "cancelled", "unavailable"]) {
    assert.ok(key in checkout.POS_STATE_BADGES, `状态 ${key} 无徽标映射（UI 会渲染 undefined）`);
  }
  return labelled.map(([, text]) => text).join("/");
});

/* ── 6. 视图接线与红线 ── */
await run("收银台接线指向真实端点实现，且清车只跟随 success", () => {
  const apiPos = read("api/pos.ts");
  for (const fn of [
    "createStoreSaleBill",
    "createStoreOfflinePayment",
    "payStoreSaleBillByCode",
    "searchStoreProducts",
    "fetchStorePaymentChannels",
  ]) {
    assert.ok(apiPos.includes(`export async function ${fn}`), `${fn} 在 api/pos.ts 无实现（视为伪造接线）`);
  }
  for (const needle of ["submitPosCheckout", "probePosChannels", "resolvePayCapability", "loadPosCatalogue", "buildPosCatTabs"]) {
    assert.ok(cashierSrc.includes(needle), `收银台未接 ${needle}`);
  }
  assert.ok(cashierSrc.includes('data-testid="pos-result-badge"'), "结果态缺测试锚点");

  // 分支判定必须落在 runCheckout 函数体内：视图里另有一处 result.state === "unavailable"
  // （目录装载 L1509），全文 indexOf 会先撞上它，所以先切函数体再找守卫
  const fnAt = cashierSrc.indexOf("async function runCheckout(");
  assert.ok(fnAt > -1, "runCheckout 结算函数不可追");
  const fnEnd = cashierSrc.indexOf("\n}", fnAt);
  const body = cashierSrc.slice(fnAt, fnEnd > -1 ? fnEnd : fnAt + 4000);
  const successAt = body.indexOf('if (result.state === "success")');
  const unavailableAt = body.indexOf('if (result.state === "unavailable")');
  assert.ok(successAt > -1 && unavailableAt > successAt, "结算结果分支结构不可追（success/unavailable 守卫缺失或倒置）");
  const successBranch = body.slice(successAt, unavailableAt);
  assert.ok(successBranch.includes("completePaymentFlow("), "清车结算只允许出现在 success 分支");
  const nonSuccessTail = body.slice(unavailableAt);
  assert.ok(!nonSuccessTail.includes("completePaymentFlow("), "非 success（待接入/失败/部分/待核对）不得清车结算");
  assert.match(cashierSrc, /failure \/ partial \/ unverified[^\n]*购物车与单号保留/, "非成功态要留车留单");
  return "5 端点既有 + 5 适配器接入 + 清车跟 success";
});

await run("分类/加购/数量/清空/弹层五动作齐备", () => {
  for (const [name, needle] of [
    ["分类", "activeCategory"],
    ["加购", "addCartItem"],
    ["数量加", "increaseQty"],
    ["数量减", "decreaseQty"],
    ["清空", "clearCart"],
    ["支付弹层", "paySheetVisible"],
  ]) {
    assert.ok(cashierSrc.includes(needle), `缺${name}动作实现（${needle}）`);
  }
  assert.ok(cashierSrc.includes("POS_STATE_BADGES[payState]"), "弹层内要有即时状态反馈");
  for (const anchor of ["pos-qty-plus", "pos-qty-minus"]) {
    assert.ok(cashierSrc.includes(`data-testid="${anchor}"`), `数量控件缺测试锚点 ${anchor}`);
  }
  return "6 动作 + 弹层态徽标 + 2 数量锚点";
});

await run("收银链路不含随机数、演示商品或伪造成功表述", () => {
  const files = {
    "CashierView.vue": cashierSrc,
    "wb-pos-catalogue.ts": read("shared/workbench/wb-pos-catalogue.ts"),
    "wb-pos-checkout.ts": read("shared/workbench/wb-pos-checkout.ts"),
  };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/Math\.random\(/.test(text), `${name} 用了随机数`);
    assert.ok(!/红星商行|张三|王强|李四|示例商品|测试商品A/.test(text), `${name} 出现演示数据字面量`);
    // 「不伪造成功」这类自证清白的表述允许存在；肯定式（同一行没有任何否定标记）才判踩线
    for (const line of text.split("\n")) {
      if (!/模拟成功|伪造成功|假成功/.test(line)) continue;
      assert.match(line, /不|未|无|禁止|杜绝|拒|别/, `${name} 出现肯定式伪造成功表述：${line.trim()}`);
    }
  }
  return "3 文件全清";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
