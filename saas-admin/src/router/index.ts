import { createRouter, createWebHashHistory } from "vue-router";

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

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/login/PlatformLogin.vue'),
      meta: { title: '平台登录' },
    },
    {
      path: '/',
      component: () => import('../layouts/PlatformLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
          meta: { title: '平台看板' },
        },
        {
          path: 'tenants',
          name: 'TenantList',
          component: () => import('../views/tenant/TenantList.vue'),
          meta: { title: '租户管理' },
        },
        {
          path: 'tenants/create',
          name: 'TenantCreate',
          component: () => import('../views/tenant/TenantForm.vue'),
          meta: { title: '新增租户' },
        },
        {
          path: 'tenants/:id',
          name: 'TenantDetail',
          component: () => import('../views/tenant/TenantDetail.vue'),
          meta: { title: '租户详情' },
        },
        {
          path: 'monitor',
          name: 'Monitor',
          component: () => import('../views/monitor/MonitorView.vue'),
          meta: { title: '系统监控' },
        },
        {
          path: 'packages',
          name: 'Packages',
          component: () => import('../views/Packages.vue'),
          meta: { title: '套餐管理' },
        },
        {
          path: 'packages/create',
          name: 'PackageCreate',
          component: () => import('../views/PackageForm.vue'),
          meta: { title: '新建套餐' },
        },
        {
          path: 'packages/:id/edit',
          name: 'PackageEdit',
          component: () => import('../views/PackageForm.vue'),
          meta: { title: '编辑套餐' },
        },
        {
          path: 'subscriptions',
          name: 'Subscriptions',
          component: () => import('../views/Subscriptions.vue'),
          meta: { title: '订阅管理' },
        },
        {
          path: 'subscriptions/:id',
          name: 'SubscriptionDetail',
          component: () => import('../views/SubscriptionDetail.vue'),
          meta: { title: '订阅详情' },
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('../views/Settings.vue'),
          meta: { title: '平台配置' },
        },
      ],
    },
  ],
})

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
