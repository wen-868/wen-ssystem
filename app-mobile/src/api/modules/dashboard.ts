import { get } from '../request'

export interface DashboardStats {
  todaySales: number
  todayOrders: number
  totalCustomers: number
  stockAlerts: number
}

export interface TodoItem {
  id: number
  title: string
  status: 'pending' | 'done'
  deadline?: string
}

export interface SalesTrend {
  date: string
  amount: number
  orderCount: number
}

export interface TopProduct {
  name: string
  sales: number
  amount: number
}

export interface TopCustomer {
  name: string
  orderCount: number
  amount: number
}

export interface CategoryDistribution {
  name: string
  value: number
  percent: number
}

const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const res: any = await get('/store/dashboard')
    return {
      todaySales: res?.todaySales ?? 0,
      todayOrders: res?.todayOrders ?? 0,
      totalCustomers: res?.totalCustomers ?? 0,
      stockAlerts: res?.stockAlerts ?? 0
    }
  },

  async getTodos(): Promise<TodoItem[]> {
    // R94-走查发现：后端无 /store/todos，实际为 /api/admin/dashboard/todos（dashboard.routes.ts:14）
    // 后端返回 { total, items }（type/title/subtitle/count/link），映射为前端 TodoItem 结构
    const res: any = await get('/admin/dashboard/todos')
    const items = res?.items ?? res?.list ?? []
    return (items as any[]).map((it: any, idx: number) => ({
      id: idx + 1,
      title: it.title ?? '',
      status: 'pending',
      deadline: it.subtitle ?? undefined,
    }))
  },

  async getSalesTrend(days?: number): Promise<SalesTrend[]> {
    const res: any = await get('/store/dashboard/sales-trend', { days: days ?? 7 })
    return (res?.list ?? res ?? []) as SalesTrend[]
  },

  async getTopProducts(limit?: number): Promise<TopProduct[]> {
    const res: any = await get('/store/dashboard/top-products', { limit: limit ?? 5 })
    return (res?.list ?? res ?? []) as TopProduct[]
  },

  async getTopCustomers(limit?: number): Promise<TopCustomer[]> {
    const res: any = await get('/store/dashboard/top-customers', { limit: limit ?? 5 })
    return (res?.list ?? res ?? []) as TopCustomer[]
  },

  async getCategoryDistribution(): Promise<CategoryDistribution[]> {
    const res: any = await get('/store/dashboard/category-distribution')
    return (res?.list ?? res ?? []) as CategoryDistribution[]
  }
}

export { dashboardApi }
