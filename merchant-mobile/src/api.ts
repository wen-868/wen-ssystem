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

/* ========== Phase 9: 数据报表 ========== */

export interface BusinessOverview {
  todaySalesAmount: number
  todayOrderCount: number
  salesGrowthRate: number
  orderGrowthRate: number
  monthSalesAmount: number
  monthOrderCount: number
  yearSalesAmount: number
  yearOrderCount: number
  totalReceivable: number
  totalPayable: number
  inventoryValue: number
  customerCount: number
  supplierCount: number
  monthPurchaseAmount: number
  monthPurchaseCount: number
}

export interface SalesTrendItem {
  period: string
  orderCount: number
  salesAmount: number
  receivedAmount: number
}

export interface SalesRankingItem {
  id: number
  name: string
  totalQty: number
  totalAmount: number
  orderCount: number
  mobile?: string
}

export interface CustomerContributionItem {
  customerId: number
  customerName: string
  customerMobile: string
  orderCount: number
  totalAmount: number
  receivedAmount: number
  unpaidAmount: number
  avgOrderAmount: number
}

export interface FinanceOverview {
  income: number
  cost: number
  returns: number
  grossProfit: number
  grossProfitRate: number
  salesGrowthRate: number
  profitGrowthRate: number
}

export interface PaymentAnalysisItem {
  period: string
  paymentCount: number
  totalAmount: number
}

export interface PaymentChannelItem {
  customerId: number
  customerName: string
  paymentCount: number
  totalAmount: number
}

export interface InventorySummaryItem {
  skuId: number
  skuName: string
  skuCode: string
  barcode: string
  costPrice: number
  totalPhysicalQty: number
  totalLockedQty: number
  totalAvailableQty: number
  totalAmount: number
}

export interface InventoryAgeItem {
  skuId: number
  skuName: string
  batchNo: string
  inStockDate: string
  ageDays: number
  qty: number
}

export interface InventoryAgeData {
  summary: {
    within30: { qty: number; amount: number; count: number }
    days30to90: { qty: number; amount: number; count: number }
    days90to180: { qty: number; amount: number; count: number }
    over180: { qty: number; amount: number; count: number }
  }
  details: InventoryAgeItem[]
}

export interface ReceivablePayableData {
  totalReceivable: number
  totalPayable: number
  receivableList: {
    customerId: number
    customerName: string
    customerMobile: string
    billCount: number
    totalReceivable: number
    totalReceived: number
    totalUnreceived: number
  }[]
  payableList: {
    supplierId: number
    supplierName: string
    orderCount: number
    totalPayable: number
    totalPaid: number
    totalUnpaid: number
  }[]
}

export function fetchBusinessOverview() {
  return api.get('/store/reports/business-overview')
}

export function fetchSalesTrend(params?: { granularity?: string }) {
  return api.get('/store/reports/sales-trend', { params })
}

export function fetchSalesRanking(params: { dimension?: string; dateStart?: string; dateEnd?: string; limit?: number }) {
  return api.get('/store/reports/sales-ranking', { params })
}

export function fetchCustomerContribution(params: { dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  return api.get('/store/reports/customer-contribution', { params })
}

export function fetchInventorySummary(params?: { groupBy?: string }) {
  return api.get('/store/reports/inventory-summary', { params })
}

export function fetchInventoryAgeData() {
  return api.get('/store/reports/inventory-age')
}

export function fetchReceivablePayable(params?: { dateStart?: string; dateEnd?: string }) {
  return api.get('/store/reports/receivable-payable', { params })
}

export function fetchProfitData(params?: { dateStart?: string; dateEnd?: string }) {
  return api.get('/store/reports/profit', { params })
}

export function fetchPaymentAnalysis(params?: { dateStart?: string; dateEnd?: string; groupBy?: string }) {
  return api.get('/store/reports/payment-analysis', { params })
}

/* ========== 兼容旧接口 ========== */

export function fetchProductRanking(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/sales-ranking', { params: { ...params, dimension: 'product' } })
}

export function fetchProfitAnalysis(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/profit', { params })
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

/* ========== Phase 6: 库存管理 ========== */

export interface InventoryCheckRecord {
  id: number
  checkNo: string
  check_no: string
  storeId: number
  storeName: string
  warehouseName: string
  warehouseId: number
  warehouse_name: string
  status: string
  skuCount: number
  sku_count: number
  diffCount: number
  diff_count: number
  createdAt: string
  created_at: string
}

export interface InventoryCheckItem {
  id: number
  skuId: number
  skuName: string
  skuCode: string
  bookQty: number
  book_qty: number
  actualQty: number | null
  actual_qty: number | null
  diffQty: number | null
  diff_qty: number | null
  unitPrice: number
  remark: string
}

export interface InventoryCheckDetail extends InventoryCheckRecord {
  items: InventoryCheckItem[]
}

export function fetchInventoryChecks(params?: { page?: number; pageSize?: number; status?: string }) {
  return api.get('/store/stock-checks/my', { params })
}

export function createInventoryCheck(data: { warehouseId: number; remark?: string }) {
  return api.post('/store/stock-checks', data)
}

export function getInventoryCheckDetail(id: number) {
  return api.get(`/store/stock-checks/${id}`)
}

export function updateInventoryCheckItem(checkId: number, itemId: number, data: { actualQty: number }) {
  return api.put(`/store/stock-checks/${checkId}/items/${itemId}`, data)
}

export function submitInventoryCheck(id: number) {
  return api.post(`/store/stock-checks/${id}/submit`)
}

export interface TransferOrderRecord {
  id: number
  transferNo: string
  transfer_no: string
  fromStoreId: number
  fromStoreName: string
  from_store_name: string
  toStoreId: number
  toStoreName: string
  to_store_name: string
  status: string
  totalAmount: number
  total_amount: number
  totalQty: number
  total_qty: number
  expectedDate: string
  expected_date: string
  createdAt: string
  created_at: string
}

export interface TransferOrderItem {
  id: number
  skuId: number
  skuName: string
  quantity: number
  shippedQty: number
  shipped_qty: number
  receivedQty: number
  received_qty: number
  unitPrice: number
}

export interface TransferOrderDetail extends TransferOrderRecord {
  items: TransferOrderItem[]
}

export function fetchTransferOrders(params?: { page?: number; pageSize?: number; status?: string }) {
  return api.get('/store/transfers', { params })
}

export function createTransferOrder(data: {
  fromStoreId: number
  toStoreId: number
  expectedDate?: string
  remark?: string
  items: { skuId: number; skuName: string; quantity: number; unitPrice: number }[]
}) {
  return api.post('/store/transfers', data)
}

export function getTransferOrderDetail(id: number) {
  return api.get(`/store/transfers/${id}`)
}

export function confirmTransferOut(id: number) {
  return api.post(`/store/transfers/${id}/ship`)
}

export function confirmTransferIn(id: number, items: { itemId: number; receivedQty: number }[]) {
  return api.post(`/store/transfers/${id}/receive`, { items })
}

/* ========== Phase 7: 客户管理 ========== */

export interface CustomerPointsData {
  userId: number
  points: number
  totalEarned: number
  totalSpent: number
  updatedAt?: string
}

export interface PointsRecord {
  id: number
  userId: number
  type: string
  amount: number
  balance: number
  sourceType: string
  sourceId: string
  remark: string
  createdAt: string
}

export function fetchCustomerPoints(customerId: number) {
  return api.get(`/store/points/customer/${customerId}`)
}

export function fetchCustomerPointsRecords(customerId: number, type?: string) {
  return api.get(`/store/points/customer/${customerId}/records`, { params: { type } })
}

export function adjustCustomerPoints(customerId: number, payload: { amount: number; reason: string }) {
  return api.post(`/store/points/customer/${customerId}/adjust`, payload)
}

export interface StoreValueCard {
  id: number
  cardNo: string
  customerId: number
  balance: number
  status: string
  totalRecharged: number
  totalConsumed: number
  createdAt: string
}

export interface StoreValueTransaction {
  id: number
  cardNo: string
  type: string
  amount: number
  balance: number
  paymentMethod: string
  remark: string
  createdAt: string
}

export function fetchStoreValueCard(customerId: number) {
  return api.get(`/store/store-value-cards/customer/${customerId}`)
}

export function rechargeStoreValueCard(customerId: number, payload: { amount: number; paymentMethod: string }) {
  return api.post(`/store/store-value-cards/customer/${customerId}/recharge`, payload)
}

export function fetchStoreValueTransactions(cardNo: string) {
  return api.get(`/store/store-value-cards/transactions/${cardNo}`)
}

export interface MemberCardData {
  memberId: number
  name: string
  mobile: string
  customerType: string
  points: number
  levelCode: string
  levelName: string
  levelIcon: string
  discount: number
  status: number
  createdAt: string
  recentOrders: { id: number; saleNo: string; receivableAmount: number; createdAt: string }[]
  benefits: string[]
}

export interface MemberBenefit {
  code: string
  name: string
  icon: string
  discount: number
  benefits: string[]
  minPoints: number
}

export function fetchMemberCard(customerId: number) {
  return api.get(`/store/member-cards/customer/${customerId}`)
}

export function fetchMemberBenefits() {
  return api.get('/store/member-cards/benefits')
}

export interface CustomerTag {
  id: number
  tagId: number
  tagName: string
  groupId: number
  groupName: string
  color: string
}

export interface CustomerProfile {
  name: string
  points: number
  levelCode: string
  customerType: string
  orderCount: number
  avgOrderAmount: number
}

export function fetchCustomerTags(customerId: number) {
  return api.get(`/store/customer-tags/customer/${customerId}`)
}

export function fetchAllTags() {
  return api.get('/store/customer-tags/all')
}

export function addCustomerTag(customerId: number, tagId: number) {
  return api.post(`/store/customer-tags/customer/${customerId}`, { tagId })
}

export function removeCustomerTag(customerId: number, tagId: number) {
  return api.delete(`/store/customer-tags/customer/${customerId}/${tagId}`)
}

export function fetchCustomerProfile(customerId: number) {
  return api.get(`/store/customer-tags/customer/${customerId}/profile`)
}

/* ========== Phase 8: 财务往来 ========== */

export interface ReceiptRecord {
  id: number
  receiptNo: string
  receipt_no: string
  customerId: number
  customerName: string
  customer_name: string
  amount: number
  paymentMethod: string
  payment_method: string
  status: string
  remark: string
  createdAt: string
  created_at: string
}

export function fetchReceipts(params?: { customer_id?: number; status?: string; start_date?: string; end_date?: string; page?: number; pageSize?: number }) {
  return api.get('/store/customer-payments', { params })
}

export function createReceipt(data: { customer_id: number; customer_name: string; amount: number; payment_method: string; remark?: string }) {
  return api.post('/store/customer-payments', data)
}

export function getReceiptDetail(receiptNo: string) {
  return api.get(`/store/customer-payments/${receiptNo}`)
}

export interface CustomerReceivable {
  receivableNo: string
  receivable_no: string
  sourceType: string
  source_type: string
  sourceNo: string
  source_no: string
  customerName: string
  customer_name: string
  customerMobile: string
  customer_mobile: string
  receivableAmount: number
  receivable_amount: number
  receivedAmount: number
  received_amount: number
  unreceivedAmount: number
  unreceived_amount: number
  status: string
  createdAt: string
  created_at: string
}

export function fetchCustomerReceivables(customerId: number) {
  return api.get('/store/receivables', { params: { keyword: String(customerId) } })
}

export function fetchReceivablesSummary(customerId: number) {
  return api.get('/store/receivables', { params: { keyword: String(customerId) } })
}

export interface ExpenseRecord {
  expenseNo: string
  expense_no: string
  type: string
  category: string
  amount: number
  payee: string
  paymentMethod: string
  payment_method: string
  remark: string
  invoiceUrl: string
  invoice_url: string
  createdAt: string
  created_at: string
}

export function createExpense(data: { type: string; category: string; amount: number; payee: string; paymentMethod: string; remark?: string; invoiceUrl?: string }) {
  return api.post('/store/expenses', data)
}

export function fetchExpenses(params?: { type?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  return api.get('/store/expenses', { params })
}

export interface ReconciliationRecord {
  id: number
  statementNo: string
  statement_no: string
  customerId: number
  customer_id: number
  customerName: string
  customer_name: string
  startDate: string
  start_date: string
  endDate: string
  end_date: string
  openingBalance: number
  opening_balance: number
  totalSales: number
  total_sales: number
  totalReceived: number
  total_received: number
  closingBalance: number
  closing_balance: number
  status: string
  createdAt: string
  created_at: string
}

export interface ReconciliationDetail extends ReconciliationRecord {
  details: { date: string; billNo: string; bill_no: string; summary: string; receivable: number; received: number; balance: number }[]
}

export function fetchCustomerReconciliation(params?: { customer_id?: number; status?: string; start_date?: string; end_date?: string; page?: number; pageSize?: number }) {
  return api.get('/store/customer-statements', { params })
}

export function fetchCustomerReconciliationDetail(statementNo: string) {
  return api.get(`/store/customer-statements/${statementNo}`)
}

export function confirmCustomerReconciliation(statementNo: string) {
  return api.post(`/store/customer-statements/${statementNo}/confirm`)
}

/* ========== Phase 10: 营销中心 ========== */

export interface CouponTemplate {
  id: number
  name: string
  type: string // FIXED | PERCENT | SHIPPING | FREE_GIFT
  value: number
  minAmount: number
  maxDiscount: number | null
  applicableScope: string
  totalCount: number
  claimedCount: number
  usedCount: number
  startTime: string
  endTime: string
  status: string
  description: string
}

export interface UserCoupon {
  id: number
  templateId: number
  userId: number
  status: string // AVAILABLE | USED | EXPIRED
  claimedAt: string
  usedAt: string
  expiresAt: string
  templateName: string
  couponType: string
  couponValue: number
  minAmount: number
  maxDiscount: number | null
  applicableScope: string
  description: string
}

export interface CouponStatistics {
  overall: {
    totalTemplates: number
    totalIssued: number
    totalClaimed: number
    totalUsed: number
    claimRate: string
    useRate: string
  }
  byType: {
    type: string
    templateCount: number
    totalIssued: number
    totalClaimed: number
    totalUsed: number
    claimRate: string
    useRate: string
  }[]
}

export interface FlashSaleItem {
  id: number
  name: string
  productId: number
  skuId: number
  flashPrice: number
  originalPrice: number
  totalStock: number
  soldCount: number
  limitPerUser: number
  startTime: string
  endTime: string
  status: string
}

export interface FullReductionItem {
  id: number
  name: string
  type: string
  minAmount: number
  reduceAmount: number
  discountPercent: number
  startTime: string
  endTime: string
  status: string
  applicableScope: string
}

export function fetchCouponTemplates(params?: { page?: number; pageSize?: number; status?: string }) {
  return api.get('/store/marketing/coupons/templates', { params })
}

export function fetchAvailableCoupons() {
  return api.get('/store/marketing/coupons/available')
}

export function fetchCouponStatistics() {
  return api.get('/store/marketing/coupons/statistics')
}

export function claimCoupon(templateId: number) {
  return api.post(`/store/marketing/coupons/claim/${templateId}`)
}

export function fetchMyCoupons(params?: { page?: number; pageSize?: number; status?: string }) {
  return api.get('/store/marketing/coupons/my', { params })
}

export function fetchActiveFlashSales() {
  return api.get('/store/marketing/flash-sales/active')
}

export function fetchActiveLimitedDiscounts() {
  return api.get('/store/marketing/limited-discounts/active')
}

export function fetchMyPoints() {
  return api.get('/store/marketing/points/my')
}

export function fetchMyPointsRecords(params?: { page?: number; pageSize?: number; type?: string }) {
  return api.get('/store/marketing/points/my-records', { params })
}

export function fetchPointsRule() {
  return api.get('/store/marketing/points/rule')
}
