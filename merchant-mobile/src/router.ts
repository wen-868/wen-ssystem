import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/share/payment/:token',
    name: 'share-payment',
    component: () => import('./views/SharePaymentView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'home',
    component: () => import('./views/HomeView.vue'),
    meta: { requiresAuth: true, tab: 'home' }
  },
  { path: '/products', name: 'products', component: () => import('./views/ProductsView.vue'), meta: { requiresAuth: true, tab: 'products' } },
  { path: '/products/:spuId', name: 'product-detail', component: () => import('./views/ProductDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/products/:spuId/batches', name: 'batch-list', component: () => import('./views/BatchListView.vue'), meta: { requiresAuth: true } },
  { path: '/batches/:batchId/trace', name: 'batch-trace', component: () => import('./views/BatchTraceView.vue'), meta: { requiresAuth: true } },
  { path: '/create-sale', name: 'create-sale', component: () => import('./views/CreateSaleView.vue'), meta: { requiresAuth: true, tab: 'create-sale' } },
  {
    path: '/function-center',
    name: 'function-center',
    component: () => import('./views/FunctionCenterView.vue'),
    meta: { requiresAuth: true, tab: 'function-center' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('./views/ProfileView.vue'),
    meta: { requiresAuth: true, tab: 'profile' }
  },
  { path: '/orders', name: 'orders', component: () => import('./views/OrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory', name: 'inventory', component: () => import('./views/InventoryView.vue'), meta: { requiresAuth: true } },
  { path: '/customers', name: 'customers', component: () => import('./views/CustomersView.vue'), meta: { requiresAuth: true } },
  { path: '/customer-detail', name: 'customer-detail', component: () => import('./views/CustomerDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/customer-ledger', name: 'customer-ledger', component: () => import('./views/CustomerLedView.vue'), meta: { requiresAuth: true } },
  { path: '/receivables', name: 'receivables', component: () => import('./views/ReceivablesView.vue'), meta: { requiresAuth: true } },
  { path: '/reports', name: 'reports', component: () => import('./views/ReportsView.vue'), meta: { requiresAuth: true } },
  { path: '/reports/sales', name: 'sales-reports', component: () => import('./views/SalesReportsView.vue'), meta: { requiresAuth: true } },
  { path: '/shift/settlement', name: 'shift-settlement', component: () => import('./views/ShiftSettlement.vue'), meta: { requiresAuth: true } },
  { path: '/sale-bills', name: 'sale-bills', component: () => import('./views/SaleBillsView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory-adjust', name: 'inventory-adjust', component: () => import('./views/InventoryAdjustView.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/products', name: 'admin-products', component: () => import('./views/AdminProductsView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/staff', name: 'admin-staff', component: () => import('./views/AdminStaffView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/stores', name: 'admin-stores', component: () => import('./views/AdminStoresView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/prices', name: 'admin-prices', component: () => import('./views/AdminPricesView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/share-collection', name: 'share-collection', component: () => import('./views/ShareCollectionView.vue'), meta: { requiresAuth: true } },
  // 销售退货
  { path: '/sale-returns', name: 'sale-returns', component: () => import('./views/SaleReturnsView.vue'), meta: { requiresAuth: true } },
  { path: '/sale-returns/create', name: 'sale-returns-create', component: () => import('./views/CreateSaleReturnView.vue'), meta: { requiresAuth: true } },
  { path: '/sale-returns/:returnNo', name: 'sale-returns-detail', component: () => import('./views/SaleReturnDetailView.vue'), meta: { requiresAuth: true } },
  // 采购订单
  { path: '/purchase-orders', name: 'purchase-orders', component: () => import('./views/PurchaseOrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/purchase-orders/create', name: 'purchase-order-create', component: () => import('./views/CreatePurchaseOrderView.vue'), meta: { requiresAuth: true } },
  { path: '/purchase-orders/:orderNo', name: 'purchase-order-detail', component: () => import('./views/PurchaseOrderDetailView.vue'), meta: { requiresAuth: true } },
  // 采购入库
  { path: '/purchase-in-stocks', name: 'purchase-in-stocks', component: () => import('./views/PurchaseStockView.vue'), meta: { requiresAuth: true } },
  { path: '/purchase-warehousing', name: 'purchase-warehousing', component: () => import('./views/PurchaseWarehousingView.vue'), meta: { requiresAuth: true } },
  // 采购退货
  { path: '/purchase-returns', name: 'purchase-returns', component: () => import('./views/PurchaseReturnsView.vue'), meta: { requiresAuth: true } },
  { path: '/purchase-returns/create', name: 'purchase-return-create', component: () => import('./views/CreatePurchaseReturnView.vue'), meta: { requiresAuth: true } },
  { path: '/purchase-returns/:returnNo', name: 'purchase-return-detail', component: () => import('./views/PurchaseReturnDetailView.vue'), meta: { requiresAuth: true } },
  // 客户对账
  { path: '/statements', name: 'statements', component: () => import('./views/StatementsView.vue'), meta: { requiresAuth: true } },
  { path: '/statements/create', name: 'statement-create', component: () => import('./views/CreateStatementView.vue'), meta: { requiresAuth: true } },
  { path: '/statements/:statementNo', name: 'statement-detail', component: () => import('./views/StatementDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/statements/:statementNo/payment', name: 'statement-payment', component: () => import('./views/StatementPaymentView.vue'), meta: { requiresAuth: true } },
  // 供应商管理
  { path: '/suppliers', name: 'suppliers', component: () => import('./views/SuppliersView.vue'), meta: { requiresAuth: true } },
  { path: '/suppliers/:id', name: 'supplier-detail', component: () => import('./views/SupplierDetailView.vue'), meta: { requiresAuth: true } },
  // 供应商对账
  { path: '/supplier-statements', name: 'supplier-statements', component: () => import('./views/SupplierStatementsView.vue'), meta: { requiresAuth: true } },
  { path: '/supplier-statements/:statementNo', name: 'supplier-statement-detail', component: () => import('./views/SupplierStatementDetailView.vue'), meta: { requiresAuth: true } },
  // 盘点管理
  { path: '/inventory-checks', name: 'inventory-checks', component: () => import('./views/InventoryCheckView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory-checks/:checkNo/execute', name: 'inventory-check-execute', component: () => import('./views/InventoryCheckExecuteView.vue'), meta: { requiresAuth: true } },
  // 调拨管理
  { path: '/inventory-transfers', name: 'inventory-transfers', component: () => import('./views/InventoryTransferView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory-transfers/:transferNo', name: 'inventory-transfer-detail', component: () => import('./views/InventoryTransferDetailView.vue'), meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('merchant_token')

  if (to.meta.requiresAuth === false) {
    if (token) {
      next({ name: 'home' })
      return
    }
    next()
    return
  }

  if (!token) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  const requiredRole = to.meta.role as string | undefined
  if (requiredRole) {
    try {
      const savedUser = localStorage.getItem('merchant_user')
      if (savedUser) {
        const user = JSON.parse(savedUser)
        if (user.role && user.role !== requiredRole) {
          next({ name: 'home' })
          return
        }
      }
    } catch {
      // ignore
    }
  }

  next()
})

export default router