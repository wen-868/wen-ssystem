import { asyncHandler } from "../shared/async-handler.js";
import * as service from "../services/admin/export.service.js";

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

export const exportCustomers = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const records = await service.exportCustomers(req.tenantId!, keyword);
  const header = ["ID", "客户名称", "手机号", "客户类型", "积分", "等级", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.name, r.mobile, r.customerType, r.points, r.levelCode, r.status, r.createdAt]);
  sendCsv(res, `customers-${today()}.csv`, header, rows);
});

export const exportSuppliers = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const supplyType = req.query.supplyType ? String(req.query.supplyType) : undefined;
  const records = await service.exportSuppliers(req.tenantId!, keyword, supplyType);
  const header = ["ID", "供应商编码", "名称", "联系人", "电话", "供应类型", "状态", "地址", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.supplierCode, r.name, r.contactPerson, r.phone, r.supplyType, r.status, r.address, r.createdAt]);
  sendCsv(res, `suppliers-${today()}.csv`, header, rows);
});

export const exportProducts = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const records = await service.exportProducts(req.tenantId!, keyword);
  const header = ["ID", "SKU编码", "商品名称", "规格", "品类", "品牌", "单位", "零售价", "批发价", "小程序价", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.id, r.skuCode, r.name, r.skuName, r.category, r.brand, r.unit, r.retailPrice, r.wholesalePrice, r.miniappPrice, r.status, r.createdAt]);
  sendCsv(res, `products-${today()}.csv`, header, rows);
});

export const exportInventory = asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? String(req.query.storeId) : undefined;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const records = await service.exportInventory(req.tenantId!, storeId, keyword);
  const header = ["门店ID", "SKU ID", "SKU编码", "商品名称", "总库存", "锁定库存", "可用库存", "更新时间"];
  const rows = records.map((r: any) => [r.storeId, r.skuId, r.skuCode, r.skuName, r.quantity, r.lockedQuantity, r.availableQuantity, r.updatedAt]);
  sendCsv(res, `inventory-${today()}.csv`, header, rows);
});

export const exportPurchaseOrders = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const records = await service.exportPurchaseOrders(req.tenantId!, keyword, status);
  const header = ["采购单号", "供应商", "采购金额", "已付金额", "状态", "入库状态", "创建时间"];
  const rows = records.map((r: any) => [r.purchaseNo, r.supplierName, r.totalAmount, r.paidAmount, r.status, r.warehouseStatus, r.createdAt]);
  sendCsv(res, `purchase-orders-${today()}.csv`, header, rows);
});

export const exportPayments = asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const records = await service.exportPayments(req.tenantId!, status);
  const header = ["付款单号", "关联采购单", "供应商", "付款金额", "付款方式", "状态", "付款时间"];
  const rows = records.map((r: any) => [r.paymentNo, r.purchaseNo, r.supplierName, r.amount, r.paymentMethod, r.status, r.createdAt]);
  sendCsv(res, `payments-${today()}.csv`, header, rows);
});

export const exportSalesOrders = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
  const records = await service.exportSalesOrders(req.tenantId!, keyword, status, startDate, endDate);
  const header = ["订单号", "客户名称", "订单金额", "优惠金额", "实付金额", "支付方式", "状态", "创建时间"];
  const rows = records.map((r: any) => [r.orderNo, r.customerName, r.totalAmount, r.discountAmount, r.paidAmount, r.paymentMethod, r.status, r.createdAt]);
  sendCsv(res, `sales-orders-${today()}.csv`, header, rows);
});

export const exportAuditLogs = asyncHandler(async (req, res) => {
  const action = req.query.action ? String(req.query.action) : undefined;
  const resourceType = req.query.resourceType ? String(req.query.resourceType) : undefined;
  const dateStart = req.query.dateStart ? String(req.query.dateStart) : undefined;
  const dateEnd = req.query.dateEnd ? String(req.query.dateEnd) : undefined;
  const records = await service.exportAuditLogs(req.tenantId!, action, resourceType, dateStart, dateEnd);
  const header = ["操作人", "角色", "操作类型", "资源类型", "资源ID", "IP", "操作时间"];
  const rows = records.map((r: any) => [r.userName, r.role, r.action, r.resourceType, r.resourceId, r.ip, r.createdAt]);
  sendCsv(res, `audit-logs-${today()}.csv`, header, rows);
});