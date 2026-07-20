import { get, post, put } from '../request'

export interface Receipt {
  id: number
  receiptNo: string
  customerId: number
  customerName: string
  receiptDate: string
  receiptAmount: number
  paymentMethod: string
  status: string
  remark: string
  createdAt: string
}

export interface ReceiptQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  type?: string
  customerId?: number
  startDate?: string
  endDate?: string
}

export interface ReceiptListResponse {
  list: Receipt[]
  total: number
}

export const receiptApi = {
  async getList(query: ReceiptQuery): Promise<ReceiptListResponse> {
    return get('/admin/receipts', query)
  },

  async getById(id: number): Promise<Receipt> {
    return get(`/admin/receipts/${id}`)
  },

  async create(data: Partial<Receipt>): Promise<Receipt> {
    return post('/admin/receipts', data)
  },

  async update(id: number, data: Partial<Receipt>): Promise<Receipt> {
    return put(`/admin/receipts/${id}`, data)
  },

  async cancel(receiptNo: string, reason: string): Promise<void> {
    return post(`/admin/receipts/${receiptNo}/void`, { reason })
  }
}
