import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: { title: "登录" }
  },
  {
    path: "/",
    component: () => import("../layouts/StoreLayout.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("../views/DashboardView.vue"),
        meta: { title: "工作台", nav: "工作台" }
      },
      {
        path: "cashier",
        name: "Cashier",
        component: () => import("../views/CashierView.vue"),
        meta: { title: "快速收银", nav: "快速收银" }
      },
      {
        path: "sale-bills",
        name: "SaleBills",
        component: () => import("../views/SaleBillsView.vue"),
        meta: { title: "销售单", nav: "销售单" }
      },
      {
        path: "order-fulfill",
        name: "OrderFulfill",
        component: () => import("../views/OrderFulfillView.vue"),
        meta: { title: "接单履约", nav: "接单履约" }
      },
      {
        path: "inventory",
        name: "Inventory",
        component: () => import("../views/InventoryView.vue"),
        meta: { title: "库存查询", nav: "库存查询" }
      },
      {
        path: "transfer",
        name: "Transfer",
        component: () => import("../views/TransferView.vue"),
        meta: { title: "调拨", nav: "调拨" }
      },
      {
        path: "stock-check",
        name: "StockCheck",
        component: () => import("../views/StockCheckView.vue"),
        meta: { title: "盘点", nav: "盘点" }
      },
      {
        path: "collection",
        name: "Collection",
        component: () => import("../views/CollectionView.vue"),
        meta: { title: "分享收款", nav: "分享收款" }
      },
      {
        path: "daily-settle",
        name: "DailySettle",
        component: () => import("../views/DailySettleView.vue"),
        meta: { title: "日结", nav: "日结" }
      },
      {
        path: "store-control",
        name: "StoreControl",
        component: () => import("../views/StoreControlView.vue"),
        meta: { title: "门店管控", nav: "门店管控" }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("store_token") || localStorage.getItem("admin_token");
  if (to.path !== "/login" && !token) {
    next("/login");
  } else if (to.path === "/login" && token) {
    next("/");
  } else {
    next();
  }
});

export default router;
