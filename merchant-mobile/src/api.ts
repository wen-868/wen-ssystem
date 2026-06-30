import axios from 'axios'
import { showToast } from 'vant'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('merchant_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => {
    // 统一解包：让调用方直接获取 data.data
    if (response.data && typeof response.data === 'object' && 'code' in response.data && 'data' in response.data) {
      (response as any).data = response.data.data
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('merchant_token')
      window.dispatchEvent(new Event('auth:logout'))
      showToast('登录已过期，请重新登录')
    }
    return Promise.reject(error)
  }
)

/* ========== 订单 ========== */

export interface OrderItem {
  skuId: number
  skuName: string
  quantity: number
  unitPrice: number
  subtotalAmount: number
}

export interface OrderRecord {
  orderNo: string
  storeId: number
  fulfillmentType: string
  orderStatus: string
  payStatus: string
  payableAmount: number
  receiverName: string
  receiverMobile: string
  receiverAddress: string
  createdAt: string
}

export interface OrderDetail extends OrderRecord {
  items: OrderItem[]
}

export function fetchOrders(params: { page?: number; pageSize?: number; status?: string }) {
  return api.get('/store/orders', { params })
}

export function fetchOrderDetail(orderNo: string) {
  return api.get(`/store/orders/${orderNo}`)
}

export function startDelivery(orderNo: string) {
  return api.post(`/store/orders/${orderNo}/start-delivery`)
}

export function completeDelivery(orderNo: string) {
  return api.post(`/store/orders/${orderNo}/complete-delivery`)
}

export function rejectOrder(orderNo: string) {
  return api.post(`/store/orders/${orderNo}/reject`)
}

/* ========== 库存 ========== */

export interface InventoryRecord {
  storeId: number
  skuId: number
  skuName: string
  stockType: string
  physicalQty: number
  lockedQty: number
  availableQty: number
}

export function fetchInventory(params: { keyword?: string }) {
  return api.get('/store/inventory', { params })
}

/* ========== 客户 ========== */

export interface CustomerRecord {
  memberId: number
  name: string
  mobile: string
  customerType: string
  status: number
  settlementType?: string
}

export function fetchCustomers(params: { keyword?: string; page?: number; pageSize?: number }) {
  return api.get('/store/members', { params })
}

export function createCustomer(data: {
  name: string
  mobile: string
  customerType: string
  settlementType?: string
}) {
  return api.post('/store/members', data)
}

export function fetchCustomerDetail(memberId: number) {
  return api.get(`/store/members/${memberId}`)
}

export function fetchCustomerStats(memberId: number) {
  return api.get(`/store/members/${memberId}/stats`)
}

export function fetchCustomerSales(memberId: number, params: { page?: number; pageSize?: number }) {
  return api.get(`/store/members/${memberId}/sales`, { params })
}

export function fetchCustomerPayments(memberId: number, params: { page?: number; pageSize?: number }) {
  return api.get(`/store/members/${memberId}/payments`, { params })
}

export function fetchCustomerDebts(memberId: number, params: { page?: number; pageSize?: number }) {
  return api.get(`/store/members/${memberId}/debts`, { params })
}

/* ========== 客户台账 ========== */

export interface CustomerLedgerItem {
  id: number
  time: string
  type: string
  typeLabel: string
  amount: number
  balance: number
  remark: string
  billNo: string
  transactionType: string
  transactionNo: string
  sourceType: string
  sourceNo: string
  transactionDate: string
}

export interface CustomerLedgerSummary {
  memberId: number
  memberName: string
  customerId: number
  customerName: string
  openBalance: number
  totalDebit: number
  totalCredit: number
  closeBalance: number
  balance: number
  totalReceivable: number
  totalReceived: number
  totalPayable: number
  totalPaid: number
}

export interface CustomerLedgerRecord {
  memberId: number
  memberName: string
  customerType: string
  mobile: string
  openBalance: number
  totalDebit: number
  totalCredit: number
  closeBalance: number
  startDate: string
  endDate: string
}

export interface CustomerLedgerDetail extends CustomerLedgerRecord {
  items: CustomerLedgerItem[]
  summary: CustomerLedgerSummary
  records: CustomerLedgerItem[]
}

export function fetchCustomerLedgers(params: {
  page?: number
  pageSize?: number
  keyword?: string
  startDate?: string
  endDate?: string
}) {
  return api.get('/store/customer-ledgers', { params })
}

export function fetchCustomerLedgerDetail(memberId: number, params: {
  startDate?: string
  endDate?: string
}) {
  return api.get(`/store/customer-ledgers/${memberId}`, { params })
}

/* ========== 应收 ========== */

export interface ReceivableRecord {
  receivableNo: string
  sourceType: string
  sourceNo: string
  customerName: string
  customerMobile: string
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  status: string
  createdAt: string
}

export function fetchReceivables(params: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}) {
  return api.get('/store/receivables', { params })
}

export function registerReceivablePayment(
  receivableNo: string,
  data: { amount: number; paymentMethod: string; remark?: string }
) {
  return api.post(`/store/receivables/${receivableNo}/payment`, data)
}

/* ========== 报表 ========== */

export interface DashboardData {
  todayOrderCount: number
  pendingOrderCount: number
  todaySalesAmount: number
  unReceivedAmount: number
  storeId: number
}

export interface DailySalesRecord {
  date: string
  count: number
  amount: number
}

export interface InventoryAlertRecord {
  skuId: number
  skuName: string
  stockType: string
  availableQty: number
}

export function fetchDashboard() {
  return api.get('/store/dashboard')
}

export function fetchDailySales() {
  return api.get('/store/daily-sales')
}

export function fetchInventoryAlerts() {
  return api.get('/store/inventory/alerts')
}

export function fetchProductRanking(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/sales-ranking', { params })
}

export function fetchSalesRanking(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/customer-contribution', { params })
}

export function fetchSalesTrend(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports', { params })
}

export function fetchProfitAnalysis(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/profit-analysis', { params })
}

/* ========== 销售单 ========== */

export interface SaleBillItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  priceType: string
  subtotalAmount: number
}

export interface SaleBillRecord {
  billNo: string
  storeId: number
  customerId: number | null
  customerName: string
  customerMobile: string
  customerType: string
  businessStatus: string
  collectionStatus: string
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  createdAt: string
}

export interface SaleBillDetail extends SaleBillRecord {
  items: SaleBillItem[]
}

export interface CreateSaleBillParams {
  saleType?: 'CASH' | 'CREDIT'  // 销售类型：现销/赊销
  customerId?: number | null
  customerName?: string
  customerMobile?: string
  discountAmount?: number
  roundingAmount?: number
  dueDate?: string  // 赊销应收截止日期
  remark?: string
  items: {
    skuId: number
    boxQty?: number
    bottleQty?: number
    totalBottleQty: number
    unitPrice?: number
    priceType?: string
  }[]
}

export function createSaleBill(data: CreateSaleBillParams) {
  return api.post('/store/sale-bills', data)
}

export function fetchSaleBills(params: {
  page?: number
  pageSize?: number
  keyword?: string
  collectionStatus?: string
}) {
  return api.get('/store/sale-bills', { params })
}

export function fetchSaleBillDetail(billNo: string) {
  return api.get(`/store/sale-bills/${billNo}`)
}

export function offlinePayment(billNo: string, data: {
  amount: number
  paymentMethod: string
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/offline-payment`, data)
}

export function createCollectionLink(billNo: string, data: {
  amount: number
  shareChannel?: string
  expireHours?: number
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/collection-link`, data)
}

/* ========== 商品搜索（用于开单时选商品） ========== */

/* Phase 2 新增 */
export interface CategoryRecord {
  id: number
  parentId: number | null
  name: string
  icon: string | null
  code: string | null
  sortNo: number
  status: number
}

export function fetchCategories() {
  return api.get('/store/product-categories')
}

export interface ProductDetailRecord {
  spuId: number
  spuCode: string
  name: string
  categoryId: number
  categoryName: string
  mainImage: string
  imageUrls: string[]
  detail: string
  alcoholContent: number
  origin: string
  saleChannels: string[]
  status: string
  brand: string
  unit: string
  specs: string
  sortNo: number
  isNew: number
  isRecommend: number
  marketingTags: string[] | null
  description: string
  createdAt: string
  updatedAt: string
  skus: ProductDetailSku[]
}

export interface ProductDetailSku {
  skuId: number
  spuId: number
  skuCode: string
  skuName: string
  barcode: string
  alcoholDegree: number
  skuOrigin: string
  baseUnit: string
  boxUnit: string
  boxRatio: number
  temperature: string
  traceEnabled: number
  warningThreshold: number
  status: number
  volume: string
  packaging: string
  costPrice: number
  retailPrice: number
  wholesalePrice: number
  miniappPrice: number
  storePrice: number
  availableQty: number
}

export function fetchProductDetail(spuId: number) {
  return api.get(`/store/products/${spuId}`)
}

export interface ProductRecord {
  spuId: number
  skuId: number
  skuCode: string
  productName: string
  skuName: string
  barcode: string
  retailPrice: number
  wholesalePrice: number
  storePrice: number
  availableQty: number
}

export function fetchProducts(params: { keyword?: string; barcode?: string; category?: string; categoryId?: number; tagIds?: number[]; page?: number; pageSize?: number }) {
  return api.get('/store/products', { params })
}

/* ========== 库存调整 ========== */

export interface InventoryLogRecord {
  logNo: string
  storeId: number
  skuId: number
  skuName: string
  changeQty: number
  beforeQty: number
  afterQty: number
  reason: string
  operatorId: number
  createdAt: string
}

export function adjustInventory(data: {
  skuId: number
  stockType?: string
  change: number
  remark?: string
}) {
  return api.post('/store/inventory/adjust', data)
}

export function fetchInventoryLogs(params: {
  page?: number
  pageSize?: number
}) {
  return api.get('/store/inventory/logs', { params })
}

/* ========== 管理后台 ========== */

export interface AdminProductRecord {
  spuId: number
  skuId: number
  name: string
  mainImage: string
  skuName: string
  skuCode: string
  barcode: string
  retailPrice: number
  wholesalePrice: number
  storePrice?: number
  status: string
  alcoholContent: number | null
  origin: string | null
  boxRatio: number
  boxUnit: string
  baseUnit: string
  categoryName: string | null
  brand?: string | null
  skuCount?: number
  totalStock?: number
}

export interface AdminCustomerRecord {
  memberId: number
  name: string
  mobile: string
  customerType: string
  points: number
  levelCode: string | null
  status: number
  staffId: number | null
  staffName: string | null
  totalSpent: number
  arrears: number
}

export interface AdminStaffRecord {
  staffId: number
  username: string
  realName: string
  storeId: number
  status: number
}

export interface AdminStoreRecord {
  id: number
  storeCode: string
  name: string
  address: string
  contact: string
  phone: string
  deliveryRadius: number
  businessStatus: string
  status: number
}

export function fetchAdminProducts(params: { page?: number; pageSize?: number; keyword?: string; category?: string }) {
  return api.get('/admin/products', { params })
}

export function fetchAdminCustomers(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/admin/customers', { params })
}

export function createAdminProduct(data: {
  name: string
  categoryId: number
  mainImage?: string
  saleChannels?: string[]
  skus: {
    skuName: string
    barcode?: string
    boxRatio?: number
    temperature?: string
    traceEnabled?: boolean
    warningThreshold?: number
    costPrice?: number
    retailPrice: number
    wholesalePrice?: number | null
    miniappPrice?: number | null
    storePrice?: number | null
  }[]
}) {
  return api.post('/admin/products', data)
}

export function updateProductStatus(spuId: number, status: string) {
  return api.patch(`/admin/products/${spuId}/status`, { status })
}

export function updateProductPrice(skuId: number, data: {
  costPrice?: number
  retailPrice?: number
  wholesalePrice?: number | null
  miniappPrice?: number | null
  storePrice?: number | null
}) {
  return api.put(`/admin/products/${skuId}/price`, data)
}

export function fetchAdminStaff() {
  return api.get('/admin/staff')
}

export function fetchAdminStores(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/admin/stores', { params })
}

export function createAdminStore(data: {
  name: string
  address?: string
  lng?: number
  lat?: number
  contact?: string
  phone?: string
  deliveryRadius?: number
}) {
  return api.post('/admin/stores', data)
}

/* ========== 分享收款 ========== */

export interface CollectionLinkRecord {
  linkNo: string
  sourceType: string
  sourceNo: string
  amount: number
  paidAmount: number
  status: string
  shareChannel: string
  token: string
  expireAt: string
  createdAt: string
}

export interface PaymentOrderRecord {
  payNo: string
  sourceType: string
  sourceNo: string
  amount: number
  status: string
  paymentMethod: string
  paidAt: string
  createdAt: string
}

export interface RefundOrderRecord {
  refundNo: string
  payNo: string
  sourceType: string
  sourceNo: string
  amount: number
  reason: string
  status: string
  createdAt: string
}

export function fetchCollectionLinks(params: { page?: number; pageSize?: number }) {
  return api.get('/store/collection-links', { params })
}

export function fetchPaymentOrders(params: { page?: number; pageSize?: number }) {
  return api.get('/store/payment-orders', { params })
}

export function fetchRefundOrders(params: { page?: number; pageSize?: number }) {
  return api.get('/store/refund-orders', { params })
}

/* ========== 销售退货 ========== */

export interface SaleReturnItem {
  id: number
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  subtotal: number
  reason: string
}

export interface SaleReturnRecord {
  id: number
  returnNo: string
  sourceBillNo: string
  storeId: number
  customerId: number | null
  customerName: string
  customerMobile: string
  status: string
  refundStatus: string
  returnType: string
  reason: string
  goodsAmount: number
  discountAmount: number
  refundAmount: number
  refundedAmount: number
  refundMethod: string
  operatorId: number
  auditorId: number
  auditedAt: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface SaleReturnDetail extends SaleReturnRecord {
  items: SaleReturnItem[]
}

export function fetchSaleReturns(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}) {
  return api.get('/store/sale-returns', { params })
}

export function fetchSaleReturnDetail(returnNo: string) {
  return api.get(`/store/sale-returns/${returnNo}`)
}

export function createSaleReturn(data: {
  sourceBillNo?: string
  storeId?: number
  customerId?: number | null
  customerName?: string
  customerMobile?: string
  returnType?: string
  reason?: string
  discountAmount?: number
  remark?: string
  items: {
    skuId: number
    skuName?: string
    boxQty?: number
    bottleQty?: number
    unitPrice?: number
    reason?: string
  }[]
}) {
  return api.post('/store/sale-returns', data)
}

export function approveSaleReturn(returnNo: string) {
  return api.post(`/store/sale-returns/${returnNo}/approve`)
}

export function refundSaleReturn(returnNo: string, data?: { refundMethod?: string }) {
  return api.post(`/store/sale-returns/${returnNo}/refund`, data)
}

/* ========== 采购订单 ========== */

export interface PurchaseOrderItem {
  id: number
  skuId: number
  skuName: string
  barcode: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  quantity: number
  unitPrice: number
  taxRate: number
  subtotal: number
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  remark: string
}

export interface PurchaseOrderRecord {
  id: number
  purchaseNo: string
  orderNo: string
  supplierId: number
  supplierName: string
  storeId: number
  warehouseName: string
  status: string
  orderStatus: string
  warehouseStatus: string
  goodsAmount: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  payableAmount: number
  expectedDate: string
  actualDate: string
  operatorId: number
  auditorId: number
  auditedAt: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderDetail extends PurchaseOrderRecord {
  items: PurchaseOrderItem[]
  operationLogs: {
    action: string
    operatorId: number
    operator: string
    remark: string
    createdAt: string
  }[]
}

export function fetchPurchaseOrders(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  orderStatus?: string
  supplierId?: number
}) {
  return api.get('/store/purchase-orders', { params })
}

export function fetchPurchaseOrderDetail(purchaseNo: string | number) {
  return api.get(`/store/purchase-orders/${purchaseNo}`)
}

export function createPurchaseOrder(data: {
  supplierId: number
  supplierName?: string
  storeId?: number
  warehouseId?: number
  expectedDate?: string
  discountAmount?: number
  remark?: string
  items: {
    skuId: number
    skuName?: string
    barcode?: string
    boxQty?: number
    bottleQty?: number
    unitPrice?: number
    taxRate?: number
    remark?: string
  }[]
}) {
  return api.post('/store/purchase-orders', data)
}

export function updatePurchaseOrder(purchaseNo: string, data: {
  supplierId?: number
  expectedDate?: string
  discountAmount?: number
  remark?: string
  items?: {
    skuId: number
    boxQty?: number
    bottleQty?: number
    unitPrice?: number
    remark?: string
  }[]
}) {
  return api.put(`/store/purchase-orders/${purchaseNo}`, data)
}

export function deletePurchaseOrder(purchaseNo: string) {
  return api.delete(`/store/purchase-orders/${purchaseNo}`)
}

export function submitPurchaseOrder(purchaseNo: string) {
  return api.post(`/store/purchase-orders/${purchaseNo}/submit`)
}

export function approvePurchaseOrder(purchaseNo: string) {
  return api.post(`/store/purchase-orders/${purchaseNo}/approve`)
}

export function cancelPurchaseOrder(purchaseNo: string | number, reason?: string) {
  return api.post(`/store/purchase-orders/${purchaseNo}/cancel`, { reason })
}

export function confirmPurchaseOrder(purchaseNo: string | number) {
  return api.post(`/store/purchase-orders/${purchaseNo}/confirm`)
}

/* ========== 采购入库 ========== */

export function purchaseInStock(data: {
  purchaseNo: string
  warehouseId?: number
  remark?: string
  items: {
    skuId: number
    boxQty?: number
    bottleQty?: number
  }[]
}) {
  return api.post(`/store/purchase-orders/${data.purchaseNo}/in-stock`, data)
}

/* ========== 采购入库记录 ========== */

export interface PurchaseStockRecord {
  id: number
  stockNo: string
  orderNo: string
  purchaseNo: string
  stockStatus: string
  supplierId: number
  supplierName: string
  warehouseId: number
  warehouseName: string
  status: string
  totalQty: number
  totalAmount: number
  goodsAmount: number
  taxAmount: number
  remark: string
  operatorId: number
  operatorName: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseStockDetail extends PurchaseStockRecord {
  items: PurchaseStockItem[]
  stockStatus: string
}

export interface PurchaseStockItem {
  id: number
  skuId: number
  skuName: string
  skuCode: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  subtotal: number
  subtotalAmount: number
}

export function fetchPurchaseInStocks(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  stockStatus?: string
}) {
  return api.get('/store/purchase-in-stocks', { params })
}

export function fetchPurchaseInStockDetail(stockNo: string | number) {
  return api.get(`/store/purchase-in-stocks/${stockNo}`)
}

export function confirmPurchaseInStock(stockNo: string | number) {
  return api.post(`/store/purchase-in-stocks/${stockNo}/confirm`)
}

/* ========== 采购退货 ========== */

export interface PurchaseReturnItem {
  id: number
  skuId: number
  skuName: string
  returnQty: number
  returnPrice: number
  returnAmount: number
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  subtotalAmount: number
  reason: string
}

export interface PurchaseReturnRecord {
  id: number
  returnNo: string
  purchaseNo: string
  orderNo: string
  supplierId: number
  supplierName: string
  status: string
  returnStatus: string
  totalAmount: number
  goodsAmount: number
  refundAmount: number
  refundedAmount: number
  refundMethod: string
  reason: string
  operatorId: number
  auditorId: number
  auditedAt: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseReturnDetail extends PurchaseReturnRecord {
  items: PurchaseReturnItem[]
}

export function fetchPurchaseReturns(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  returnStatus?: string
  supplierId?: number
}) {
  return api.get('/store/purchase-returns', { params })
}

export function fetchPurchaseReturnDetail(returnNo: string | number) {
  return api.get(`/store/purchase-returns/${returnNo}`)
}

export function createPurchaseReturn(data: {
  purchaseNo?: string
  supplierId?: number
  supplierName?: string
  reason: string
  remark?: string
  items: {
    skuId: number
    returnQty: number
    returnPrice: number
    reason?: string
  }[]
}) {
  return api.post('/store/purchase-returns', data)
}

export type CreatePurchaseReturnParams = Parameters<typeof createPurchaseReturn>[0]

export function approvePurchaseReturn(returnNo: string) {
  return api.post(`/store/purchase-returns/${returnNo}/approve`)
}

/* ========== 客户往来账 ========== */

export interface StatementRecord {
  id: number
  statementNo: string
  customerId: number
  customerName: string
  customerMobile: string
  periodStart: string
  periodEnd: string
  openingBalance: number
  periodReceivable: number
  periodReceived: number
  closingBalance: number
  status: string
  operatorId: number
  createdAt: string
  updatedAt: string
}

export interface StatementDetail extends StatementRecord {
  details: {
    id: number
    date: string
    type: string
    billNo: string
    summary: string
    debit: number
    credit: number
    balance: number
    remark: string
  }[]
}

export function fetchStatements(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  customerId?: number
}) {
  return api.get('/store/customer-statements', { params })
}

export function fetchStatementDetail(statementNo: string) {
  return api.get(`/store/customer-statements/${statementNo}`)
}

export function generateStatement(data: {
  customerId?: number
  memberId?: number
  periodStart: string
  periodEnd: string
}) {
  return api.post('/store/customer-statements/generate', data)
}

export function confirmStatement(statementNo: string) {
  return api.post(`/store/customer-statements/${statementNo}/confirm`)
}

export function recordStatementPayment(statementNo: string, data: {
  amount: number
  paymentMethod: string
  paymentDate: string
  remark?: string
}) {
  return api.post(`/store/customer-statements/${statementNo}/payment`, data)
}

export function fetchStatementPayments(params: {
  page?: number
  pageSize?: number
  customerId?: number
}) {
  return api.get('/store/customer-payments', { params })
}

/* ========== 分享支付（H5支付页面） ========== */

export interface ShareCollectionDetail {
  linkNo: string
  sourceType: string
  sourceNo: string
  amount: number
  paidAmount: number
  status: string
  expireAt: string
  taxEnabled: boolean
  taxRate: number
  taxAmount: number
  customerName: string
  storeName: string
  items: ShareCollectionItem[]
}

export interface ShareCollectionItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  subtotalAmount: number
}

export function fetchCollectionLinkByToken(token: string) {
  return api.get(`/share/collections/${token}`)
}

export function payCollectionByToken(token: string) {
  return api.post(`/share/collections/${token}/pay`)
}

/* ========== 班结 ========== */

export interface ShiftData {
  shiftDate: string
  startTime: string
  operatingHours: string
  totalSales: number
  orderCount: number
  cashOrderCount: number
  creditOrderCount: number
  returnOrderCount: number
  totalReceived: number
  paymentBreakdown: ShiftPaymentBreakdown[]
  settleNo?: string
}

export interface ShiftPaymentBreakdown {
  channel: string
  amount: number
}

export function fetchShiftSummary() {
  return api.get('/store/shift/current')
}

export function submitShiftSettlement(data: { actualAmount: number }) {
  return api.post('/store/shift/settle', data)
}

export function fetchShiftHistory(params?: { page?: number; pageSize?: number }) {
  return api.get('/store/shift/history', { params })
}

/* ========== Phase 3: 标签 ========== */

export interface TagGroupRecord {
  id: number
  name: string
  code: string
  sortNo: number
  isMultiple: number
  status: number
}

export interface TagRecord {
  id: number
  groupId: number
  groupName: string
  name: string
  sortNo: number
  status: number
}

export interface ProductTagGroups {
  groups: {
    groupId: number
    groupName: string
    groupCode: string
    isMultiple: number
    tags: { id: number; name: string }[]
  }[]
  tagIds: number[]
}

export function fetchTagGroups() {
  return api.get('/store/tag-groups')
}

export function fetchTags(groupId?: number) {
  return api.get('/store/tags', { params: groupId ? { groupId } : undefined })
}

export function fetchProductTags(spuId: number) {
  return api.get(`/store/products/${spuId}/tags`)
}

/* ========== Phase 3: 批次 ========== */

export interface BatchRecord {
  id: number
  batch_no: string
  batchNo?: string
  sku_id: number
  sku_name: string
  skuName?: string
  storeName?: string
  production_date: string
  productionDate?: string
  expiry_date: string
  expiryDate?: string
  quantity: number
  cost_price: number
  costPrice?: number
  locked_quantity?: number
  created_at?: string
}

export interface BatchTraceRecord {
  batch: {
    id: number
    batchNo: string
    productName: string
    skuName: string
    productionDate: string
    expiryDate: string
    quantity: number
    costPrice: number
  }
  chain: {
    time: string
    type: string
    title: string
    detail: string
  }[]
}

export function fetchBatches(spuId: number) {
  return api.get(`/store/products/${spuId}/batches`)
}

export function fetchBatchDetail(batchId: number) {
  return api.get(`/store/batches/${batchId}`)
}

export function fetchBatchTrace(batchId: number) {
  return api.get(`/store/batches/${batchId}/trace`)
}

/* ========== Phase 3: 营销标签 ========== */

export function setMarketingTags(spuId: number, tags: string[]) {
  return api.put(`/admin/products/${spuId}/marketing-tags`, { tags })
}

/* ========== Phase 5: 供应商管理 ========== */

export interface SupplierRecord {
  id: number
  name: string
  shortName: string
  supplyType: string
  province: string
  city: string
  district: string
  address: string
  creditLevel: string
  settlementType: string
  settlementDay: number
  taxRate: number
  bankName: string
  bankAccount: string
  bankAccountName: string
  contactPerson: string
  contactMobile: string
  contactPhone: string
  status: number
  remark: string
  createdAt: string
}

export interface SupplierContact {
  id: number
  supplierId: number
  name: string
  mobile: string
  phone: string
  email: string
  wechat: string
  isPrimary: number
  position: string
  remark: string
}

export interface SupplierDetail extends SupplierRecord {
  contacts: SupplierContact[]
}

export interface SupplierStats {
  purchaseOrderCount: number
  totalPurchaseAmount: number
}

export interface SupplierProductRecord {
  spuId: number
  spuName: string
  skuId: number
  skuName: string
  purchasePrice: number
  supplyStatus: number
}

export function fetchSuppliers(params: {
  keyword?: string
  supplyType?: string
  page?: number
  pageSize?: number
}) {
  return api.get('/store/suppliers', { params })
}

export function fetchSupplierDetail(id: number) {
  return api.get(`/store/suppliers/${id}`)
}

export function fetchSupplierProducts(id: number, params?: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get(`/store/suppliers/${id}/products`, { params })
}

export function fetchSupplierStats(id: number) {
  return api.get(`/store/suppliers/${id}/stats`)
}

/* ========== Phase 5: 供应商对账 ========== */

export interface SupplierStatementRecord {
  id: number
  statementNo: string
  statement_no: string
  supplierId: number
  supplier_id: number
  supplierName: string
  supplier_name: string
  startDate: string
  start_date: string
  endDate: string
  end_date: string
  openingBalance: number
  opening_balance: number
  totalPurchase: number
  total_purchase: number
  totalReturns: number
  total_returns: number
  totalPayments: number
  total_payments: number
  closingBalance: number
  closing_balance: number
  status: string
  remark: string
  operatorId: number
  createdAt: string
  created_at: string
}

export interface SupplierStatementDetail extends SupplierStatementRecord {
  purchases: { purchase_no: string; goods_amount: number; tax_amount: number; total_amount: number; created_at: string }[]
  returns: { return_no: string; return_amount: number; created_at: string }[]
  payments: { payment_no: string; amount: number; payment_date: string }[]
}

export function fetchSupplierStatements(params: {
  supplierId?: number
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  return api.get('/store/supplier-statements', { params })
}

export function generateSupplierStatement(data: {
  supplier_id: number
  supplier_name: string
  start_date: string
  end_date: string
  remark?: string
}) {
  return api.post('/store/supplier-statements', data)
}

export function getSupplierStatementDetail(statementNo: string) {
  return api.get(`/store/supplier-statements/${statementNo}`)
}

export function confirmSupplierStatement(statementNo: string) {
  return api.post(`/store/supplier-statements/${statementNo}/confirm`)
}

export function disputeSupplierStatement(statementNo: string, remark: string) {
  return api.post(`/store/supplier-statements/${statementNo}/dispute`, { remark })
}
