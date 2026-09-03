import { get, post, put } from '../request'

export interface PurchaseOrder {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string
  orderDate: string
  deliveryDate: string
  totalAmount: number
  status: string
  remark: string
  items: PurchaseOrderItem[]
  createdAt: string
}

export interface PurchaseOrderItem {
  id: number
  productId: number
  productName: string
  skuId: number
  skuName: string
  quantity: number
  unit: string
  unitPrice: number
  subtotal: number
  remark: string
}

export interface PurchaseOrderQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  supplierId?: number
  startDate?: string
  endDate?: string
}

export interface PurchaseOrderListResponse {
  list: PurchaseOrder[]
  total: number
}

export interface InStockRecord {
  id: number
  inStockNo: string
  orderNo?: string
  purchaseOrderId: number
  purchaseOrderNo: string
  supplierId: number
  supplierName: string
  storeId?: number
  storeName?: string
  inStockDate: string
  stockDate?: string
  totalAmount: number
  status: string
  statusLabel?: string
  itemCount?: number
  remark: string
  items: InStockItem[]
  createdAt: string
}

/** 创建采购入库单载荷（严格对齐后端 purchase-in-stock.service.ts#create，snake_case） */
export interface CreatePurchaseInStockPayload {
  supplier_id: number
  supplier_name: string
  store_id: number
  remark?: string
  items: Array<{
    sku_id: number
    sku_name: string
    box_qty?: number
    bottle_qty?: number
    unit_price: number
    tax_rate?: number
  }>
}

export interface InStockItem {
  id: number
  productId: number
  productName: string
  skuId: number
  skuName: string
  quantity: number
  unit: string
  unitPrice: number
  subtotal: number
  remark: string
}

export interface InStockQuery {
  page: number
  pageSize: number
  keyword?: string
  status?: string
  supplierId?: number
  startDate?: string
  endDate?: string
}

export interface InStockListResponse {
  list: InStockRecord[]
  total: number
}

export const purchaseApi = {
  async getOrderList(query: PurchaseOrderQuery): Promise<PurchaseOrderListResponse> {
    // 归一化：后端返回 {records:[...]}（mock 层还会透出 snake_case 原始键），统一映射为 {list,total}
    const res: any = await get('/admin/purchase-orders', query)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        ...r,
        orderNo: r.orderNo ?? r.order_no ?? '',
        supplierId: r.supplierId ?? r.supplier_id,
        supplierName: r.supplierName ?? r.supplier_name ?? '',
        status: r.status ?? r.order_status ?? '',
        // 订单日期：优先 orderDate，mock/部分实现只有 createdAt
        orderDate: r.orderDate ?? r.order_date ?? r.createdAt ?? r.created_at ?? '',
        // 金额：价税合计语义（stats.totalAmount=SUM(payable_amount)），无 totalAmount 时取 payableAmount
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? r.payableAmount ?? r.payable_amount ?? 0),
        createdAt: r.createdAt ?? r.created_at ?? '',
      })),
      total: Number(raw?.total ?? raw?.count ?? rows.length),
    }
  },

  async getOrderById(id: number): Promise<PurchaseOrder> {
    return get(`/admin/purchase-orders/${id}`)
  },

  async createOrder(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return post('/admin/purchase-orders', data)
  },

  async updateOrder(id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return put(`/admin/purchase-orders/${id}`, data)
  },

  async getInStockList(query: InStockQuery): Promise<InStockListResponse> {
    // R94-03：原 /admin/purchase-orders/in-stock 不存在，改为 /admin/purchase-in-stocks（purchase-in-stock.routes.ts）
    const res: any = await get('/admin/purchase-in-stocks', query)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        inStockNo: r.inStockNo ?? r.stockNo ?? r.stock_no ?? '',
        orderNo: r.orderNo ?? r.order_no,
        purchaseOrderId: r.purchaseOrderId ?? r.purchase_order_id,
        purchaseOrderNo: r.purchaseOrderNo ?? r.purchase_order_no ?? r.orderNo,
        supplierId: r.supplierId ?? r.supplier_id,
        supplierName: r.supplierName ?? r.supplier_name ?? '',
        storeId: r.storeId ?? r.store_id,
        storeName: r.storeName ?? r.store_name,
        inStockDate: r.inStockDate ?? r.stockDate ?? r.createdAt ?? '',
        stockDate: r.stockDate ?? r.stock_date,
        warehouseId: r.warehouseId ?? r.warehouse_id,
        warehouseName: r.warehouseName ?? r.warehouse_name ?? '',
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        status: r.status ?? '',
        statusLabel: r.statusLabel ?? r.status_label,
        itemCount: r.itemCount ?? (Array.isArray(r.items) ? r.items.length : undefined),
        remark: r.remark ?? '',
        items: Array.isArray(r.items) ? r.items : [],
        createdAt: r.createdAt ?? r.created_at ?? '',
      })),
      total: raw?.total ?? rows.length,
    }
  },

  async getInStockById(id: number): Promise<InStockRecord> {
    // R94-03：原 /admin/purchase-orders/in-stock/:id 不存在，改为 /admin/purchase-in-stocks/:stockNo
    return get(`/admin/purchase-in-stocks/${id}`)
  },

  async createInStock(data: CreatePurchaseInStockPayload): Promise<InStockRecord> {
    // R94-03：路径同步改为 /admin/purchase-in-stocks；载荷为 snake_case，严格对齐后端契约
    return post('/admin/purchase-in-stocks', data)
  }
}
