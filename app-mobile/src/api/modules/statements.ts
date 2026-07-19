import { get, post, put } from '../request'

export interface Statement {
  id: number
  statementNo: string
  customerId: number
  customerName: string
  statementDate: string
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  status: string
  remark: string
  createdAt: string
}

export interface StatementQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  customerId?: number
  startDate?: string
  endDate?: string
}

export interface StatementListResponse {
  list: Statement[]
  total: number
}

export const statementApi = {
  async getList(query: StatementQuery): Promise<StatementListResponse> {
    return get('/store/customer-statements', query)
  },

  async getById(id: number): Promise<Statement> {
    return get(`/store/customer-statements/${id}`)
  },

  async create(data: Partial<Statement>): Promise<Statement> {
    return post('/store/customer-statements', data)
  },

  async update(id: number, data: Partial<Statement>): Promise<Statement> {
    return put(`/store/customer-statements/${id}`, data)
  },

  async confirm(statementNo: string): Promise<void> {
    return post(`/store/customer-statements/${statementNo}/confirm`)
  }
}
