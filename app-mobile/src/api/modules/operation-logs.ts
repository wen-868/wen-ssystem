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
    return {
      list: (res?.list ?? res?.records ?? []),
      total: res?.total ?? 0
    }
  },

  async getDetail(id: number): Promise<OperationLog> {
    const res: any = await get(`/admin/operation-logs/${id}`)
    return res as OperationLog
  },

  async getTypes(): Promise<OperationType[]> {
    const res: any = await get('/admin/operation-logs/types')
    return (res?.list ?? res ?? []) as OperationType[]
  }
}

export { operationLogApi }
