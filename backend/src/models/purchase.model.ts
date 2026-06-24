export type PurchaseOrderStatus = "DRAFT" | "PENDING" | "APPROVED" | "CANCELLED";
export type WarehouseStatus = "NOT_STARTED" | "PARTIAL" | "FULL";

export interface PurchaseOrder {
  id: number;
  purchaseNo: string;
  supplierId: number;
  supplierName: string;
  storeId: number;
  status: PurchaseOrderStatus;
  warehouseStatus: WarehouseStatus;
  goodsAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  expectedDate?: string;
  operatorId: number;
  auditorId?: number;
  auditedAt?: string;
  remark?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchaseNo: string;
  skuId: number;
  skuName: string;
  barcode?: string;
  boxQty: number;
  bottleQty: number;
  totalBottleQty: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  inStockedQty?: number;
  remark?: string;
}

export interface PurchaseOrderDetailVO extends PurchaseOrder {
  items: PurchaseOrderItem[];
  operationLogs: OperationLog[];
}

export interface OperationLog {
  id: number;
  action: string;
  operatorId: number;
  operator: string;
  remark: string;
  createdAt: string;
}

export interface PurchaseOrderListVO extends PurchaseOrder {}

export interface CreatePurchaseOrderDTO {
  supplierId: number;
  supplierName: string;
  storeId: number;
  expectedDate?: string;
  discountAmount?: number;
  remark?: string;
  items: CreatePurchaseOrderItemDTO[];
}

export interface CreatePurchaseOrderItemDTO {
  skuId: number;
  skuName: string;
  barcode?: string;
  boxQty: number;
  bottleQty: number;
  unitPrice: number;
  taxRate: number;
  remark?: string;
}

export interface UpdatePurchaseOrderDTO {
  supplierId?: number;
  supplierName?: string;
  expectedDate?: string;
  discountAmount?: number;
  remark?: string;
  items?: CreatePurchaseOrderItemDTO[];
}

export interface InStockItemDTO {
  skuId: number;
  boxQty: number;
  bottleQty: number;
}

export interface InStockDTO {
  warehouseId?: number;
  remark?: string;
  items: InStockItemDTO[];
}
