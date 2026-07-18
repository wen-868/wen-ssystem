import { get, post } from '../request'

export interface OrderException {
  id: number
  orderNo: string
  exceptionType: string
  exceptionReason: string
  description: string
  status: string
  handler: string
  handleTime: string
  handleResult: string
  createdAt: string
}

export interface OrderExceptionQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  exceptionType?: string
  startDate?: string
  endDate?: string
}

export interface OrderExceptionListResponse {
  list: OrderException[]
  total: number
}

export const exceptionApi = {
  async getList(query: OrderExceptionQuery): Promise<OrderExceptionListResponse> {
    return get('/order-exceptions', query)
  },

  async getById(id: number): Promise<OrderException> {
    return get(`/order-exceptions/${id}`)
  },

  async handle(id: number, handleResult: string): Promise<void> {
    return post(`/order-exceptions/${id}/handle`, { handleResult })
  }
}
