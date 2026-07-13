import { get } from '../request'

/** 应收/应付汇总项 */
export interface ReceivableItem {
  id: number
  customerName: string
  customerPhone?: string
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  overdueAmount?: number
  lastPaymentDate?: string
}

/** 应付汇总项 */
export interface PayableItem {
  id: number
  supplierName: string
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  overdueAmount?: number
}

/** 账龄分析项 */
export interface AgingItem {
  range: string
  amount: number
  proportion?: number
}

/** 账龄分析结果 */
export interface AgingResult {
  receivableAging: AgingItem[]
  payableAging: AgingItem[]
}

function mapReceivable(r: any): ReceivableItem {
  return {
    id: r.id ?? r.customerId ?? r.customer_id,
    customerName: r.customerName ?? r.customer_name ?? '',
    customerPhone: r.customerPhone ?? r.customer_phone,
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.paid_amount ?? 0),
    unpaidAmount: Number(r.unpaidAmount ?? r.unpaid_amount ?? r.balance ?? 0),
    overdueAmount: r.overdueAmount != null ? Number(r.overdueAmount) : r.overdue_amount != null ? Number(r.overdue_amount) : undefined,
    lastPaymentDate: r.lastPaymentDate ?? r.last_payment_date,
  }
}

function mapPayable(r: any): PayableItem {
  return {
    id: r.id ?? r.supplierId ?? r.supplier_id,
    supplierName: r.supplierName ?? r.supplier_name ?? '',
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.paid_amount ?? 0),
    unpaidAmount: Number(r.unpaidAmount ?? r.unpaid_amount ?? r.balance ?? 0),
    overdueAmount: r.overdueAmount != null ? Number(r.overdueAmount) : r.overdue_amount != null ? Number(r.overdue_amount) : undefined,
  }
}

const receivableApi = {
  /** 应收汇总（客户欠款） */
  async listReceivables(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: ReceivableItem[]; total: number }> {
    const res: any = await get('/admin/receivables', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapReceivable), total: raw?.total ?? rows.length }
  },

  /** 应付汇总（供应商欠款） */
  async listPayables(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: PayableItem[]; total: number }> {
    const res: any = await get('/admin/receivables/payables', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapPayable), total: raw?.total ?? rows.length }
  },

  /** 应收账龄分析 */
  async receivableAging(): Promise<AgingItem[]> {
    const res: any = await get('/admin/receivables/aging')
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw ?? (Array.isArray(raw) ? raw : [])
    return rows.map((r: any) => ({
      range: r.range ?? r.rangeLabel ?? '',
      amount: Number(r.amount ?? 0),
      proportion: r.proportion != null ? Number(r.proportion) : undefined,
    }))
  },

  /** 应付账龄分析 */
  async payableAging(): Promise<AgingItem[]> {
    const res: any = await get('/admin/receivables/payables/aging')
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw ?? (Array.isArray(raw) ? raw : [])
    return rows.map((r: any) => ({
      range: r.range ?? r.rangeLabel ?? '',
      amount: Number(r.amount ?? 0),
      proportion: r.proportion != null ? Number(r.proportion) : undefined,
    }))
  },

  /** 应收明细 */
  async receivableDetail(id: number): Promise<any> {
    const res: any = await get(`/admin/receivables/${id}/detail`)
    return res?.result ?? res
  },

  /** 应付明细 */
  async payableDetail(id: number): Promise<any> {
    const res: any = await get(`/admin/receivables/payables/${id}/detail`)
    return res?.result ?? res
  },
}

export { receivableApi }
