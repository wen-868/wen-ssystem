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
  { path: '/profile/edit', name: 'profile-edit', component: () => import('./views/ProfileEditView.vue'), meta: { requiresAuth: true } },
  { path: '/profile/change-password', name: 'profile-change-password', component: () => import('./views/ChangePasswordView.vue'), meta: { requiresAuth: true } },
  { path: '/orders', name: 'orders', component: () => import('./views/OrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory', name: 'inventory', component: () => import('./views/InventoryView.vue'), meta: { requiresAuth: true } },
  { path: '/customers', name: 'customers', component: () => import('./views/CustomersView.vue'), meta: { requiresAuth: true } },
  { path: '/customer-detail', name: 'customer-detail', component: () => import('./views/CustomerDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/customer-ledger', name: 'customer-ledger', component: () => import('./views/CustomerLedView.vue'), meta: { requiresAuth: true } },
  { path: '/receivables', name: 'receivables', component: () => import('./views/ReceivablesView.vue'), meta: { requiresAuth: true } },
  { path: '/reports', name: 'reports', component: () => import('./views/ReportsView.vue'), meta: { requiresAuth: true } },
  { path: '/reports/sales', name: 'sales-reports', component: () => import('./views/SalesReportsView.vue'), meta: { requiresAuth: true } },
  { path: '/reports/collection', name: 'collection-analysis', component: () => import('./views/CollectionAnalysisView.vue'), meta: { requiresAuth: true } },
  { path: '/reports/inventory', name: 'inventory-analysis', component: () => import('./views/InventoryAnalysisView.vue'), meta: { requiresAuth: true } },
  { path: '/reports/customers', name: 'customer-analysis', component: () => import('./views/CustomerAnalysisView.vue'), meta: { requiresAuth: true } },
  { path: '/shift/settlement', name: 'shift-settlement', component: () => import('./views/ShiftSettlement.vue'), meta: { requiresAuth: true } },
  { path: '/sale-bills', name: 'sale-bills', component: () => import('./views/SaleBillsView.vue'), meta: { requiresAuth: true } },
  { path: '/inventory-adjust', name: 'inventory-adjust', component: () => import('./views/InventoryAdjustView.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/products', name: 'admin-products', component: () => import('./views/AdminProductsView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/staff/:staffId', name: 'admin-staff-detail', component: () => import('./views/StaffDetailView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/staff', name: 'admin-staff', component: () => import('./views/AdminStaffView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/stores', name: 'admin-stores', component: () => import('./views/AdminStoresView.vue'), meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin/stores/:id', name: 'store-detail', component: () => import('./views/StoreDetailView.vue'), meta: { requiresAuth: true, role: 'admin' } },
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
  { path: '/inventory-transfers/:transferNo', name: 'inventory-transfer-detail', component: () => import('./views/InventoryTransferDetailView.vue'), meta: { requiresAuth: true } },
  // 客户积分
  { path: '/customer-points/:customerId', name: 'customer-points', component: () => import('./views/CustomerPointsView.vue'), meta: { requiresAuth: true } },
  // 储值卡
  { path: '/store-value-card/:customerId', name: 'store-value-card', component: () => import('./views/StoreValueCardView.vue'), meta: { requiresAuth: true } },
  // 会员卡
  { path: '/member-card/:customerId', name: 'member-card', component: () => import('./views/MemberCardView.vue'), meta: { requiresAuth: true } },
  // 客户标签
  { path: '/customer-tags/:customerId', name: 'customer-tags', component: () => import('./views/CustomerTagEditView.vue'), meta: { requiresAuth: true } },
  // 财务往来
  { path: '/receipts', name: 'receipts', component: () => import('./views/ReceiptListView.vue'), meta: { requiresAuth: true } },
  { path: '/customer-receivables/:customerId', name: 'customer-receivables', component: () => import('./views/CustomerReceivableView.vue'), meta: { requiresAuth: true } },
  { path: '/expense-create', name: 'expense-create', component: () => import('./views/ExpenseCreateView.vue'), meta: { requiresAuth: true } },
  { path: '/reconciliation', name: 'reconciliation', component: () => import('./views/ReconciliationMobileView.vue'), meta: { requiresAuth: true } },
  { path: '/reconciliation/:customerId', name: 'reconciliation-detail', component: () => import('./views/ReconciliationMobileView.vue'), meta: { requiresAuth: true } },
  // 营销中心
  { path: '/marketing', name: 'marketing', component: () => import('./views/MarketingCenter.vue'), meta: { requiresAuth: true } },
  { path: '/marketing/coupons', name: 'marketing-coupons', component: () => import('./views/MarketingCoupons.vue'), meta: { requiresAuth: true } },
  { path: '/marketing/limited-discount', name: 'marketing-limited-discount', component: () => import('./views/MarketingLimitedDiscount.vue'), meta: { requiresAuth: true } },
  { path: '/marketing/points-mall', name: 'marketing-points-mall', component: () => import('./views/MarketingPointsMall.vue'), meta: { requiresAuth: true } },
  // 即时零售
  { path: '/instant-retail/orders', name: 'instant-retail-orders', component: () => import('./views/instant-retail/order-list.vue'), meta: { requiresAuth: true } },
  { path: '/instant-retail/orders/:platformOrderId', name: 'instant-retail-order-detail', component: () => import('./views/instant-retail/order-detail.vue'), meta: { requiresAuth: true } },
  { path: '/instant-retail/inventory-sync', name: 'instant-retail-inventory-sync', component: () => import('./views/instant-retail/inventory-sync.vue'), meta: { requiresAuth: true } },
  // 订单中心
  { path: '/order-center', name: 'order-center', component: () => import('./views/OrderCenterView.vue'), meta: { requiresAuth: true } },
  { path: '/order-center/detail/:channelOrderNo', name: 'order-center-detail', component: () => import('./views/OrderCenterDetailView.vue'), meta: { requiresAuth: true } },
  // 异常订单
  { path: '/order-exception', name: 'order-exception', component: () => import('./views/OrderExceptionView.vue'), meta: { requiresAuth: true } },
  { path: '/order-exception/detail/:id', name: 'order-exception-detail', component: () => import('./views/OrderExceptionDetailView.vue'), meta: { requiresAuth: true } },
  // 售后管理
  { path: '/order-aftersale/list', name: 'order-aftersale-list', component: () => import('./views/OrderAftersaleView.vue'), meta: { requiresAuth: true } },
  { path: '/order-aftersale/detail/:aftersaleNo', name: 'order-aftersale-detail', component: () => import('./views/OrderAftersaleDetailView.vue'), meta: { requiresAuth: true } },
  // 系统设置
  { path: '/profile/edit', name: 'profile-edit', component: () => import('./views/ProfileEditView.vue'), meta: { requiresAuth: true } },
  { path: '/profile/change-password', name: 'profile-change-password', component: () => import('./views/ChangePasswordView.vue'), meta: { requiresAuth: true } },
  // 通知
  { path: '/notifications', name: 'notifications', component: () => import('./views/NotificationView.vue'), meta: { requiresAuth: true } },
  { path: '/notifications/:id', name: 'notification-detail', component: () => import('./views/NotificationDetailView.vue'), meta: { requiresAuth: true } },
  // 待办
  { path: '/todos', name: 'todos', component: () => import('./views/TodoListView.vue'), meta: { requiresAuth: true } }
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