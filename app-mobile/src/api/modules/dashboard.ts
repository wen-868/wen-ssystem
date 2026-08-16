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
    // UI v1.2 首页为「7日趋势」按天展示：后端按天接口为 sales-trend-daily（sales-trend 为按月聚合）
    const res: any = await get('/admin/dashboard/sales-trend-daily', { days: days ?? 7 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      date: r.date ?? r.day ?? r.month ?? '',
      amount: Number(r.salesAmount ?? r.amount ?? r.totalAmount ?? 0),
      orderCount: Number(r.orderCount ?? r.count ?? 0),
    }))
  },

  async getTopProducts(limit?: number): Promise<TopProduct[]> {
    // R94-03：原 /store/dashboard/top-products 不存在，改为 /admin/dashboard/top-products
    const res: any = await get('/admin/dashboard/top-products', { limit: limit ?? 5 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      name: r.name ?? r.productName ?? r.skuName ?? '',
      sales: Number(r.sales ?? r.soldQty ?? r.quantity ?? 0),
      amount: Number(r.amount ?? r.salesAmount ?? r.totalAmount ?? 0),
    }))
  },

  async getTopCustomers(limit?: number): Promise<TopCustomer[]> {
    // R94-03：原 /store/dashboard/top-customers 不存在，改为 /admin/dashboard/top-customers
    const res: any = await get('/admin/dashboard/top-customers', { limit: limit ?? 5 })
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      name: r.name ?? r.customerName ?? '',
      orderCount: Number(r.orderCount ?? r.count ?? 0),
      amount: Number(r.amount ?? r.totalAmount ?? 0),
    }))
  },

  async getCategoryDistribution(): Promise<CategoryDistribution[]> {
    // R94-03：原 /store/dashboard/category-distribution 不存在，改为 /admin/dashboard/category-pie
    const res: any = await get('/admin/dashboard/category-pie')
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      name: r.name ?? r.categoryName ?? '',
      value: Number(r.value ?? r.amount ?? r.salesAmount ?? 0),
      percent: Number(r.percent ?? r.percent_ ?? 0),
    }))
  }
}

export { dashboardApi }
