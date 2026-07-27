﻿﻿﻿import { query } from "../../shared/db";

// ── 数据库行接口（类型安全） ──

/** 客户导出行（t_member） */
interface MemberRow {
  id: number;
  name: string;
  mobile: string | null;
  customerType: string | null;
  points: number | string | null;
  levelCode: string | null;
  status: string | null;
  createdAt: string | Date;
}

/** 供应商导出行（t_supplier） */
interface SupplierRow {
  id: number;
  supplierCode: string | null;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  supplyType: string | null;
  status: string | null;
  address: string | null;
  createdAt: string | Date;
}

/** 商品 SKU 导出行（t_product_sku） */
interface ProductSkuRow {
  id: number;
  skuCode: string | null;
  name: string;
  skuName: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  retailPrice: number | string | null;
  wholesalePrice: number | string | null;
  miniappPrice: number | string | null;
  status: string | null;
  createdAt: string | Date;
}

/** 库存导出行（t_inventory） */
interface InventoryRow {
  storeId: string | number;
  skuId: number;
  skuCode: string | null;
  skuName: string | null;
  quantity: number | string;
  lockedQuantity: number | string;
  availableQuantity: number | string;
  updatedAt: string | Date;
}

/** 采购单导出行（t_purchase_order） */
interface PurchaseOrderRow {
  purchaseNo: string;
  supplierName: string | null;
  totalAmount: number | string;
  paidAmount: number | string;
  status: string;
  warehouseStatus: string | null;
  createdAt: string | Date;
}

/** 付款单导出行（t_payment） */
interface PaymentRow {
  paymentNo: string;
  purchaseNo: string | null;
  supplierName: string | null;
  amount: number | string;
  paymentMethod: string | null;
  status: string;
  createdAt: string | Date;
}

/** 销售单导出行（t_sales_order） */
interface SalesOrderRow {
  orderNo: string;
  customerName: string | null;
  totalAmount: number | string;
  discountAmount: number | string;
  paidAmount: number | string;
  paymentMethod: string | null;
  status: string;
  createdAt: string | Date;
}

/** 审计日志导出行（t_audit_log） */
interface AuditLogRow {
  userName: string | null;
  role: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | number | null;
  ip: string | null;
  createdAt: string | Date;
}

export async function exportCustomers(tenantId: string, keyword?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(name LIKE ? OR mobile LIKE ?)");
    params.push(kw, kw);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<MemberRow>(
    `SELECT id, name, mobile, customer_type AS customerType, points, level_code AS levelCode, status, created_at AS createdAt
     FROM t_member ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
}

export async function exportSuppliers(tenantId: string, keyword?: string, supplyType?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(name LIKE ? OR supplier_code LIKE ?)");
    params.push(kw, kw);
  }
  if (supplyType) {
    conditions.push("supply_type = ?");
    params.push(supplyType);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<SupplierRow>(
    `SELECT id, supplier_code AS supplierCode, name, contact_person AS contactPerson,
            phone, supply_type AS supplyType, status, address, created_at AS createdAt
     FROM t_supplier ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
}

export async function exportProducts(tenantId: string, keyword?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(name LIKE ? OR sku_code LIKE ?)");
    params.push(kw, kw);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<ProductSkuRow>(
    `SELECT id, sku_code AS skuCode, name, sku_name AS skuName, category, brand, unit,
            retail_price AS retailPrice, wholesale_price AS wholesalePrice,
            miniapp_price AS miniappPrice, status, created_at AS createdAt
     FROM t_product_sku ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
}

export async function exportInventory(tenantId: string, storeId?: string, keyword?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (storeId) {
    conditions.push("store_id = ?");
    params.push(storeId);
  }
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(sku_name LIKE ? OR sku_code LIKE ?)");
    params.push(kw, kw);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<InventoryRow>(
    `SELECT store_id AS storeId, sku_id AS skuId, sku_code AS skuCode, sku_name AS skuName,
            quantity, locked_quantity AS lockedQuantity, available_quantity AS availableQuantity,
            updated_at AS updatedAt
     FROM t_inventory ${where} ORDER BY store_id, sku_id LIMIT 5000`,
    params
  );
}

export async function exportPurchaseOrders(tenantId: string, keyword?: string, status?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(purchase_no LIKE ? OR supplier_name LIKE ?)");
    params.push(kw, kw);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<PurchaseOrderRow>(
    `SELECT purchase_no AS purchaseNo, supplier_name AS supplierName,
            total_amount AS totalAmount, paid_amount AS paidAmount,
            status, warehouse_status AS warehouseStatus, created_at AS createdAt
     FROM t_purchase_order ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
}

export async function exportPayments(tenantId: string, status?: string) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<PaymentRow>(
    `SELECT payment_no AS paymentNo, purchase_no AS purchaseNo, supplier_name AS supplierName,
            amount, payment_method AS paymentMethod, status, created_at AS createdAt
     FROM t_payment ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
}

export async function exportSalesOrders(
  tenantId: string,
  keyword?: string,
  status?: string,
  startDate?: string,
  endDate?: string
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(order_no LIKE ? OR customer_name LIKE ?)");
    params.push(kw, kw);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(endDate);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<SalesOrderRow>(
    `SELECT order_no AS orderNo, customer_name AS customerName,
            total_amount AS totalAmount, discount_amount AS discountAmount,
            paid_amount AS paidAmount, payment_method AS paymentMethod,
            status, created_at AS createdAt
     FROM t_sales_order ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
}

export async function exportAuditLogs(
  tenantId: string,
  action?: string,
  resourceType?: string,
  dateStart?: string,
  dateEnd?: string
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (action) {
    conditions.push("action = ?");
    params.push(action);
  }
  if (resourceType) {
    conditions.push("resource_type = ?");
    params.push(resourceType);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<AuditLogRow>(
    `SELECT user_name AS userName, role, action, resource_type AS resourceType,
            resource_id AS resourceId, ip, created_at AS createdAt
     FROM t_audit_log ${where} ORDER BY created_at DESC LIMIT 10000`,
    params
  );
}