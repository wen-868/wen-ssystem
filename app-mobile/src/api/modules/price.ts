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
    const rows: any[] = res?.list ?? res ?? (Array.isArray(res) ? res : [])
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
}

export { priceApi }
