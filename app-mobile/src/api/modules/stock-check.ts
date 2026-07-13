import { get, post, put } from '../request'

/** 盘点单状态 */
export type CheckStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

/** 盘点单 */
export interface StockCheck {
  id: number
  checkNo: string
  title: string
  status: CheckStatus | string
  totalCount?: number
  diffCount?: number
  operatorName?: string
  createdAt?: string
  completedAt?: string
  remark?: string
}

/** 盘点明细项 */
export interface StockCheckItem {
  id: number
  productId: number
  productName: string
  skuId?: string
  systemQty: number
  actualQty?: number
  diffQty?: number
  unit?: string
  remark?: string
}

/** 盘点统计 */
export interface CheckStatistics {
  total: number
  inProgress: number
  completed: number
  draft: number
  cancel: number
}

function mapCheck(r: any): StockCheck {
  return {
    id: r.id,
    checkNo: r.checkNo ?? r.check_no ?? '',
    title: r.title ?? r.name ?? '',
    status: r.status ?? 'DRAFT',
    totalCount: r.totalCount ?? r.total_count != null ? Number(r.total_count) : undefined,
    diffCount: r.diffCount ?? r.diff_count != null ? Number(r.diff_count) : undefined,
    operatorName: r.operatorName ?? r.operator_name,
    createdAt: r.createdAt ?? r.created_at,
    completedAt: r.completedAt ?? r.completed_at,
    remark: r.remark,
  }
}

const stockCheckApi = {
  /** 盘点单列表 */
  async list(params?: { page?: number; pageSize?: number; status?: string; keyword?: string }): Promise<{ list: StockCheck[]; total: number }> {
    const res: any = await get('/admin/stock-checks', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapCheck),
      total: raw?.total ?? rows.length,
    }
  },

  /** 盘点统计 */
  async statistics(): Promise<CheckStatistics> {
    const res: any = await get('/admin/stock-checks/statistics')
    return res?.result ?? res
  },

  /** 盘点单详情 */
  async detail(id: number): Promise<{ check: StockCheck; items: StockCheckItem[] }> {
    const res: any = await get(`/admin/stock-checks/${id}`)
    const raw = res?.result ?? res
    return {
      check: mapCheck(raw?.check ?? raw ?? {}),
      items: (raw?.items ?? raw?.details ?? []).map((it: any) => ({
        id: it.id,
        productId: it.productId ?? it.product_id,
        productName: it.productName ?? it.product_name ?? '',
        skuId: it.skuId ?? it.sku_id,
        systemQty: Number(it.systemQty ?? it.system_qty ?? 0),
        actualQty: it.actualQty != null ? Number(it.actualQty) : undefined,
        diffQty: it.diffQty != null ? Number(it.diffQty) : undefined,
        unit: it.unit,
        remark: it.remark,
      })),
    }
  },

  /** 新建盘点单 */
  async create(data: { title: string; productIds?: number[]; categoryIds?: number[]; remark?: string }): Promise<any> {
    return post('/admin/stock-checks', data)
  },

  /** 更新盘点单 */
  async update(id: number, data: any): Promise<any> {
    return put(`/admin/stock-checks/${id}`, data)
  },

  /** 开始盘点 */
  async start(id: number): Promise<any> {
    return post(`/admin/stock-checks/${id}/start`)
  },

  /** 完成盘点 */
  async complete(id: number): Promise<any> {
    return post(`/admin/stock-checks/${id}/complete`)
  },

  /** 取消盘点 */
  async cancel(id: number): Promise<any> {
    return post(`/admin/stock-checks/${id}/cancel`)
  },

  /** 处理差异 */
  async handleDiff(id: number, data: { items: Array<{ id: number; action: string; remark?: string }> }): Promise<any> {
    return post(`/admin/stock-checks/${id}/handle-diff`, data)
  },
}

export { stockCheckApi }
