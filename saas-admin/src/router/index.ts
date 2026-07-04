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

function getUserRole(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem("saas_user") || "{}");
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
    meta: { requiresAuth: true, roles: ["ADMIN"] },
    children: [
      // 工作台
      { path: "dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue"), meta: { roles: ["ADMIN"] } },
      // 租户管理
      { path: "tenants", name: "Tenants", component: () => import("../views/Tenants.vue"), meta: { roles: ["ADMIN"] } },
      { path: "tenants/:id", name: "TenantDetail", component: () => import("../views/TenantDetail.vue"), meta: { roles: ["ADMIN"] } },
      // 套餐管理
      { path: "packages", name: "Packages", component: () => import("../views/Packages.vue"), meta: { roles: ["ADMIN"] } },
      { path: "packages/create", name: "PackageCreate", component: () => import("../views/PackageForm.vue"), meta: { roles: ["ADMIN"] } },
      { path: "packages/:id/edit", name: "PackageEdit", component: () => import("../views/PackageForm.vue"), meta: { roles: ["ADMIN"] } },
      // 订阅管理
      { path: "subscriptions", name: "Subscriptions", component: () => import("../views/Subscriptions.vue"), meta: { roles: ["ADMIN"] } },
      { path: "subscriptions/:id", name: "SubscriptionDetail", component: () => import("../views/SubscriptionDetail.vue"), meta: { roles: ["ADMIN"] } },
      // 平台配置
      { path: "settings", name: "Settings", component: () => import("../views/Settings.vue"), meta: { roles: ["ADMIN"] } },
      // 操作日志
      { path: "audit-logs", name: "AuditLogs", component: () => import("../views/AuditLogs.vue"), meta: { roles: ["ADMIN"] } },
      // 监控告警
      { path: "monitor", name: "Monitor", component: () => import("../views/MonitorView.vue"), meta: { roles: ["ADMIN"] } }
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
    // 角色权限检查
    const allowedRoles = to.meta.roles as string[] | undefined;
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = getUserRole();
      if (userRole && !allowedRoles.includes(userRole)) {
        next("/dashboard");
        return;
      }
    }
    next();
  }
});

export default router;