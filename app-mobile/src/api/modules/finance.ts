import { get } from '../request'

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
    const res: any = await get('/admin/finance/income-stats')
    return {
      todayIncome: res?.todayIncome ?? 0,
      monthIncome: res?.monthIncome ?? 0,
      todayOrders: res?.todayOrders ?? 0,
      monthOrders: res?.monthOrders ?? 0
    }
  },

  async getExpenseStats(): Promise<ExpenseStats> {
    const res: any = await get('/admin/finance/expense-stats')
    return {
      todayExpense: res?.todayExpense ?? 0,
      monthExpense: res?.monthExpense ?? 0,
      todayCount: res?.todayCount ?? 0,
      monthCount: res?.monthCount ?? 0
    }
  },

  async getProfitStats(): Promise<ProfitStats> {
    const res: any = await get('/admin/finance/profit-stats')
    return {
      grossProfit: res?.grossProfit ?? 0,
      netProfit: res?.netProfit ?? 0,
      grossMargin: res?.grossMargin ?? 0,
      netMargin: res?.netMargin ?? 0
    }
  },

  async getIncomeTrend(days?: number): Promise<IncomeTrendItem[]> {
    const res: any = await get('/admin/finance/income-trend', { days: days ?? 7 })
    return (res?.list ?? res ?? []) as IncomeTrendItem[]
  },

  async getExpenseTrend(days?: number): Promise<ExpenseTrendItem[]> {
    const res: any = await get('/admin/finance/expense-trend', { days: days ?? 7 })
    return (res?.list ?? res ?? []) as ExpenseTrendItem[]
  },

  async getCategoryExpense(): Promise<CategoryExpense[]> {
    const res: any = await get('/admin/finance/category-expense')
    return (res?.list ?? res ?? []) as CategoryExpense[]
  }
}

export { financeApi }
