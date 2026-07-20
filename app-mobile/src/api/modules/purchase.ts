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
  warehouseId: number
  warehouseName: string
  totalAmount: number
  status: string
  statusLabel?: string
  itemCount?: number
  remark: string
  items: InStockItem[]
  createdAt: string
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
    return get('/admin/purchase-orders', query)
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
    return get('/admin/purchase-orders/in-stock', query)
  },

  async getInStockById(id: number): Promise<InStockRecord> {
    return get(`/admin/purchase-orders/in-stock/${id}`)
  },

  async createInStock(data: Partial<InStockRecord>): Promise<InStockRecord> {
    return post('/admin/purchase-orders/in-stock', data)
  }
}
