import { item, type ManifestGroup } from "./types";

/** 人工操作台第 7~12 组（34 项） */
export const MANUAL_GROUPS_B: ManifestGroup[] = [
  {
    groupCode: "wb.purchase",
    title: "采购管理",
    items: [
      item("web.purchase.orders", "purchase-orders", "/purchase-orders", "采购订单", () => import("../../views/purchase/PurchaseOrders.vue")),
      item("web.purchase.in-stocks", "purchase-in-stocks", "/purchase-in-stocks", "采购入库", () => import("../../views/purchase/PurchaseInStocks.vue")),
      item("web.purchase.suppliers", "suppliers", "/suppliers", "供应商管理", () => import("../../views/purchase/Suppliers.vue")),
      item("web.purchase.payments", "purchase-payments", "/purchase-payments", "采购付款", () => import("../../views/purchase/PurchasePayments.vue")),
    ],
  },
  {
    groupCode: "wb.instant-retail",
    title: "即时零售",
    items: [
      item("web.retail.config", "instant-retail-config", "/instant-retail/config", "平台配置", () => import("../../views/instant-retail/InstantRetailConfig.vue")),
      item("web.retail.pickup", "instant-retail-pickup", "/instant-retail/pickup", "接单工作台", () => import("../../views/instant-retail/InstantRetailPickup.vue")),
      item("web.retail.orders", "instant-retail-orders", "/instant-retail/orders", "小程序订单", () => import("../../views/instant-retail/InstantRetailOrders.vue")),
      item("web.retail.order-board", "instant-retail-order-board", "/instant-retail/order-board", "订单看板", () => import("../../views/instant-retail/InstantRetailOrderBoard.vue")),
      item("web.retail.shelf", "instant-retail-shelf", "/instant-retail/shelf", "商品货架", () => import("../../views/instant-retail/InstantRetailShelf.vue")),
      item("web.retail.sync", "instant-retail-sync", "/instant-retail/sync", "库存同步", () => import("../../views/instant-retail/InstantRetailSync.vue")),
      item("web.retail.delivery", "instant-retail-delivery", "/instant-retail/delivery", "配送管理", () => import("../../views/instant-retail/InstantRetailDelivery.vue")),
      item("web.retail.platform", "instant-retail-platform", "/instant-retail/platform", "平台管理", () => import("../../views/instant-retail/InstantRetailPlatform.vue")),
      item("web.retail.payment", "instant-retail-payment", "/instant-retail/payment", "平台对账", () => import("../../views/instant-retail/InstantRetailPayment.vue")),
      item("web.retail.announcements", "retail-announcements", "/instant-retail/announcements", "平台公告", () => import("../../views/instant-retail/RetailAnnouncement.vue")),
      item("web.retail.dashboard", "instant-retail-dashboard", "/instant-retail/dashboard", "零售看板", () => import("../../views/instant-retail/InstantRetailDashboard.vue")),
      item("web.retail.report", "instant-retail-report", "/instant-retail/report", "零售报表", () => import("../../views/instant-retail/InstantRetailReport.vue")),
    ],
  },
  {
    groupCode: "wb.marketing",
    // WORKBENCH-10：组名对齐原型一级模块（原「营销中心」）
    title: "营销推广",
    items: [
      item("web.marketing.list", "marketing", "/marketing", "营销活动", () => import("../../views/marketing/MarketingView.vue")),
      item("web.marketing.coupon", "marketing-coupon", "/marketing/coupon", "优惠券管理", () => import("../../views/marketing/CouponManage.vue")),
      item("web.marketing.limited-discount", "marketing-limited-discount", "/marketing/limited-discount", "限时折扣", () => import("../../views/marketing/MarketingLimitedDiscount.vue")),
      item("web.marketing.flash-sale", "marketing-flash-sale", "/marketing/flash-sale", "秒杀活动", () => import("../../views/marketing/FlashSale.vue")),
      item("web.marketing.full-reduction", "marketing-full-reduction", "/marketing/full-reduction", "满减满赠", () => import("../../views/marketing/FullReduction.vue")),
      item("web.marketing.aftersale", "aftersale", "/aftersale", "售后管理", () => import("../../views/marketing/AftersaleView.vue")),
    ],
  },
  {
    groupCode: "wb.report",
    title: "数据报表",
    items: [
      item("web.report.list", "reports", "/reports", "销售统计", () => import("../../views/report/Reports.vue")),
      item("web.report.sales-analysis", "sales-analysis", "/reports/sales-analysis", "销售分析", () => import("../../views/report/SalesAnalysis.vue")),
      item("web.report.products", "reports-products", "/reports/products", "商品排行", () => import("../../views/report/ReportsProducts.vue")),
      item("web.report.employees", "reports-employees", "/reports/employees", "员工业绩", () => import("../../views/report/ReportsEmployees.vue")),
    ],
  },
  {
    groupCode: "wb.system",
    // WORKBENCH-10：组名对齐原型一级模块「系统管理」（原「系统设置」；
    // rail 末位另有独立的「设置」入口，两者在原型里是两个不同的东西，不可合并）
    title: "系统管理",
    items: [
      item("web.system.organization", "organization", "/organization", "组织架构", () => import("../../views/system/OrganizationView.vue")),
      item("web.system.config", "system-config", "/system/config", "系统配置", () => import("../../views/system/SystemConfigView.vue")),
      item("web.system.print", "system-print", "/system/print", "打印模板", () => import("../../modules/print/PrintTemplatesView.vue")),
      item("web.system.approval", "approval-manage", "/system/approval/manage", "审批管理", () => import("../../views/system/ApprovalManage.vue")),
      item("web.system.report-permissions", "report-permissions", "/report-permissions", "报表权限", () => import("../../views/system/ReportPermission.vue")),
      item("web.system.payment", "payment-config", "/system/payment", "支付配置", () => import("../../views/system/PaymentConfigView.vue")),
      item("web.system.miniapp", "miniapp-config", "/system/miniapp", "小程序配置", () => import("../../views/system/MiniappConfigView.vue")),
      item("web.system.monitor", "monitor-manage", "/monitor-manage", "日志与反馈", () => import("../../views/system/SystemMonitorManage.vue")),
    ],
  },
];
