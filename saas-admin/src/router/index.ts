import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../layouts/MainLayout.vue";
import LoginView from "../views/LoginView.vue";

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
  const token = localStorage.getItem("saas_token");
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp;
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
      // 工作台
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
      // 租户管理
      { path: "tenants", name: "Tenants", component: () => import("../views/Tenants.vue") },
      { path: "tenants/:id", name: "TenantDetail", component: () => import("../views/TenantDetail.vue") },
      // 套餐管理
      { path: "packages", name: "Packages", component: () => import("../views/Packages.vue") },
      { path: "packages/create", name: "PackageCreate", component: () => import("../views/PackageForm.vue") },
      { path: "packages/:id/edit", name: "PackageEdit", component: () => import("../views/PackageForm.vue") },
      // 订阅管理
      { path: "subscriptions", name: "Subscriptions", component: () => import("../views/Subscriptions.vue") },
      { path: "subscriptions/:id", name: "SubscriptionDetail", component: () => import("../views/SubscriptionDetail.vue") },
      // 平台配置
      { path: "settings", name: "Settings", component: () => import("../views/Settings.vue") }
    ]
  },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("saas_token");
  const expired = token && isTokenExpired();

  if (expired) {
    localStorage.removeItem("saas_token");
    localStorage.removeItem("saas_user");
    if (to.path !== "/login") {
      next("/login");
      return;
    }
  }

  if (to.meta.requiresAuth !== false && !token) {
    next("/login");
  } else if (to.path === "/login" && token) {
    next("/dashboard");
  } else {
    next();
  }
});

export default router;