import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../layouts/MainLayout.vue";
import LoginView from "../views/LoginView.vue";

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
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
      // 2. 销售管理
      { path: "sales/create", name: "SalesOrderCreate", component: () => import("../views/SalesOrderCreate.vue") },
      { path: "sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue") },
      { path: "sale-returns", name: "SaleReturns", component: () => import("../views/SaleReturnsView.vue") },
      { path: "collection", name: "Collection", component: () => import("../views/Collection.vue") },
      // 3. 订单管理
      { path: "orders", name: "Orders", component: () => import("../views/Orders.vue") },
      { path: "order-board", name: "OrderBoard", component: () => import("../views/OrderBoardView.vue") },
      { path: "order-timeout", name: "OrderTimeout", component: () => import("../views/OrderTimeoutView.vue") },
      // 4. 采购管理
      { path: "purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue") },
      { path: "purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue") },
      { path: "purchase-returns", name: "PurchaseReturns", component: () => import("../views/PurchaseReturns.vue") },
      { path: "purchase-payments", name: "PurchasePayments", component: () => import("../views/PurchasePayments.vue") },
      { path: "suppliers", name: "Suppliers", component: () => import("../views/Suppliers.vue") },
      // 5. 库存管理
      { path: "inventory", name: "Inventory", component: () => import("../views/Inventory.vue") },
      { path: "inventory-check", name: "InventoryCheck", component: () => import("../views/InventoryCheck.vue") },
      { path: "inventory-transfer", name: "InventoryTransfer", component: () => import("../views/InventoryTransfer.vue") },
      { path: "inventory-batch", name: "InventoryBatch", component: () => import("../views/InventoryBatch.vue") },
      { path: "inventory-alerts", name: "InventoryAlerts", component: () => import("../views/InventoryAlerts.vue") },
      // 6. 客户管理
      { path: "customers", name: "Customers", component: () => import("../views/CustomersView.vue") },
      { path: "credit", name: "Credit", component: () => import("../views/CreditView.vue") },
      // 7. 商品中心
      { path: "products", name: "Products", component: () => import("../views/Products.vue") },
      { path: "products/categories", name: "ProductCategories", component: () => import("../views/ProductCategories.vue") },
      { path: "prices", name: "Prices", component: () => import("../views/PricesView.vue") },
      // 8. 即时零售
      { path: "instant-retail/config", name: "InstantRetailConfig", component: () => import("../views/InstantRetailConfig.vue") },
      { path: "instant-retail/shelf", name: "InstantRetailShelf", component: () => import("../views/InstantRetailShelf.vue") },
      { path: "instant-retail/orders", name: "InstantRetailOrders", component: () => import("../views/InstantRetailOrders.vue") },
      { path: "instant-retail/payment", name: "InstantRetailPayment", component: () => import("../views/InstantRetailPayment.vue") },
      { path: "instant-retail/delivery", name: "InstantRetailDelivery", component: () => import("../views/InstantRetailDelivery.vue") },
      { path: "instant-retail/report", name: "InstantRetailReport", component: () => import("../views/InstantRetailReport.vue") },
      { path: "instant-retail/platform", name: "InstantRetailPlatform", component: () => import("../views/InstantRetailPlatform.vue") },
      { path: "instant-retail/order-board", name: "InstantRetailOrderBoard", component: () => import("../views/InstantRetailOrderBoard.vue") },
      // 9. 财务管理
      { path: "payments", name: "Payments", component: () => import("../views/PaymentsView.vue") },
      { path: "finance/collection", name: "FinanceCollection", component: () => import("../views/FinanceCollection.vue") },
      { path: "customer-statements", name: "CustomerStatements", component: () => import("../views/CustomerStatements.vue") },
      { path: "finance/profit", name: "FinanceProfit", component: () => import("../views/FinanceProfit.vue") },
      // 10. 数据报表
      { path: "reports", name: "Reports", component: () => import("../views/Reports.vue") },
      { path: "reports/products", name: "ReportsProducts", component: () => import("../views/ReportsProducts.vue") },
      { path: "reports/employees", name: "ReportsEmployees", component: () => import("../views/ReportsEmployees.vue") },
      { path: "reports/stores", name: "ReportsStores", component: () => import("../views/ReportsStores.vue") },
      // 11. 营销推广
      { path: "marketing", name: "Marketing", component: () => import("../views/MarketingView.vue") },
      { path: "marketing/promotion", name: "MarketingPromotion", component: () => import("../views/MarketingPromotion.vue") },
      { path: "aftersale", name: "Aftersale", component: () => import("../views/AftersaleView.vue") },
      // 12. 系统管理
      { path: "employees", name: "Employees", component: () => import("../views/EmployeesView.vue") },
      { path: "stores", name: "Stores", component: () => import("../views/StoresView.vue") },
      { path: "system/roles", name: "SystemRoles", component: () => import("../views/SystemRoles.vue") },
      { path: "audit-log", name: "AuditLog", component: () => import("../views/AuditLogView.vue") },
      { path: "system", name: "System", component: () => import("../views/System.vue") }
    ]
  },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("admin_token");
  if (to.meta.requiresAuth !== false && !token) {
    next("/login");
  } else if (to.path === "/login" && token) {
    next("/dashboard");
  } else {
    next();
  }
});

export default router;
