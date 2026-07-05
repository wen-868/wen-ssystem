import { createRouter, createWebHistory } from "vue-router";
import { ElMessage } from "element-plus";
import MainLayout from "../layouts/MainLayout.vue";
import LoginView from "../views/LoginView.vue";
import NotFound from "../views/NotFound.vue";

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(): boolean {
  const token = localStorage.getItem("admin_token");
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp;
}

function getUserRole(): string | null {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user.role || null;
  } catch {
    return null;
  }
}

const routes = [
  {
    path: "/login",
    name: "Login",
    component: LoginView,
    meta: { requiresAuth: false, title: "登录" }
  },
  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    meta: { requiresAuth: true },
    children: [
      // 1. 工作台
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue"), meta: { roles: ["BOSS", "MGR"], title: "工作台" } },
      { path: "todo-list", name: "TodoList", component: () => import("../views/TodoList.vue"), meta: { roles: ["BOSS", "MGR"], title: "待办事项" } },
      { path: "quick-entries", name: "QuickEntryConfig", component: () => import("../views/QuickEntryConfig.vue"), meta: { roles: ["BOSS"], title: "快捷入口配置" } },
      { path: "messages", name: "MessageCenter", component: () => import("../views/MessageCenter.vue"), meta: { roles: ["BOSS", "MGR"], title: "消息中心" } },
      // 2. 销售管理
      { path: "sales/create", name: "SalesOrderCreate", component: () => import("../views/SalesOrderCreate.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售开单" } },
      { path: "sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售单据" } },
      { path: "sale-returns", name: "SaleReturns", component: () => import("../views/SaleReturnsView.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售退货" } },
      { path: "collection", name: "Collection", component: () => import("../views/Collection.vue"), meta: { roles: ["BOSS", "MGR"], title: "收款管理" } },
      { path: "sales/collection-links", name: "CollectionLinks", component: () => import("../views/CollectionLinks.vue"), meta: { roles: ["BOSS", "MGR"], title: "收款关联" } },
      { path: "sales/customer-prices", name: "CustomerPrices", component: () => import("../views/CustomerPrices.vue"), meta: { roles: ["BOSS", "MGR"], title: "客户价格" } },
      { path: "sales/commission/rules", name: "CommissionRules", component: () => import("../views/CommissionRules.vue"), meta: { roles: ["BOSS", "MGR"], title: "提成规则" } },
      { path: "sales/commission/records", name: "CommissionRecords", component: () => import("../views/CommissionRecords.vue"), meta: { roles: ["BOSS", "MGR"], title: "提成记录" } },
      { path: "sales/reports", name: "SalesReports", component: () => import("../views/SalesReports.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售报表" } },
      // 3. 订单管理
      { path: "orders", name: "Orders", component: () => import("../views/Orders.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单列表" } },
      { path: "order-board", name: "OrderBoard", component: () => import("../views/OrderBoardView.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单看板" } },
      { path: "order-timeout", name: "OrderTimeout", component: () => import("../views/OrderTimeoutView.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单超时" } },
      { path: "order-center", name: "OrderCenter", component: () => import("../views/OrderCenterView.vue"), meta: { roles: ["BOSS"], title: "订单中心" } },
      { path: "order-routing", name: "OrderRouting", component: () => import("../views/OrderRoutingView.vue"), meta: { roles: ["BOSS"], title: "订单路由" } },
      { path: "order-sync", name: "OrderSync", component: () => import("../views/OrderSyncView.vue"), meta: { roles: ["BOSS"], title: "订单同步" } },
      { path: "order-exception", name: "OrderException", component: () => import("../views/OrderExceptionView.vue"), meta: { roles: ["BOSS"], title: "订单异常" } },
      { path: "order-product-map", name: "OrderProductMap", component: () => import("../views/OrderProductMapView.vue"), meta: { roles: ["BOSS"], title: "订单商品映射" } },
      { path: "order-aftersale", name: "OrderAftersale", component: () => import("../views/OrderAftersaleView.vue"), meta: { roles: ["BOSS"], title: "订单售后" } },
      // 4. 采购管理
      { path: "purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue"), meta: { roles: ["BOSS"], title: "采购订单" } },
      { path: "purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue"), meta: { roles: ["BOSS"], title: "采购入库" } },
      { path: "purchase-returns", name: "PurchaseReturns", component: () => import("../views/PurchaseReturnsView.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购退货" } },
      { path: "purchase/supplier-statements", name: "SupplierStatements", component: () => import("../views/SupplierStatements.vue"), meta: { roles: ["BOSS", "MGR"], title: "供应商对账" } },
      { path: "purchase/plans", name: "PurchasePlans", component: () => import("../views/PurchasePlans.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购计划" } },
      { path: "purchase-payments", name: "PurchasePayments", component: () => import("../views/PurchasePayments.vue"), meta: { roles: ["BOSS"], title: "采购付款" } },
      { path: "suppliers", name: "Suppliers", component: () => import("../views/Suppliers.vue"), meta: { roles: ["BOSS"], title: "供应商管理" } },
      // 5. 库存管理
      { path: "inventory", name: "Inventory", component: () => import("../views/Inventory.vue"), meta: { roles: ["BOSS", "MGR"], title: "库存列表" } },
      { path: "inventory-check", name: "InventoryCheck", component: () => import("../views/InventoryCheck.vue"), meta: { roles: ["BOSS"], title: "库存盘点" } },
      { path: "inventory-transfer", name: "InventoryTransfer", component: () => import("../views/InventoryTransfer.vue"), meta: { roles: ["BOSS"], title: "库存调拨" } },
      { path: "inventory-batch", name: "InventoryBatch", component: () => import("../views/InventoryBatch.vue"), meta: { roles: ["BOSS"], title: "库存批次" } },
      { path: "inventory-batch-price", name: "InventoryBatchPrice", component: () => import("../views/InventoryBatchPrice.vue"), meta: { roles: ["BOSS"], title: "批量调价" } },
      { path: "inventory-price-quote", name: "InventoryPriceQuote", component: () => import("../views/InventoryPriceQuote.vue"), meta: { roles: ["BOSS"], title: "报价管理" } },
      { path: "inventory-alerts", name: "InventoryAlerts", component: () => import("../views/InventoryAlerts.vue"), meta: { roles: ["BOSS", "MGR"], title: "库存预警" } },
      { path: "inventory-cost", name: "InventoryCost", component: () => import("../views/InventoryCost.vue"), meta: { roles: ["BOSS"], title: "库存成本" } },
      { path: "inventory-alert-config", name: "InventoryAlertConfig", component: () => import("../views/InventoryAlertConfig.vue"), meta: { roles: ["BOSS"], title: "预警配置" } },
      { path: "inventory-reports", name: "InventoryReports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"], title: "库存报表" } },
      { path: "points-rules", name: "PointsRules", component: () => import("../views/PointsRules.vue"), meta: { roles: ["BOSS"], title: "积分规则" } },
      { path: "level-config", name: "LevelConfig", component: () => import("../views/LevelConfig.vue"), meta: { roles: ["BOSS"], title: "等级配置" } },
      { path: "store-value-cards", name: "StoreValueCards", component: () => import("../views/StoreValueCards.vue"), meta: { roles: ["BOSS"], title: "储值卡管理" } },
      { path: "member-system", name: "MemberSystem", component: () => import("../views/MemberSystem.vue"), meta: { roles: ["BOSS"], title: "会员体系" } },
      { path: "customer-tags", name: "CustomerTags", component: () => import("../views/CustomerTags.vue"), meta: { roles: ["BOSS"], title: "客户标签" } },
      { path: "customer-profile", name: "CustomerProfile", component: () => import("../views/CustomerProfile.vue"), meta: { roles: ["BOSS"], title: "客户画像" } },
      { path: "customer-care", name: "CustomerCareRules", component: () => import("../views/CustomerCareRules.vue"), meta: { roles: ["BOSS"], title: "客户关怀" } },
      { path: "customer-lifecycle", name: "CustomerLifecycle", component: () => import("../views/CustomerLifecycle.vue"), meta: { roles: ["BOSS"], title: "客户生命周期" } },
      { path: "customer-segments", name: "CustomerSegments", component: () => import("../views/CustomerSegments.vue"), meta: { roles: ["BOSS"], title: "客户分群" } },
      // 6. 客户管理
      { path: "customers", name: "Customers", component: () => import("../views/CustomersView.vue"), meta: { roles: ["BOSS", "MGR"], title: "客户管理" } },
      { path: "credit", name: "Credit", component: () => import("../views/CreditView.vue"), meta: { roles: ["BOSS", "MGR"], title: "信用管理" } },
      // 7. 商品中心
      { path: "products", name: "Products", component: () => import("../views/Products.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品管理" } },
      { path: "products/categories", name: "ProductCategories", component: () => import("../views/ProductCategories.vue"), meta: { roles: ["BOSS"], title: "商品分类" } },
      { path: "products/brands", name: "Brands", component: () => import("../views/Brands.vue"), meta: { roles: ["BOSS", "MGR"], title: "品牌管理" } },
      { path: "products/units", name: "Units", component: () => import("../views/Units.vue"), meta: { roles: ["BOSS", "MGR"], title: "单位管理" } },
      { path: "products/import", name: "ProductImport", component: () => import("../views/ProductImport.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品导入" } },
      { path: "products/tags", name: "ProductTags", component: () => import("../views/ProductTags.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品标签" } },
      { path: "products/tag-groups", name: "TagGroups", component: () => import("../views/TagGroups.vue"), meta: { roles: ["BOSS", "MGR"], title: "标签分组" } },
      { path: "products/tag-relation", name: "ProductTagRelation", component: () => import("../views/ProductTagRelation.vue"), meta: { roles: ["BOSS", "MGR"], title: "标签关联" } },
      { path: "prices", name: "Prices", component: () => import("../views/PricesView.vue"), meta: { roles: ["BOSS", "MGR"], title: "价格管理" } },
      // 8. 即时零售
      { path: "instant-retail/config", name: "InstantRetailConfig", component: () => import("../views/InstantRetailConfig.vue"), meta: { roles: ["BOSS"], title: "平台配置" } },
      { path: "instant-retail/shelf", name: "InstantRetailShelf", component: () => import("../views/InstantRetailShelf.vue"), meta: { roles: ["BOSS"], title: "商品上架" } },
      { path: "instant-retail/orders", name: "InstantRetailOrders", component: () => import("../views/InstantRetailOrders.vue"), meta: { roles: ["BOSS"], title: "平台订单" } },
      { path: "instant-retail/payment", name: "InstantRetailPayment", component: () => import("../views/InstantRetailPayment.vue"), meta: { roles: ["BOSS"], title: "平台对账" } },
      { path: "instant-retail/delivery", name: "InstantRetailDelivery", component: () => import("../views/InstantRetailDelivery.vue"), meta: { roles: ["BOSS"], title: "配送管理" } },
      { path: "instant-retail/report", name: "InstantRetailReport", component: () => import("../views/InstantRetailReport.vue"), meta: { roles: ["BOSS"], title: "平台报表" } },
      { path: "instant-retail/platform", name: "InstantRetailPlatform", component: () => import("../views/InstantRetailPlatform.vue"), meta: { roles: ["BOSS"], title: "平台管理" } },
      { path: "instant-retail/order-board", name: "InstantRetailOrderBoard", component: () => import("../views/InstantRetailOrderBoard.vue"), meta: { roles: ["BOSS"], title: "订单看板" } },
      { path: "instant-retail/announcements", name: "RetailAnnouncements", component: () => import("../views/RetailAnnouncement.vue"), meta: { roles: ["BOSS"], title: "平台公告" } },
      // 9. 财务管理
      { path: "payments", name: "Payments", component: () => import("../views/PaymentsView.vue"), meta: { roles: ["BOSS"], title: "收付款管理" } },
      { path: "finance/collection", name: "FinanceCollection", component: () => import("../views/FinanceCollection.vue"), meta: { roles: ["BOSS"], title: "回款管理" } },
      { path: "customer-statements", name: "CustomerStatements", component: () => import("../views/CustomerStatements.vue"), meta: { roles: ["BOSS"], title: "客户对账" } },
      { path: "finance/profit", name: "FinanceProfit", component: () => import("../views/FinanceProfit.vue"), meta: { roles: ["BOSS"], title: "利润核算" } },
      { path: "finance/receipts", name: "FinanceReceipts", component: () => import("../views/ReceiptsView.vue"), meta: { roles: ["BOSS"], title: "收款单" } },
      { path: "finance/payments", name: "FinancePayments", component: () => import("../views/PaymentsNewView.vue"), meta: { roles: ["BOSS"], title: "付款单" } },
      { path: "finance/receivables-payables", name: "FinanceReceivablesPayables", component: () => import("../views/ReceivablesPayables.vue"), meta: { roles: ["BOSS"], title: "应收应付" } },
      { path: "finance/expenses", name: "FinanceExpenses", component: () => import("../views/ExpensesView.vue"), meta: { roles: ["BOSS"], title: "费用管理" } },
      { path: "finance/reconciliation", name: "FinanceReconciliation", component: () => import("../views/ReconciliationView.vue"), meta: { roles: ["BOSS"], title: "财务对账" } },
      { path: "finance/dashboard", name: "FinanceDashboard", component: () => import("../views/FinanceDashboard.vue"), meta: { roles: ["BOSS"], title: "财务看板" } },
      // 10. 数据报表
      { path: "reports", name: "Reports", component: () => import("../views/Reports.vue"), meta: { roles: ["BOSS", "MGR"], title: "报表中心" } },
      { path: "reports/purchase", name: "PurchaseReports", component: () => import("../views/PurchaseReports.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购报表" } },
      { path: "reports/products", name: "ReportsProducts", component: () => import("../views/ReportsProducts.vue"), meta: { roles: ["BOSS"], title: "商品报表" } },
      { path: "reports/employees", name: "ReportsEmployees", component: () => import("../views/ReportsEmployees.vue"), meta: { roles: ["BOSS"], title: "员工报表" } },
      { path: "reports/stores", name: "ReportsStores", component: () => import("../views/ReportsStores.vue"), meta: { roles: ["BOSS"], title: "门店报表" } },
      { path: "reports/sales-analysis", name: "SalesAnalysis", component: () => import("../views/SalesAnalysis.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售分析" } },
      { path: "reports/collection-analysis", name: "CollectionAnalysis", component: () => import("../views/CollectionAnalysis.vue"), meta: { roles: ["BOSS", "MGR"], title: "回款分析" } },
      { path: "reports/customers", name: "CustomerAnalysis", component: () => import("../views/CustomerAnalysis.vue"), meta: { roles: ["BOSS"], title: "客户分析" } },
      { path: "reports/inventory", name: "InventoryReports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"], title: "库存报表" } },
      // 11. 营销推广
      { path: "marketing", name: "Marketing", component: () => import("../views/MarketingView.vue"), meta: { roles: ["BOSS"], title: "营销活动" } },
      { path: "marketing/tags", name: "MarketingTags", component: () => import("../views/MarketingTags.vue"), meta: { roles: ["BOSS", "MGR"], title: "营销标签" } },
      { path: "marketing/limited-discount", name: "MarketingLimitedDiscount", component: () => import("../views/MarketingLimitedDiscount.vue"), meta: { roles: ["BOSS"], title: "限时折扣" } },
      { path: "marketing/gift-rule", name: "MarketingGiftRule", component: () => import("../views/MarketingGiftRule.vue"), meta: { roles: ["BOSS"], title: "赠品规则" } },
      { path: "marketing/points-mall", name: "MarketingPointsMall", component: () => import("../views/MarketingPointsMall.vue"), meta: { roles: ["BOSS"], title: "积分商城" } },
      { path: "marketing/dashboard", name: "MarketingDashboard", component: () => import("../views/MarketingDashboard.vue"), meta: { roles: ["BOSS"], title: "营销看板" } },
      { path: "marketing/materials", name: "MarketingMaterial", component: () => import("../views/MarketingMaterial.vue"), meta: { roles: ["BOSS"], title: "营销素材" } },
      { path: "aftersale", name: "Aftersale", component: () => import("../views/AftersaleView.vue"), meta: { roles: ["BOSS"], title: "售后管理" } },
      // 12. 系统管理
      { path: "employees", name: "Employees", component: () => import("../views/EmployeesView.vue"), meta: { roles: ["BOSS"], title: "员工管理" } },
      { path: "stores", name: "Stores", component: () => import("../views/StoresView.vue"), meta: { roles: ["BOSS"], title: "门店管理" } },
      { path: "system/roles", name: "SystemRoles", component: () => import("../views/SystemRoles.vue"), meta: { roles: ["BOSS"], title: "角色管理" } },
      { path: "audit-log", name: "AuditLog", component: () => import("../views/AuditLogView.vue"), meta: { roles: ["BOSS"], title: "操作日志" } },
      { path: "error-log", name: "ErrorLog", component: () => import("../views/ErrorLogView.vue"), meta: { roles: ["BOSS"], title: "错误日志" } },
      { path: "system", name: "System", component: () => import("../views/System.vue"), meta: { roles: ["BOSS"], title: "系统设置" } },
      { path: "system/config", name: "SystemConfig", component: () => import("../views/SystemConfigView.vue"), meta: { roles: ["BOSS"], title: "系统配置" } },
      { path: "system/approval/rules", name: "ApprovalRules", component: () => import("../views/ApprovalRules.vue"), meta: { roles: ["BOSS"], title: "审批规则" } },
      { path: "report-permissions", name: "ReportPermissions", component: () => import("../views/ReportPermission.vue"), meta: { roles: ["BOSS"], title: "报表权限" } },
      { path: "system/approval/detail/:id", name: "ApprovalDetail", component: () => import("../views/ApprovalDetail.vue"), meta: { roles: ["BOSS"], title: "审批详情" } },
      { path: "system/approval/my", name: "MyApprovals", component: () => import("../views/MyApprovals.vue"), meta: { roles: ["BOSS"], title: "我的审批" } },
      { path: "system/payment", name: "PaymentConfig", component: () => import("../views/PaymentConfigView.vue"), meta: { roles: ["BOSS"], title: "支付配置" } },
      { path: "system/miniapp", name: "MiniappConfig", component: () => import("../views/MiniappConfigView.vue"), meta: { roles: ["BOSS"], title: "小程序配置" } },
      { path: "monitor", name: "Monitor", component: () => import("../views/MonitorView.vue"), meta: { roles: ["BOSS"], title: "系统监控" } },
      { path: "system/feedback", name: "Feedback", component: () => import("../views/FeedbackView.vue"), meta: { roles: ["BOSS"], title: "反馈管理" } },
      { path: "consumer-addresses", name: "ConsumerAddresses", component: () => import("../views/ConsumerAddress.vue"), meta: { roles: ["BOSS"], title: "收货地址" } }
    ]
  },
  { path: "/:pathMatch(.*)*", name: "NotFound", component: NotFound, meta: { requiresAuth: false, title: "页面不存在" } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("admin_token");
  const expired = token && isTokenExpired();

  if (expired) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    if (to.path !== "/login") {
      next("/login");
      return;
    }
  }

  if (to.meta.requiresAuth !== false && !token) {
    next("/login");
    return;
  }

  if (to.path === "/login" && token) {
    next("/dashboard");
    return;
  }

  // 角色权限检查
  const userRole = getUserRole();
  const allowedRoles = (to.meta.roles as string[] | undefined) || [];
  if (allowedRoles.length > 0 && userRole && !allowedRoles.includes(userRole)) {
    ElMessage.warning("您没有权限访问该页面");
    next("/dashboard");
    return;
  }

  next();
});

export default router;