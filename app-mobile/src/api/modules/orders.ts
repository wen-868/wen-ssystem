import { get, post, put } from '../request'

export interface OrderItem {
  id?: number
  skuId: number
  skuName: string
  productName?: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  quantity?: number
  unitPrice: number
  totalPrice?: number
  subtotalAmount: number
}

export interface OrderInfo {
  orderNo: string
  customerName: string
  customerMobile?: string
  customerAddress?: string
  remark?: string
  status: string
  statusLabel: string
  totalAmount: number
  paidAmount: number
  receivableAmount: number
  items: OrderItem[]
  logs?: OrderLog[]
  createdAt: string
  logisticsInfo?: LogisticsInfo
  // 列表展示用扩展字段
  itemCount?: number
  channel?: string
  createTime?: string
}

export interface OrderLog {
  id?: number
  action: string
  operator: string
  remark?: string
  createdAt: string
}

export interface LogisticsInfo {
  logisticsNo?: string
  logisticsCompany?: string
  logisticsStatus?: string
  logisticsStatusLabel?: string
  trackingSteps?: TrackingStep[]
}

export interface TrackingStep {
  status: string
  description: string
  time: string
}

export interface OrderListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  customerName?: string
  startDate?: string
  endDate?: string
}

export interface OrderListResult {
  list: OrderInfo[]
  total: number
  page: number
  pageSize: number
}

const ordersApi = {
  async list(params?: OrderListParams): Promise<OrderListResult> {
    // R94-03 结构对齐：后端返回 data.records（订单行），前端统一映射为 list + statusLabel
    const res: any = await get('/admin/orders', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapOrder),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(orderNo: string): Promise<OrderInfo> {
    const res: any = await get(`/admin/orders/${orderNo}`)
    return mapOrder(res?.result ?? res)
  },

  confirm(orderNo: string): Promise<void> {
    // R94-03：后端无 /confirm；订单状态流转真实接口为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'ACCEPTED' })
  },

  startDelivery(orderNo: string): Promise<void> {
    // R94-03：后端无 /start-delivery；状态流转为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'DELIVERING' })
  },

  completeDelivery(orderNo: string): Promise<void> {
    // R94-03：后端无 /complete-delivery；状态流转为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'COMPLETED' })
  },

  reject(orderNo: string, reason?: string): Promise<void> {
    // R94-03：后端无 /reject；拒单使用状态流转 PUT /admin/orders/:orderNo/status（CANCELLED）
    return put(`/admin/orders/${orderNo}/status`, { status: 'CANCELLED', remark: reason })
  },

  cancel(orderNo: string, reason?: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/cancel`, { reason })
  },

  export(params?: OrderListParams): Promise<Blob> {
    // R94-03：后端导出接口为 GET /admin/orders/export-csv
    return get('/admin/orders/export-csv', params, { responseType: 'blob' })
  }
}

/** 订单状态中文映射（后端返回英文 order_status） */
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '待付款',
  PENDING: '待处理',
  ACCEPTED: '待配送',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  UNPAID: '未支付',
  PAID: '已支付',
}

/**
 * 订单明细映射（R102-01）
 * 后端 t_miniapp_order_item 的 unit_price / subtotal_amount / qty 均为 DECIMAL，
 * mysql2 默认按「字符串」返回（实测 `unit_price: "2899.00"`）。若原样进入视图层，
 * 模板里的 `item.unitPrice.toFixed(2)` 会抛 TypeError → App 端整页白屏。
 * 因此在映射层统一 Number() 归一，视图层可安全格式化。
 * 注意：后端不返回明细 id，列表 key 由页面用 skuId + 索引兜底。
 */
function mapOrderItem(it: any): OrderItem {
  const quantity = Number(it.quantity ?? it.qty ?? 0)
  const totalPrice = it.totalPrice ?? it.total_price
  return {
    skuId: Number(it.skuId ?? it.sku_id ?? 0),
    skuName: it.skuName ?? it.sku_name ?? '',
    productName: it.productName ?? it.product_name,
    boxQty: Number(it.boxQty ?? it.box_qty ?? 0),
    bottleQty: Number(it.bottleQty ?? it.bottle_qty ?? quantity),
    totalBottleQty: Number(it.totalBottleQty ?? it.total_bottle_qty ?? quantity),
    quantity,
    unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
    totalPrice: totalPrice != null ? Number(totalPrice) : undefined,
    subtotalAmount: Number(
      it.subtotalAmount ?? it.subtotal_amount ?? totalPrice ?? 0
    ),
  }
}

function mapOrder(r: any): OrderInfo {
  const status = r.orderStatus ?? r.status ?? ''
  const fulfillmentType = r.fulfillmentType ?? r.fulfillment_type ?? ''
  const customerType = r.customerType ?? r.customer_type ?? ''
  const channel = r.channel
    ?? (fulfillmentType.includes('MINIAPP') ? '小程序'
      : fulfillmentType.includes('INSTANT') ? '即时零售'
      : fulfillmentType.includes('PICKUP') || fulfillmentType.includes('STORE') ? '门店'
      : customerType.includes('WHOLESALE') ? '批发'
      : customerType.includes('RETAIL') ? '零售'
      : (fulfillmentType || '门店'))
  return {
    orderNo: r.orderNo ?? r.order_no ?? '',
    customerName: r.customerName ?? r.customer_name ?? r.receiverName ?? r.receiver_name ?? r.memberName ?? '',
    customerMobile: r.customerMobile ?? r.customer_mobile ?? r.receiverMobile ?? r.receiver_mobile ?? r.mobile,
    customerAddress: r.customerAddress ?? r.address,
    remark: r.remark,
    status,
    statusLabel: r.statusLabel ?? r.status_label ?? ORDER_STATUS_LABEL[status] ?? status,
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? r.payableAmount ?? r.payable_amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.paid_amount ?? r.receivedAmount ?? 0),
    receivableAmount: Number(r.receivableAmount ?? r.receivable_amount ?? r.totalAmount ?? r.payableAmount ?? 0),
    items: Array.isArray(r.items) ? r.items.map(mapOrderItem) : [],
    logs: Array.isArray(r.logs) ? r.logs : undefined,
    createdAt: r.createdAt ?? r.created_at ?? r.createTime ?? '',
    logisticsInfo: r.logisticsInfo ?? r.logistics,
    itemCount: r.itemCount,
    channel,
    createTime: r.createTime,
  }
}

export { ordersApi }

// ========== 历史单据统一查询（后端 admin-bill-history.routes：/api/admin/bills/history） ==========

/**
 * 历史单据记录（聚合：销售单/销售订单/采购订单/采购入库）
 *
 * MOBILE-REJECT-REDELIVER-ENTRY-01-F2：`status` 的口径必须是**业务真实状态**，
 * 不是收款状态。此前本接口与 storeSaleBillsApi 都把 `collectionStatus` 直接当 status，
 * 导致 DB 里 business_status=REJECTED / delivery_status=REJECTED 的单据在列表里
 * 永远显示成 UNPAID/PAID 等收款态 ⇒ 「拒收/配送失败」在 UI 上不可见（F1 被判驳回的真因）。
 */
export interface BillHistoryItem {
  /** sale_bill | sale_order | purchase_order | purchase_in_stock */
  billType: string
  billNo: string
  /** 客户/供应商名称 */
  partyName: string
  amount: number
  /**
   * 展示用真实业务状态（已按优先级归一）：
   * sale_bill ⇒ business_status；sale_order ⇒ delivery_status 优先、其次 order_status；
   * 采购侧 ⇒ 原 order_status / stock_status。**不再是 collection_status。**
   */
  status: string
  createdAt: string
  /** 客户类型 RETAIL/WHOLESALE（仅销售单有值，渠道来源区分 门店零售/门店批发） */
  customerType?: string | null
  /** 业务状态原文（销售单 business_status；仅后端有则透传，供诊断与高级渲染） */
  businessStatus?: string | null
  /** 配送状态原文（即时零售/小程序订单 delivery_status；WATTING/DELIVERING/COMPLETED/REJECTED/CANCELLED） */
  deliveryStatus?: string | null
  /** 订单状态原文（order_status） */
  orderStatus?: string | null
  /** 收款状态原文（collection_status）—— 与 status 分家后单独保留，避免信息丢失 */
  collectionStatus?: string | null
  /** 失败原因（后端有则透传；本表当前无此列时会为空 ⇒ 页面走稳定人工兜底文案） */
  statusReason?: string | null
  /** 恢复入口标记（后端有则透传；本版后端未实现 store:manual-redeliver ⇒ 仅用于识别） */
  retryEntry?: string | null
}

export interface BillHistoryParams {
  billType?: string
  startDate?: string
  endDate?: string
  keyword?: string
  page?: number
  pageSize?: number
}

/**
 * 配送/拒收失败等价状态集合（与 utils/order-recovery-entry.ts 的 FAILURE_STATUSES 同源口径）
 * 单一真相源：本文件只做优先级挑选，判「是不是失败态」仍由 order-recovery-entry 决定。
 */
const FAILURE_STATUSES = ['DELIVERY_FAILED', 'REJECTED']

/**
 * 列表展示状态：**失败态覆盖，否则沿用原历史语义**（failure override, otherwise legacy display）
 *
 * F3 订正（凌舟驳回 F2 §二/§三）：F2 让 `businessStatus` 在**非失败**情形也优先，
 * 使正常销售单从 `UNPAID/PAID` 变成 `CREATED/COMPLETED`，页面「待收款/已收款」筛选随之失效
 * （筛选按 `item.status` 与 UNPAID/PENDING_PAYMENT/PAID 比较）。违反「正常历史单据状态不得回归」。
 *
 * 现行口径（卡 §三）：
 *  ① 失败态优先：`DELIVERY_FAILED` / `REJECTED` 任一来源命中 ⇒ 展示该失败态。
 *     来源顺序按单据类型：sale_bill 先 business_status；其余先 delivery_status；
 *     但**任一来源命中即算失败**（不因来源顺序漏判）。
 *  ② 非失败态一律回到原历史语义：
 *     · sale_bill      ⇒ collectionStatus（收款态；缺失才回退 business/order）
 *     · sale_order     ⇒ orderStatus（缺失才回退 delivery/business）
 *     · purchase_in_stock ⇒ stockStatus；purchase_order ⇒ orderStatus
 *     ⇒ 正常单仍显示 `UNPAID/PAID` 等中文标签，筛选不受影响。
 *  ③ businessStatus / deliveryStatus / collectionStatus 等字段继续保留在返回项里供诊断，
 *     只是**不覆盖**正常列表语义。
 */
function pickDisplayStatus(r: any, billType: string): string {
  const biz = str(r.businessStatus ?? r.business_status)
  const deliv = str(r.deliveryStatus ?? r.delivery_status)
  const order = str(r.orderStatus ?? r.order_status)
  const coll = str(r.collectionStatus ?? r.collection_status)
  const stock = str(r.stockStatus ?? r.stock_status)

  // ① 失败态优先：任一来源命中即展示失败态（用户必须能看见「拒收/配送失败」）
  for (const cand of [biz, deliv, order, coll]) {
    if (cand && FAILURE_STATUSES.includes(cand.toUpperCase())) return cand.toUpperCase()
  }

  // ② 非失败 ⇒ 严格回到原历史语义（不得让 business/delivery 覆盖正常收款态）
  if (billType === 'sale_bill') return coll || biz || order || ''
  if (billType === 'sale_order') return order || deliv || biz || ''
  if (billType === 'purchase_in_stock') return stock || order || ''
  return order || stock || biz || ''
}

function str(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/**
 * 历史单据行 → BillHistoryItem（导出供单测直接验映射，不依赖网络）。
 * 与 storeSaleBillsApi.list 共用 pickDisplayStatus 口径。
 */
export function mapBillHistoryRow(r: any): BillHistoryItem {
  const billType = str(r.billType)
  return {
    billType,
    billNo: str(r.billNo),
    partyName: str(r.partyName),
    amount: Number(r.amount ?? 0),
    status: pickDisplayStatus(r, billType),
    createdAt: str(r.createdAt),
    customerType: r.customerType ?? null,
    businessStatus: r.businessStatus ?? null,
    deliveryStatus: r.deliveryStatus ?? null,
    orderStatus: r.orderStatus ?? null,
    collectionStatus: r.collectionStatus ?? null,
    statusReason: r.statusReason ?? null,
    retryEntry: r.retryEntry ?? null,
  }
}

/** 门店销售单行 → BillHistoryItem（导出供单测直接验映射） */
export function mapStoreSaleBillRow(r: any): BillHistoryItem {
  // 门店销售单：失败语义在 business_status（后端 sale-bill.service.ts:183 已返回 businessStatus）。
  // 此前这里写死 collectionStatus ⇒ 拒收单永远显示成收款态（F1 驳回真因）。
  return mapBillHistoryRow({
    ...r,
    billType: 'sale_bill',
    partyName: r.customerName,
    amount: r.receivableAmount,
  })
}

export const billHistoryApi = {
  async list(params?: BillHistoryParams): Promise<{ list: BillHistoryItem[]; total: number }> {
    const res: any = await get('/admin/bills/history', params)
    const raw: any = res?.result ?? res
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: records.map(mapBillHistoryRow),
      total: Number(raw?.total ?? records.length),
    }
  },
}

export const storeSaleBillsApi = {
  /**
   * 门店销售单列表（GET /store/sale-bills，store-sale-bill.routes.ts）。
   * 比 bills/history 多返回 customerType，供渠道来源区分 门店零售/门店批发。
   */
  async list(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{
    list: BillHistoryItem[]
    total: number
  }> {
    const res: any = await get('/store/sale-bills', params)
    const raw: any = res?.result ?? res
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: records.map(mapStoreSaleBillRow),
      total: Number(raw?.total ?? records.length),
    }
  },
}
