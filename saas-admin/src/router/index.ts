import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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
      redirect: '/tenants',
      children: [
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
        // 报表权限矩阵（阿澈 P18-C）
        {
          path: 'report-permissions',
          name: 'ReportPermission',
          component: () => import('../views/ReportPermission.vue'),
          meta: { title: '报表权限矩阵' },
        },
        // 系统配置（阿澈 P18-C）
        {
          path: 'sys-config',
          name: 'SysConfig',
          component: () => import('../views/SysConfigView.vue'),
          meta: { title: '系统配置' },
        },
        // 监控告警（阿澈 P18-C）
        {
          path: 'monitor',
          name: 'Monitor',
          component: () => import('../views/MonitorView.vue'),
          meta: { title: '监控告警' },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || '智享全链管理系统'
  const authStore = useAuthStore()
  if (to.path !== '/login' && !authStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router