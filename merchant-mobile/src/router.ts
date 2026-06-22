import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/products', name: 'products', component: () => import('./views/ProductsView.vue') },
  { path: '/create-sale', name: 'create-sale', component: () => import('./views/CreateSaleView.vue') },
  { path: '/function-center', name: 'function-center', component: () => import('./views/FunctionCenterView.vue') },
  { path: '/profile', name: 'profile', component: () => import('./views/ProfileView.vue') },
  { path: '/orders', name: 'orders', component: () => import('./views/OrdersView.vue') },
  { path: '/inventory', name: 'inventory', component: () => import('./views/InventoryView.vue') },
  { path: '/customers', name: 'customers', component: () => import('./views/CustomersView.vue') },
  { path: '/customer-detail', name: 'customer-detail', component: () => import('./views/CustomerDetailView.vue') },
  { path: '/receivables', name: 'receivables', component: () => import('./views/ReceivablesView.vue') },
  { path: '/reports', name: 'reports', component: () => import('./views/ReportsView.vue') },
  { path: '/sale-bills', name: 'sale-bills', component: () => import('./views/SaleBillsView.vue') },
  { path: '/inventory-adjust', name: 'inventory-adjust', component: () => import('./views/InventoryAdjustView.vue') },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue') },
  { path: '/admin/products', name: 'admin-products', component: () => import('./views/AdminProductsView.vue') },
  { path: '/admin/staff', name: 'admin-staff', component: () => import('./views/AdminStaffView.vue') },
  { path: '/admin/stores', name: 'admin-stores', component: () => import('./views/AdminStoresView.vue') },
  { path: '/admin/prices', name: 'admin-prices', component: () => import('./views/AdminPricesView.vue') },
  { path: '/share-collection', name: 'share-collection', component: () => import('./views/ShareCollectionView.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
