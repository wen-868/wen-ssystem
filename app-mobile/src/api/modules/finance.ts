import { get, post } from '../request'

export interface IncomeStats {
  todayIncome: number
  monthIncome: number
  todayOrders: number
  monthOrders: number
}

export interface ExpenseStats {
  todayExpense: number
  monthExpense: number
  todayCount: number
  monthCount: number
}

export interface ProfitStats {
  grossProfit: number
  netProfit: number
  grossMargin: number
  netMargin: number
}

export interface IncomeTrendItem {
  date: string
  amount: number
}

export interface ExpenseTrendItem {
  date: string
  amount: number
}

export interface CategoryExpense {
  name: string
  amount: number
  percent: number
}

const financeApi = {
  async getIncomeStats(): Promise<IncomeStats> {
    // R94-03：原 /admin/finance/income-stats 不存在；聚合接口为 /admin/finance/income-expense-stats
    const res: any = await get('/admin/finance/income-expense-stats')
    return {
      todayIncome: Number(res?.income?.amount ?? 0),
      monthIncome: Number(res?.income?.amount ?? 0),
      todayOrders: Number(res?.income?.count ?? 0),
      monthOrders: Number(res?.income?.count ?? 0)
    }
  },

  async getExpenseStats(): Promise<ExpenseStats> {
    // R94-03：原 /admin/finance/expense-stats 不存在；聚合接口为 /admin/finance/income-expense-stats
    const res: any = await get('/admin/finance/income-expense-stats')
    return {
      todayExpense: Number(res?.expense?.amount ?? 0),
      monthExpense: Number(res?.expense?.amount ?? 0),
      todayCount: Number(res?.expense?.count ?? 0),
      monthCount: Number(res?.expense?.count ?? 0)
    }
  },

  async getProfitStats(): Promise<ProfitStats> {
    // R94-03：原 /admin/finance/profit-stats 不存在；财务看板聚合接口为 /admin/finance/dashboard
    const res: any = await get('/admin/finance/dashboard')
    const profit = Number(res?.monthProfit ?? 0)
    return {
      grossProfit: profit,
      netProfit: profit,
      grossMargin: res?.grossMargin != null ? Number(res.grossMargin) : 0,
      netMargin: res?.netMargin != null ? Number(res.netMargin) : 0
    }
  },

  async getIncomeTrend(days?: number): Promise<IncomeTrendItem[]> {
    // R94-03：原 /admin/finance/income-trend 不存在；收支趋势为 /admin/finance/profit-trend（income/expense/profit 同一数据）
    const res: any = await get('/admin/finance/profit-trend', { months: days ?? 7 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      date: r.month ?? r.date ?? '',
      amount: Number(r.income ?? 0),
    }))
  },

  async getExpenseTrend(days?: number): Promise<ExpenseTrendItem[]> {
    // R94-03：原 /admin/finance/expense-trend 不存在；收支趋势为 /admin/finance/profit-trend
    const res: any = await get('/admin/finance/profit-trend', { months: days ?? 7 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      date: r.month ?? r.date ?? '',
      amount: Number(r.expense ?? 0),
    }))
  },

  async getCategoryExpense(): Promise<CategoryExpense[]> {
    // R94-03：原 /admin/finance/category-expense 不存在；分类支出为 /admin/finance/expense-by-category
    const res: any = await get('/admin/finance/expense-by-category')
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    const total = rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)
    return rows.map((r: any) => ({
      name: r.name ?? r.category ?? r.categoryName ?? '',
      amount: Number(r.amount ?? 0),
      percent: total > 0 ? Number(((Number(r.amount ?? 0) / total) * 100).toFixed(1)) : 0,
    }))
  }
}

export { financeApi }

// ========== 付款单（后端 payment-new.routes：/api/admin/payments-new） ==========

/** 创建付款单契约：payment-new.controller.ts#createPayment */
export interface CreatePaymentParams {
  supplierId: number
  supplierName?: string
  /** 付款类型，后端默认 PURCHASE */
  paymentType?: string
  amount: number
  paymentMethod?: string
  bankAccountId?: number
  /** 付款日期 YYYY-MM-DD */
  paidDate?: string
  remark?: string
}

export const paymentNewApi = {
  async create(params: CreatePaymentParams): Promise<any> {
    return post('/admin/payments-new', params)
  },

  async list(params?: { supplierId?: number; paymentType?: string; status?: string; page?: number; pageSize?: number }): Promise<any> {
    return get('/admin/payments-new', params)
  },
}
