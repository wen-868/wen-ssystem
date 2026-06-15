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
  (response) => response,
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

export function fetchReports() {
  return api.get('/store/reports')
}
