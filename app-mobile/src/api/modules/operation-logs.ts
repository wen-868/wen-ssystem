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
}

export interface OperationType {
  value: string
  label: string
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
      list: rows.map((r: any) => ({
        id: r.id,
        operator: r.operatorName ?? r.operator ?? '',
        operatorId: Number(r.operatorId ?? r.operator_id ?? 0),
        operationType: r.action ?? r.operationType ?? '',
        operationTypeName: r.action ?? r.operationTypeName ?? r.actionText ?? '',
        content: r.remark ?? r.content ?? (r.action ? `${r.action}${r.bizNo ? ' ' + r.bizNo : ''}` : ''),
        module: r.module ?? '',
        moduleName: r.module ?? '',
        ip: r.ip ?? '',
        createdAt: r.createdAt ?? r.created_at ?? '',
      })),
      total: raw?.total ?? rows.length,
    }
  },

  async getDetail(id: number): Promise<OperationLog> {
    // R94-03 核实：后端仅提供 /admin/operation-logs 列表与 /statistics，无单条详情，由页面降级为「开发中」提示
    return Promise.reject(new Error('操作日志详情功能开发中（R94-03 核实：后端无详情接口）'))
  },

  async getTypes(): Promise<OperationType[]> {
    // R94-03 核实：后端无操作类型接口（/admin/operation-logs/types 不存在），筛选类型由页面降级为静态枚举
    return Promise.reject(new Error('操作类型接口开发中（R94-03 核实：后端无 /types 接口）'))
  }
}

export { operationLogApi }
