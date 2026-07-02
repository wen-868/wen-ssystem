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
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || '至象平台总后台'
  const authStore = useAuthStore()
  if (to.path !== '/login' && !authStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router