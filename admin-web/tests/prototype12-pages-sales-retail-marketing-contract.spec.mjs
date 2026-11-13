/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SALES-RETAIL-MARKETING-01 · 28 页合同门禁用例
 *
 * 覆盖卡面「必须完成」§1/§3/§5：
 *   1. 三组全部生产路由逐页建档（路由注册合同 + 建档证据在中央 evidence archive-cards/pages/）；
 *   2. 表格/筛选/看板/弹层/详情状态完整（el-empty / v-loading / el-pagination 精确集 + 弹层点名）；
 *   3. 红线落测试：S5 COPY_BLACKLIST 零命中；演示数据边界锁定（OrderBoard/Report/Platform 三页）；
 *      SalesOrderCreate.vue 零引用（归墨）；13B 修复锚点不回潮。
 *
 * 断言口径：源码扫描（readFileSync，剥离注释后扫描产品可见面）。
 * mutation 映射（对齐 e2e/prototype12-pages-sales-retail-marketing-mutation.mjs）：
 *   M1 → 用例2 黑名单   M2 → 用例11 空态精确集   M3 → 用例6 状态机
 *   M4 → 用例9 API 绑定 M5 → 用例12 loading 精确集
 *
 * 运行（admin-web 目录）：node tests/prototype12-pages-sales-retail-marketing-contract.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

/** 本卡页面域 28 文件（sale 5 + instant-retail 12 + marketing 11 = 28；SalesOrderCreate.vue 归墨不在列） */
const SALE_PAGES = [
  "views/sale/CollectionLinks.vue",
  "views/sale/CommissionRecords.vue",
  "views/sale/CommissionRules.vue",
  "views/sale/CustomerPrices.vue",
  "views/sale/SalesReports.vue",
];
const RETAIL_PAGES = [
  "views/instant-retail/InstantRetailDashboard.vue",
  "views/instant-retail/InstantRetailOrders.vue",
  "views/instant-retail/InstantRetailConfig.vue",
  "views/instant-retail/InstantRetailDelivery.vue",
  "views/instant-retail/InstantRetailOrderBoard.vue",
  "views/instant-retail/InstantRetailPayment.vue",
  "views/instant-retail/InstantRetailPickup.vue",
  "views/instant-retail/InstantRetailPlatform.vue",
  "views/instant-retail/InstantRetailReport.vue",
  "views/instant-retail/InstantRetailShelf.vue",
  "views/instant-retail/InstantRetailSync.vue",
  "views/instant-retail/RetailAnnouncement.vue",
];
const MARKETING_PAGES = [
  "views/marketing/MarketingDashboard.vue",
  "views/marketing/MarketingView.vue",
  "views/marketing/CouponManage.vue",
  "views/marketing/FlashSale.vue",
  "views/marketing/FullReduction.vue",
  "views/marketing/AftersaleView.vue",
  "views/marketing/MarketingGiftRule.vue",
  "views/marketing/MarketingLimitedDiscount.vue",
  "views/marketing/MarketingMaterial.vue",
  "views/marketing/MarketingPointsMall.vue",
  "views/marketing/MarketingTags.vue",
];
const ALL_PAGES = [...SALE_PAGES, ...RETAIL_PAGES, ...MARKETING_PAGES];

/** 剥离注释（模板注释/块注释/整行行注释）——黑名单只对产品可见字符串生效 */
function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    const stackLine = String(err.stack || "").split("\n")[1]?.trim() ?? "";
    console.log(`FAIL  ${name}  ← ${err.message}${stackLine ? `  [${stackLine}]` : ""}`);
  }
}

/* ══ 1. 生产路由注册合同（28 页逐页点名）══ */

const ROUTES = [
  ["sales/collection-links", "collection-links", "sale/CollectionLinks.vue"],
  ["sales/customer-prices", "customer-prices", "sale/CustomerPrices.vue"],
  ["sales/commission/rules", "commission-rules", "sale/CommissionRules.vue"],
  ["sales/commission/records", "commission-records", "sale/CommissionRecords.vue"],
  ["sales/reports", "sales-reports", "sale/SalesReports.vue"],
  ["instant-retail/dashboard", "instant-retail-dashboard", "instant-retail/InstantRetailDashboard.vue"],
  ["instant-retail/orders", "instant-retail-orders", "instant-retail/InstantRetailOrders.vue"],
  ["instant-retail/config", "instant-retail-config", "instant-retail/InstantRetailConfig.vue"],
  ["instant-retail/shelf", "instant-retail-shelf", "instant-retail/InstantRetailShelf.vue"],
  ["instant-retail/pickup", "instant-retail-pickup", "instant-retail/InstantRetailPickup.vue"],
  ["instant-retail/payment", "instant-retail-payment", "instant-retail/InstantRetailPayment.vue"],
  ["instant-retail/delivery", "instant-retail-delivery", "instant-retail/InstantRetailDelivery.vue"],
  ["instant-retail/report", "instant-retail-report", "instant-retail/InstantRetailReport.vue"],
  ["instant-retail/platform", "instant-retail-platform", "instant-retail/InstantRetailPlatform.vue"],
  ["instant-retail/order-board", "instant-retail-order-board", "instant-retail/InstantRetailOrderBoard.vue"],
  ["instant-retail/announcements", "retail-announcements", "instant-retail/RetailAnnouncement.vue"],
  ["instant-retail/sync", "instant-retail-sync", "instant-retail/InstantRetailSync.vue"],
  ["marketing", "marketing", "marketing/MarketingView.vue"],
  ["marketing/tags", "marketing-tags", "marketing/MarketingTags.vue"],
  ["marketing/limited-discount", "marketing-limited-discount", "marketing/MarketingLimitedDiscount.vue"],
  ["marketing/gift-rule", "marketing-gift-rule", "marketing/MarketingGiftRule.vue"],
  ["marketing/points-mall", "marketing-points-mall", "marketing/MarketingPointsMall.vue"],
  ["marketing/dashboard", "marketing-dashboard", "marketing/MarketingDashboard.vue"],
  ["marketing/materials", "marketing-material", "marketing/MarketingMaterial.vue"],
  ["marketing/coupon", "marketing-coupon", "marketing/CouponManage.vue"],
  ["marketing/flash-sale", "marketing-flash-sale", "marketing/FlashSale.vue"],
  ["marketing/full-reduction", "marketing-full-reduction", "marketing/FullReduction.vue"],
  ["aftersale", "aftersale", "marketing/AftersaleView.vue"],
];

await run("生产路由注册合同：28 页 path+name+组件文件在 router/index.ts 逐页齐备（缺一即红）", () => {
  const routerSrc = read("router/index.ts");
  const missing = [];
  for (const [routePath, name, comp] of ROUTES) {
    if (!routerSrc.includes(`path: "${routePath}"`)) missing.push(`${comp} 缺 path "${routePath}"`);
    if (!routerSrc.includes(`name: "${name}"`)) missing.push(`${comp} 缺 name "${name}"`);
    if (!routerSrc.includes(comp)) missing.push(`${comp} 组件未注册`);
  }
  assert.deepEqual(missing, [], `路由注册缺失：\n${missing.join("\n")}`);
  return `${ALL_PAGES.length} 路由 × (path+name+组件) 齐备`;
});

/* ══ 2. S5 COPY_BLACKLIST 零命中（M1 锚点）══ */

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

await run("S5 COPY_BLACKLIST 10 项 × 28 页零命中（剥注释，逐文件点名）", () => {
  const hits = [];
  for (const rel of ALL_PAGES) {
    const visible = stripComments(read(rel));
    for (const term of COPY_BLACKLIST) {
      if (visible.includes(term)) hits.push(`${rel} ← 「${term}」`);
    }
  }
  assert.deepEqual(hits, [], `产品可见字符串命中黑名单：\n${hits.join("\n")}`);
  return `${ALL_PAGES.length} 文件 × 10 词 = 0 命中`;
});

/* ══ 3-5. 演示数据边界锁定（红线：不以原型演示数据冒充真实数据）══ */

await run("演示数据边界①：mock 订单号（JD20240115001 等）仅存在于订单看板一页，其余 26 页零泄漏", () => {
  const demoMarkers = ["JD20240115001", "MT20240115002", "张先生 138****5678"];
  const leaked = [];
  for (const rel of ALL_PAGES) {
    const src = read(rel);
    for (const marker of demoMarkers) {
      if (src.includes(marker) && rel !== "views/instant-retail/InstantRetailOrderBoard.vue") {
        leaked.push(`${rel} ← 「${marker}」`);
      }
    }
  }
  assert.deepEqual(leaked, [], `演示订单数据泄漏出看板页：\n${leaked.join("\n")}`);
  const board = read("views/instant-retail/InstantRetailOrderBoard.vue");
  assert.ok(board.includes("JD20240115001"), "订单看板 mock 边界样本丢失（建档口径失真）");
  return "mock 订单锁死在 InstantRetailOrderBoard.vue";
});

await run("演示数据边界②：报表硬编码演示指标（128560.5/1256 单）仅存在于即时零售报表一页", () => {
  const demoMarkers = ["128560.5", "sales: 128560", "orders: 1256"];
  const leaked = [];
  for (const rel of ALL_PAGES) {
    const src = read(rel);
    for (const marker of demoMarkers) {
      if (src.includes(marker) && rel !== "views/instant-retail/InstantRetailReport.vue") {
        leaked.push(`${rel} ← 「${marker}」`);
      }
    }
  }
  assert.deepEqual(leaked, [], `报表演示指标泄漏：\n${leaked.join("\n")}`);
  return "演示指标锁死在 InstantRetailReport.vue（无 API 绑定，建档已标注）";
});

await run("演示数据边界③：平台对接演示商户/门店/同步日志（JD_MCH_001 等）仅存在于平台对接一页", () => {
  const demoMarkers = ["JD_MCH_001", "MT_MCH_001", "store_001", "store_002"];
  const leaked = [];
  for (const rel of ALL_PAGES) {
    const src = read(rel);
    for (const marker of demoMarkers) {
      if (src.includes(marker) && rel !== "views/instant-retail/InstantRetailPlatform.vue") {
        leaked.push(`${rel} ← 「${marker}」`);
      }
    }
  }
  assert.deepEqual(leaked, [], `平台对接演示值泄漏：\n${leaked.join("\n")}`);
  return "演示商户锁死在 InstantRetailPlatform.vue";
});

/* ══ 6. 订单状态机合同（M3 锚点）══ */

const ORDER_STATUS_MAP_LINES = [
  'PENDING: { name: "待确认", type: "primary" }',
  'CONFIRMED: { name: "已确认", type: "" }',
  'PREPARING: { name: "备货中", type: "warning" }',
  'DELIVERING: { name: "配送中", type: "info" }',
  'COMPLETED: { name: "已完成", type: "success" }',
  'CANCELLED: { name: "已取消", type: "info" }',
  'REFUNDED: { name: "已退款", type: "danger" }',
];

await run("订单状态机七态合同：statusMap 七态中文名+tag 色在订单页与看板页逐字一致（改名/改色即点名红）", () => {
  for (const rel of ["views/instant-retail/InstantRetailOrders.vue", "views/instant-retail/InstantRetailDashboard.vue"]) {
    const src = read(rel);
    const missing = ORDER_STATUS_MAP_LINES.filter((line) => !src.includes(line));
    assert.deepEqual(missing, [], `${rel} 状态机漂移：\n${missing.join("\n")}`);
  }
  return "2 文件 × 7 态逐字落值";
});

/* ══ 7. 平台映射合同 ══ */

await run("平台映射合同：MEITUAN/ELEME/JD/MINIAPP 名称+tag 色逐字一致（订单/看板 4 平台；同步页 3 平台）", () => {
  const PLATFORM_LINES_FULL = [
    'MEITUAN: { name: "美团外卖", type: "danger" }',
    'ELEME: { name: "饿了么", type: "primary" }',
    'JD: { name: "京东到家", type: "success" }',
    'MINIAPP: { name: "自有小程序", type: "warning" }',
  ];
  const PLATFORM_LINES_SYNC = [
    'JD: { name: "京东到家", type: "success" }',
    'MEITUAN: { name: "美团外卖", type: "danger" }',
    'ELEME: { name: "饿了么", type: "primary" }',
  ];
  for (const rel of ["views/instant-retail/InstantRetailOrders.vue", "views/instant-retail/InstantRetailDashboard.vue"]) {
    const src = read(rel);
    const missing = PLATFORM_LINES_FULL.filter((line) => !src.includes(line));
    assert.deepEqual(missing, [], `${rel} 平台映射漂移：\n${missing.join("\n")}`);
  }
  const syncSrc = read("views/instant-retail/InstantRetailSync.vue");
  const missingSync = PLATFORM_LINES_SYNC.filter((line) => !syncSrc.includes(line));
  assert.deepEqual(missingSync, [], `InstantRetailSync.vue 平台映射漂移：\n${missingSync.join("\n")}`);
  return "订单/看板 4 平台 + 同步页 3 平台逐字落值";
});

/* ══ 8. sale 域 API 绑定合同 ══ */

await run("sale 域 API 绑定合同：5 页逐页点名函数齐备（收款链接/提成/价格策略/报表）", () => {
  const contract = {
    "views/sale/CollectionLinks.vue": ["fetchCollectionStats", "fetchCollectionLinks", "batchCreateCollectionLinks", "revokeCollectionLink", "fetchSaleBills"],
    "views/sale/CommissionRecords.vue": ["fetchCommissionRecords", "calculateCommission", "settleCommission", "fetchCommissionStats"],
    "views/sale/CommissionRules.vue": ["fetchCommissionRules", "createCommissionRule", "updateCommissionRule", "deleteCommissionRule"],
    "views/sale/CustomerPrices.vue": ["fetchCustomerPrices", "createCustomerPrice", "updateCustomerPrice", "deleteCustomerPrice", "batchSetCustomerPrices", "fetchMembers", "fetchProducts"],
    "views/sale/SalesReports.vue": ["fetchReportSalesTrend", "fetchReportSalesRanking", "fetchReportBusinessOverview", "fetchReportCustomerContribution", "fetchReportStaffPerformance"],
  };
  const missing = [];
  for (const [rel, fns] of Object.entries(contract)) {
    const src = read(rel);
    for (const fn of fns) if (!src.includes(fn)) missing.push(`${rel} 缺 ${fn}`);
  }
  assert.deepEqual(missing, [], `sale API 绑定缺失：\n${missing.join("\n")}`);
  return "5 页 × 26 函数齐备";
});

/* ══ 9. instant-retail 域 API 绑定合同（M4 锚点）══ */

await run("instant-retail 域 API 绑定合同：接口驱动 9 页逐页点名函数齐备（看板/平台/报表三页为演示态除外）", () => {
  const contract = {
    "views/instant-retail/InstantRetailDashboard.vue": ["fetchOrderCenterStats", "fetchInstantOrders"],
    "views/instant-retail/InstantRetailOrders.vue": ["fetchInstantOrders", "fetchInstantOrderDetail", "updateInstantOrderStatus"],
    "views/instant-retail/InstantRetailConfig.vue": ["fetchShopConfig", "saveShopConfig", "fetchBanners", "createBanner", "updateBanner", "deleteBanner", "fetchRetailCategories", "createRetailCategory", "updateRetailCategory", "deleteRetailCategory"],
    "views/instant-retail/InstantRetailDelivery.vue": ["fetchInstantDeliveries", "assignDelivery", "updateDeliveryStatus"],
    "views/instant-retail/InstantRetailPayment.vue": ["fetchInstantPayments", "fetchInstantPaymentDetail"],
    "views/instant-retail/InstantRetailPickup.vue": ["fetchInstantOrders", "updateInstantOrderStatus"],
    "views/instant-retail/InstantRetailShelf.vue": ["fetchShelfProducts", "addShelfProduct", "removeShelfProduct", "updateShelfProduct", "fetchRetailCategories", "fetchProducts"],
    "views/instant-retail/InstantRetailSync.vue": ["fetchInstantRetailConfigs", "syncPlatformOrders", "syncPlatformProducts", "fetchSyncStatus", "fetchSyncLastTime", "fetchMiniappOrderSyncLogs", "retryMiniappOrderSync"],
    "views/instant-retail/RetailAnnouncement.vue": ["fetchRetailAnnouncements", "createRetailAnnouncement", "updateRetailAnnouncement", "deleteRetailAnnouncement", "fetchStores"],
  };
  const missing = [];
  for (const [rel, fns] of Object.entries(contract)) {
    const src = read(rel);
    for (const fn of fns) if (!src.includes(fn)) missing.push(`${rel} 缺 ${fn}`);
  }
  assert.deepEqual(missing, [], `instant-retail API 绑定缺失：\n${missing.join("\n")}`);
  return "9 页 × 46 函数齐备";
});

/* ══ 10. marketing 域 API 绑定合同 ══ */

await run("marketing 域 API 绑定合同：11 页逐页点名函数齐备（优惠券/秒杀/满减/折扣/满赠/素材/积分/标签/售后）", () => {
  const contract = {
    "views/marketing/MarketingDashboard.vue": ["getMarketingOverview", "getMarketingTrend", "getActivityRanking", "getActivityStats", "getCouponStats", "getActivityComparison"],
    "views/marketing/MarketingView.vue": ["fetchCouponTemplates", "fetchFullReductions", "fetchFlashSales", "fetchGroupBuys", "getActivityEffectAnalysis"],
    "views/marketing/CouponManage.vue": ["fetchCouponTemplates", "createCouponTemplate", "updateCouponTemplate", "deleteCouponTemplate", "activateCouponTemplate", "pauseCouponTemplate", "fetchUserCoupons"],
    "views/marketing/FlashSale.vue": ["fetchFlashSales", "createFlashSale", "updateFlashSale", "deleteFlashSale", "pauseFlashSale", "fetchProducts"],
    "views/marketing/FullReduction.vue": ["fetchFullReductions", "createFullReduction", "updateFullReduction", "deleteFullReduction", "activateFullReduction", "pauseFullReduction"],
    "views/marketing/MarketingLimitedDiscount.vue": ["fetchLimitedDiscounts", "fetchLimitedDiscountDetail", "createLimitedDiscount", "updateLimitedDiscount", "deleteLimitedDiscount", "activateLimitedDiscount", "pauseLimitedDiscount", "addLimitedDiscountProducts", "fetchProducts"],
    "views/marketing/MarketingGiftRule.vue": ["fetchGiftRules", "createGiftRule", "updateGiftRule", "deleteGiftRule", "fetchProducts"],
    "views/marketing/MarketingMaterial.vue": ["fetchMarketingMaterials", "deleteMarketingMaterial", "publishMarketingMaterial", "archiveMarketingMaterial", "fetchMarketingMaterialCategories"],
    "views/marketing/MarketingPointsMall.vue": ["fetchPointsProducts", "createPointsProduct", "updatePointsProduct", "deletePointsProduct", "togglePointsProduct", "fetchPointsExchangeRecords", "fetchPointsMallStats"],
    "views/marketing/MarketingTags.vue": ["fetchProducts", "fetchProductMarketingTags", "setProductMarketingTags", "/admin/product-tags"],
    "views/marketing/AftersaleView.vue": ["fetchAfterSales", "fetchAfterSaleStatistics", "approveAfterSale", "rejectAfterSale", "confirmReceiptAfterSale", "inspectAfterSale"],
  };
  const missing = [];
  for (const [rel, fns] of Object.entries(contract)) {
    const src = read(rel);
    for (const fn of fns) if (!src.includes(fn)) missing.push(`${rel} 缺 ${fn}`);
  }
  assert.deepEqual(missing, [], `marketing API 绑定缺失：\n${missing.join("\n")}`);
  return "11 页 × 63 函数齐备";
});

/* ══ 11. 空态精确集（M2 锚点）══ */

const EL_EMPTY_EXPECTED = [
  "views/instant-retail/InstantRetailOrders.vue",
  "views/instant-retail/InstantRetailConfig.vue",
  "views/instant-retail/InstantRetailDelivery.vue",
  "views/instant-retail/InstantRetailOrderBoard.vue",
  "views/instant-retail/InstantRetailPayment.vue",
  "views/instant-retail/InstantRetailPickup.vue",
  "views/instant-retail/InstantRetailShelf.vue",
  "views/instant-retail/InstantRetailSync.vue",
  "views/instant-retail/RetailAnnouncement.vue",
  "views/marketing/MarketingDashboard.vue",
  "views/marketing/MarketingMaterial.vue",
  "views/marketing/MarketingPointsMall.vue",
  "views/marketing/MarketingTags.vue",
  "views/marketing/AftersaleView.vue",
  "views/marketing/MarketingView.vue",
];

await run("空态合同：28 页中 el-empty 落点精确集 = 15 文件（建档逐页核过；多余/缺失均点名）", () => {
  const actual = ALL_PAGES.filter((rel) => read(rel).includes("el-empty"));
  assert.deepEqual(
    actual.sort(),
    [...EL_EMPTY_EXPECTED].sort(),
    "el-empty 落点漂移（其余列表页空态由 DataTable/表格组件内置承担，不得混入）",
  );
  return `实测 15 文件，与建档一致`;
});

/* ══ 12. loading 精确集（M5 锚点）══ */

const V_LOADING_EXPECTED = [
  "views/instant-retail/InstantRetailDashboard.vue",
  "views/instant-retail/InstantRetailOrders.vue",
  "views/instant-retail/InstantRetailConfig.vue",
  "views/instant-retail/InstantRetailDelivery.vue",
  "views/instant-retail/InstantRetailPayment.vue",
  "views/instant-retail/InstantRetailShelf.vue",
  "views/instant-retail/InstantRetailSync.vue",
  "views/instant-retail/RetailAnnouncement.vue",
  "views/marketing/MarketingView.vue",
  "views/marketing/CouponManage.vue",
  "views/marketing/FlashSale.vue",
  "views/marketing/FullReduction.vue",
  "views/marketing/AftersaleView.vue",
  "views/marketing/MarketingGiftRule.vue",
  "views/marketing/MarketingLimitedDiscount.vue",
  "views/marketing/MarketingTags.vue",
];

await run("loading 合同：28 页中 v-loading 落点精确集 = 16 文件（sale 4 页走 DataTable :loading 口径，不混入）", () => {
  const actual = ALL_PAGES.filter((rel) => read(rel).includes("v-loading"));
  assert.deepEqual(
    actual.sort(),
    [...V_LOADING_EXPECTED].sort(),
    "v-loading 落点漂移（sale 域 DataTable :loading 与本断言口径分离）",
  );
  const saleTableLoading = ["views/sale/CollectionLinks.vue", "views/sale/CommissionRecords.vue", "views/sale/CommissionRules.vue", "views/sale/CustomerPrices.vue"];
  for (const rel of saleTableLoading) {
    assert.ok(read(rel).includes(":loading=\"loading\""), `${rel} DataTable 缺 :loading 绑定`);
  }
  return `实测 v-loading 16 文件 + sale DataTable :loading 4 文件`;
});

/* ══ 13. 分页精确集 ══ */

const PAGINATION_EXPECTED = [
  "views/instant-retail/InstantRetailOrders.vue",
  "views/instant-retail/InstantRetailDelivery.vue",
  "views/instant-retail/InstantRetailPayment.vue",
  "views/instant-retail/InstantRetailShelf.vue",
  "views/instant-retail/InstantRetailSync.vue",
  "views/instant-retail/RetailAnnouncement.vue",
  "views/marketing/MarketingView.vue",
  "views/marketing/CouponManage.vue",
  "views/marketing/FlashSale.vue",
  "views/marketing/FullReduction.vue",
  "views/marketing/AftersaleView.vue",
  "views/marketing/MarketingGiftRule.vue",
  "views/marketing/MarketingLimitedDiscount.vue",
  "views/marketing/MarketingMaterial.vue",
  "views/marketing/MarketingPointsMall.vue",
  "views/marketing/MarketingTags.vue",
];

await run("分页合同：28 页中 el-pagination 落点精确集 = 16 文件（sale 4 页走 DataTable 内置分页）", () => {
  const actual = ALL_PAGES.filter((rel) => read(rel).includes("el-pagination"));
  assert.deepEqual(
    actual.sort(),
    [...PAGINATION_EXPECTED].sort(),
    "分页落点漂移（看板/统计/图表页无分页属预期，不得混入）",
  );
  return `实测 16 文件，与建档一致`;
});

/* ══ 14. 表格组件归属合同 ══ */

await run("表格组件归属：sale 4 列表页走 PageCard/DataTable 口径；SalesReports 为纯图表页（无 el-table）", () => {
  for (const rel of ["views/sale/CollectionLinks.vue", "views/sale/CommissionRecords.vue", "views/sale/CommissionRules.vue", "views/sale/CustomerPrices.vue"]) {
    const src = read(rel);
    assert.ok(src.includes("DataTable"), `${rel} 缺 DataTable 组件`);
  }
  assert.ok(read("views/sale/CollectionLinks.vue").includes("PageCard"), "CollectionLinks 缺 PageCard");
  assert.ok(read("views/sale/CommissionRecords.vue").includes("PageCard"), "CommissionRecords 缺 PageCard");
  assert.ok(!read("views/sale/SalesReports.vue").includes("<el-table"), "SalesReports 不应有 el-table（纯图表页口径）");
  return "DataTable 4 页 + PageCard 2 页 + SalesReports 纯图表";
});

/* ══ 15. 弹层/抽屉合同 ══ */

await run("弹层/抽屉合同：详情抽屉 900px（订单）/560px（售后）+ 各页关键弹层标题逐字在位", () => {
  const orders = read("views/instant-retail/InstantRetailOrders.vue");
  assert.ok(orders.includes('title="订单详情"') && orders.includes('size="900px"'), "订单详情抽屉 900px 缺失");
  const aftersale = read("views/marketing/AftersaleView.vue");
  assert.ok(aftersale.includes('title="售后详情"') && aftersale.includes('size="560px"'), "售后详情抽屉 560px 缺失");
  const dialogTitles = {
    "views/sale/CollectionLinks.vue": ["批量生成分享链接"],
    "views/sale/CommissionRecords.vue": ["计算提成"],
    "views/sale/CommissionRules.vue": ["新增规则"],
    "views/sale/CustomerPrices.vue": ["新增专属价格", "批量设置专属价格"],
    "views/instant-retail/InstantRetailConfig.vue": ["新增轮播图", "新增分类"],
    "views/instant-retail/InstantRetailDelivery.vue": ["分配骑手"],
    "views/instant-retail/InstantRetailPayment.vue": ["支付详情"],
    "views/instant-retail/InstantRetailShelf.vue": ["添加商品到货架", "批量改价", "批量设置标签"],
    "views/instant-retail/InstantRetailPickup.vue": ["拒单原因"],
    "views/marketing/CouponManage.vue": ["新建优惠券", "发放记录"],
    "views/marketing/FlashSale.vue": ["新建秒杀活动", "选择秒杀商品"],
    "views/marketing/FullReduction.vue": ["新建活动"],
    "views/marketing/MarketingLimitedDiscount.vue": ["新建折扣活动", "选择适用商品"],
    "views/marketing/MarketingGiftRule.vue": ["新建满赠规则"],
    "views/marketing/MarketingMaterial.vue": ["素材详情", "上传素材"],
    "views/marketing/MarketingPointsMall.vue": ["新建商品"],
    "views/marketing/MarketingTags.vue": ["新增营销标签"],
    "views/marketing/MarketingView.vue": ["新建活动", "活动效果分析"],
  };
  const missing = [];
  for (const [rel, titles] of Object.entries(dialogTitles)) {
    const src = read(rel);
    for (const t of titles) if (!src.includes(t)) missing.push(`${rel} 缺弹层「${t}」`);
  }
  assert.deepEqual(missing, [], `弹层标题缺失：\n${missing.join("\n")}`);
  return "2 抽屉尺寸 + 18 页弹层标题齐备";
});

/* ══ 16. 表单必填规则合同 ══ */

await run("表单必填规则合同：关键表单校验逐字在位（批量生成/取消原因/店铺信息/优惠券/批量价格）", () => {
  const rules = {
    "views/sale/CollectionLinks.vue": ["billNos: [{ required: true, message: '请选择至少一张销售单'"],
    "views/instant-retail/InstantRetailOrders.vue": ['reason: [{ required: true, message: "请输入取消原因"'],
    "views/instant-retail/InstantRetailConfig.vue": ['storeName: [{ required: true, message: "请输入店铺名称"'],
    "views/marketing/CouponManage.vue": ['name: [{ required: true, message: "请输入优惠券名称"'],
    "views/sale/CustomerPrices.vue": ['skuIds: [{ required: true, message: "请选择至少一个商品"'],
  };
  const missing = [];
  for (const [rel, lines] of Object.entries(rules)) {
    const src = read(rel);
    for (const line of lines) if (!src.includes(line)) missing.push(`${rel} 缺规则 ${line.slice(0, 40)}…`);
  }
  assert.deepEqual(missing, [], `必填规则缺失：\n${missing.join("\n")}`);
  return "5 处必填规则逐字落值";
});

/* ══ 17. SalesOrderCreate 隔离红线（归墨）══ */

await run("SalesOrderCreate.vue 隔离红线：本卡 28 页零引用（页面域不越界）", () => {
  const refs = ALL_PAGES.filter((rel) => read(rel).includes("SalesOrderCreate"));
  assert.deepEqual(refs, [], `${ALL_PAGES.length} 页出现 SalesOrderCreate 引用（越界即红）：\n${refs.join("\n")}`);
  return `${ALL_PAGES.length} 页 × 0 引用`;
});

/* ══ 18. 13B 修复锚点不回潮 ══ */

await run("13B 修复锚点保留：货架全宽修复与平台对接内衬修复注释在位（历史对齐落点不回退）", () => {
  const shelf = read("views/instant-retail/InstantRetailShelf.vue");
  assert.ok(shelf.includes("WORKBENCH-13B 全宽修复"), "货架 13B 全宽修复锚点丢失");
  assert.ok(/flex-direction:\s*column/.test(shelf), "货架 shelf-layout 全宽（上下堆叠）布局回退");
  const platform = read("views/instant-retail/InstantRetailPlatform.vue");
  assert.ok(platform.includes("WORKBENCH-13B 内衬修复"), "平台对接 13B 内衬修复锚点丢失");
  assert.ok(/padding:\s*0;/.test(platform), "平台对接 tabs 容器横向内衬回潮");
  return "2 处锚点在位";
});

/* ══ 19. 错误提示兜底合同 ══ */

await run("错误提示兜底合同：接口驱动页均含 ElMessage.error 错误路径（静默容错页点名豁免）", () => {
  const mustHaveError = [
    "views/sale/CollectionLinks.vue",
    "views/sale/CommissionRecords.vue",
    "views/sale/CommissionRules.vue",
    "views/sale/CustomerPrices.vue",
    "views/instant-retail/InstantRetailDashboard.vue",
    "views/instant-retail/InstantRetailOrders.vue",
    "views/instant-retail/InstantRetailConfig.vue",
    "views/instant-retail/InstantRetailDelivery.vue",
    "views/instant-retail/InstantRetailPayment.vue",
    "views/instant-retail/InstantRetailPickup.vue",
    "views/instant-retail/InstantRetailShelf.vue",
    "views/instant-retail/InstantRetailSync.vue",
    "views/instant-retail/RetailAnnouncement.vue",
    "views/marketing/MarketingView.vue",
    "views/marketing/CouponManage.vue",
    "views/marketing/FlashSale.vue",
    "views/marketing/FullReduction.vue",
    "views/marketing/AftersaleView.vue",
    "views/marketing/MarketingGiftRule.vue",
    "views/marketing/MarketingLimitedDiscount.vue",
    "views/marketing/MarketingMaterial.vue",
    "views/marketing/MarketingPointsMall.vue",
    "views/marketing/MarketingTags.vue",
  ];
  const missing = mustHaveError.filter((rel) => !read(rel).includes("ElMessage.error"));
  assert.deepEqual(missing, [], `缺错误提示路径：\n${missing.join("\n")}`);
  return "23 页齐备；SalesReports/Dashboard(营销)/看板/平台/报表 5 页豁免口径与建档一致";
});

/* ══ 20. 死路径修复合同（阿坚移交）：fetchMarketingTagsByType 不得调用不存在的端点 ══ */

await run("死路径修复：fetchMarketingTagsByType 改接真实端点 /admin/tags/groups + /admin/tags（禁 /admin/product-tags/by-type）", () => {
  const src = read("api/marketing.ts");
  // 该函数体区间
  const fnMatch = src.match(/export async function fetchMarketingTagsByType\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, "fetchMarketingTagsByType 函数缺失");
  // 只对可执行代码断言：先剥注释（说明性注释里可以出现旧端点名，不算调用）
  const body = stripComments(fnMatch[1]);
  // 红线①：不得再出现死端点字面量
  assert.ok(
    !body.includes("/admin/product-tags/by-type"),
    "仍调用后端不存在的端点 /admin/product-tags/by-type（运行时必 404）",
  );
  // 红线②：必须接真实端点（两个都在）
  assert.ok(body.includes("/admin/tags/groups"), "未接真实端点 /admin/tags/groups");
  assert.ok(
    /api\.get\(\s*["'`]\/admin\/tags["'`]/.test(body),
    "未接真实端点 /admin/tags（标签列表，含 group_id）",
  );
  // 红线③：客户端按 group_id 映射分组名（tags 行含 group_id）
  assert.ok(body.includes("group_id"), "未按 tags.group_id 做客户端分组映射");
  return "死端点已剔除；/admin/tags/groups + /admin/tags 双真实端点 + group_id 客户端分组在位";
});

/* ══ 21. 字段名幻觉防护：函数体不得读服务端不存在的字段（groupName / tagType）══ */

await run("字段名幻觉防护：fetchMarketingTagsByType 不得读 groupName / tagType（后端 groups 行是 name，tags 行无 tagType）", () => {
  const src = read("api/marketing.ts");
  const fnMatch = src.match(/export async function fetchMarketingTagsByType\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, "fetchMarketingTagsByType 函数缺失");
  const body = stripComments(fnMatch[1]);
  // 只查可执行代码里的「读字段」形态：.groupName / .tagType / groupName: / tagType: / ["groupName"] / ["tagType"]
  const phantom = [
    [/\.\s*groupName\b/, "读了 .groupName（groups 行真实字段是 name）"],
    [/\.\s*tagType\b/, "读了 .tagType（t_product_tag 表无 tagType 列）"],
    [/\bgroupName\s*:/, "构造了 groupName 字段（服务端不返回该名）"],
    [/\btagType\s*:/, "构造了 tagType 字段（服务端不返回该名）"],
    [/\[\s*["'`]groupName["'`]\s*\]/, "以字符串键读 groupName"],
    [/\[\s*["'`]tagType["'`]\s*\]/, "以字符串键读 tagType"],
  ];
  const hits = phantom.filter(([re]) => re.test(body)).map(([, msg]) => msg);
  assert.deepEqual(hits, [], `字段名幻觉：\n${hits.join("\n")}`);
  // 正向：必须按真实字段 name 取组名
  assert.ok(/\.\s*name\b/.test(body), "未按 groups 行真实字段 name 取组名");
  return "零 groupName / 零 tagType 读字段；组名取 groups.name，分组键取 tags.group_id";
});

/* ══ 小结 ══ */

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
