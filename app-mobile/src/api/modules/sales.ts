import { get, post } from '../request'

export interface SaleItem {
  productId: number
  skuId?: number
  productName: string
  price?: number
  quantity?: number
  total?: number
  boxQty: number
  bottleQty: number
  unitPrice: number
  subtotalAmount: number
  unit?: string
  specs?: string
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

export interface SaleBillInfo {
  billNo: string
  customerName: string
  customerMobile?: string
  totalAmount: number
  receivableAmount: number
  receivedAmount: number
  status: string
  items: SaleItem[]
  createdAt: string
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
      items: params.items.map((it) => ({
        skuId: it.skuId ?? it.productId,
        boxQty: it.boxQty ?? 0,
        bottleQty: it.bottleQty ?? 0,
        quantity: (it.bottleQty ?? 0) + (it.boxQty ?? 0),
        unitPrice: it.unitPrice ?? 0,
      })),
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
