import { get, post } from '../request'

/** 售后单（管理端 /admin/aftersales 契约） */
export interface AftersaleRecord {
  id: number
  aftersaleNo: string
  orderNo: string
  customerId?: number
  storeId?: number
  aftersaleType: string
  aftersaleTypeLabel?: string
  reason: string
  refundAmount: number
  status: string
  statusLabel?: string
  deadline?: string
  returnLogisticsNo?: string
  returnLogisticsCompany?: string
  createdAt: string
  updatedAt: string
}

/** 后端售后状态枚举 → 前端 tab */
export const AFTERSALE_STATUS = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  RETURNING: '退货中',
  RECEIVED: '已收货',
  INSPECTING: '验货中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
} as const

const aftersaleApi = {
  /** 售后列表（管理端） */
  async list(params?: { status?: string; keyword?: string; page?: number; pageSize?: number }): Promise<{ records: AftersaleRecord[]; total: number }> {
    const res: any = await get('/admin/aftersales', params)
    const raw = res?.result ?? res
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return { records, total: Number(raw?.total ?? records.length) }
  },

  /** 审核通过（version 用于乐观锁，列表行携带，缺省 1） */
  approve(id: number, processRemark?: string, version?: number): Promise<any> {
    return post(`/admin/aftersales/${id}/approve`, { processRemark, version: version ?? 1 })
  },

  /** 审核拒绝（processRemark 必填） */
  reject(id: number, processRemark: string, version?: number): Promise<any> {
    return post(`/admin/aftersales/${id}/reject`, { processRemark, version: version ?? 1 })
  },
}

export { aftersaleApi }
