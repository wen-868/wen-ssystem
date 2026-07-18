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
    return get('/receipts', query)
  },

  async getById(id: number): Promise<Receipt> {
    return get(`/receipts/${id}`)
  },

  async create(data: Partial<Receipt>): Promise<Receipt> {
    return post('/receipts', data)
  },

  async update(id: number, data: Partial<Receipt>): Promise<Receipt> {
    return put(`/receipts/${id}`, data)
  },

  async cancel(id: number, reason: string): Promise<void> {
    return post(`/receipts/${id}/cancel`, { reason })
  }
}
