import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('./views/HomeView.vue')
  },
  {
    path: '/orders',
    name: 'orders',
    component: () => import('./views/OrdersView.vue')
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: () => import('./views/InventoryView.vue')
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('./views/CustomersView.vue')
  },
  {
    path: '/receivables',
    name: 'receivables',
    component: () => import('./views/ReceivablesView.vue')
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('./views/ReportsView.vue')
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('./views/ProfileView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
