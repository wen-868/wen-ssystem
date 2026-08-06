import { get, post } from '../request'

/** 损益类型 */
export type LossGainType = 'LOSS' | 'GAIN'

/** 损益单状态 */
export type LossGainStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 损益明细项 */
export interface LossGainItem {
  id: number
  skuId: number
  skuName: string
  barcode?: string
  quantity: number
  unit?: string
  costPrice?: number
  subtotalAmount?: number
  remark?: string
}

/** 审核记录 */
export interface AuditRecord {
  id: number
  action: string
  actionText: string
  operatorName: string
  operatedAt: string
  remark?: string
}

/** 损益单 */
export interface LossGainOrder {
  id: number
  orderNo: string
  type: LossGainType
  status: LossGainStatus
  totalQty: number
  totalAmount: number
  reason: string
  reasonText: string
  remark?: string
  photos?: string[]
  operatorId?: number
  operatorName?: string
  auditorId?: number
  auditorName?: string
  auditedAt?: string
  storeId?: number
  storeName?: string
  createdAt: string
  updatedAt: string
  items?: LossGainItem[]
  auditLogs?: AuditRecord[]
}

/** 损益统计 */
export interface LossGainStatistics {
  totalLossCount: number
  totalGainCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  totalLossAmount: number
  totalGainAmount: number
  monthlyTrend: Array<{ month: string; lossAmount: number; gainAmount: number; lossCount: number; gainCount: number }>
  reasonStats: Array<{ reason: string; reasonText: string; count: number; amount: number; type: LossGainType }>
  productTop: Array<{ skuId: number; skuName: string; quantity: number; amount: number; type: LossGainType }>
}

/** 报损原因 */
export const LOSS_REASONS = [
  { value: 'DAMAGE', label: '破损' },
  { value: 'EXPIRED', label: '过期' },
  { value: 'LOST', label: '丢失' },
  { value: 'OTHER', label: '其他' },
]

/** 报溢原因 */
export const GAIN_REASONS = [
  { value: 'INVENTORY_PROFIT', label: '盘盈' },
  { value: 'INPUT_ERROR', label: '录入错误' },
  { value: 'OTHER', label: '其他' },
]

function mapLossGainOrder(r: any, type?: LossGainType): LossGainOrder {
  const orderType = (type ?? r.type ?? r.order_type ?? 'LOSS') as LossGainType
  const status = (r.status ?? r.order_status ?? 'PENDING') as LossGainStatus
  const reason = r.reason ?? ''
  return {
    id: r.id,
    orderNo: r.orderNo ?? r.order_no ?? r.lossNo ?? r.profitNo ?? '',
    type: orderType,
    status,
    totalQty: Number(r.totalQty ?? r.total_qty ?? 0),
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
    reason,
    reasonText: getReasonText(reason, orderType),
    remark: r.remark,
    photos: r.photos ? (Array.isArray(r.photos) ? r.photos : JSON.parse(r.photos)) : undefined,
    operatorId: r.operatorId ?? r.operator_id,
    operatorName: r.operatorName ?? r.operator_name,
    auditorId: r.auditorId ?? r.auditor_id,
    auditorName: r.auditorName ?? r.auditor_name,
    auditedAt: r.auditedAt ?? r.audited_at,
    storeId: r.storeId ?? r.store_id,
    storeName: r.storeName ?? r.store_name,
    createdAt: r.createdAt ?? r.created_at ?? '',
    updatedAt: r.updatedAt ?? r.updated_at ?? '',
    items: Array.isArray(r.items) ? r.items.map(mapItem) : undefined,
    auditLogs: r.auditLogs ?? r.audit_logs ?? [],
  }
}

function mapItem(it: any): LossGainItem {
  return {
    id: it.id,
    skuId: it.skuId ?? it.sku_id,
    skuName: it.skuName ?? it.sku_name ?? '',
    barcode: it.barcode,
    quantity: Number(it.quantity ?? it.qty ?? 0),
    unit: it.unit,
    costPrice: it.costPrice != null ? Number(it.costPrice) : it.cost_price != null ? Number(it.cost_price) : undefined,
    subtotalAmount: it.subtotalAmount != null ? Number(it.subtotalAmount) : it.subtotal_amount != null ? Number(it.subtotal_amount) : undefined,
    remark: it.remark,
  }
}

function getReasonText(reason: string, type: LossGainType): string {
  const list = type === 'LOSS' ? LOSS_REASONS : GAIN_REASONS
  const found = list.find(r => r.value === reason)
  return found?.label ?? reason
}

const inventoryLossGainApi = {
  /** 损益单列表 */
  async list(params?: {
    page?: number
    pageSize?: number
    type?: LossGainType
    status?: string
    keyword?: string
    startDate?: string
    endDate?: string
  }): Promise<{ list: LossGainOrder[]; total: number }> {
    // R94-03：列表真实接口为 /admin/inventory/loss-gains（inventory-loss-gain.routes.ts），去除原 mock 兜底（禁止编造数据）
    const res: any = await get('/admin/inventory/loss-gains', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => mapLossGainOrder(r, params?.type)),
      total: raw?.total ?? rows.length,
    }
  },

  /** 损益单详情（按类型走报损/报溢详情接口） */
  async detail(id: number, type: LossGainType = 'LOSS'): Promise<LossGainOrder> {
    // R94-03：原 /admin/inventory/loss-gains/:id 不存在；报损单详情为 /admin/inventory/loss-orders/:id，报溢单为 /admin/inventory/profit-orders/:id
    const path = type === 'GAIN' ? `/admin/inventory/profit-orders/${id}` : `/admin/inventory/loss-orders/${id}`
    const res: any = await get(path)
    const raw = res?.result ?? res
    const order = mapLossGainOrder(raw?.order ?? raw ?? {}, type)
    order.items = (raw?.items ?? order.items ?? []).map(mapItem)
    order.auditLogs = raw?.auditLogs ?? raw?.audit_logs ?? order.auditLogs ?? []
    return order
  },

  /** 创建报损单 */
  async createLoss(data: {
    reason: string
    remark?: string
    photos?: string[]
    items: Array<{ skuId: number; quantity: number; remark?: string }>
  }): Promise<any> {
    return post('/admin/inventory/report-loss-gain', { type: 'LOSS', ...data })
  },

  /** 创建报溢单 */
  async createGain(data: {
    reason: string
    remark?: string
    items: Array<{ skuId: number; quantity: number; remark?: string }>
  }): Promise<any> {
    return post('/admin/inventory/report-loss-gain', { type: 'GAIN', ...data })
  },

  /** 审核通过（按类型走报损/报溢审核接口） */
  async approve(id: number, type: LossGainType = 'LOSS', remark?: string): Promise<any> {
    const path = type === 'GAIN' ? `/admin/inventory/profit-orders/${id}/approve` : `/admin/inventory/loss-orders/${id}/approve`
    return post(path, { remark })
  },

  /** 审核驳回（按类型走报损/报溢驳回接口） */
  async reject(id: number, remark: string, type: LossGainType = 'LOSS'): Promise<any> {
    const path = type === 'GAIN' ? `/admin/inventory/profit-orders/${id}/reject` : `/admin/inventory/loss-orders/${id}/reject`
    return post(path, { remark })
  },

  /** 损益统计 */
  async statistics(params?: { startDate?: string; endDate?: string; type?: LossGainType }): Promise<LossGainStatistics> {
    // R94-03：原 /admin/inventory/statistics 不存在；损益统计真实接口为 /admin/inventory/profit-loss/stats
    const res: any = await get('/admin/inventory/profit-loss/stats', params)
    const raw = res?.result ?? res
    return {
      totalLossCount: Number(raw?.lossOrderCount ?? 0),
      totalGainCount: Number(raw?.profitOrderCount ?? 0),
      pendingCount: Number(raw?.pendingLossCount ?? 0) + Number(raw?.pendingProfitCount ?? 0),
      approvedCount: 0, // 后端统计未细分已通过/已驳回
      rejectedCount: 0,
      totalLossAmount: Number(raw?.lossTotalAmount ?? 0),
      totalGainAmount: Number(raw?.profitTotalAmount ?? 0),
      monthlyTrend: [], // 后端无月度趋势明细
      reasonStats: [],
      productTop: [],
    }
  },
}

export { inventoryLossGainApi }
