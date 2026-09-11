import { get, post, put } from '../request'

export interface Expense {
  /**
   * 业务标识：后端 expense 路由全部以 expense_no 作为路径参数
   * （routes/expense.routes.ts 的 /:expenseNo），且列表 SQL 不返回自增 id，
   * 因此这里统一以 expenseNo 作为 id 使用（R102-03）。
   */
  id: string
  expenseNo: string
  type: string
  typeName: string
  amount: number
  date: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED'
  statusName: string
  remark: string
  submitterName: string
  createdAt: string
}

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  VOIDED: '已作废',
}

/**
 * 费用行映射（R102-03）
 * 1) amount 为 DECIMAL，mysql2 返回字符串 → 必须 Number()，否则视图层 formatAmount 调用
 *    `.toFixed()` 会抛 TypeError 导致 App 端整页白屏；
 * 2) 后端列表返回 { total, page, pageSize, records }，且不含 id/typeName/statusName/submitterName，
 *    需要在此派生，避免页面出现 undefined。
 */
function mapExpense(r: any): Expense {
  const expenseNo = String(r.expenseNo ?? r.expense_no ?? '')
  const status = String(r.status ?? 'PENDING')
  const expenseType = String(r.expenseType ?? r.expense_type ?? '')
  return {
    id: expenseNo,
    expenseNo,
    type: expenseType,
    typeName: r.category ?? r.typeName ?? expenseType,
    amount: Number(r.amount ?? 0),
    date: r.expenseDate ?? r.expense_date ?? r.createdAt ?? r.created_at ?? '',
    status: status as Expense['status'],
    statusName: EXPENSE_STATUS_LABEL[status] ?? status,
    remark: r.remark ?? '',
    submitterName: r.operatorName ?? r.operator_name ?? '',
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  }
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
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapExpense),
      total: Number(raw?.total ?? rows.length)
    }
  },

  async getDetail(expenseNo: string): Promise<Expense> {
    const res: any = await get(`/admin/expenses/${expenseNo}`)
    return mapExpense(res?.result ?? res ?? {})
  },

  async create(data: ExpenseForm): Promise<Expense> {
    const res: any = await post('/admin/expenses', data)
    return mapExpense(res?.result ?? res ?? {})
  },

  async update(expenseNo: string, data: ExpenseForm): Promise<Expense> {
    const res: any = await put(`/admin/expenses/${expenseNo}`, data)
    return mapExpense(res?.result ?? res ?? {})
  },

  // 后端 expense 路由：POST /api/admin/expenses/:expenseNo/approve
  async approve(expenseNo: string): Promise<void> {
    await post(`/admin/expenses/${expenseNo}/approve`)
  },

  // 后端 expense 路由：POST /api/admin/expenses/:expenseNo/void（状态置为 VOIDED）
  async reject(expenseNo: string, reason: string): Promise<void> {
    await post(`/admin/expenses/${expenseNo}/void`, { reason })
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
