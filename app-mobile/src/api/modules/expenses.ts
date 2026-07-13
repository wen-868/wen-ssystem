import { get, post, put } from '../request'

export interface Expense {
  id: number
  expenseNo: string
  type: string
  typeName: string
  amount: number
  date: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  statusName: string
  remark: string
  submitterName: string
  createdAt: string
}

export interface ExpenseType {
  value: string
  label: string
}

export interface ExpenseForm {
  type: string
  amount: number
  date: string
  remark: string
}

const expenseApi = {
  async list(params?: {
    page?: number
    pageSize?: number
    type?: string
    status?: string
    keyword?: string
  }): Promise<{ list: Expense[]; total: number }> {
    const res: any = await get('/admin/expenses', params)
    return {
      list: (res?.list ?? res?.records ?? []),
      total: res?.total ?? 0
    }
  },

  async getDetail(id: number): Promise<Expense> {
    const res: any = await get(`/admin/expenses/${id}`)
    return res as Expense
  },

  async create(data: ExpenseForm): Promise<Expense> {
    const res: any = await post('/admin/expenses', data)
    return res as Expense
  },

  async update(id: number, data: ExpenseForm): Promise<Expense> {
    const res: any = await put(`/admin/expenses/${id}`, data)
    return res as Expense
  },

  async approve(id: number): Promise<void> {
    await post(`/admin/expenses/${id}/approval`, { status: 'APPROVED' })
  },

  async reject(id: number, reason: string): Promise<void> {
    await post(`/admin/expenses/${id}/approval`, { status: 'REJECTED', reason })
  },

  async getTypes(): Promise<ExpenseType[]> {
    const res: any = await get('/admin/expenses/types')
    return (res?.list ?? res ?? []) as ExpenseType[]
  }
}

export { expenseApi }
