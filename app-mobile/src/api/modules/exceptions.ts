import { get, post, put } from '../request'

export interface OrderException {
  id: number
  exceptionNo: string
  exceptionLevel: string
  channelOrderNo: string
  channelType: string
  exceptionType: string
  exceptionDetail: string
  handleStatus: string
  handlerName: string
  handleResult: string
  handledAt: string | null
  createdAt: string
  /** 页面展示字段（由后端契约映射） */
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  orderNo: string
  description: string
  createTime: string
  customerName: string
  logs?: Array<{
    id: number
    handlerName: string
    action: string
    result: string | null
    createdAt: string
  }>
}

export interface OrderExceptionQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  exceptionType?: string
  startDate?: string
  endDate?: string
}

export interface OrderExceptionListResponse {
  records: OrderException[]
  total: number
  page: number
  pageSize: number
}

const TYPE_LABELS: Record<string, string> = {
  TIMEOUT: '超时未处理',
  STOCKOUT: '库存不足',
  LOGISTICS: '物流异常',
  OTHER: '其他',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已处理',
  CLOSED: '已关闭',
}

/** 后端记录行 → 页面展示对象（驼峰字段 + 中文标签） */
function mapException(r: any): OrderException {
  const type = String(r.exceptionType ?? 'OTHER').toUpperCase()
  const status = String(r.handleStatus ?? 'PENDING').toUpperCase()
  return {
    id: r.id,
    exceptionNo: r.exceptionNo ?? r.exception_no ?? '',
    exceptionLevel: r.exceptionLevel ?? r.exception_level ?? 'WARNING',
    channelOrderNo: r.channelOrderNo ?? r.channel_order_no ?? '',
    channelType: r.channelType ?? r.channel_type ?? '',
    exceptionType: type,
    exceptionDetail: r.exceptionDetail ?? r.exception_detail ?? '',
    handleStatus: status,
    handlerName: r.handlerName ?? r.handler_name ?? '',
    handleResult: r.handleResult ?? r.handle_result ?? '',
    handledAt: r.handledAt ?? r.handled_at ?? null,
    createdAt: r.createdAt ?? r.created_at ?? '',
    type: type.toLowerCase(),
    typeLabel: TYPE_LABELS[type] ?? type,
    status: status.toLowerCase(),
    statusLabel: STATUS_LABELS[status] ?? status,
    orderNo: r.channelOrderNo ?? r.channel_order_no ?? '',
    description: r.exceptionDetail ?? r.exception_detail ?? '',
    createTime: r.createdAt ?? r.created_at ?? '',
    customerName: '',
    logs: Array.isArray(r.logs)
      ? r.logs.map((log: any) => ({
          id: log.id,
          handlerName: log.handlerName ?? log.handler_name ?? '',
          action: log.action ?? '',
          result: log.result ?? null,
          createdAt: log.createdAt ?? log.created_at ?? '',
        }))
      : undefined,
  }
}

export const exceptionApi = {
  /** 异常订单列表（后端 GET /admin/order-exceptions） */
  async getList(query: OrderExceptionQuery = {}): Promise<OrderExceptionListResponse> {
    const res: any = await get('/admin/order-exceptions', query)
    const raw = res?.result ?? res
    return {
      records: (raw?.records ?? raw?.list ?? []).map(mapException),
      total: raw?.total ?? 0,
      page: raw?.page ?? query.page ?? 1,
      pageSize: raw?.pageSize ?? query.pageSize ?? 20,
    }
  },

  /** 异常详情（含处理日志） */
  async getById(id: number): Promise<OrderException> {
    const res: any = await get(`/admin/order-exceptions/${id}`)
    return mapException(res?.result ?? res)
  },

  /** 处理/忽略异常：更新处理状态（RESOLVED/CLOSED） */
  async handle(id: number, result: string, status: 'RESOLVED' | 'CLOSED' = 'RESOLVED'): Promise<void> {
    await put(`/admin/order-exceptions/${id}/status`, { status, result, action: status === 'RESOLVED' ? '处理' : '关闭' })
  },

  /** 从订单创建异常记录 */
  async create(data: {
    orderNo: string
    channelType?: string
    exceptionType?: string
    exceptionDetail?: string
    level?: string
  }): Promise<{ id: number; exceptionNo: string }> {
    const res: any = await post('/admin/order-exceptions', data)
    return res?.result ?? res
  },

  /** 编辑异常备注 */
  async updateRemark(id: number, remark: string): Promise<void> {
    await put(`/admin/order-exceptions/${id}`, { exceptionDetail: remark })
  },
}
