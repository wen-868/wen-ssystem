import { get, post } from '../request'

/**
 * 门店收银相关 API（统一走 /store 前缀）
 * 涵盖：快速收银、交接班、日结、挂单、会员识别
 */

// ==================== 快速收银 ====================

export interface CashierItem {
  productId: number
  productName: string
  sku: string
  price: number
  quantity: number
  subtotal: number
}

export type PaymentChannelValue = 'cash' | 'wechat' | 'alipay' | 'store_card'

export interface CashierOrderParams {
  items: CashierItem[]
  memberId?: number
  paymentChannel: PaymentChannelValue
  receivedAmount?: number
  couponId?: number
  discountAmount?: number
  remark?: string
  shiftId?: number
}

export interface CashierOrderResult {
  orderNo: string
  totalAmount: number
  discountAmount: number
  paidAmount: number
  changeAmount: number
  paymentChannel: string
  createdAt: string
}

export interface PaymentChannel {
  value: PaymentChannelValue
  label: string
  icon: string
}

const cashierApi = {
  /** 创建收银订单（快速收银结账） */
  async createCashierOrder(params: CashierOrderParams): Promise<CashierOrderResult> {
    return post('/store/cashier/orders', params)
  },

  /** 获取支付方式列表 */
  async getPaymentChannels(): Promise<PaymentChannel[]> {
    return get('/store/cashier/payment-channels')
  },

  /** 扫码识别商品（条码/二维码） */
  async scanProduct(code: string): Promise<CashierItem> {
    return get('/store/cashier/scan', { code })
  },
}

// ==================== 交接班 ====================

export interface ShiftInfo {
  id: number
  shiftNo: string
  operatorId: number
  operatorName: string
  startTime: string
  endTime?: string
  status: 'active' | 'closed'
  totalAmount: number
  totalOrders: number
  cashAmount: number
  wechatAmount: number
  alipayAmount: number
  storeCardAmount: number
}

export interface ShiftSummary {
  totalAmount: number
  totalOrders: number
  cashAmount: number
  wechatAmount: number
  alipayAmount: number
  storeCardAmount: number
  refundAmount: number
  discountAmount: number
}

const shiftApi = {
  /** 获取当前班次信息 */
  async getCurrentShift(): Promise<ShiftInfo | null> {
    const res: any = await get('/store/shifts/current')
    return (res?.result ?? res) as ShiftInfo | null
  },

  /** 开班（接班） */
  async startShift(): Promise<ShiftInfo> {
    return post('/store/shifts/start')
  },

  /** 交班（结束当前班次） */
  async endShift(shiftId: number): Promise<ShiftInfo> {
    return post(`/store/shifts/${shiftId}/end`)
  },

  /** 获取当前班次汇总 */
  async getShiftSummary(shiftId: number): Promise<ShiftSummary> {
    const res: any = await get(`/store/shifts/${shiftId}/summary`)
    return (res?.result ?? res) as ShiftSummary
  },

  /** 交接班历史列表 */
  async listShifts(params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }): Promise<{ list: ShiftInfo[]; total: number }> {
    const res: any = await get('/store/shifts', params)
    return (res?.result ?? res) as { list: ShiftInfo[]; total: number }
  },
}

// ==================== 日结 ====================

export interface DailySettleInfo {
  settleDate: string
  totalAmount: number
  totalOrders: number
  avgOrderAmount: number
  cashAmount: number
  wechatAmount: number
  alipayAmount: number
  storeCardAmount: number
  refundAmount: number
  refundOrders: number
  discountAmount: number
  memberPointsUsed: number
  status: 'pending' | 'settled'
  settledAt?: string
  settledBy?: string
}

const dailySettleApi = {
  /** 获取指定日期的日结数据 */
  async getDailySettle(date: string): Promise<DailySettleInfo> {
    const res: any = await get('/store/daily-settle', { date })
    return (res?.result ?? res) as DailySettleInfo
  },

  /** 执行日结操作 */
  async settle(date: string, remark?: string): Promise<DailySettleInfo> {
    return post('/store/daily-settle', { date, remark })
  },

  /** 日结历史列表 */
  async listDailySettles(params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }): Promise<{ list: DailySettleInfo[]; total: number }> {
    const res: any = await get('/store/daily-settle/list', params)
    return (res?.result ?? res) as { list: DailySettleInfo[]; total: number }
  },
}

// ==================== 挂单管理 ====================

export interface HoldOrder {
  id: number
  holdNo: string
  items: CashierItem[]
  totalAmount: number
  memberId?: number
  memberName?: string
  remark?: string
  createdAt: string
  operatorName: string
}

const holdOrderApi = {
  /** 挂单列表 */
  async list(params?: { keyword?: string }): Promise<HoldOrder[]> {
    const res: any = await get('/store/hold-orders', params)
    return (res?.result ?? res?.list ?? res) as HoldOrder[]
  },

  /** 挂单（保存当前收银草稿） */
  async hold(params: { items: CashierItem[]; memberId?: number; remark?: string }): Promise<HoldOrder> {
    return post('/store/hold-orders', params)
  },

  /** 恢复挂单（取回继续收银） */
  async resume(id: number): Promise<HoldOrder> {
    return post(`/store/hold-orders/${id}/resume`)
  },

  /** 删除挂单 */
  async remove(id: number): Promise<void> {
    return post(`/store/hold-orders/${id}/delete`)
  },
}

// ==================== 会员识别 ====================

export interface MemberIdentifyResult {
  id: number
  name: string
  mobile: string
  level: string
  levelName: string
  points: number
  balance: number
  totalSpent: number
  orderCount: number
  lastConsumeAt?: string
}

const memberIdentifyApi = {
  /** 通过手机号识别会员 */
  async identifyByMobile(mobile: string): Promise<MemberIdentifyResult | null> {
    const res: any = await get('/store/members/identify', { mobile })
    return (res?.result ?? res) as MemberIdentifyResult | null
  },

  /** 通过会员码识别会员 */
  async identifyByCode(code: string): Promise<MemberIdentifyResult | null> {
    const res: any = await get('/store/members/identify-by-code', { code })
    return (res?.result ?? res) as MemberIdentifyResult | null
  },
}

export {
  cashierApi,
  shiftApi,
  dailySettleApi,
  holdOrderApi,
  memberIdentifyApi,
}
