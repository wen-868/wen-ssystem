import { get, post, put } from '../request'

/** 价格等级（多价格体系：零售价、批发价、会员价等） */
export interface PriceLevel {
  id: number
  name: string
  code: string
  levelType?: string
  discount?: number
  status?: number
  remark?: string
}

/** 批量调价参数（对齐后端契约） */
export interface BatchAdjustParams {
  filter?: {
    categoryId?: number
    brand?: string
    supplierId?: number
    priceLevelId?: number
    keyword?: string
    minPrice?: number
    maxPrice?: number
    skuIds?: number[]
  }
  adjustment: {
    field: 'retail_price' | 'wholesale_price' | 'cost_price' | 'miniapp_price' | 'store_price'
    method: 'FIXED' | 'PERCENTAGE'
    value: number
    direction: 'INCREASE' | 'DECREASE'
  }
  reason?: string
}

/** 批量调价预览结果（对齐后端） */
export interface BatchPreviewResult {
  totalCount: number
  affectedCount: number
  skippedCount: number
  totalOldAmount: number
  totalNewAmount: number
  totalChangeAmount: number
  items: Array<{
    skuId: number
    skuName: string
    skuCode: string
    oldPrice: number
    newPrice: number
    changeAmount: number
    changePercent: number
  }>
}

/** 批量调价执行结果（对齐后端） */
export interface BatchExecuteResult {
  success: boolean
  totalCount: number
  updatedCount: number
  failedCount: number
  changeLogs?: number
  batchNo?: string
}

function mapLevel(r: any): PriceLevel {
  return {
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? r.levelCode ?? '',
    levelType: r.levelType ?? r.level_type,
    discount: r.discount != null ? Number(r.discount) : undefined,
    status: r.status != null ? Number(r.status) : 1,
    remark: r.remark ?? r.description,
  }
}

const priceApi = {
  /** 价格等级列表 */
  async listLevels(): Promise<PriceLevel[]> {
    const res: any = await get('/admin/prices/levels')
    // R94-03 结构对齐：后端返回 { total, records }，原先取 res.list 导致 rows.map 崩溃
    const rows: any[] = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map(mapLevel)
  },

  /** 新建价格等级 */
  async createLevel(data: Partial<PriceLevel>): Promise<any> {
    return post('/admin/prices/levels', data)
  },

  /** 更新价格等级 */
  async updateLevel(id: number, data: Partial<PriceLevel>): Promise<any> {
    return put(`/admin/prices/levels/${id}`, data)
  },

  /** 批量调价预览 */
  async previewBatch(params: BatchAdjustParams): Promise<BatchPreviewResult> {
    const res: any = await post('/admin/prices/batch/preview', params)
    return res?.result ?? res
  },

  /** 批量调价执行 */
  async executeBatch(params: BatchAdjustParams): Promise<BatchExecuteResult> {
    const res: any = await post('/admin/prices/batch/execute', params)
    return res?.result ?? res
  },

  /** 批量调价日志 */
  async listBatchLogs(params?: { page?: number; pageSize?: number }): Promise<any> {
    const res: any = await get('/admin/prices/batch/logs', params)
    return res?.result ?? res
  },

  /** 提交建议核价单（后端 POST /admin/prices/review，priceType 可选，默认 RETAIL 零售价） */
  async submitReview(data: {
    skuId: number
    suggestedPrice: number
    priceType?: 'COST' | 'RETAIL' | 'WHOLESALE' | 'MINIAPP' | 'STORE'
    reason?: string
  }): Promise<{ id: number; reviewNo: string; status: string }> {
    const res: any = await post('/admin/prices/review', data)
    return res?.result ?? res
  },

  /** 价格异常列表（后端 GET /admin/prices/anomalies） */
  async listAnomalies(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    anomalyType?: string
  }): Promise<{
    records: Array<{
      skuId: number
      spuId: number
      productName: string
      skuName: string
      spec: string
      barcode: string
      costPrice: number
      retailPrice: number
      storePrice: number
      miniappPrice: number
      wholesalePrice: number
      anomalyType: string
      anomalyTypeLabel: string
    }>
    total: number
    page: number
    pageSize: number
  }> {
    const res: any = await get('/admin/prices/anomalies', params)
    return res?.result ?? res
  },
}

export { priceApi }
