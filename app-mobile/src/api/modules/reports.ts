import { get } from '../request'

// 销售报表类型定义
export interface SalesSummary {
  totalSales: number
  orderCount: number
  itemCount: number
  profit: number
  avgPrice: number
  customerCount: number
  salesGrowth: number
}

export interface SalesTrendItem {
  date: string
  amount: number
  orderCount: number
}

export interface CategorySales {
  id: number
  name: string
  amount: number
  percent: number
}

export interface SalesRankItem {
  id: number
  name: string
  spec: string
  image: string
  salesAmount: number
  soldQty: number
}

// 库存报表类型定义
export interface InventorySummary {
  totalQty: number
  totalValue: number
  warningCount: number
}

export interface InventoryTrendItem {
  date: string
  qty: number
  value: number
}

export interface InventoryRankItem {
  id: number
  name: string
  spec: string
  qty: number
  value: number
}

export interface InventoryDetailItem {
  id: number
  type: 'in' | 'out'
  productName: string
  qty: number
  date: string
}

// 财务报表类型定义
export interface FinanceSummary {
  totalIncome: number
  totalExpense: number
  profit: number
  profitMargin: number
  cashFlow: number
}

export interface IncomeExpenseTrendItem {
  date: string
  income: number
  expense: number
  profit: number
}

export interface IncomeCategory {
  name: string
  amount: number
  percent: number
}

export interface ExpenseCategory {
  name: string
  amount: number
  percent: number
}

export interface CashFlowItem {
  id: number
  date: string
  type: 'income' | 'expense'
  amount: number
  description: string
}

const reportsApi = {
  // 销售报表接口
  async getSalesSummary(params?: {
    startDate?: string
    endDate?: string
    storeId?: string
    salesmanId?: string
  }): Promise<SalesSummary> {
    const res: any = await get('/admin/reports/sales-summary', params)
    return {
      totalSales: res?.totalSales ?? 0,
      orderCount: res?.orderCount ?? 0,
      itemCount: res?.itemCount ?? 0,
      profit: res?.profit ?? 0,
      avgPrice: res?.avgPrice ?? 0,
      customerCount: res?.customerCount ?? 0,
      salesGrowth: res?.salesGrowth ?? 0
    }
  },

  async getSalesTrend(params?: {
    startDate?: string
    endDate?: string
    period?: 'day' | 'week' | 'month'
  }): Promise<SalesTrendItem[]> {
    const res: any = await get('/admin/reports/sales-trend', params)
    return (res?.list ?? res ?? []) as SalesTrendItem[]
  },

  async getCategorySales(params?: {
    startDate?: string
    endDate?: string
  }): Promise<CategorySales[]> {
    const res: any = await get('/admin/reports/category-sales', params)
    return (res?.list ?? res ?? []) as CategorySales[]
  },

  async getSalesRank(params?: {
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<SalesRankItem[]> {
    const res: any = await get('/admin/reports/sales-rank', params)
    return (res?.list ?? res ?? []) as SalesRankItem[]
  },

  // 库存报表接口
  async getInventorySummary(params?: {
    startDate?: string
    endDate?: string
  }): Promise<InventorySummary> {
    const res: any = await get('/admin/reports/inventory-summary', params)
    return {
      totalQty: res?.totalQty ?? 0,
      totalValue: res?.totalValue ?? 0,
      warningCount: res?.warningCount ?? 0
    }
  },

  async getInventoryTrend(params?: {
    startDate?: string
    endDate?: string
    period?: 'day' | 'week' | 'month'
  }): Promise<InventoryTrendItem[]> {
    const res: any = await get('/admin/reports/inventory-trend', params)
    return (res?.list ?? res ?? []) as InventoryTrendItem[]
  },

  async getInventoryRank(params?: {
    limit?: number
  }): Promise<InventoryRankItem[]> {
    const res: any = await get('/admin/reports/inventory-rank', params)
    return (res?.list ?? res ?? []) as InventoryRankItem[]
  },

  async getInventoryDetail(params?: {
    startDate?: string
    endDate?: string
    type?: 'in' | 'out' | 'all'
    page?: number
    pageSize?: number
  }): Promise<InventoryDetailItem[]> {
    const res: any = await get('/admin/reports/inventory-detail', params)
    return (res?.list ?? res ?? []) as InventoryDetailItem[]
  },

  // 财务报表接口
  async getFinanceSummary(params?: {
    startDate?: string
    endDate?: string
  }): Promise<FinanceSummary> {
    const res: any = await get('/admin/reports/finance-summary', params)
    return {
      totalIncome: res?.totalIncome ?? 0,
      totalExpense: res?.totalExpense ?? 0,
      profit: res?.profit ?? 0,
      profitMargin: res?.profitMargin ?? 0,
      cashFlow: res?.cashFlow ?? 0
    }
  },

  async getIncomeExpenseTrend(params?: {
    startDate?: string
    endDate?: string
    period?: 'day' | 'week' | 'month'
  }): Promise<IncomeExpenseTrendItem[]> {
    const res: any = await get('/admin/reports/income-expense-trend', params)
    return (res?.list ?? res ?? []) as IncomeExpenseTrendItem[]
  },

  async getIncomeCategory(params?: {
    startDate?: string
    endDate?: string
  }): Promise<IncomeCategory[]> {
    const res: any = await get('/admin/reports/income-category', params)
    return (res?.list ?? res ?? []) as IncomeCategory[]
  },

  async getExpenseCategory(params?: {
    startDate?: string
    endDate?: string
  }): Promise<ExpenseCategory[]> {
    const res: any = await get('/admin/reports/expense-category', params)
    return (res?.list ?? res ?? []) as ExpenseCategory[]
  },

  async getCashFlow(params?: {
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }): Promise<CashFlowItem[]> {
    const res: any = await get('/admin/reports/cash-flow', params)
    return (res?.list ?? res ?? []) as CashFlowItem[]
  }
}

export { reportsApi }
