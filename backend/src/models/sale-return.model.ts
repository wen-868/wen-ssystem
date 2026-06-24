export type SaleReturnStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type RefundMethod = "CASH" | "WECHAT" | "BANK";

export interface SaleReturn {
  id: number;
  returnNo: string;
  sourceBillNo?: string;
  storeId: number;
  customerId?: number;
  customerName?: string;
  customerMobile?: string;
  status: SaleReturnStatus;
  goodsAmount: number;
  discountAmount: number;
  refundAmount: number;
  refundedAmount: number;
  refundMethod?: RefundMethod;
  operatorId: number;
  auditorId?: number;
  auditedAt?: string;
  remark?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleReturnItem {
  id: number;
  returnNo: string;
  skuId: number;
  skuName: string;
  boxQty: number;
  bottleQty: number;
  totalBottleQty: number;
  unitPrice: number;
  subtotal: number;
  reason?: string;
}

export interface SaleReturnDetailVO extends SaleReturn {
  items: SaleReturnItem[];
}

export interface SaleReturnListVO extends SaleReturn {}

export interface CreateSaleReturnDTO {
  sourceBillNo?: string;
  storeId: number;
  customerId?: number;
  customerName?: string;
  customerMobile?: string;
  discountAmount?: number;
  remark?: string;
  items: CreateSaleReturnItemDTO[];
}

export interface CreateSaleReturnItemDTO {
  skuId: number;
  skuName: string;
  boxQty: number;
  bottleQty: number;
  unitPrice: number;
  reason?: string;
}

export interface RefundDTO {
  refundMethod: RefundMethod;
}

export interface SaleBillVO {
  billNo: string;
  storeId: number;
  customerId?: number;
  customerName?: string;
  customerType?: string;
  saleType?: string;
  goodsAmount: number;
  discountAmount: number;
  receivableAmount: number;
  items: SaleBillItemVO[];
}

export interface SaleBillItemVO {
  skuId: number;
  skuName: string;
  boxQty: number;
  bottleQty: number;
  totalBottleQty: number;
  unitPrice: number;
  subtotalAmount: number;
}
