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
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
      { path: "products", name: "Products", component: () => import("../views/Products.vue") },
      { path: "prices", name: "Prices", component: () => import("../views/PricesView.vue") },
      { path: "orders", name: "Orders", component: () => import("../views/Orders.vue") },
      { path: "order-board", name: "OrderBoard", component: () => import("../views/OrderBoardView.vue") },
      { path: "order-timeout", name: "OrderTimeout", component: () => import("../views/OrderTimeoutView.vue") },
      { path: "sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue") },
      { path: "sale-returns", name: "SaleReturns", component: () => import("../views/SaleReturnsView.vue") },
      { path: "payments", name: "Payments", component: () => import("../views/PaymentsView.vue") },
      { path: "purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue") },
      { path: "purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue") },
      { path: "suppliers", name: "Suppliers", component: () => import("../views/Suppliers.vue") },
      { path: "customers", name: "Customers", component: () => import("../views/CustomersView.vue") },
      { path: "customer-statements", name: "CustomerStatements", component: () => import("../views/CustomerStatements.vue") },
      { path: "credit", name: "Credit", component: () => import("../views/CreditView.vue") },
      { path: "inventory", name: "Inventory", component: () => import("../views/Inventory.vue") },
      { path: "inventory-alerts", name: "InventoryAlerts", component: () => import("../views/InventoryAlerts.vue") },
      { path: "stores", name: "Stores", component: () => import("../views/StoresView.vue") },
      { path: "employees", name: "Employees", component: () => import("../views/EmployeesView.vue") },
      { path: "marketing", name: "Marketing", component: () => import("../views/MarketingView.vue") },
      { path: "aftersale", name: "Aftersale", component: () => import("../views/AftersaleView.vue") },
      { path: "reports", name: "Reports", component: () => import("../views/Reports.vue") },
      { path: "audit-log", name: "AuditLog", component: () => import("../views/AuditLogView.vue") },
      { path: "system", name: "System", component: () => import("../views/System.vue") },
      { path: "collection", name: "Collection", component: () => import("../views/Collection.vue") }
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
