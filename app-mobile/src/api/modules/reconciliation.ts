import { get, post } from '../request'

/** 客户对账汇总 */
export interface CustomerReconciliationItem {
  customerId: number
  customerName: string
  totalAmount: number
  confirmedAmount: number
  unconfirmedAmount: number
  status?: string
}

/** 供应商对账汇总 */
export interface SupplierReconciliationItem {
  supplierId: number
  supplierName: string
  totalAmount: number
  confirmedAmount: number
  unconfirmedAmount: number
  status?: string
}

/** 对账详情 */
export interface ReconciliationDetail {
  partyId: number
  partyName: string
  startDate?: string
  endDate?: string
  totalAmount: number
  receivedAmount: number
  balance: number
  records: Array<{
    id: number
    billNo: string
    billType: string
    amount: number
    date: string
    remark?: string
  }>
}

const reconciliationApi = {
  /** 客户对账单列表 */
  async listCustomerReconciliation(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: CustomerReconciliationItem[]; total: number }> {
    const res: any = await get('/admin/reconciliation/customer', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        customerId: r.customerId ?? r.customer_id,
        customerName: r.customerName ?? r.customer_name ?? '',
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        confirmedAmount: Number(r.confirmedAmount ?? r.confirmed_amount ?? 0),
        unconfirmedAmount: Number(r.unconfirmedAmount ?? r.unconfirmed_amount ?? 0),
        status: r.status,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 客户对账详情 */
  async customerDetail(customerId: number): Promise<ReconciliationDetail> {
    const res: any = await get(`/admin/reconciliation/customer/${customerId}`)
    return res?.result ?? res
  },

  /** 客户对账确认 */
  async confirmCustomer(customerId: number, data?: { remark?: string }): Promise<any> {
    return post(`/admin/reconciliation/customer/${customerId}/confirm`, data ?? {})
  },

  /** 供应商对账单列表 */
  async listSupplierReconciliation(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: SupplierReconciliationItem[]; total: number }> {
    const res: any = await get('/admin/reconciliation/supplier', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        supplierId: r.supplierId ?? r.supplier_id,
        supplierName: r.supplierName ?? r.supplier_name ?? '',
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        confirmedAmount: Number(r.confirmedAmount ?? r.confirmed_amount ?? 0),
        unconfirmedAmount: Number(r.unconfirmedAmount ?? r.unconfirmed_amount ?? 0),
        status: r.status,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 供应商对账详情 */
  async supplierDetail(supplierId: number): Promise<ReconciliationDetail> {
    const res: any = await get(`/admin/reconciliation/supplier/${supplierId}`)
    return res?.result ?? res
  },

  /** 供应商对账确认 */
  async confirmSupplier(supplierId: number, data?: { remark?: string }): Promise<any> {
    return post(`/admin/reconciliation/supplier/${supplierId}/confirm`, data ?? {})
  },
}

export { reconciliationApi }
