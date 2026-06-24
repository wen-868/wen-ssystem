import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
  { path: "/products", name: "Products", component: () => import("../views/Products.vue") },
  { path: "/suppliers", name: "Suppliers", component: () => import("../views/Suppliers.vue") },
  { path: "/purchase-orders", name: "PurchaseOrders", component: () => import("../views/PurchaseOrders.vue") },
  { path: "/purchase-in-stocks", name: "PurchaseInStocks", component: () => import("../views/PurchaseInStocks.vue") },
  { path: "/orders", name: "Orders", component: () => import("../views/Orders.vue") },
  { path: "/sale-bills", name: "SaleBills", component: () => import("../views/SaleBills.vue") },
  { path: "/customer-statements", name: "CustomerStatements", component: () => import("../views/CustomerStatements.vue") },
  { path: "/inventory", name: "Inventory", component: () => import("../views/Inventory.vue") },
  { path: "/inventory-alerts", name: "InventoryAlerts", component: () => import("../views/InventoryAlerts.vue") },
  { path: "/collection", name: "Collection", component: () => import("../views/Collection.vue") },
  { path: "/reports", name: "Reports", component: () => import("../views/Reports.vue") },
  { path: "/system", name: "System", component: () => import("../views/System.vue") }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
