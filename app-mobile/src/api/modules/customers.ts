import { get, post } from '../request'

export interface CustomerInfo {
  id: number
  name: string
  phone?: string
  type: string
  typeLabel: string
  debtAmount: number
  totalOrders: number
  totalAmount: number | string
  lastOrderTime?: string
  address?: string
  remark?: string
  contact?: string
  level?: string
  area?: string
  unpaidAmount?: string
}

export interface CustomerListParams {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
}

export interface CustomerListResult {
  list: CustomerInfo[]
  total: number
  page: number
  pageSize: number
}

export interface CustomerSales {
  productName: string
  totalQty: number
  totalAmount: number
}

export interface CustomerPayment {
  paymentNo: string
  amount: number
  channel: string
  paidAt: string
}

const customersApi = {
  async list(params?: CustomerListParams): Promise<CustomerListResult> {
    const res: any = await get('/admin/members', params)
    // R94-03 结构对齐：后端返回 data.records，前端统一映射为 list（与 admin-web 一致）
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapCustomer),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(id: number): Promise<CustomerInfo> {
    const res: any = await get(`/admin/members/${id}`)
    return mapCustomer(res?.result ?? res ?? {})
  },

  async create(data: Partial<CustomerInfo>): Promise<CustomerInfo> {
    return post('/admin/members', data)
  },

  async stats(id: number): Promise<{
    totalOrders: number
    totalAmount: number
    debtAmount: number
    lastOrderTime?: string
  }> {
    const res: any = await get(`/admin/members/${id}/purchase-stats`)
    return res?.result ?? res
  },

  async sales(id: number): Promise<CustomerSales[]> {
    const res: any = await get(`/admin/members/${id}/sale-bills`)
    return (res?.list ?? res ?? []) as CustomerSales[]
  },

  async payments(id: number): Promise<CustomerPayment[]> {
    const res: any = await get(`/admin/members/${id}/payments`)
    return (res?.list ?? res ?? []) as CustomerPayment[]
  },

  async ledger(id: number, params?: { page?: number; pageSize?: number }): Promise<any> {
    return get(`/admin/members/${id}/statements`, params)
  }
}

function mapCustomer(r: any): CustomerInfo {
  const type = r.customerType ?? r.customer_type ?? r.type ?? ''
  return {
    id: r.id ?? r.memberId,
    name: r.name ?? '',
    phone: r.phone ?? r.mobile ?? '',
    type,
    typeLabel: r.typeLabel ?? typeLabelOf(type),
    debtAmount: Number(r.debtAmount ?? r.debt_amount ?? r.unpaidAmount ?? 0),
    totalOrders: Number(r.totalOrders ?? r.total_orders ?? 0),
    totalAmount: r.totalAmount ?? r.total_amount ?? 0,
    lastOrderTime: r.lastOrderTime ?? r.last_order_time,
    address: r.address,
    remark: r.remark,
    contact: r.contact,
    level: r.level ?? r.levelName ?? r.level_name,
    area: r.area,
    unpaidAmount: r.unpaidAmount ?? r.unpaid_amount ?? '0',
  }
}

function typeLabelOf(type: string): string {
  const map: Record<string, string> = {
    RETAIL: '零售客户',
    WHOLESALE: '批发客户',
    MEMBER: '会员客户',
  }
  return map[type] ?? type
}

export { customersApi }
