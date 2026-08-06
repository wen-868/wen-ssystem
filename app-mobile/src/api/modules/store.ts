/**
 * 门店端（POS 收银台）业务接口模块
 * 统一使用 app-mobile 的 request 实例与 token 存储机制
 * 对应后端 /store/* 路由
 */
import { get, post, put, del } from '../request'

// ==================== 通用类型 ====================
export interface PageParams {
  page?: number
  pageSize?: number
}

export interface PageResult<T> {
  list?: T[]
  records?: T[]
  total?: number
  page?: number
  pageSize?: number
}

// ==================== 商品 / 库存 ====================
export interface StoreProduct {
  skuId?: number
  id?: number
  productName?: string
  skuName?: string
  barcode?: string
  category?: string
  categoryId?: number
  availableQty?: number
  unitPrice?: number
  price?: number
  spec?: string
  unit?: string
}

export interface StoreCategory {
  id: number
  name: string
  shortName?: string
  icon?: string
}

export interface InventoryAdjustParams {
  skuId: number
  stockType: string
  change: number
  remark?: string
}

export interface InventoryLog {
  id: number
  skuId: number
  skuName?: string
  stockType: string
  change: number
  beforeQty?: number
  afterQty?: number
  remark?: string
  operatorName?: string
  createdAt?: string
}

export interface InventoryAlertItem {
  skuId: number
  skuName?: string
  productName?: string
  currentQty: number
  alertThreshold: number
  unit?: string
}

// ==================== 销售单 ====================
export interface StoreSaleItem {
  skuId: number
  skuName: string
  quantity: number
  unitPrice: number
  subtotalAmount: number
  boxQty?: number
  bottleQty?: number
}

export interface CreateStoreSaleParams {
  customerName?: string
  customerMobile?: string
  memberId?: number
  items: StoreSaleItem[]
  paymentMethod?: string
  amountReceived?: number
  remark?: string
}

export interface StoreSaleBill {
  billNo: string
  customerName?: string
  customerMobile?: string
  totalAmount: number
  receivedAmount?: number
  status: string
  collectionStatus?: string
  paymentMethod?: string
  items?: StoreSaleItem[]
  createdAt?: string
  saleDate?: string
}

export interface StoreSaleBillListParams extends PageParams {
  keyword?: string
  collectionStatus?: string
  status?: string
}

// ==================== 收款链接 / 支付 / 退款 ====================
export interface CollectionLinkResult {
  linkNo: string
  token: string
  shareUrl: string
}

export interface CollectionLinkParams {
  amount: number
  shareChannel?: string
  taxEnabled?: boolean
  taxRate?: number
  expireHours?: number
  remark?: string
}

export interface PaymentOrder {
  orderNo: string
  billNo?: string
  amount: number
  channel?: string
  status: string
  paidAt?: string
  createdAt?: string
}

export interface RefundOrder {
  refundNo: string
  orderNo?: string
  billNo?: string
  amount: number
  reason?: string
  status: string
  createdAt?: string
}

// ==================== 订单履约 ====================
export interface StoreOrder {
  orderNo: string
  channel?: string
  customerName?: string
  customerMobile?: string
  address?: string
  totalAmount: number
  status: string
  items?: Array<{ skuName: string; quantity: number; unitPrice: number }>
  createdAt?: string
  acceptDeadline?: string
}

export interface StoreOrderDetail extends StoreOrder {
  remark?: string
  deliveryType?: string
  riderName?: string
  riderMobile?: string
}

// ==================== 挂单 ====================
export interface HoldOrderItem {
  skuId: number
  skuName: string
  quantity: number
  unitPrice: number
  subtotalAmount: number
}

export interface CreateHoldOrderParams {
  customerName?: string
  customerMobile?: string
  amount: number
  remark?: string
  items: HoldOrderItem[]
}

export interface HoldOrder {
  holdNo: string
  customerName?: string
  customerMobile?: string
  amount: number
  remark?: string
  items?: HoldOrderItem[]
  status?: string
  createdAt?: string
}

// ==================== 仪表盘 ====================
export interface StoreDashboard {
  todaySales?: number
  todayOrders?: number
  todayAmount?: number
  monthSales?: number
  monthOrders?: number
  stockAlertCount?: number
  pendingOrders?: number
  [key: string]: any
}

export interface DailySalesItem {
  date?: string
  amount?: number
  count?: number
}

// ==================== 盘点 ====================
export interface StockCheckResult {
  id: number
  checkNo?: string
  status?: string
  totalQty?: number
  diffQty?: number
  createdAt?: string
  operatorName?: string
}

export interface StoreStockCheck {
  id: number
  checkNo?: string
  status: string
  createdAt?: string
  items?: Array<{
    id: number
    skuId: number
    skuName?: string
    bookQty: number
    actualQty?: number
    diffReason?: string
  }>
}

// ==================== 门店管控 / 调拨 ====================
export interface StoreControlStatus {
  storeId: number
  storeName?: string
  status?: string
  online?: boolean
  businessHours?: string
  lastOpenTime?: string
}

export interface StoreControlLog {
  id: number
  action: string
  operatorName?: string
  remark?: string
  createdAt?: string
}

export interface StoreTransfer {
  id: number
  transferNo: string
  fromStoreName?: string
  toStoreName?: string
  status: string
  totalQty?: number
  createdAt?: string
}

// ==================== 交接班 ====================
export interface ShiftRecord {
  id: number
  shiftType: string
  startTime: string
  endTime?: string
  operatorId?: number
  operatorName?: string
  status?: string
  actualCash?: number
  actualWechat?: number
  actualAlipay?: number
  remark?: string
}

export interface CreateShiftParams {
  shiftType: string
  startTime: string
  endTime?: string
  operatorId?: number
  operatorName?: string
  remark?: string
}

export interface CompleteShiftParams {
  endTime: string
  actualCash?: number
  actualWechat?: number
  actualAlipay?: number
  remark?: string
}

export interface ShiftSalesStats {
  totalAmount?: number
  totalCount?: number
  cashAmount?: number
  wechatAmount?: number
  alipayAmount?: number
}

export interface ShiftStockCheckItem {
  skuId: number
  bookQty: number
  actualQty: number
  diffReason?: string
}

// ==================== 会员 ====================
export interface StoreMember {
  id: number
  name?: string
  mobile?: string
  levelName?: string
  points?: number
  balance?: number
  totalSpent?: number
  lastConsumeAt?: string
}

export interface MemberPointsHistoryItem {
  id: number
  change: number
  beforePoints?: number
  afterPoints?: number
  reason?: string
  type?: string
  createdAt?: string
}

// ==================== 销售退货 ====================
export interface SaleReturnItem {
  skuId: number
  skuName: string
  quantity: number
  unitPrice: number
  reason?: string
}

export interface CreateSaleReturnParams {
  sourceBillNo: string
  items: SaleReturnItem[]
  remark?: string
}

export interface SaleReturn {
  returnNo: string
  sourceBillNo: string
  totalAmount: number
  status: string
  items?: SaleReturnItem[]
  remark?: string
  createdAt?: string
}

export interface SaleReturnListParams extends PageParams {
  returnStatus?: string
  date?: string
}

// ==================== 优惠券 ====================
export interface StoreCoupon {
  id: number
  code?: string
  name?: string
  faceValue?: number
  minValue?: number
  status: string
  expireAt?: string
  usedAt?: string
}

export interface CouponVerifyResult {
  valid: boolean
  couponId?: number
  code?: string
  name?: string
  faceValue?: number
  minValue?: number
  expireAt?: string
  message?: string
}

// ==================== 日结 ====================
export interface SubmitDailySettleParams {
  settleDate: string
}

export interface DailySettleRecord {
  id: number
  settleDate: string
  totalAmount?: number
  totalCount?: number
  cashAmount?: number
  wechatAmount?: number
  alipayAmount?: number
  status?: string
  operatorName?: string
  createdAt?: string
}

export interface DailySettleListParams extends PageParams {
  startDate?: string
  endDate?: string
}

// ==================== 操作日志 ====================
export interface OperationLog {
  id: number
  actionType: string
  action?: string
  operatorName?: string
  module?: string
  target?: string
  remark?: string
  createdAt?: string
}

export interface OperationLogListParams extends PageParams {
  startTime?: string
  endTime?: string
  operatorName?: string
  actionType?: string
}

// ==================== 门店端 API ====================
const storeApi = {
  // ---------- 商品 / 库存 ----------
  /** 搜索门店商品 */
  async searchProducts(keyword: string): Promise<{ records: StoreProduct[] }> {
    const res: any = await get('/store/products', { keyword })
    return (res?.result ?? res) as { records: StoreProduct[] }
  },

  /** 门店库存查询 */
  async fetchInventory(params?: string | Record<string, unknown>): Promise<any> {
    const queryParams = typeof params === 'string' ? { keyword: params } : (params || {})
    const res: any = await get('/store/inventory', queryParams)
    return (res?.result ?? res)
  },

  /** 库存调整 */
  async adjustInventory(params: InventoryAdjustParams): Promise<any> {
    return post('/store/inventory/adjust', params)
  },

  /** 库存调整日志 */
  async fetchInventoryLogs(params?: PageParams): Promise<PageResult<InventoryLog>> {
    const res: any = await get('/store/inventory/logs', { page: 1, pageSize: 30, ...params })
    return (res?.result ?? res) as PageResult<InventoryLog>
  },

  /** 库存预警列表 */
  async fetchInventoryAlerts(): Promise<InventoryAlertItem[]> {
    const res: any = await get('/store/inventory/alerts')
    return (res?.result ?? res) || []
  },

  /** 商品分类 */
  async fetchCategories(): Promise<StoreCategory[]> {
    const res: any = await get('/store/product-categories')
    return (res?.result ?? res) || []
  },

  /** 更新预警阈值 */
  async updateAlertThreshold(skuId: number, threshold: number): Promise<any> {
    return put(`/store/inventory/alerts/${skuId}/threshold`, { threshold })
  },

  // ---------- 销售单 ----------
  /** 创建销售单 */
  async createSaleBill(params: CreateStoreSaleParams): Promise<StoreSaleBill> {
    const res: any = await post('/store/sale-bills', params)
    return (res?.result ?? res) as StoreSaleBill
  },

  /** 销售单列表 */
  async fetchSaleBills(params?: StoreSaleBillListParams): Promise<PageResult<StoreSaleBill>> {
    const res: any = await get('/store/sale-bills', { page: 1, pageSize: 20, ...params })
    return (res?.result ?? res) as PageResult<StoreSaleBill>
  },

  /** 销售单详情 */
  async fetchSaleBillDetail(billNo: string): Promise<StoreSaleBill> {
    const res: any = await get(`/store/sale-bills/${billNo}`)
    return (res?.result ?? res) as StoreSaleBill
  },

  /** 线下收款 */
  async offlinePayment(billNo: string, amount: number, paymentMethod: string): Promise<any> {
    return post(`/store/sale-bills/${billNo}/offline-payment`, { amount, paymentMethod })
  },

  /** 生成收款链接 */
  async createCollectionLink(billNo: string, params: CollectionLinkParams): Promise<CollectionLinkResult> {
    const res: any = await post(`/store/sale-bills/${billNo}/collection-link`, {
      shareChannel: 'LINK',
      amount: params.amount,
      taxEnabled: params.taxEnabled ?? false,
      taxRate: params.taxRate ?? 0,
      expireHours: params.expireHours ?? 72,
    })
    return (res?.result ?? res) as CollectionLinkResult
  },

  /** 收款链接列表 */
  async fetchCollectionLinks(params?: PageParams): Promise<PageResult<any>> {
    const res: any = await get('/store/collection-links', { page: 1, pageSize: 30, ...params })
    return (res?.result ?? res) as PageResult<any>
  },

  /** 撤销收款链接 */
  async revokeCollectionLink(linkNo: string): Promise<any> {
    return post(`/store/collection-links/${linkNo}/revoke`, {})
  },

  /** 支付单列表 */
  async fetchPaymentOrders(params?: PageParams): Promise<PageResult<PaymentOrder>> {
    const res: any = await get('/store/payment-orders', { page: 1, pageSize: 30, ...params })
    return (res?.result ?? res) as PageResult<PaymentOrder>
  },

  /** 退款单列表 */
  async fetchRefundOrders(params?: PageParams): Promise<PageResult<RefundOrder>> {
    const res: any = await get('/store/refund-orders', { page: 1, pageSize: 30, ...params })
    return (res?.result ?? res) as PageResult<RefundOrder>
  },

  // ---------- 订单履约 ----------
  /** 门店订单列表 */
  async fetchOrders(params?: PageParams): Promise<PageResult<StoreOrder>> {
    const res: any = await get('/store/orders', { page: 1, pageSize: 20, ...params })
    return (res?.result ?? res) as PageResult<StoreOrder>
  },

  /** 门店订单详情 */
  async fetchOrderDetail(orderNo: string): Promise<StoreOrderDetail> {
    const res: any = await get(`/store/orders/${orderNo}`)
    return (res?.result ?? res) as StoreOrderDetail
  },

  /** 接单 */
  async acceptOrder(orderNo: string): Promise<any> {
    return post(`/store/orders/${orderNo}/accept`, {})
  },

  /** 开始配送 */
  async startDelivery(orderNo: string): Promise<any> {
    return post(`/store/orders/${orderNo}/start-delivery`, {})
  },

  /** 拒单 */
  async rejectOrder(orderNo: string): Promise<any> {
    return post(`/store/orders/${orderNo}/reject`, {})
  },

  /** 完成订单 */
  async completeOrder(orderNo: string): Promise<any> {
    return post(`/store/orders/${orderNo}/complete`, {})
  },

  // ---------- 挂单 ----------
  /** 创建挂单 */
  async createHoldOrder(params: CreateHoldOrderParams): Promise<HoldOrder> {
    const res: any = await post('/store/hold-orders', params)
    return (res?.result ?? res) as HoldOrder
  },

  /** 挂单列表 */
  async fetchHoldOrders(params?: PageParams): Promise<PageResult<HoldOrder>> {
    const res: any = await get('/store/hold-orders', { page: 1, pageSize: 30, ...params })
    return (res?.result ?? res) as PageResult<HoldOrder>
  },

  /** 恢复挂单 */
  async restoreHoldOrder(holdNo: string): Promise<any> {
    return post(`/store/hold-orders/${holdNo}/restore`)
  },

  /** 删除挂单 */
  async deleteHoldOrder(holdNo: string): Promise<any> {
    return del(`/store/hold-orders/${holdNo}`)
  },

  // ---------- 仪表盘 ----------
  /** 门店仪表盘 */
  async fetchDashboard(): Promise<StoreDashboard> {
    const res: any = await get('/store/dashboard')
    return (res?.result ?? res) as StoreDashboard
  },

  /** 管理端总览（兼容） */
  async fetchDashboardOverview(): Promise<any> {
    // R94-03：原 /store/dashboard/overview 不存在；门店看板聚合接口为 /store/dashboard（store-dashboard.routes.ts）
    const res: any = await get('/store/dashboard')
    return (res?.result ?? res)
  },

  /** 近期每日销售 */
  async fetchDailySales(): Promise<DailySalesItem[]> {
    const res: any = await get('/store/daily-sales')
    return (res?.result ?? res) || []
  },

  // ---------- 盘点 ----------
  /** 盘点结果列表 */
  async fetchStockCheckResults(params?: PageParams): Promise<PageResult<StockCheckResult>> {
    const res: any = await get('/store/stock-checks/results', { page: 1, pageSize: 20, ...params })
    return (res?.result ?? res) as PageResult<StockCheckResult>
  },

  /** 我的盘点任务 */
  async fetchStockChecks(): Promise<StoreStockCheck[]> {
    const res: any = await get('/store/stock-checks/my')
    return (res?.result ?? res) || []
  },

  /** 盘点详情 */
  async fetchStockCheckDetail(id: number): Promise<StoreStockCheck> {
    const res: any = await get(`/store/stock-checks/${id}`)
    return (res?.result ?? res) as StoreStockCheck
  },

  /** 更新盘点项 */
  async updateStockCheckItem(checkId: number, itemId: number, payload: { actualQty: number }): Promise<any> {
    return put(`/store/stock-checks/${checkId}/items/${itemId}`, payload)
  },

  /** 提交盘点 */
  async submitStockCheck(id: number): Promise<any> {
    return post(`/store/stock-checks/${id}/submit`)
  },

  // ---------- 门店管控 / 调拨 ----------
  /** 门店管控状态 */
  async fetchControlStatus(): Promise<StoreControlStatus> {
    const res: any = await get('/store/control/status')
    return (res?.result ?? res) as StoreControlStatus
  },

  /** 门店管控操作日志 */
  async fetchControlMyLogs(params?: PageParams): Promise<PageResult<StoreControlLog>> {
    const res: any = await get('/store/control/my-logs', { page: 1, pageSize: 20, ...params })
    return (res?.result ?? res) as PageResult<StoreControlLog>
  },

  /** 在途调拨 */
  async fetchInTransitTransfers(): Promise<StoreTransfer[]> {
    const res: any = await get('/store/transfers/in-transit')
    return (res?.result ?? res) || []
  },

  /** 我的发货 */
  async fetchMyShipments(): Promise<StoreTransfer[]> {
    const res: any = await get('/store/transfers/my-shipments')
    return (res?.result ?? res) || []
  },

  /** 收货确认 */
  async receiveTransfer(id: number, payload: unknown): Promise<any> {
    return post(`/store/transfers/${id}/receive`, payload)
  },

  // ---------- 交接班 ----------
  /** 交接班记录 */
  async fetchShifts(params?: PageParams & { date?: string; shiftType?: string }): Promise<PageResult<ShiftRecord>> {
    // R94-03：原 /store/shifts 不存在；交接班历史真实接口为 /store/shift/history（store-shift.routes.ts）
    const res: any = await get('/store/shift/history', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        shiftType: r.shiftType ?? r.shift_type ?? '',
        startTime: r.startTime ?? r.start_time ?? '',
        endTime: r.endTime ?? r.end_time,
        operatorId: r.operatorId ?? r.operator_id,
        operatorName: r.operatorName ?? r.operator_name,
        status: r.status,
        actualCash: r.actualCash ?? r.actual_cash,
        actualWechat: r.actualWechat ?? r.actual_wechat,
        actualAlipay: r.actualAlipay ?? r.actual_alipay,
        remark: r.remark,
      })),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? 1,
      pageSize: raw?.pageSize ?? rows.length,
    }
  },

  /** 创建交接班 */
  async createShift(params: CreateShiftParams): Promise<ShiftRecord> {
    // R94-03 核实：后端仅提供 /store/shift/current、/store/shift/history、/store/shift/settle，无创建交接班接口
    return Promise.reject(new Error('创建交接班功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 交接班详情 */
  async fetchShiftDetail(shiftId: number): Promise<ShiftRecord> {
    // R94-03 核实：后端无交接班详情接口（仅 current/history/settle）
    return Promise.reject(new Error('交接班详情功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 完成交接班 */
  async completeShift(shiftId: number, params: CompleteShiftParams): Promise<any> {
    // R94-03：原 /store/shifts/:shiftId/complete 不存在；交接班结算真实接口为 POST /store/shift/settle
    return post('/store/shift/settle', params)
  },

  /** 交接班销售统计 */
  async fetchShiftSalesStats(shiftId: number): Promise<ShiftSalesStats> {
    // R94-03 核实：后端无交接班销售统计接口（仅 current/history/settle）
    return Promise.reject(new Error('交接班销售统计功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 交接班盘点 */
  async fetchShiftStockCheck(shiftId: number): Promise<any> {
    // R94-03 核实：后端无交接班盘点接口
    return Promise.reject(new Error('交接班盘点功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 提交交接班盘点 */
  async submitShiftStockCheck(shiftId: number, items: ShiftStockCheckItem[]): Promise<any> {
    // R94-03 核实：后端无交接班盘点提交接口
    return Promise.reject(new Error('交接班盘点提交功能开发中（R94-03 核实：后端无对应接口）'))
  },

  // ---------- 会员 ----------
  /** 搜索会员 */
  async searchMember(keyword: string): Promise<{ records: StoreMember[] } | StoreMember[]> {
    // R94-03：原 /store/members/search 不存在；会员列表真实接口为 /store/members（keyword 查询参数，store.routes.ts）
    const res: any = await get('/store/members', { keyword })
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return rows.map((r: any) => ({
      id: r.id ?? r.memberId,
      name: r.name ?? '',
      mobile: r.mobile ?? r.phone ?? '',
      levelName: r.levelName ?? r.level_name ?? r.levelCode,
      points: Number(r.points ?? 0),
      balance: Number(r.balance ?? 0),
      totalSpent: Number(r.totalSpent ?? r.total_amount ?? 0),
      lastConsumeAt: r.lastConsumeAt ?? r.last_consume_at,
    }))
  },

  /** 会员列表（兼容旧版接口名） */
  async searchStoreMembers(keyword: string): Promise<{ records: StoreMember[] }> {
    const res: any = await get('/store/members', { keyword })
    return (res?.result ?? res) as { records: StoreMember[] }
  },

  /** 会员详情 */
  async getMemberDetail(memberId: number): Promise<StoreMember> {
    // R94-03 核实：后端 /store/members 仅提供列表（无 /:id 详情接口），由页面降级处理
    return Promise.reject(new Error('会员详情功能开发中（R94-03 核实：后端无详情接口）'))
  },

  /** 会员积分 */
  async getMemberPoints(memberId: number): Promise<{ points: number } | any> {
    // R94-03 核实：后端无会员积分接口，由页面降级处理
    return Promise.reject(new Error('会员积分功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 会员积分明细 */
  async getMemberPointsHistory(memberId: number, params?: PageParams): Promise<PageResult<MemberPointsHistoryItem>> {
    // R94-03 核实：后端无会员积分明细接口，由页面降级处理
    return Promise.reject(new Error('会员积分明细功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 会员订单 */
  async getMemberOrders(memberId: number, params?: PageParams): Promise<PageResult<any>> {
    // R94-03 核实：后端无会员订单接口，由页面降级处理
    return Promise.reject(new Error('会员订单功能开发中（R94-03 核实：后端无对应接口）'))
  },

  // ---------- 销售退货 ----------
  /** 退货列表 */
  async fetchSaleReturns(params?: SaleReturnListParams): Promise<PageResult<SaleReturn>> {
    const res: any = await get('/store/sale-returns', { page: 1, pageSize: 20, ...params })
    return (res?.result ?? res) as PageResult<SaleReturn>
  },

  /** 创建退货 */
  async createSaleReturn(params: CreateSaleReturnParams): Promise<SaleReturn> {
    const res: any = await post('/store/sale-returns', params)
    return (res?.result ?? res) as SaleReturn
  },

  /** 退货详情 */
  async fetchSaleReturnDetail(returnNo: string): Promise<SaleReturn> {
    const res: any = await get(`/store/sale-returns/${returnNo}`)
    return (res?.result ?? res) as SaleReturn
  },

  /** 审核通过退货 */
  async approveSaleReturn(returnNo: string): Promise<any> {
    return post(`/store/sale-returns/${returnNo}/approve`)
  },

  /** 拒绝退货 */
  async rejectSaleReturn(returnNo: string, reason: string): Promise<any> {
    return post(`/store/sale-returns/${returnNo}/reject`, { reason })
  },

  // ---------- 优惠券 ----------
  /** 核销优惠券（扫码） */
  async verifyCoupon(code: string): Promise<CouponVerifyResult> {
    const res: any = await post('/store/coupons/verify', { code })
    return (res?.result ?? res) as CouponVerifyResult
  },

  /** 手动核销优惠券 */
  async manualVerifyCoupon(payload: { couponCode: string; saleBillNo?: string }): Promise<CouponVerifyResult> {
    const res: any = await post('/store/coupons/manual-verify', payload)
    return (res?.result ?? res) as CouponVerifyResult
  },

  /** 优惠券列表 */
  async fetchCoupons(params?: PageParams & { status?: string }): Promise<PageResult<StoreCoupon>> {
    // R94-03 核实：后端无门店优惠券列表接口（仅核销 verify/manual-verify），由页面降级处理
    return Promise.reject(new Error('优惠券列表功能开发中（R94-03 核实：后端无对应接口）'))
  },

  /** 优惠券详情 */
  async fetchCouponDetail(couponId: number): Promise<StoreCoupon> {
    // R94-03 核实：后端无优惠券详情接口，由页面降级处理
    return Promise.reject(new Error('优惠券详情功能开发中（R94-03 核实：后端无对应接口）'))
  },

  // ---------- 日结 ----------
  /** 提交日结 */
  async submitDailySettle(params: SubmitDailySettleParams): Promise<any> {
    // R94-03：原 /admin/daily-settle 不存在；日结创建真实接口为 POST /admin/daily-settlements（admin-finance.routes.ts）
    return post('/admin/daily-settlements', params)
  },

  /** 日结历史 */
  async fetchDailySettleHistory(params?: DailySettleListParams): Promise<PageResult<DailySettleRecord>> {
    // R94-03：原 /admin/daily-settle 不存在；日结列表真实接口为 GET /admin/daily-settlements
    const res: any = await get('/admin/daily-settlements', { page: 1, pageSize: 30, ...params })
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        settleDate: r.settleDate ?? r.settle_date ?? r.createdAt ?? '',
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        totalCount: Number(r.totalCount ?? r.total_count ?? 0),
        cashAmount: Number(r.cashAmount ?? r.cash_amount ?? 0),
        wechatAmount: Number(r.wechatAmount ?? r.wechat_amount ?? 0),
        alipayAmount: Number(r.alipayAmount ?? r.alipay_amount ?? 0),
        status: r.status,
        operatorName: r.operatorName ?? r.operator_name,
        createdAt: r.createdAt ?? r.created_at,
      })),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? 1,
      pageSize: raw?.pageSize ?? rows.length,
    }
  },

  // ---------- 操作日志 ----------
  /** 操作日志列表 */
  async fetchOperationLogs(params?: OperationLogListParams): Promise<PageResult<OperationLog>> {
    // R94-03：原 /store/operation-logs 不存在；操作日志真实接口为 /admin/operation-logs（operation-log.routes.ts）
    const res: any = await get('/admin/operation-logs', { page: 1, pageSize: 30, ...params })
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        actionType: r.actionType ?? r.operationType ?? r.action ?? '',
        action: r.action ?? r.operationType,
        operatorName: r.operatorName ?? r.operator ?? r.operator_name,
        module: r.module ?? r.moduleName,
        target: r.target ?? r.targetType,
        remark: r.remark ?? r.detail,
        createdAt: r.createdAt ?? r.created_at ?? '',
      })),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? 1,
      pageSize: raw?.pageSize ?? rows.length,
    }
  },

  /** 操作日志详情 */
  async fetchOperationLogDetail(logId: number): Promise<OperationLog> {
    // R94-03 核实：后端操作日志仅提供列表与统计，无单条详情接口
    return Promise.reject(new Error('操作日志详情功能开发中（R94-03 核实：后端无详情接口）'))
  },
}

export { storeApi }
