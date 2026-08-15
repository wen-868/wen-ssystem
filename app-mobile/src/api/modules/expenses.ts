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
    // 后端 expense 路由：POST /api/admin/expenses/:expenseNo/approve
    await post(`/admin/expenses/${id}/approve`, { status: 'APPROVED' })
  },

  async reject(id: number, reason: string): Promise<void> {
    await post(`/admin/expenses/${id}/approve`, { status: 'REJECTED', reason })
  },

  async getTypes(): Promise<ExpenseType[]> {
    // R95-03 核实：后端无独立费用类型接口（t_expense.expense_type 为自由填写字段，
    // expense.routes.ts 无 /types 路由，此前调用被 :expenseNo 参数路由吞掉返回「费用不存在」）。
    // 录入页仅需类型选项，使用静态常用类型（不编造业务数据）。
    return [
      { value: 'PURCHASE', label: '采购支出' },
      { value: 'SALARY', label: '工资薪酬' },
      { value: 'RENT', label: '房租水电' },
      { value: 'TRANSPORT', label: '物流运输' },
      { value: 'MARKETING', label: '营销费用' },
      { value: 'OTHER', label: '其他' },
    ]
  }
}

export { expenseApi }
