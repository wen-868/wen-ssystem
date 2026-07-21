import { get, post } from '../request'

export interface SaleItem {
  productId: number
  productName: string
  price?: number
  quantity?: number
  total?: number
  boxQty: number
  bottleQty: number
  unitPrice: number
  subtotalAmount: number
  unit?: string
  specs?: string
}

export interface CreateSaleParams {
  customerId?: number
  customerName: string
  customerMobile?: string
  items: SaleItem[]
  taxEnabled?: boolean
  taxRate?: number
  remark?: string
}

export interface SaleBillInfo {
  billNo: string
  customerName: string
  customerMobile?: string
  totalAmount: number
  receivableAmount: number
  receivedAmount: number
  status: string
  items: SaleItem[]
  createdAt: string
}

export interface SaleBillListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  startDate?: string
  endDate?: string
}

export interface SaleBillListResult {
  list: SaleBillInfo[]
  total: number
  page: number
  pageSize: number
}

const salesApi = {
  async createSale(params: CreateSaleParams): Promise<SaleBillInfo> {
    return post('/admin/sales', params)
  },

  async list(params?: SaleBillListParams): Promise<SaleBillListResult> {
    const res: any = await get('/admin/sales', params)
    return (res?.result ?? res) as SaleBillListResult
  },

  async detail(billNo: string): Promise<SaleBillInfo> {
    const res: any = await get(`/admin/sales/${billNo}`)
    return (res?.result ?? res) as SaleBillInfo
  },

  async offlinePayment(billNo: string, amount: number, channel: string): Promise<void> {
    return post(`/admin/sales/${billNo}/payment`, { amount, channel })
  },

  async createCollectionLink(billNo: string, data: {
    amount: number
    expireHours?: number
    shareChannel?: string
    taxEnabled?: boolean
    taxRate?: number
  }): Promise<{ linkNo: string; token: string; shareUrl: string }> {
    return post(`/admin/sales/${billNo}/collection-link`, data)
  }
}

export { salesApi }