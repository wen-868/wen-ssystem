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
      // 2. 销售管理
      { path: "sales/create", name: "SalesOrderCreate", component: () => import("../views/SalesOrderCreate.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "sale-returns", name: "SaleReturns", component: () => import("../views/SaleReturnsView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "collection", name: "Collection", component: () => import("../views/Collection.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 3. 订单管理
      { path: "orders", name: "Orders", component: () => import("../views/Orders.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "order-board", name: "OrderBoard", component: () => import("../views/OrderBoardView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "order-timeout", name: "OrderTimeout", component: () => import("../views/OrderTimeoutView.vue"), meta: { roles: ["BOSS", "MGR"] } },
      // 4. 采购管理
      { path: "purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue"), meta: { roles: ["BOSS"] } },
      { path: "purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue"), meta: { roles: ["BOSS"] } },
      { path: "purchase-returns", name: "PurchaseReturns", component: () => import("../views/PurchaseReturns.vue"), meta: { roles: ["BOSS"] } },
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
      // 10. 数据报表
      { path: "reports", name: "Reports", component: () => import("../views/Reports.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/products", name: "ReportsProducts", component: () => import("../views/ReportsProducts.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/employees", name: "ReportsEmployees", component: () => import("../views/ReportsEmployees.vue"), meta: { roles: ["BOSS"] } },
      { path: "reports/stores", name: "ReportsStores", component: () => import("../views/ReportsStores.vue"), meta: { roles: ["BOSS"] } },
      // 11. 营销推广
      { path: "marketing", name: "Marketing", component: () => import("../views/MarketingView.vue"), meta: { roles: ["BOSS"] } },
      { path: "marketing/tags", name: "MarketingTags", component: () => import("../views/MarketingTags.vue"), meta: { roles: ["BOSS", "MGR"] } },
      { path: "marketing/promotion", name: "MarketingPromotion", component: () => import("../views/MarketingPromotion.vue"), meta: { roles: ["BOSS"] } },
      { path: "aftersale", name: "Aftersale", component: () => import("../views/AftersaleView.vue"), meta: { roles: ["BOSS"] } },
      // 12. 系统管理
      { path: "employees", name: "Employees", component: () => import("../views/EmployeesView.vue"), meta: { roles: ["BOSS"] } },
      { path: "stores", name: "Stores", component: () => import("../views/StoresView.vue"), meta: { roles: ["BOSS"] } },
      { path: "system/roles", name: "SystemRoles", component: () => import("../views/SystemRoles.vue"), meta: { roles: ["BOSS"] } },
      { path: "audit-log", name: "AuditLog", component: () => import("../views/AuditLogView.vue"), meta: { roles: ["BOSS"] } },
      { path: "system", name: "System", component: () => import("../views/System.vue"), meta: { roles: ["BOSS"] } }
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
