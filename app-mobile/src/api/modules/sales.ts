import { get, post } from '../request'

export interface SaleItem {
  productId: number
  skuId?: number
  productName: string
  /** 后端单据明细可能返回 skuName（详情页按 productName || skuName 兜底展示） */
  skuName?: string
  /** 后端明细快照：规格（如 "500ml 瓶装"） */
  skuSpec?: string
  price?: number
  quantity?: number
  total?: number
  boxQty: number
  bottleQty: number
  /** 后端明细快照：总瓶数（箱×换算+散瓶） */
  totalBottleQty?: number
  /** 每箱换算瓶数（箱规，如 24 瓶/箱）；用于把整箱数量换算为总瓶数 */
  boxRatio?: number
  unitPrice: number
  subtotalAmount: number
  unit?: string
  specs?: string
  /** 后端明细快照：行备注 */
  remark?: string
  /** 后端明细快照：行优惠金额 */
  itemDiscount?: number
  barcode?: string
  /** 追溯码（可多个；后端 store-sale-bill item schema 支持 traceCodes: string[]） */
  traceCodes?: string[]
  /** 追溯码录入草稿（输入框中间态，提交时按 traceCodes 数组） */
  draftTrace?: string
}

/**
 * 销售单详情（R96-07 对齐后端 getSaleBillDetail 真实返回：
 * t_sale_bill 行 + items 明细快照；原 totalAmount/status 字段后端不存在）
 */
export interface SaleBillInfo {
  billNo: string
  customerName: string
  customerMobile?: string
  /** RETAIL/WHOLESALE 等 */
  customerType?: string
  /** CASH 现金 / CREDIT 赊销 */
  saleType?: string
  /** 业务状态：CREATED 等 */
  businessStatus?: string
  /** 收款状态：UNPAID/PARTIAL/PAID */
  collectionStatus?: string
  /** 商品合计 */
  goodsAmount?: number
  /** 整单优惠 */
  discountAmount?: number
  /** 抹零 */
  roundingAmount?: number
  receivableAmount: number
  receivedAmount: number
  /** 未收金额 */
  unreceivedAmount?: number
  /** 赊销到期日 */
  dueDate?: string
  remark?: string
  operatorName?: string
  auditorName?: string
  salesmanName?: string
  /** 旧字段（列表等场景仍引用；详情接口不返回，详情页勿用） */
  totalAmount?: number
  status?: string
  items: SaleItem[]
  createdAt: string
}

export interface CreateSaleParams {
  customerId?: number
  customerName: string
  customerMobile?: string
  items: SaleItem[]
  taxEnabled?: boolean
  taxRate?: number
  remark?: string
}

export interface SaleBillListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  startDate?: string
  endDate?: string
}

export interface SaleBillListResult {
  list: SaleBillInfo[]
  total: number
  page: number
  pageSize: number
}

const salesApi = {
  async createSale(params: CreateSaleParams): Promise<SaleBillInfo> {
    // R94-03：原 POST /admin/sales 后端不存在；创建销售单真实接口为 /store/sale-bills（store-sale-bill.routes.ts）
    // 结构适配：后端 items 要求 skuId + totalBottleQty>0（store-sale-bill schema），前端 item 仅有 productId/boxQty/bottleQty
    const res: any = await post('/store/sale-bills', {
      customerId: params.customerId ?? null,
      customerName: params.customerName,
      customerMobile: params.customerMobile,
      remark: params.remark,
      saleType: 'CASH',
      items: params.items.map((it) => {
        const boxQty = Number(it.boxQty ?? 0)
        const bottleQty = Number(it.bottleQty ?? 0)
        const boxRatio = Number(it.boxRatio ?? 0)
        // R102-07：后端 schemas/store-sale-bill.ts 的 transform 用 `totalBottleQty ?? quantity`
        // 作为「总瓶数」，并据此按 unitPrice 重算金额、扣减库存。
        // 原实现发送 quantity = 箱数 + 瓶数（量纲混加），一旦录入整箱会把 2箱(24瓶/箱)+5瓶 记成 7 瓶。
        // 这里统一换算为总瓶数，且保留 quantity 字段保证向后兼容。
        const totalBottleQty = Number(
          it.totalBottleQty != null
            ? it.totalBottleQty
            : (boxRatio > 0 ? boxQty * boxRatio + bottleQty : bottleQty)
        )
        return {
          skuId: it.skuId ?? it.productId,
          boxQty,
          bottleQty,
          quantity: totalBottleQty,
          totalBottleQty,
          unitPrice: it.unitPrice ?? 0,
          traceCodes: it.traceCodes?.length ? it.traceCodes : undefined,
        }
      }),
    })
    return (res?.result ?? res) as SaleBillInfo
  },

  async list(params?: SaleBillListParams): Promise<SaleBillListResult> {
    // R94-03：原 /admin/sales 不存在；销售单列表真实接口为 /admin/sale-bills（admin-order.routes.ts）
    const res: any = await get('/admin/sale-bills', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        billNo: r.billNo ?? r.bill_no ?? '',
        customerName: r.customerName ?? r.customer_name ?? '',
        customerMobile: r.customerMobile ?? r.customer_mobile,
        itemCount: Number(r.itemCount ?? r.item_count ?? 0),
        paymentMethod: r.paymentMethod ?? r.payment_method ?? null,
        collectionStatus: r.collectionStatus ?? r.collection_status ?? '',
        businessStatus: r.businessStatus ?? r.business_status ?? '',
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        receivableAmount: Number(r.receivableAmount ?? r.receivable_amount ?? 0),
        receivedAmount: Number(r.receivedAmount ?? r.received_amount ?? 0),
        status: r.status ?? '',
        items: r.items ?? [],
        createdAt: r.createdAt ?? r.created_at ?? '',
      })),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(billNo: string): Promise<SaleBillInfo> {
    // R94-03：原 /admin/sales/:billNo 不存在；销售单详情真实接口为 /store/sale-bills/:billNo
    const res: any = await get(`/store/sale-bills/${billNo}`)
    return (res?.result ?? res) as SaleBillInfo
  },

  async offlinePayment(billNo: string, amount: number, channel: string): Promise<void> {
    // R94-03：真实接口为 /store/sale-bills/:billNo/offline-payment
    return post(`/store/sale-bills/${billNo}/offline-payment`, { amount, paymentMethod: channel })
  },

  async createCollectionLink(billNo: string, data: {
    amount: number
    expireHours?: number
    shareChannel?: string
    taxEnabled?: boolean
    taxRate?: number
  }): Promise<{ linkNo: string; token: string; shareUrl: string }> {
    // R94-03：真实接口为 /store/sale-bills/:billNo/collection-link
    return post(`/store/sale-bills/${billNo}/collection-link`, data)
  }
}

export { salesApi }
