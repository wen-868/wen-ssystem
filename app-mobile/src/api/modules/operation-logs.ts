import { get } from '../request'

export interface OperationLog {
  id: number
  operator: string
  operatorId: number
  operationType: string
  operationTypeName: string
  content: string
  module: string
  moduleName: string
  ip: string
  createdAt: string
  bizNo?: string
  beforeData?: string
  afterData?: string
}

export interface OperationType {
  value: string
  label: string
}

/** 后端操作日志行 → 前端日志项 */
function normalizeLog(r: any): OperationLog {
  return {
    id: Number(r.id),
    operator: r.operatorName ?? r.operator ?? '',
    operatorId: Number(r.operatorId ?? r.operator_id ?? 0),
    operationType: r.action ?? r.operationType ?? '',
    operationTypeName: r.action ?? r.operationTypeName ?? r.actionText ?? '',
    content: r.remark ?? r.content ?? (r.action ? `${r.action}${r.bizNo ? ' ' + r.bizNo : ''}` : ''),
    module: r.module ?? '',
    moduleName: r.module ?? '',
    ip: r.ip ?? '',
    createdAt: r.createdAt ?? r.created_at ?? '',
    bizNo: r.bizNo ?? r.biz_no ?? undefined,
    beforeData: r.beforeValue !== undefined ? JSON.stringify(r.beforeValue) : (r.beforeData ?? r.before_data ?? undefined),
    afterData: r.afterValue !== undefined ? JSON.stringify(r.afterValue) : (r.afterData ?? r.after_data ?? undefined),
  }
}

const operationLogApi = {
  async list(params?: {
    page?: number
    pageSize?: number
    startTime?: string
    endTime?: string
    operator?: string
    operationType?: string
    keyword?: string
  }): Promise<{ list: OperationLog[]; total: number }> {
    const res: any = await get('/admin/operation-logs', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(normalizeLog),
      total: raw?.total ?? rows.length,
    }
  },

  async getDetail(id: number): Promise<OperationLog> {
    const res: any = await get(`/admin/operation-logs/${id}`)
    const raw = res?.result ?? res
    return normalizeLog(raw)
  },

  async getTypes(): Promise<OperationType[]> {
    const res: any = await get('/admin/operation-logs/types')
    const raw = res?.result ?? res
    return raw?.list ?? (Array.isArray(raw) ? raw : [])
  }
}

export { operationLogApi }
