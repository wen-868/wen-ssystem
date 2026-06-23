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

export function fetchCustomers(params: { keyword?: string }) {
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

export function fetchSalesRanking(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/sales-ranking', { params })
}

export function fetchCustomerContribution(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/customer-contribution', { params })
}

export function fetchProfitAnalysis(params: { startDate?: string; endDate?: string }) {
  return api.get('/store/reports/profit-analysis', { params })
}

export function fetchReports(params: { type?: string; startDate?: string; endDate?: string }) {
  return api.get('/store/reports', { params })
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
  customerType: string
  saleType: 'CASH' | 'CREDIT'
  dueDate: string | null
  businessStatus: string
  collectionStatus: string
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  createdAt: string
}

export interface SaleBillDetail extends SaleBillRecord {
  remark?: string
  internalRemark?: string
  items: SaleBillItem[]
}

export interface CreateSaleBillParams {
  customerId?: number | null
  customerName?: string
  customerMobile?: string
  saleType?: 'CASH' | 'CREDIT'
  dueDate?: string | null
  discountAmount?: number
  roundingAmount?: number
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

export interface ProductRecord {
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

export function fetchProducts(params: { keyword?: string; barcode?: string }) {
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
  status: string
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

export function fetchAdminProducts(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/admin/products', { params })
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
