import { get, post, put, del } from '../request'

/** 即时零售平台 */
export interface RetailPlatform {
  code: string
  name: string
  icon?: string
  status?: number
}

/** 平台对接配置 */
export interface PlatformConfig {
  id?: number
  platform: string
  platformName?: string
  appKey?: string
  appSecret?: string
  shopId?: string
  callbackUrl?: string
  status?: number
  connected?: boolean
}

/** 零售商品（上架管理） */
export interface RetailProduct {
  id: number
  productId?: number
  name: string
  skuId?: string
  price: number
  stock: number
  image?: string
  category?: string
  shelfStatus?: string
  shelfStatusText?: string
}

/** 即时零售订单（订单看板） */
export interface RetailOrder {
  id: number
  orderNo: string
  platform: string
  platformText?: string
  customerName?: string
  customerPhone?: string
  totalAmount: number
  status: string
  statusText?: string
  createdAt: string
  remainingSeconds?: number
  items?: Array<{ name: string; qty: number; price: number }>
  address?: string
  remark?: string
}

function mapOrder(r: any): RetailOrder {
  return {
    id: r.id,
    orderNo: r.orderNo ?? r.order_no ?? r.platformOrderId ?? '',
    platform: r.platform ?? '',
    platformText: r.platformText ?? r.platform_name,
    customerName: r.customerName ?? r.customer_name,
    customerPhone: r.customerPhone ?? r.customer_phone,
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? r.payAmount ?? 0),
    status: r.status ?? '',
    statusText: r.statusText ?? r.status_text,
    createdAt: r.createdAt ?? r.created_at ?? r.createTime ?? '',
    remainingSeconds: r.remainingSeconds != null ? Number(r.remainingSeconds) : r.remaining_seconds != null ? Number(r.remaining_seconds) : undefined,
    items: Array.isArray(r.items) ? r.items.map((it: any) => ({
      name: it.name ?? it.productName ?? '',
      qty: Number(it.qty ?? it.quantity ?? 0),
      price: Number(it.price ?? 0),
    })) : undefined,
    address: r.address,
    remark: r.remark,
  }
}

const instantRetailApi = {
  /** 平台列表 */
  async platforms(): Promise<RetailPlatform[]> {
    const res: any = await get('/admin/instant-retail/platforms')
    const rows: any[] = res?.list ?? res ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      code: r.code ?? r.platform ?? '',
      name: r.name ?? r.platformName ?? '',
      icon: r.icon,
      status: r.status != null ? Number(r.status) : undefined,
    }))
  },

  /** 平台对接配置列表 */
  async configs(): Promise<PlatformConfig[]> {
    const res: any = await get('/admin/instant-retail/configs')
    const rows: any[] = res?.list ?? res ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      id: r.id,
      platform: r.platform ?? r.platformCode ?? '',
      platformName: r.platformName ?? r.platform_name,
      appKey: r.appKey ?? r.app_key,
      appSecret: r.appSecret ?? r.app_secret,
      shopId: r.shopId ?? r.shop_id,
      callbackUrl: r.callbackUrl ?? r.callback_url,
      status: r.status != null ? Number(r.status) : 1,
      connected: r.connected ?? r.status === 1,
    }))
  },

  /** 保存平台配置 */
  async saveConfig(data: PlatformConfig): Promise<any> {
    return post('/admin/instant-retail/configs', data)
  },

  /** 测试连接 */
  async testConnection(platform: string): Promise<any> {
    return post(`/admin/instant-retail/configs/${platform}/test`, {})
  },

  /** 同步订单 */
  async syncOrders(platform: string): Promise<any> {
    return post(`/admin/instant-retail/configs/${platform}/sync-orders`, {})
  },

  /** 同步商品 */
  async syncProducts(platform: string): Promise<any> {
    return post(`/admin/instant-retail/configs/${platform}/sync-products`, {})
  },

  /** 删除配置 */
  async deleteConfig(platform: string): Promise<any> {
    return del(`/admin/instant-retail/configs/${platform}`)
  },

  /** 零售商品列表（上架管理） */
  async listProducts(params?: { page?: number; pageSize?: number; keyword?: string; shelfStatus?: string }): Promise<{ list: RetailProduct[]; total: number }> {
    const res: any = await get('/admin/instant-retail/products', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        productId: r.productId ?? r.product_id,
        name: r.name ?? r.productName ?? '',
        skuId: r.skuId ?? r.sku_id,
        price: Number(r.price ?? r.retailPrice ?? 0),
        stock: Number(r.stock ?? r.availableQty ?? 0),
        image: r.image ?? r.mainImage,
        category: r.category ?? r.categoryName,
        shelfStatus: r.shelfStatus ?? r.shelf_status,
        shelfStatusText: r.shelfStatusText ?? r.shelf_status_text,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 添加零售商品（上架） */
  async addProduct(data: { productId: number; price?: number; category?: string }): Promise<any> {
    return post('/admin/instant-retail/products', data)
  },

  /** 更新零售商品 */
  async updateProduct(id: number, data: Partial<RetailProduct>): Promise<any> {
    return put(`/admin/instant-retail/products/${id}`, data)
  },

  /** 下架/删除零售商品 */
  async removeProduct(id: number): Promise<any> {
    return del(`/admin/instant-retail/products/${id}`)
  },

  /** 即时零售订单列表（订单看板） */
  async listOrders(params?: { page?: number; pageSize?: number; status?: string; platform?: string }): Promise<{ list: RetailOrder[]; total: number }> {
    const res: any = await get('/admin/instant-retail/orders', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return { list: rows.map(mapOrder), total: raw?.total ?? rows.length }
  },

  /** 接单（60秒接单工作台） */
  async confirmOrder(orderNo: string): Promise<any> {
    return post(`/admin/instant-retail/orders/${orderNo}/status`, { status: 'CONFIRMED' })
  },

  /** 取消订单 */
  async cancelOrder(orderNo: string, reason?: string): Promise<any> {
    return post(`/admin/instant-retail/orders/${orderNo}/status`, { status: 'CANCELLED', reason })
  },
}

export { instantRetailApi }
