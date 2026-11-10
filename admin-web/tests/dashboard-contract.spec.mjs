/**
 * WORKBENCH-07 · Dashboard 字段适配器契约测试
 *
 * 覆盖派单卡 §五-5（新增测试至少覆盖）：
 *   ① 嵌套/扁平兼容边界
 *   ② 四个指标（今日销售/订单/毛利、本月销售/订单）
 *   ③ todos 分组
 *   ④ 空态/失败态可区分
 *   ⑤ 两条客户会员入口
 * 以及 §五-2（两页共用同一适配器）的结构负断言。
 *
 * 契约依据（直读后端，非文档）：
 *   - `backend/src/services/admin/dashboard.service.ts:360-406` getOverview（嵌套 today/month；**无毛利**）
 *   - `backend/src/services/admin/report/finance-report.service.ts:307-321` getProfit（grossProfit）
 *   - `backend/src/routes/report.routes.ts:36` → `GET /api/admin/reports/profit`
 *   - `backend/src/services/admin/dashboard.service.ts:539` getTodos（**平铺数组**）
 *   - `backend/src/services/admin/dashboard.service.ts:513` getRecentAlerts（**平铺数组**）
 *
 * 运行：node admin-web/tests/dashboard-contract.spec.mjs（已串入 npm test）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");

// ── 以 .ts 直载：把 dashboard-contract.ts 当 ESM 处理（Node 原生 type stripping）──
// ⚠️ Windows 绝对路径必须转成 file:// URL，否则 ESM loader 报 ERR_UNSUPPORTED_ESM_URL_SCHEME（'d:'）
const contract = await import(pathToFileURL(path.join(SRC, "utils", "dashboard-contract.ts")).href);

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}
/** 剥注释，只留可执行代码（避免注释里合法提及被误判） */
function codeOnly(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

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

// ═══════════════════════════════════════════════════════════════════════════
// 一、嵌套契约（主路径）
// ═══════════════════════════════════════════════════════════════════════════

await run("嵌套契约：today.* / month.* 正确读取（WB-AUDIT-01/08 主修复）", () => {
  const parsed = contract.parseDashboardOverview({
    today: { salesAmount: 12345.67, orderCount: 42, receivedAmount: 12000, purchaseAmount: 800 },
    month: { salesAmount: 98765.43, orderCount: 321 },
  });
  assert.equal(parsed.ok, true, "嵌套载荷必须解析成功");
  assert.equal(parsed.data.today.salesAmount, 12345.67, "今日销售额应读 today.salesAmount");
  assert.equal(parsed.data.today.orderCount, 42, "今日订单应读 today.orderCount");
  assert.equal(parsed.data.month.salesAmount, 98765.43, "本月销售额应读 month.salesAmount");
  assert.equal(parsed.data.month.orderCount, 321, "本月订单应读 month.orderCount");
  return `today=${parsed.data.today.salesAmount}/${parsed.data.today.orderCount} · month=${parsed.data.month.salesAmount}/${parsed.data.month.orderCount}`;
});

await run("嵌套契约：毛利来自 reports/profit（overview 无此字段）", () => {
  // overview 载荷**不含**毛利；毛利由第二个入参注入
  const parsed = contract.parseDashboardOverview(
    { today: { salesAmount: 100, orderCount: 1 }, month: { salesAmount: 1000, orderCount: 10 } },
    88.88,
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.today.grossProfit, 88.88, "毛利应取 parseProfitGross 结果");
  return "today.grossProfit=88.88（外部注入）";
});

await run("毛利：未取到 ⇒ null（**绝不填 0**）", () => {
  const parsed = contract.parseDashboardOverview({
    today: { salesAmount: 100, orderCount: 1 },
    month: { salesAmount: 1000, orderCount: 10 },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.today.grossProfit, null, "无毛利来源时必须为 null，不得为 0");
  assert.equal(contract.parseProfitGross({ income: 100, cost: 60 }), null, "profit 报告缺 grossProfit ⇒ null");
  assert.equal(contract.parseProfitGross({ grossProfit: 40.5 }), 40.5, "有 grossProfit 应取到");
  assert.equal(contract.parseProfitGross(null), null, "null 载荷 ⇒ null");
  return "缺字段全 null，不伪造 0";
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、扁平兼容边界
// ═══════════════════════════════════════════════════════════════════════════

await run("扁平兼容：仅扁平字段时兜底可读（旧夹具不炸，但不冒充主路径）", () => {
  const parsed = contract.parseDashboardOverview({
    todaySalesAmount: 555,
    todayOrderCount: 7,
    monthSalesAmount: 6666,
    monthOrderCount: 66,
  });
  assert.equal(parsed.ok, true, "扁平兜底应仍可解析（避免旧数据白屏）");
  assert.equal(parsed.data.today.salesAmount, 555);
  assert.equal(parsed.data.month.salesAmount, 6666);
  return "扁平兜底 555 / 6666（嵌套缺失时才生效）";
});

await run("嵌套优先：嵌套与扁平同时存在时，**以嵌套为准**", () => {
  const parsed = contract.parseDashboardOverview({
    today: { salesAmount: 100, orderCount: 2 },
    month: { salesAmount: 200, orderCount: 3 },
    todaySalesAmount: 999,
    monthSalesAmount: 888,
  });
  assert.equal(parsed.data.today.salesAmount, 100, "嵌套优先，扁平不得覆盖");
  assert.equal(parsed.data.month.salesAmount, 200, "嵌套优先，扁平不得覆盖");
  return "嵌套 100/200 胜过扁平 999/888";
});

await run("边界：嵌套字段为 null / 字符串数字 / NaN", () => {
  const a = contract.parseDashboardOverview({ today: { salesAmount: null, orderCount: "12" }, month: {} });
  assert.equal(a.ok, true);
  assert.equal(a.data.today.orderCount, 12, "字符串数字应转为 12");
  const b = contract.parseDashboardOverview({ today: { salesAmount: Number.NaN }, month: {} });
  assert.equal(b.ok, true);
  assert.equal(b.data.today.salesAmount, 0, "NaN 落 0（真实缺省）");
  return "字符串→数字、NaN→0";
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、失败态（绝不伪装成空/0）
// ═══════════════════════════════════════════════════════════════════════════

await run("失败态：overview 形状异常 ⇒ ok:false（不返回 0 指标）", () => {
  for (const bad of [null, undefined, "x", 42, []]) {
    const r = contract.parseDashboardOverview(bad);
    assert.equal(r.ok, false, `载荷 ${JSON.stringify(bad)} 必须判失败`);
    assert.ok(r.reason.length > 0, "失败必须带原因");
  }
  const missing = contract.parseDashboardOverview({ foo: 1 });
  assert.equal(missing.ok, false, "缺 today/month 主体 ⇒ 失败（不当作真实 0）");
  return "5 种异常载荷 + 缺主体 全部 ok:false";
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、todos（WB-AUDIT-02 主修复）
// ═══════════════════════════════════════════════════════════════════════════

await run("todos：**真实形状 {total,items}** 可渲染（运行态抓包口径）", () => {
  // 真实响应（2026-10-28 抓包 + 源码 L649 `return { total: items.length, items }`）
  const r = contract.parseDashboardTodos({
    total: 2,
    items: [
      { type: "pending_payment", priority: "urgent", title: "3笔订单待付款", subtitle: "最早: 2026-10-01 09:00", count: 3, link: "/orders?status=PENDING_PAYMENT" },
      { type: "pending_delivery", priority: "important", title: "2笔订单待配送", subtitle: "", count: 2, link: "/orders?status=WAIT_DELIVERY" },
    ],
  });
  assert.equal(r.ok, true, "{total,items} 必须解析成功");
  assert.equal(r.state, "ready", "非空必须 ready");
  assert.equal(r.data.length, 2);
  assert.equal(r.data[0].type, "pending_payment");
  assert.equal(r.data[0].count, 3);
  return `{total:2,items:[2]} ⇒ ready（${r.data[0].title}）`;
});

await run("todos：平铺数组形态亦兼容（未来简化/旧缓存容忍）", () => {
  const r = contract.parseDashboardTodos([
    { type: "pending_payment", priority: "urgent", title: "1笔", count: 1, link: "/orders" },
  ]);
  assert.equal(r.ok, true, "平铺数组应兼容");
  assert.equal(r.data.length, 1);
  return "平铺兼容 1 条 ⇒ ready";
});

await run("todos：空 ⇒ empty（真空结果，不是失败）", () => {
  // 真实空态响应即 {total:0, items:[]}
  const nested = contract.parseDashboardTodos({ total: 0, items: [] });
  assert.equal(nested.ok, true, "空 items 是合法业务结果");
  assert.equal(nested.state, "empty");
  const flat = contract.parseDashboardTodos([]);
  assert.equal(flat.state, "empty");
  return "{total:0,items:[]} 与 [] 均 ⇒ empty";
});

await run("todos：**失败态与空态必须可区分**（形状异常 ⇒ ok:false）", () => {
  // 注意：`{items:[]}` 是**合法空态**（真实形状），不能列为失败 —— 首版误列，已修正
  for (const bad of [null, undefined, "x", 123, { total: 3 }, { foo: 1 }]) {
    const r = contract.parseDashboardTodos(bad);
    assert.equal(r.ok, false, `载荷 ${JSON.stringify(bad)} 必须判失败（≠ 空态）`);
  }
  const empty = contract.parseDashboardTodos({ total: 0, items: [] });
  const fail = contract.parseDashboardTodos(null);
  assert.notEqual(empty.ok, fail.ok, "空态与失败态的 ok 必须不同");
  assert.equal(empty.state, "empty");
  assert.equal(fail.ok, false);
  return "6 种异常载荷 ok:false；合法空态 {total:0,items:[]} ⇒ empty（二者可区分）";
});

await run("todos 分组：按 type 归组、按 priority 排序、未知类型不丢", () => {
  const items = [
    { type: "b_type", priority: "normal", title: "普通", subtitle: "", count: 1, link: "" },
    { type: "a_type", priority: "urgent", title: "紧急", subtitle: "", count: 2, link: "" },
    { type: "future_type", priority: "important", title: "未来类型", subtitle: "", count: 1, link: "" },
  ];
  const g = contract.groupTodos(items);
  assert.equal(g.totalItems, 3, "合计项数 = 3");
  assert.deepEqual(Object.keys(g.byType).sort(), ["a_type", "b_type", "future_type"], "后端新增类型不得丢");
  assert.equal(g.byType.a_type.length, 1);
  assert.equal(g.ordered[0].priority, "urgent", "urgent 排最前");
  assert.equal(g.ordered[1].priority, "important", "important 次之");
  assert.equal(g.ordered[2].priority, "normal", "normal 最后");
  return "3 组（含未知类型）+ 优先级排序 urgent→important→normal";
});

await run("alerts：平铺数组解析 + 失败与空可区分", () => {
  const ok = contract.parseDashboardAlerts([
    { alertNo: "A001", ruleType: "STOCK_LOW", alertLevel: "WARNING", title: "库存不足", description: "d", status: "PENDING", createdAt: "2026-10-01" },
  ]);
  assert.equal(ok.ok, true);
  assert.equal(ok.state, "ready");
  assert.equal(ok.data[0].alertNo, "A001");
  const empty = contract.parseDashboardAlerts([]);
  assert.equal(empty.state, "empty");
  const fail = contract.parseDashboardAlerts("nope");
  assert.equal(fail.ok, false);
  return "1 条 ready / [] empty / 字符串 ok:false";
});

// ═══════════════════════════════════════════════════════════════════════════
// 五、四态辅助
// ═══════════════════════════════════════════════════════════════════════════

await run("四态：resolveDataState 严格区分 loading/empty/ready/error", () => {
  assert.equal(contract.resolveDataState(true, null, null), "loading");
  assert.equal(contract.resolveDataState(false, null, null), "loading", "未落结果仍算 loading");
  assert.equal(contract.resolveDataState(false, "boom", null), "error", "有错必须 error");
  assert.equal(contract.resolveDataState(false, "boom", 5), "error", "有错即便有数据也 error（不让旧值冒充）");
  assert.equal(contract.resolveDataState(false, null, 0), "empty");
  assert.equal(contract.resolveDataState(false, null, 3), "ready");
  return "6 组真值表全符合";
});

// ═══════════════════════════════════════════════════════════════════════════
// 六、客户会员入口（WB-AUDIT-04）
// ═══════════════════════════════════════════════════════════════════════════

await run("入口：两处客户会员均指向 /customers（源码字符串断言）", () => {
  const dash = read("views/dashboard/Dashboard.vue");
  assert.equal(contract.CUSTOMER_MEMBERS_ROUTE, "/customers", "共享常量必须是 /customers");
  const code = codeOnly(dash);
  // ① 不得再出现死链字面量
  assert.ok(!code.includes("/customer/members"), "Dashboard 不得再出现 /customer/members 死链");
  // ② 两处引用（快捷入口点击 + 动作目录 route）
  const refs = [...code.matchAll(/CUSTOMER_MEMBERS_ROUTE/g)].length;
  assert.ok(refs >= 2, `两处入口都应引用共享常量，实际 ${refs} 处`);
  return `死链 0 处；共享常量引用 ${refs} 处`;
});

await run("入口：/customers 路由真实存在（静态路由表断言）", () => {
  /**
   * ⚠️ 判据口径（首版写错，此处修正并留痕）：
   *   路由表把客户管理写成**嵌套子路由** `path: "customers"`（父级 path 已是 "/"），
   *   解析后完整路径才是 `/customers`。因此断言必须接受 `path: "customers"` 这一形态，
   *   不能只认字面量 `'/customers'`（那会误判为"路由不存在"）。
   */
  const code = codeOnly(read("router/index.ts"));
  const hasSubRoute = /path:\s*["']customers["']/.test(code);
  const hasFullRoute = /path:\s*["']\/customers["']/.test(code);
  assert.ok(
    hasSubRoute || hasFullRoute,
    "路由表必须存在 customers 路由（嵌套 path:'customers' 或绝对 path:'/customers'）",
  );
  // 同时确认确实指向客户管理页面（语义正确，不是同名空壳）
  assert.ok(/CustomersView\.vue/.test(code), "customers 路由应指向客户管理页面");
  assert.equal(contract.CUSTOMER_MEMBERS_ROUTE, "/customers", "共享常量应为解析后的完整路径");
  return hasSubRoute ? "嵌套 path:'customers' → CustomersView.vue（解析为 /customers）" : "绝对 path:'/customers'";
});

// ═══════════════════════════════════════════════════════════════════════════
// 七、两页共用同一适配器（硬验收 §2 / 反测 §6-3）
// ═══════════════════════════════════════════════════════════════════════════

await run("共用：管理 Dashboard 与门店工作台均 import 同一适配器", () => {
  for (const rel of ["views/dashboard/Dashboard.vue", "views/pos/StoreDashboardView.vue"]) {
    const code = codeOnly(read(rel));
    assert.ok(
      /from\s+["'][^"']*utils\/dashboard-contract["']/.test(code),
      `${rel} 必须从 utils/dashboard-contract 引入（不得各自手写映射）`,
    );
    assert.ok(/\bparseDashboardOverview\b/.test(code), `${rel} 必须调用 parseDashboardOverview`);
  }
  return "两页均 import 并调用同一适配器";
});

await run("共用（强断言）：两页**不得**自建指标对象绕过适配器", () => {
  /**
   * ⚠️ 本条为 mutation M3 暴露的分辨力缺口而加（原断言只查"是否调用"，注入"调用后另写 mapping"仍能过）。
   * 判据：页面里不得出现**自建 metrics/shape 对象字面量**去喂指标：
   *   - 不得对 parse 结果做类型断言绕过（`as any` 配 `{ ok: true, data: {`
   *   - 不得在页面内手写 `month: { salesAmount:` / `today: { salesAmount:` 对象
   * 合法用法只有：`parseDashboardOverview(...)` 的返回值直接赋给 metrics/ref。
   */
  for (const rel of ["views/dashboard/Dashboard.vue", "views/pos/StoreDashboardView.vue"]) {
    const code = codeOnly(read(rel));
    assert.ok(
      !/\{\s*ok:\s*true,\s*data:\s*\{/.test(code),
      `${rel} 不得自建 {ok:true,data:{...}} 伪装适配器结果（绕过共享契约）`,
    );
    assert.ok(
      !/\b(month|today)\s*:\s*\{\s*(salesAmount|orderCount)\s*:/.test(code),
      `${rel} 不得手写 month/today 指标对象（必须来自适配器）`,
    );
  }
  return "两页零自建指标对象 / 零伪装适配器结果";
});

await run("共用（负断言）：两页不得再手写**后端原始字段**路径", () => {
  /**
   * ⚠️ 判据必须区分两种 `x.today.salesAmount`（首版一律 ban ⇒ 误判）：
   *   ① 违规：直接摸**后端原始响应**（`overview.value.today.salesAmount` / `const d = overview.value; d.todaySalesAmount`）
   *      —— 这正是 WB-AUDIT-01/08 的病灶；
   *   ② 合法：摸**适配器归一化后的领域模型**（`m.today.salesAmount`，其中 `m = metrics.value` 类型为 DashboardMetrics）
   *      —— 这是修复后的正确用法，必须允许。
   * 故判据锁定"数据源变量"：`overview` / `dashboardOverview` / `alertData` 上的原始字段读取才违规。
   */
  for (const rel of ["views/dashboard/Dashboard.vue", "views/pos/StoreDashboardView.vue"]) {
    const code = codeOnly(read(rel));
    for (const bad of [
      /overview\.value\.today\.salesAmount/,
      /overview\.value\.today\.orderCount/,
      /overview\.value\.month\.(salesAmount|orderCount)/,
      /overview\.value\.todaySalesAmount/,
      /overview\.value\.monthSalesAmount/,
      /dashboardOverview\.value\.monthSalesAmount/,
      /alertData\.value\.inventoryAlerts/,
      /alertData\.value\.pendingOrders/,
    ]) {
      assert.ok(!bad.test(code), `${rel} 含后端原始字段直读 ${bad}（应走适配器）`);
    }
  }
  // 反向确认：修复后确实改为消费适配器输出（metrics/todosRaw）
  const dash = codeOnly(read("views/dashboard/Dashboard.vue"));
  assert.ok(/\bmetrics\b/.test(dash) && /\btodosRaw\b/.test(dash), "Dashboard 应消费 metrics/todosRaw");
  const store = codeOnly(read("views/pos/StoreDashboardView.vue"));
  assert.ok(/\bmetrics\b/.test(store), "门店页应消费 metrics");
  return "两页零后端原始字段直读；均消费适配器输出";
});

await run("共用（负断言）：门店页不得再静默吞掉失败", () => {
  const code = codeOnly(read("views/pos/StoreDashboardView.vue"));
  // 旧写法：catch { /* 静默失败 */ }
  assert.ok(!/catch\s*\{\s*\}/.test(code), "不得留空 catch（静默失败会让错误态无法呈现）");
  assert.ok(/metricsError/.test(code), "必须有 metricsError 承载失败态");
  return "空 catch 0 处；metricsError 在位";
});

// ═══════════════════════════════════════════════════════════════════════════
// 八、API 层端点真实性
// ═══════════════════════════════════════════════════════════════════════════

await run("API：todos/profit 端点与后端路由逐字对齐", () => {
  const code = codeOnly(read("api/report.ts"));
  assert.ok(code.includes('"/admin/dashboard/todos"'), "必须调用 /admin/dashboard/todos");
  assert.ok(code.includes('"/admin/reports/profit"'), "必须调用 /admin/reports/profit");
  assert.ok(/dateStart/.test(code) && /dateEnd/.test(code), "profit 必须支持日期区间");
  return "两条端点 + 日期参数齐备";
});

await run("API（负断言）：不得重复定义同名导出（fetchReportProfit ×2 已合并）", () => {
  const code = codeOnly(read("api/report.ts"));
  const names = [...code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual([...new Set(dup)], [], `存在重复导出：${dup.join(", ")}`);
  return `${names.length} 个导出函数，无重名`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 九、日期区间
// ═══════════════════════════════════════════════════════════════════════════

await run("区间：todayRange / monthRange 正确", () => {
  const now = new Date(2026, 9, 28); // 2026-10-28
  assert.deepEqual(contract.todayRange(now), { dateStart: "2026-10-28", dateEnd: "2026-10-28" });
  assert.deepEqual(contract.monthRange(now), { dateStart: "2026-10-01", dateEnd: "2026-10-28" });
  return "今日 10-28/10-28；本月 10-01/10-28";
});

// ═══════════════════════════════════════════════════════════════════════════
// 十、mutation 装置自身的证据输出（WORKBENCH-07F1 静态守卫）
// ═══════════════════════════════════════════════════════════════════════════

await run("mutation 装置（负断言）：证据输出不得落回代码仓 docs/evidence/WORKBENCH-07", () => {
  /**
   * 判据（静态扫描装置源码**全文，含注释**）——两种写法都必须命中：
   *   ① 字符串拼接式：`"docs/evidence/WORKBENCH-07"` / `"docs\evidence\WORKBENCH-07"`；
   *   ② 分段拼接式：`path.join(REPO, "docs", "evidence", "WORKBENCH-07", "redtest")`。
   * ⚠️ 口径教训（本条断言自己被反测抓出缺口）：只认①等于没设防——
   *    WORKBENCH-07 的真实病灶正是 ② 的写法，首版断言扫不到它，反测 RT-1 只能靠
   *   「os.tmpdir() 缺失」这条间接理由变红。故两式并列，缺一不可。
   * 修复后装置必须 `--out <dir>` 输出到中央证据目录，未给 --out 时只写系统临时目录。
   * 口径提醒：`WORKBENCH-07F1` 这类更长目录名不会被 `WORKBENCH-07\b` 误伤（\b 在 7 与 F 之间不成立）。
   */
  const device = path.join(WEB, "tests", "dashboard-countertest.mjs");
  const src = readFileSync(device, "utf8");
  const FORBIDDEN = new RegExp(
    [
      String.raw`docs[/\\]evidence[/\\]WORKBENCH-07\b`, // ① 拼接式
      String.raw`["']docs["']\s*,\s*["']evidence["']\s*,\s*["']WORKBENCH-07["']`, // ② 分段式
    ].join("|"),
  );
  const hits = src
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter((h) => FORBIDDEN.test(h.text));
  assert.equal(
    hits.length,
    0,
    `装置源码不得出现代码仓证据路径（拼接式或分段式），命中 ${hits.length} 处：` +
      hits.map((h) => `L${h.line} ${h.text.slice(0, 90)}`).join(" ; "),
  );
  // 正向确认：装置确实支持 --out，且未给 --out 时只落系统临时目录
  assert.ok(/["']--out["']/.test(src), "装置必须支持 --out <dir>（权威证据输出到中央）");
  assert.ok(/os\.tmpdir\(\)/.test(src), "未给 --out 时必须只写系统临时目录");
  return "禁用路径 0 处（拼接式+分段式双式扫描）；--out 支持在位；默认落 os.tmpdir()";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
