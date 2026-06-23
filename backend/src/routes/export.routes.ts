import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query } from "../shared/db.js";
import { requireAuthWithTenant } from "../shared/auth.js";

export const exportRouter = Router();

/** CSV字段转义 */
function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** 生成CSV并响应 */
function sendCsv(res: import("express").Response, filename: string, header: string[], rows: unknown[][]) {
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

const today = () => new Date().toISOString().slice(0, 10);

// ========== 导出客户列表（带租户隔离） ==========
exportRouter.get("/customers", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(name LIKE ? OR mobile LIKE ?)");
    params.push(keyword, keyword);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT id, name, mobile, customer_type AS customerType, points, level_code AS levelCode, status, created_at AS createdAt
     FROM member ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
  const header = ["ID", "客户名称", "手机号", "客户类型", "积分", "等级", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.name, r.mobile, r.customerType, r.points, r.levelCode, r.status, r.createdAt]);
  sendCsv(res, `customers-${today()}.csv`, header, rows);
}));

// ========== 导出供应商列表（带租户隔离） ==========
exportRouter.get("/suppliers", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(name LIKE ? OR supplier_code LIKE ?)");
    params.push(keyword, keyword);
  }
  if (req.query.supplyType) {
    conditions.push("supply_type = ?");
    params.push(req.query.supplyType);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT id, supplier_code AS supplierCode, name, contact_person AS contactPerson,
            phone, supply_type AS supplyType, status, address, created_at AS createdAt
     FROM supplier ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
  const header = ["ID", "供应商编码", "名称", "联系人", "电话", "供应类型", "状态", "地址", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.supplierCode, r.name, r.contactPerson, r.phone, r.supplyType, r.status, r.address, r.createdAt]);
  sendCsv(res, `suppliers-${today()}.csv`, header, rows);
}));

// ========== 导出商品列表（带租户隔离） ==========
exportRouter.get("/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(name LIKE ? OR sku_code LIKE ?)");
    params.push(keyword, keyword);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT id, sku_code AS skuCode, name, sku_name AS skuName, category, brand, unit,
            retail_price AS retailPrice, wholesale_price AS wholesalePrice,
            miniapp_price AS miniappPrice, status, created_at AS createdAt
     FROM product_sku ${where} ORDER BY id DESC LIMIT 5000`,
    params
  );
  const header = ["ID", "SKU编码", "商品名称", "规格", "品类", "品牌", "单位", "零售价", "批发价", "小程序价", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.skuCode, r.name, r.skuName, r.category, r.brand, r.unit, r.retailPrice, r.wholesalePrice, r.miniappPrice, r.status, r.createdAt]);
  sendCsv(res, `products-${today()}.csv`, header, rows);
}));

// ========== 导出库存明细（带租户隔离） ==========
exportRouter.get("/inventory", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.storeId) {
    conditions.push("store_id = ?");
    params.push(req.query.storeId);
  }
  if (req.query.keyword) {
    const keyword = `%${String(req.query.keyword)}%`;
    conditions.push("(sku_name LIKE ? OR sku_code LIKE ?)");
    params.push(keyword, keyword);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT store_id AS storeId, sku_id AS skuId, sku_code AS skuCode, sku_name AS skuName,
            quantity, locked_quantity AS lockedQuantity, available_quantity AS availableQuantity,
            updated_at AS updatedAt
     FROM inventory ${where} ORDER BY store_id, sku_id LIMIT 5000`,
    params
  );
  const header = ["门店ID", "SKU ID", "SKU编码", "商品名称", "总库存", "锁定库存", "可用库存", "更新时间"];
  const rows = records.map((r: any) => [r.storeId, r.skuId, r.skuCode, r.skuName, r.quantity, r.lockedQuantity, r.availableQuantity, r.updatedAt]);
  sendCsv(res, `inventory-${today()}.csv`, header, rows);
}));

// ========== 导出采购单（带租户隔离） ==========
exportRouter.get("/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(purchase_no LIKE ? OR supplier_name LIKE ?)");
    params.push(keyword, keyword);
  }
  if (req.query.status) {
    conditions.push("status = ?");
    params.push(req.query.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT purchase_no AS purchaseNo, supplier_name AS supplierName,
            total_amount AS totalAmount, paid_amount AS paidAmount,
            status, warehouse_status AS warehouseStatus, created_at AS createdAt
     FROM purchase_order ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
  const header = ["采购单号", "供应商", "采购金额", "已付金额", "状态", "入库状态", "创建时间"];
  const rows = records.map((r: any) => [r.purchaseNo, r.supplierName, r.totalAmount, r.paidAmount, r.status, r.warehouseStatus, r.createdAt]);
  sendCsv(res, `purchase-orders-${today()}.csv`, header, rows);
}));

// ========== 导出付款记录（带租户隔离） ==========
exportRouter.get("/payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.status) {
    conditions.push("status = ?");
    params.push(req.query.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT payment_no AS paymentNo, purchase_no AS purchaseNo, supplier_name AS supplierName,
            amount, payment_method AS paymentMethod, status, created_at AS createdAt
     FROM payment ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
  const header = ["付款单号", "关联采购单", "供应商", "付款金额", "付款方式", "状态", "付款时间"];
  const rows = records.map((r: any) => [r.paymentNo, r.purchaseNo, r.supplierName, r.amount, r.paymentMethod, r.status, r.createdAt]);
  sendCsv(res, `payments-${today()}.csv`, header, rows);
}));

// ========== 导出销售单（新增，带租户隔离） ==========
exportRouter.get("/sales-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  
  if (req.query.keyword) {
    const keyword = `%${String(req.query.keyword)}%`;
    conditions.push("(order_no LIKE ? OR customer_name LIKE ?)");
    params.push(keyword, keyword);
  }
  if (req.query.status) {
    conditions.push("status = ?");
    params.push(req.query.status);
  }
  if (req.query.startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.endDate);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT order_no AS orderNo, customer_name AS customerName,
            total_amount AS totalAmount, discount_amount AS discountAmount,
            paid_amount AS paidAmount, payment_method AS paymentMethod,
            status, created_at AS createdAt
     FROM sales_order ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );
  const header = ["订单号", "客户名称", "订单金额", "优惠金额", "实付金额", "支付方式", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.orderNo, r.customerName, r.totalAmount, r.discountAmount, r.paidAmount, r.paymentMethod, r.status, r.createdAt]);
  sendCsv(res, `sales-orders-${today()}.csv`, header, rows);
}));

// ========== 导出审计日志（带租户隔离） ==========
exportRouter.get("/audit-logs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.action) {
    conditions.push("action = ?");
    params.push(req.query.action);
  }
  if (req.query.resourceType) {
    conditions.push("resource_type = ?");
    params.push(req.query.resourceType);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT user_name AS userName, role, action, resource_type AS resourceType,
            resource_id AS resourceId, ip, created_at AS createdAt
     FROM audit_log ${where} ORDER BY created_at DESC LIMIT 10000`,
    params
  );
  const header = ["操作人", "角色", "操作类型", "资源类型", "资源ID", "IP", "操作时间"];
  const rows = records.map((r: any) => [r.userName, r.role, r.action, r.resourceType, r.resourceId, r.ip, r.createdAt]);
  sendCsv(res, `audit-logs-${today()}.csv`, header, rows);
}));
