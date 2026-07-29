import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

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

function isTokenExpired(token: string): boolean {
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp;
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
          path: 'applications',
          name: 'ApplicationList',
          component: () => import('../views/tenant/ApplicationList.vue'),
          meta: { title: '注册审核' },
        },
        {
          path: 'applications/:id',
          name: 'ApplicationDetail',
          component: () => import('../views/tenant/ApplicationDetail.vue'),
          meta: { title: '申请详情' },
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
        {
          path: 'announcements',
          name: 'Announcements',
          component: () => import('../views/Announcements.vue'),
          meta: { title: '平台公告' },
        },
        {
          path: 'reviews',
          name: 'PlatformReviews',
          component: () => import('../views/PlatformReviews.vue'),
          meta: { title: '平台评价' },
        },
        {
          path: 'reconciliation',
          name: 'Reconciliation',
          component: () => import('../views/Reconciliation.vue'),
          meta: { title: '财务结算' },
        },
        {
          path: 'tenant-usage',
          name: 'TenantUsage',
          component: () => import('../views/TenantUsage.vue'),
          meta: { title: '租户使用统计' },
        },
        {
          path: 'audit-logs',
          name: 'AuditLogs',
          component: () => import('../views/AuditLogs.vue'),
          meta: { title: '操作日志' },
        },
        {
          path: 'error-logs',
          name: 'ErrorLogs',
          component: () => import('../views/ErrorLogs.vue'),
          meta: { title: '错误日志' },
        },
        {
          path: 'library/spus',
          name: 'LibrarySpus',
          component: () => import('../views/library/LibrarySpus.vue'),
          meta: { title: '商品库 · SPU管理' },
        },
        {
          path: 'library/brands',
          name: 'LibraryBrands',
          component: () => import('../views/library/LibraryBrands.vue'),
          meta: { title: '商品库 · 品牌管理' },
        },
        {
          path: 'library/reviews',
          name: 'LibraryReviews',
          component: () => import('../views/library/LibraryReviews.vue'),
          meta: { title: '商品库 · 审核列表' },
        },
        {
          path: 'library/import',
          name: 'LibraryImport',
          component: () => import('../views/library/LibraryImport.vue'),
          meta: { title: '商品库 · 批量导入' },
        },
        {
          path: 'library/api-keys',
          name: 'LibraryApiKeys',
          component: () => import('../views/library/LibraryApiKeys.vue'),
          meta: { title: '商品库 · API密钥' },
        },
        {
          path: 'mobile-preview',
          name: 'MobilePreview',
          component: () => import('../views/MobilePreview.vue'),
          meta: { title: '移动端预览' },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  const token = authStore.token;
  const expired = token && isTokenExpired(token);

  if (expired) {
    authStore.logout();
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
