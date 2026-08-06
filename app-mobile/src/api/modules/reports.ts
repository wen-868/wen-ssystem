import { get, post } from '../request'

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

// 报表导出结果（后端生成 CSV 文本或 Excel 数据，由前端触发下载/保存）
export interface ReportExportResult {
  format: 'csv' | 'excel'
  data: string | any[]
  columns: string[]
  rowCount: number
  message?: string
}

const reportsApi = {
  // 销售报表接口
  async getSalesSummary(params?: {
    startDate?: string
    endDate?: string
    storeId?: string
    salesmanId?: string
  }): Promise<SalesSummary> {
    // R94-03：原 /admin/reports/sales-summary 不存在；经营汇总真实接口为 /admin/reports/business-overview
    const res: any = await get('/admin/reports/business-overview', params)
    return {
      totalSales: Number(res?.todaySalesAmount ?? res?.monthSalesAmount ?? res?.yearSalesAmount ?? 0),
      orderCount: Number(res?.todayOrderCount ?? res?.monthOrderCount ?? res?.yearOrderCount ?? 0),
      itemCount: 0, // business-overview 未提供件数
      profit: 0, // business-overview 未提供利润
      avgPrice: Number(res?.avgOrderAmount ?? 0),
      customerCount: Number(res?.customerCount ?? res?.customer_count ?? 0),
      salesGrowth: Number(res?.salesGrowthRate ?? res?.sales_growth_rate ?? 0)
    }
  },

  async getSalesTrend(params?: {
    granularity?: 'day' | 'week' | 'month'
  }): Promise<SalesTrendItem[]> {
    const res: any = await get('/admin/reports/sales-trend', params)
    return (res?.list ?? res ?? []) as SalesTrendItem[]
  },

  async getCategorySales(params?: {
    startDate?: string
    endDate?: string
  }): Promise<CategorySales[]> {
    // R94-03 核实：后端无品类销售接口；页面「客户等级分布」改用真实会员等级配置 /admin/members/levels/config（points.routes.ts）
    const res: any = await get('/admin/members/levels/config', params)
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any, idx: number) => ({
      id: r.id ?? idx,
      name: r.name ?? r.levelName ?? '',
      amount: 0, // 等级分布不涉及金额，页面仅展示名称/数量/占比
      percent: 0,
    }))
  },

  async getSalesRank(params?: {
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<SalesRankItem[]> {
    // R94-03：原 /admin/reports/sales-rank 不存在；商品销售排行真实接口为 /admin/reports/sales-ranking（dimension=product）
    const res: any = await get('/admin/reports/sales-ranking', { ...params, dimension: 'product' })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id ?? r.skuId ?? r.productId,
      name: r.name ?? r.skuName ?? r.productName ?? '',
      spec: r.spec ?? r.specs ?? '',
      image: r.image ?? r.mainImage ?? '',
      salesAmount: Number(r.salesAmount ?? r.amount ?? r.totalAmount ?? 0),
      soldQty: Number(r.soldQty ?? r.quantity ?? r.qty ?? 0),
    }))
  },

  // 库存报表接口
  async getInventorySummary(params?: {
    startDate?: string
    endDate?: string
  }): Promise<InventorySummary> {
    // R94-03 结构对齐：/admin/reports/inventory-summary 返回库存行数组，聚合为汇总值
    const res: any = await get('/admin/reports/inventory-summary', params)
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return {
      totalQty: rows.reduce((s: number, r: any) => s + Number(r.availableQty ?? r.physicalQty ?? 0), 0),
      totalValue: rows.reduce((s: number, r: any) => s + Number(r.totalAmount ?? r.amount ?? 0), 0),
      warningCount: rows.filter((r: any) => Number(r.availableQty ?? 0) <= 0).length,
    }
  },

  async getInventoryTrend(params?: {
    startDate?: string
    endDate?: string
    period?: 'day' | 'week' | 'month'
  }): Promise<InventoryTrendItem[]> {
    // R94-03：原 /admin/reports/inventory-trend 不存在；库存成本趋势真实接口为 /admin/inventory/cost-trend
    const res: any = await get('/admin/inventory/cost-trend', params)
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      date: r.date ?? r.day ?? r.month ?? '',
      qty: Number(r.qty ?? r.quantity ?? r.stockQty ?? 0),
      value: Number(r.value ?? r.amount ?? r.costAmount ?? 0),
    }))
  },

  async getInventoryRank(params?: {
    limit?: number
  }): Promise<InventoryRankItem[]> {
    // R94-03：原 /admin/reports/inventory-rank 不存在；库存周转排行真实接口为 /admin/reports/inventory-turnover
    const res: any = await get('/admin/reports/inventory-turnover', params)
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id ?? r.skuId ?? r.productId,
      name: r.name ?? r.skuName ?? r.productName ?? '',
      spec: r.spec ?? r.specs ?? '',
      qty: Number(r.qty ?? r.quantity ?? r.turnoverQty ?? 0),
      value: Number(r.value ?? r.amount ?? r.turnoverAmount ?? 0),
    }))
  },

  async getInventoryDetail(params?: {
    startDate?: string
    endDate?: string
    type?: 'in' | 'out' | 'all'
    page?: number
    pageSize?: number
  }): Promise<InventoryDetailItem[]> {
    // R94-03：原 /admin/reports/inventory-detail 不存在；库存账龄真实接口为 /admin/reports/inventory-age（details 段）
    const res: any = await get('/admin/reports/inventory-age', params)
    const rows: any[] = res?.details ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id ?? r.skuId ?? r.productId,
      type: 'out', // 账龄明细为存量数据，无进出方向字段，页面按存量展示
      productName: r.name ?? r.skuName ?? r.productName ?? '',
      qty: Number(r.qty ?? r.quantity ?? r.stockQty ?? 0),
      date: r.date ?? r.expiryDate ?? r.createdAt ?? '',
    }))
  },

  // 财务报表接口
  async getFinanceSummary(params?: {
    startDate?: string
    endDate?: string
  }): Promise<FinanceSummary> {
    // R94-03：原 /admin/reports/finance-summary 不存在；财务汇总真实接口为 /admin/reports/profit
    const res: any = await get('/admin/reports/profit', params)
    const income = Number(res?.income ?? 0)
    const expense = Number(res?.cost ?? 0) + Number(res?.returns ?? 0)
    const profit = Number(res?.grossProfit ?? 0)
    return {
      totalIncome: income,
      totalExpense: expense,
      profit,
      profitMargin: Number(res?.grossProfitRate ?? 0),
      cashFlow: income - expense,
    }
  },

  async getIncomeExpenseTrend(params?: {
    startDate?: string
    endDate?: string
    period?: 'day' | 'week' | 'month'
  }): Promise<IncomeExpenseTrendItem[]> {
    // R94-03：原 /admin/reports/income-expense-trend 不存在；收支趋势真实接口为 /admin/finance/profit-trend
    const res: any = await get('/admin/finance/profit-trend', { months: params?.period === 'month' ? 12 : 7 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      date: r.month ?? r.date ?? '',
      income: Number(r.income ?? 0),
      expense: Number(r.expense ?? 0),
      profit: Number(r.profit ?? 0),
    }))
  },

  async getIncomeCategory(params?: {
    startDate?: string
    endDate?: string
  }): Promise<IncomeCategory[]> {
    // R94-03：原 /admin/reports/income-category 不存在；收入分类真实接口为 /admin/finance/income-by-category
    const res: any = await get('/admin/finance/income-by-category', params)
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      name: r.name ?? r.category ?? r.categoryName ?? '',
      amount: Number(r.amount ?? 0),
      percent: Number(r.percent ?? 0),
    }))
  },

  async getExpenseCategory(params?: {
    startDate?: string
    endDate?: string
  }): Promise<ExpenseCategory[]> {
    // R94-03：原 /admin/reports/expense-category 不存在；支出分类真实接口为 /admin/finance/expense-by-category
    const res: any = await get('/admin/finance/expense-by-category', params)
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      name: r.name ?? r.category ?? r.categoryName ?? '',
      amount: Number(r.amount ?? 0),
      percent: Number(r.percent ?? 0),
    }))
  },

  async getCashFlow(params?: {
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }): Promise<CashFlowItem[]> {
    // R94-03：原 /admin/reports/cash-flow 不存在；现金流真实接口为 /admin/finance/cash-flow
    const res: any = await get('/admin/finance/cash-flow', params)
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any, idx: number) => {
      const net = Number(r.netCashFlow ?? (Number(r.income ?? 0) - Number(r.expense ?? 0)))
      return {
        id: r.id ?? idx,
        date: r.month ?? r.date ?? '',
        type: net >= 0 ? 'income' : 'expense',
        amount: Math.abs(net),
        description: r.payment ? `净现金流（含支付 ${r.payment}）` : '月度净现金流',
      }
    })
  },

  // 采购报表接口
  async getPurchaseReport(params?: {
    dateStart?: string
    dateEnd?: string
  }): Promise<{
    summary: { totalAmount: string; orderCount: number; supplierCount: number }
    supplierList: any[]
    detailList: any[]
  }> {
    const res: any = await get('/admin/reports/purchase-summary', params)
    return {
      summary: {
        totalAmount: res?.totalAmount ?? '0.00',
        orderCount: res?.orderCount ?? 0,
        supplierCount: res?.supplierCount ?? 0,
      },
      supplierList: res?.supplierList ?? [],
      detailList: res?.detailList ?? [],
    }
  },

  // 导出销售报表（CSV，filters 与后端 report-export.service 的 sales 查询对齐）
  async exportSalesReport(params?: {
    startDate?: string
    endDate?: string
    storeId?: string
  }): Promise<ReportExportResult> {
    const res: any = await post('/admin/reports/export', {
      report_type: 'sales',
      format: 'csv',
      filters: {
        startDate: params?.startDate,
        endDate: params?.endDate,
        storeId: params?.storeId,
      },
    })
    return res as ReportExportResult
  }
}

export { reportsApi }
