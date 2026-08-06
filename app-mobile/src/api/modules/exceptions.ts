export interface OrderException {
  id: number
  orderNo: string
  exceptionType: string
  exceptionReason: string
  description: string
  status: string
  handler: string
  handleTime: string
  handleResult: string
  createdAt: string
}

export interface OrderExceptionQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  exceptionType?: string
  startDate?: string
  endDate?: string
}

export interface OrderExceptionListResponse {
  list: OrderException[]
  total: number
}

export const exceptionApi = {
  async getList(query: OrderExceptionQuery): Promise<OrderExceptionListResponse> {
    // R94-03 核实：后端无订单异常模块（全库检索无 order-exception/异常单路由），由页面降级为「开发中」占位，禁止编造数据
    return Promise.reject(new Error('订单异常处理功能开发中（R94-03 核实：后端无对应接口）'))
  },

  async getById(id: number): Promise<OrderException> {
    return Promise.reject(new Error('订单异常处理功能开发中（R94-03 核实：后端无对应接口）'))
  },

  async handle(id: number, handleResult: string): Promise<void> {
    return Promise.reject(new Error('订单异常处理功能开发中（R94-03 核实：后端无对应接口）'))
  }
}
