/**
 * AI 结果 → 系统原生表单/详情页合同。
 *
 * 验证 AI 不绘制第二套简化单据：
 * - createSalesOrder preview 只跳 /sales/create，并在本地暂存一次性预填草稿；
 * - querySaleBills / getSaleBillDetail 只跳已有 /sale-bills/:billNo；
 * - 消息卡、会话面板、壳层完成事件链接线。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const bridge = await import(pathToFileURL(path.join(SRC, "shared/workbench/ai-form-bridge.ts")).href);
const menuUsage = await import(pathToFileURL(path.join(SRC, "shared/workbench/menu-usage.ts")).href);
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${error.message}`);
  }
}

await run("AI 创建销售单预览 → 原生销售开单表单 + 一次性预填草稿", () => {
  const actions = bridge.resolveAiNativeFormActions({
    tool: "createSalesOrder",
    preview: {
      operation: "创建销售单",
      summary: "客户 A · 2 种商品",
      details: {
        customerId: 9,
        customerName: "客户 A",
        saleType: "CREDIT",
        items: [
          { skuId: 101, skuName: "商品甲", totalBottleQty: 3, unitPrice: 12.5, totalPrice: 37.5 },
        ],
      },
    },
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "sales-order-form");
  assert.equal(actions[0].path, "/sales/create?source=ai&mode=form");
  assert.equal(actions[0].draft.customerId, 9);
  assert.equal(actions[0].draft.saleType, "CREDIT");
  assert.equal(actions[0].draft.items[0].skuId, 101);
  return "createSalesOrder preview → /sales/create";
});

await run("销售单列表/详情工具 → 系统已有销售单详情路由", () => {
  const list = bridge.resolveAiNativeFormActions({
    tool: "querySaleBills",
    data: { list: [{ billNo: "SB001" }, { billNo: "SB002" }, { billNo: "SB001" }] },
  });
  assert.deepEqual(list.map((item) => item.path), ["/sale-bills/SB001", "/sale-bills/SB002"]);
  const detail = bridge.resolveAiNativeFormActions({
    tool: "getSaleBillDetail",
    data: { billNo: "SB003", type: "saleBill" },
  });
  assert.equal(detail[0].kind, "sale-bill-detail");
  assert.equal(detail[0].path, "/sale-bills/SB003");
  return "2 条列表去重 + 详情复用 /sale-bills/:billNo";
});

await run("原生表单事件链：消息卡 → 会话 → AI 面板 → 壳层切人工并跳转", () => {
  const card = read("components/AiChat/AiMessageCard.vue");
  const side = read("components/AiChat/AiSidePanel.vue");
  const panel = read("components/workbench/AiChatPanel.vue");
  const shell = read("layouts/WorkbenchShell.vue");
  assert.ok(
    card.includes('emit("open-form", action)') || card.includes("emit('open-form', action)"),
    "消息卡未发出原生表单事件",
  );
  assert.ok(side.includes('emit("open-form", action)'), "会话面板未转发原生表单事件");
  assert.ok(panel.includes('emit(\'open-form\', $event)'), "AI 主面板未转发原生表单事件");
  assert.ok(shell.includes("@open-form=\"openAiNativeForm\""), "壳层未接原生表单事件");
  assert.ok(shell.includes("setWorkbenchMode(\"human\")") && shell.includes("router.push(action.path)"), "壳层未切人工并跳系统路由");
  return "四层事件链完整";
});

await run("销售开单原表单消费 AI 草稿，不新增简化表单", () => {
  const form = read("views/sale/SalesOrderCreate.vue");
  assert.ok(form.includes("consumeAiSalesOrderDraft"), "销售开单未消费 AI 预填草稿");
  assert.ok(form.includes("form.items = draft.items.map"), "AI 商品明细未写入原表单 items");
  assert.ok(form.includes('data-testid="ai-sales-order-prefill"'), "原表单缺少 AI 预填后的核对提示");
  assert.ok(form.includes("handleSubmit"), "原表单提交链应保留");
  return "原 SalesOrderCreate 表单承接 AI 填充";
});

await run("常用功能按使用次数排序，无记录不预置原型快捷项", () => {
  const items = [
    { menuCode: "a", title: "A", routeName: "a", path: "/a" },
    { menuCode: "b", title: "B", routeName: "b", path: "/b" },
  ];
  const ranked = menuUsage.rankFrequentMenuItems(items, {
    a: { count: 2, lastUsedAt: 10 },
    b: { count: 7, lastUsedAt: 9 },
  });
  assert.deepEqual(ranked.map((item) => item.routeName), ["b", "a"]);
  assert.deepEqual(menuUsage.rankFrequentMenuItems(items, {}), []);
  const subnav = read("layouts/WorkbenchSubnav.vue");
  assert.ok(subnav.includes("暂无常用功能，使用后会自动按频率排列"), "常用功能空态未说明自动生成口径");
  assert.ok(!subnav.includes("planProductionSubnav"), "常用功能仍回退固定原型快捷项");
  return "7>2 > 2>1；无记录为空";
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length ? 1 : 0;
