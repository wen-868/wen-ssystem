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

/** 批量调价参数 */
export interface BatchAdjustParams {
  productIds?: number[]
  categoryIds?: number[]
  adjustType: 'percent' | 'fixed' | 'set'
  adjustValue: number
  priceType?: string
  remark?: string
}

/** 批量调价预览结果 */
export interface BatchPreviewResult {
  totalProducts: number
  previewList: Array<{
    productId: number
    productName: string
    originalPrice: number
    newPrice: number
    diff: number
  }>
}

/** 批量调价执行结果 */
export interface BatchExecuteResult {
  batchNo: string
  successCount: number
  failCount: number
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

  /** 提交建议核价单（后端 POST /admin/prices/review） */
  async submitReview(data: {
    skuId: number
    suggestedPrice: number
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
