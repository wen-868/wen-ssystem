import { get, post } from '../request'

export interface CustomerInfo {
  id: number
  name: string
  phone?: string
  type: string
  typeLabel: string
  debtAmount: number
  totalOrders: number
  totalAmount: number
  lastOrderTime?: string
  address?: string
  remark?: string
}

export interface CustomerListParams {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
}

export interface CustomerListResult {
  list: CustomerInfo[]
  total: number
  page: number
  pageSize: number
}

export interface CustomerSales {
  productName: string
  totalQty: number
  totalAmount: number
}

export interface CustomerPayment {
  paymentNo: string
  amount: number
  channel: string
  paidAt: string
}

const customersApi = {
  async list(params?: CustomerListParams): Promise<CustomerListResult> {
    const res: any = await get('/admin/customers', params)
    return (res?.result ?? res) as CustomerListResult
  },

  async detail(id: number): Promise<CustomerInfo> {
    const res: any = await get(`/admin/customers/${id}`)
    return (res?.result ?? res) as CustomerInfo
  },

  async create(data: Partial<CustomerInfo>): Promise<CustomerInfo> {
    return post('/admin/customers', data)
  },

  async stats(id: number): Promise<{
    totalOrders: number
    totalAmount: number
    debtAmount: number
    lastOrderTime?: string
  }> {
    const res: any = await get(`/admin/customers/${id}/stats`)
    return res?.result ?? res
  },

  async sales(id: number): Promise<CustomerSales[]> {
    const res: any = await get(`/admin/customers/${id}/sales`)
    return (res?.list ?? res ?? []) as CustomerSales[]
  },

  async payments(id: number): Promise<CustomerPayment[]> {
    const res: any = await get(`/admin/customers/${id}/payments`)
    return (res?.list ?? res ?? []) as CustomerPayment[]
  },

  async ledger(id: number, params?: { page?: number; pageSize?: number }): Promise<any> {
    return get(`/admin/customers/${id}/ledger`, params)
  }
}

export { customersApi }