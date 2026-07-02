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
    meta: { requiresAuth: false }
  },
  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    meta: { requiresAuth: true },
    children: [
      // 1. 工作台
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "todo-list", name: "TodoList", component: () => import("../views/TodoList.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "quick-entries", name: "QuickEntryConfig", component: () => import("../views/QuickEntryConfig.vue"), meta: { roles: ["BOSS"] } },
      { path: "messages", name: "MessageCenter", component: () => import("../views/MessageCenter.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 2. 销售管理
      { path: "sales/create", name: "SalesOrderCreate", component: () => import("../views/SalesOrderCreate.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sale-returns", name: "SaleReturns", component: () => import("../views/SaleReturnsView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "collection", name: "Collection", component: () => import("../views/Collection.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sales/collection-links", name: "CollectionLinks", component: () => import("../views/CollectionLinks.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sales/customer-prices", name: "CustomerPrices", component: () => import("../views/CustomerPrices.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sales/commission/rules", name: "CommissionRules", component: () => import("../views/CommissionRules.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sales/commission/records", name: "CommissionRecords", component: () => import("../views/CommissionRecords.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sales/reports", name: "SalesReports", component: () => import("../views/SalesReports.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 3. 订单管理
      { path: "orders", name: "Orders", component: () => import("../views/Orders.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "order-board", name: "OrderBoard", component: () => import("../views/OrderBoardView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "order-timeout", name: "OrderTimeout", component: () => import("../views/OrderTimeoutView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "order-center", name: "OrderCenter", component: () => import("../views/OrderCenterView.vue"), meta: { roles: ["BOSS"] } },
      { path: "order-routing", name: "OrderRouting", component: () => import("../views/OrderRoutingView.vue"), meta: { roles: ["BOSS"] } },
      { path: "order-sync", name: "OrderSync", component: () => import("../views/OrderSyncView.vue"), meta: { roles: ["BOSS"] } },
      { path: "order-exception", name: "OrderException", component: () => import("../views/OrderExceptionView.vue"), meta: { roles: ["BOSS"] } },
      { path: "order-product-map", name: "OrderProductMap", component: () => import("../views/OrderProductMapView.vue"), meta: { roles: ["BOSS"] } },
      { path: "order-aftersale", name: "OrderAftersale", component: () => import("../views/OrderAftersaleView.vue"), meta: { roles: ["BOSS"] } },
      // 4. 采购管理
      { path: "purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue"), meta: { roles: ["BOSS"] } },
      { path: "purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue"), meta: { roles: ["BOSS"] } },
      { path: "purchase-returns", name: "PurchaseReturns", component: () => import("../views/PurchaseReturnsView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "purchase/supplier-statements", name: "SupplierStatements", component: () => import("../views/SupplierStatements.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "purchase/plans", name: "PurchasePlans", component: () => import("../views/PurchasePlans.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "purchase-payments", name: "PurchasePayments", component: () => import("../views/PurchasePayments.vue"), meta: { roles: ["BOSS"] } },
      { path: "suppliers", name: "Suppliers", component: () => import("../views/Suppliers.vue"), meta: { roles: ["BOSS"] } },
      // 5. 库存管理
      { path: "inventory", name: "Inventory", component: () => import("../views/Inventory.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "inventory-check", name: "InventoryCheck", component: () => import("../views/InventoryCheck.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-transfer", name: "InventoryTransfer", component: () => import("../views/InventoryTransfer.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-batch", name: "InventoryBatch", component: () => import("../views/InventoryBatch.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-batch-price", name: "InventoryBatchPrice", component: () => import("../views/InventoryBatchPrice.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-price-quote", name: "InventoryPriceQuote", component: () => import("../views/InventoryPriceQuote.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-alerts", name: "InventoryAlerts", component: () => import("../views/InventoryAlerts.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "inventory-cost", name: "InventoryCost", component: () => import("../views/InventoryCost.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-alert-config", name: "InventoryAlertConfig", component: () => import("../views/InventoryAlertConfig.vue"), meta: { roles: ["BOSS"] } },
      { path: "inventory-reports", name: "InventoryReports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"] } },
      { path: "points-rules", name: "PointsRules", component: () => import("../views/PointsRules.vue"), meta: { roles: ["BOSS"] } },
      { path: "level-config", name: "LevelConfig", component: () => import("../views/LevelConfig.vue"), meta: { roles: ["BOSS"] } },
      { path: "store-value-cards", name: "StoreValueCards", component: () => import("../views/StoreValueCards.vue"), meta: { roles: ["BOSS"] } },
      { path: "member-system", name: "MemberSystem", component: () => import("../views/MemberSystem.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-tags", name: "CustomerTags", component: () => import("../views/CustomerTags.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-profile", name: "CustomerProfile", component: () => import("../views/CustomerProfile.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-care", name: "CustomerCareRules", component: () => import("../views/CustomerCareRules.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-lifecycle", name: "CustomerLifecycle", component: () => import("../views/CustomerLifecycle.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-segments", name: "CustomerSegments", component: () => import("../views/CustomerSegments.vue"), meta: { roles: ["BOSS"] } },
      // 6. 客户管理
      { path: "customers", name: "Customers", component: () => import("../views/CustomersView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "credit", name: "Credit", component: () => import("../views/CreditView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 7. 商品中心
      { path: "products", name: "Products", component: () => import("../views/Products.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/categories", name: "ProductCategories", component: () => import("../views/ProductCategories.vue"), meta: { roles: ["BOSS"] } },
      { path: "products/brands", name: "Brands", component: () => import("../views/Brands.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/units", name: "Units", component: () => import("../views/Units.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/import", name: "ProductImport", component: () => import("../views/ProductImport.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/tags", name: "ProductTags", component: () => import("../views/ProductTags.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/tag-groups", name: "TagGroups", component: () => import("../views/TagGroups.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "products/tag-relation", name: "ProductTagRelation", component: () => import("../views/ProductTagRelation.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "prices", name: "Prices", component: () => import("../views/PricesView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 8. 即时零售
      { path: "instant-retail/config", name: "InstantRetailConfig", component: () => import("../views/InstantRetailConfig.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/shelf", name: "InstantRetailShelf", component: () => import("../views/InstantRetailShelf.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/orders", name: "InstantRetailOrders", component: () => import("../views/InstantRetailOrders.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/payment", name: "InstantRetailPayment", component: () => import("../views/InstantRetailPayment.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/delivery", name: "InstantRetailDelivery", component: () => import("../views/InstantRetailDelivery.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/report", name: "InstantRetailReport", component: () => import("../views/InstantRetailReport.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/platform", name: "InstantRetailPlatform", component: () => import("../views/InstantRetailPlatform.vue"), meta: { roles: ["BOSS"] } },
      { path: "instant-retail/order-board", name: "InstantRetailOrderBoard", component: () => import("../views/InstantRetailOrderBoard.vue"), meta: { roles: ["BOSS"] } },
      // 9. 财务管理
      { path: "payments", name: "Payments", component: () => import("../views/PaymentsView.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/collection", name: "FinanceCollection", component: () => import("../views/FinanceCollection.vue"), meta: { roles: ["BOSS"] } },
      { path: "customer-statements", name: "CustomerStatements", component: () => import("../views/CustomerStatements.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/profit", name: "FinanceProfit", component: () => import("../views/FinanceProfit.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/receipts", name: "FinanceReceipts", component: () => import("../views/ReceiptsView.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/payments", name: "FinancePayments", component: () => import("../views/PaymentsNewView.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/receivables-payables", name: "FinanceReceivablesPayables", component: () => import("../views/ReceivablesPayables.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/expenses", name: "FinanceExpenses", component: () => import("../views/ExpensesView.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/reconciliation", name: "FinanceReconciliation", component: () => import("../views/ReconciliationView.vue"), meta: { roles: ["BOSS"] } },
      { path: "finance/dashboard", name: "FinanceDashboard", component: () => import("../views/FinanceDashboard.vue"), meta: { roles: ["BOSS"] } },
      // 10. 数据报表
      { path: "reports", name: "Reports", component: () => import("../views/Reports.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "reports/purchase", name: "PurchaseReports", component: () => import("../views/PurchaseReports.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "reports/products", name: "ReportsProducts", component: () => import("../views/ReportsProducts.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/employees", name: "ReportsEmployees", component: () => import("../views/ReportsEmployees.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/stores", name: "ReportsStores", component: () => import("../views/ReportsStores.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/sales-analysis", name: "SalesAnalysis", component: () => import("../views/SalesAnalysis.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "reports/collection-analysis", name: "CollectionAnalysis", component: () => import("../views/CollectionAnalysis.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "reports/customers", name: "CustomerAnalysis", component: () => import("../views/CustomerAnalysis.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/inventory", name: "InventoryReports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"] } },
      // 11. 营销推广
      { path: "marketing", name: "Marketing", component: () => import("../views/MarketingView.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/tags", name: "MarketingTags", component: () => import("../views/MarketingTags.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "marketing/limited-discount", name: "MarketingLimitedDiscount", component: () => import("../views/MarketingLimitedDiscount.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/gift-rule", name: "MarketingGiftRule", component: () => import("../views/MarketingGiftRule.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/points-mall", name: "MarketingPointsMall", component: () => import("../views/MarketingPointsMall.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/dashboard", name: "MarketingDashboard", component: () => import("../views/MarketingDashboard.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/materials", name: "MarketingMaterial", component: () => import("../views/MarketingMaterial.vue"), meta: { roles: ["BOSS"] } },
      { path: "aftersale", name: "Aftersale", component: () => import("../views/AftersaleView.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/seckill", name: "SeckillManage", component: () => import("../views/SeckillManage.vue"), meta: { title: "秒杀管理", roles: ["BOSS"] } },
      { path: "marketing/group-buy", name: "GroupBuyManage", component: () => import("../views/GroupBuyManage.vue"), meta: { title: "拼团管理", roles: ["BOSS"] } },
      // 12. 系统管理
      { path: "employees", name: "Employees", component: () => import("../views/EmployeesView.vue"), meta: { roles: ["BOSS"] } },
      { path: "stores", name: "Stores", component: () => import("../views/StoresView.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/roles", name: "SystemRoles", component: () => import("../views/SystemRoles.vue"), meta: { roles: ["BOSS"] } },
      { path: "audit-log", name: "AuditLog", component: () => import("../views/AuditLogView.vue"), meta: { roles: ["BOSS"] } },
      { path: "system", name: "System", component: () => import("../views/System.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/config", name: "SystemConfig", component: () => import("../views/SystemConfigView.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/approval/rules", name: "ApprovalRules", component: () => import("../views/ApprovalRules.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/approval/detail/:id", name: "ApprovalDetail", component: () => import("../views/ApprovalDetail.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/approval/my", name: "MyApprovals", component: () => import("../views/MyApprovals.vue"), meta: { roles: ["BOSS"] } },
      // 13. 积分商城 + 营销素材 + 部门管理 + 会话管理
      { path: "points-mall", name: "PointsMall", component: () => import("../views/PointsMall.vue"), meta: { title: "积分商城", roles: ["BOSS"] } },
      { path: "marketing-asset", name: "MarketingAsset", component: () => import("../views/MarketingAsset.vue"), meta: { title: "营销素材", roles: ["BOSS"] } },
      { path: "departments", name: "DepartmentManage", component: () => import("../views/DepartmentManage.vue"), meta: { title: "部门管理", roles: ["BOSS"] } },
      { path: "sessions", name: "SessionManage", component: () => import("../views/SessionManage.vue"), meta: { title: "会话管理", roles: ["BOSS"] } }
    ]
  },
  { path: "/:pathMatch(.*)*", name: "NotFound", component: NotFound, meta: { requiresAuth: false } }
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
