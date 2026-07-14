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

function mapLossGainOrder(r: any): LossGainOrder {
  const type = r.type ?? r.order_type ?? 'LOSS'
  const status = r.status ?? r.order_status ?? 'PENDING'
  const reason = r.reason ?? ''
  return {
    id: r.id,
    orderNo: r.orderNo ?? r.order_no ?? '',
    type: type as LossGainType,
    status: status as LossGainStatus,
    totalQty: Number(r.totalQty ?? r.total_qty ?? 0),
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
    reason,
    reasonText: getReasonText(reason, type),
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

function getMockOrders(type: LossGainType): LossGainOrder[] {
  const reasons = type === 'LOSS' ? LOSS_REASONS : GAIN_REASONS
  const statuses: LossGainStatus[] = ['PENDING', 'APPROVED', 'REJECTED']
  const statusTexts = ['待审核', '已通过', '已驳回']
  const products = [
    { id: 1, name: '茅台飞天53度500ml' },
    { id: 2, name: '五粮液52度500ml' },
    { id: 3, name: '青岛啤酒经典500ml*12' },
    { id: 4, name: '百威啤酒330ml*24' },
    { id: 5, name: '农夫山泉550ml*24' },
  ]
  return Array.from({ length: 12 }, (_, i) => {
    const status = statuses[i % 3]
    const reason = reasons[i % reasons.length]
    const product = products[i % products.length]
    const qty = (i + 1) * 2
    return {
      id: i + 1,
      orderNo: `${type === 'LOSS' ? 'BS' : 'BY'}202607${String(15 - i).padStart(2, '0')}${String(i + 1).padStart(4, '0')}`,
      type,
      status,
      totalQty: qty,
      totalAmount: qty * 100,
      reason: reason.value,
      reasonText: reason.label,
      remark: `报${type === 'LOSS' ? '损' : '溢'}单备注说明${i + 1}`,
      operatorName: '张三',
      auditorName: status !== 'PENDING' ? '李四' : undefined,
      auditedAt: status !== 'PENDING' ? `2026-07-${15 - i} 14:30:00` : undefined,
      storeName: '总店',
      createdAt: `2026-07-${15 - i} 10:00:00`,
      updatedAt: `2026-07-${15 - i} 10:00:00`,
      items: [
        {
          id: i * 10 + 1,
          skuId: product.id,
          skuName: product.name,
          quantity: qty,
          unit: '瓶',
          costPrice: 100,
          subtotalAmount: qty * 100,
        },
      ],
      auditLogs: [
        {
          id: 1,
          action: 'CREATE',
          actionText: '创建单据',
          operatorName: '张三',
          operatedAt: `2026-07-${15 - i} 10:00:00`,
        },
        ...(status !== 'PENDING' ? [
          {
            id: 2,
            action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
            actionText: status === 'APPROVED' ? '审核通过' : '审核驳回',
            operatorName: '李四',
            operatedAt: `2026-07-${15 - i} 14:30:00`,
            remark: status === 'REJECTED' ? '原因不充分，请补充说明' : undefined,
          },
        ] : []),
      ],
    } as LossGainOrder
  })
}

function getMockStatistics(): LossGainStatistics {
  return {
    totalLossCount: 45,
    totalGainCount: 23,
    pendingCount: 8,
    approvedCount: 52,
    rejectedCount: 8,
    totalLossAmount: 28500,
    totalGainAmount: 12300,
    monthlyTrend: [
      { month: '02月', lossAmount: 3200, gainAmount: 1500, lossCount: 5, gainCount: 3 },
      { month: '03月', lossAmount: 4500, gainAmount: 2100, lossCount: 7, gainCount: 4 },
      { month: '04月', lossAmount: 3800, gainAmount: 1800, lossCount: 6, gainCount: 3 },
      { month: '05月', lossAmount: 5200, gainAmount: 2400, lossCount: 8, gainCount: 5 },
      { month: '06月', lossAmount: 6100, gainAmount: 2800, lossCount: 10, gainCount: 4 },
      { month: '07月', lossAmount: 5700, gainAmount: 1700, lossCount: 9, gainCount: 4 },
    ],
    reasonStats: [
      { reason: 'DAMAGE', reasonText: '破损', count: 18, amount: 12000, type: 'LOSS' },
      { reason: 'EXPIRED', reasonText: '过期', count: 15, amount: 9500, type: 'LOSS' },
      { reason: 'LOST', reasonText: '丢失', count: 8, amount: 5000, type: 'LOSS' },
      { reason: 'OTHER', reasonText: '其他', count: 4, amount: 2000, type: 'LOSS' },
      { reason: 'INVENTORY_PROFIT', reasonText: '盘盈', count: 12, amount: 6800, type: 'GAIN' },
      { reason: 'INPUT_ERROR', reasonText: '录入错误', count: 7, amount: 4000, type: 'GAIN' },
      { reason: 'OTHER', reasonText: '其他', count: 4, amount: 1500, type: 'GAIN' },
    ],
    productTop: [
      { skuId: 1, skuName: '茅台飞天53度500ml', quantity: 25, amount: 75000, type: 'LOSS' },
      { skuId: 2, skuName: '五粮液52度500ml', quantity: 18, amount: 21600, type: 'LOSS' },
      { skuId: 3, skuName: '青岛啤酒经典500ml*12', quantity: 45, amount: 4500, type: 'GAIN' },
      { skuId: 4, skuName: '百威啤酒330ml*24', quantity: 32, amount: 3840, type: 'GAIN' },
      { skuId: 5, skuName: '农夫山泉550ml*24', quantity: 20, amount: 600, type: 'LOSS' },
    ],
  }
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
    try {
      const res: any = await get('/inventory-loss-gains/loss-gains', params)
      const raw = res?.result ?? res
      const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
      return {
        list: rows.map(mapLossGainOrder),
        total: raw?.total ?? rows.length,
      }
    } catch {
      // 使用 mock 数据
      const all = getMockOrders(params?.type ?? 'LOSS')
      let filtered = all
      if (params?.status) {
        filtered = filtered.filter(o => o.status === params.status)
      }
      if (params?.keyword) {
        const kw = params.keyword.toLowerCase()
        filtered = filtered.filter(o =>
          o.orderNo.toLowerCase().includes(kw) ||
          o.reasonText.toLowerCase().includes(kw)
        )
      }
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 20
      const start = (page - 1) * pageSize
      return {
        list: filtered.slice(start, start + pageSize),
        total: filtered.length,
      }
    }
  },

  /** 损益单详情 */
  async detail(id: number): Promise<LossGainOrder> {
    try {
      const res: any = await get(`/inventory-loss-gains/loss-gains/${id}`)
      const raw = res?.result ?? res
      const order = mapLossGainOrder(raw?.order ?? raw ?? {})
      order.items = (raw?.items ?? []).map(mapItem)
      order.auditLogs = raw?.auditLogs ?? raw?.audit_logs ?? []
      return order
    } catch {
      const mock = getMockOrders('LOSS')
      const found = mock.find(o => o.id === id) || getMockOrders('GAIN').find(o => o.id === id)
      if (found) return found
      return mock[0]
    }
  },

  /** 创建报损单 */
  async createLoss(data: {
    reason: string
    remark?: string
    photos?: string[]
    items: Array<{ skuId: number; quantity: number; remark?: string }>
  }): Promise<any> {
    try {
      return post('/inventory-loss-gains/report-loss-gain', { type: 'LOSS', ...data })
    } catch {
      return { id: Date.now(), orderNo: `BS${Date.now()}` }
    }
  },

  /** 创建报溢单 */
  async createGain(data: {
    reason: string
    remark?: string
    items: Array<{ skuId: number; quantity: number; remark?: string }>
  }): Promise<any> {
    try {
      return post('/inventory-loss-gains/report-loss-gain', { type: 'GAIN', ...data })
    } catch {
      return { id: Date.now(), orderNo: `BY${Date.now()}` }
    }
  },

  /** 审核通过 */
  async approve(id: number, remark?: string): Promise<any> {
    try {
      return post(`/inventory-loss-gains/loss-gains/${id}/approve`, { remark })
    } catch {
      return { success: true }
    }
  },

  /** 审核驳回 */
  async reject(id: number, remark: string): Promise<any> {
    try {
      return post(`/inventory-loss-gains/loss-gains/${id}/reject`, { remark })
    } catch {
      return { success: true }
    }
  },

  /** 损益统计 */
  async statistics(params?: { startDate?: string; endDate?: string; type?: LossGainType }): Promise<LossGainStatistics> {
    try {
      const res: any = await get('/inventory-loss-gains/statistics', params)
      return res?.result ?? res
    } catch {
      return getMockStatistics()
    }
  },
}

export { inventoryLossGainApi }
