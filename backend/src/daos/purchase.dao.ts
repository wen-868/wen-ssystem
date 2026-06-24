import { BaseDAO } from "./base.dao.js";
import { query, queryOne } from "../shared/db.js";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderListVO,
  PurchaseOrderDetailVO,
  OperationLog,
} from "../models/purchase.model.js";
import type { PageParams, PageResult } from "../types/index.js";

const ORDER_FIELDS = `
  id,
  order_no AS purchaseNo,
  supplier_id AS supplierId,
  supplier_name AS supplierName,
  store_id AS storeId,
  order_status AS status,
  warehouse_status AS warehouseStatus,
  goods_amount AS goodsAmount,
  tax_amount AS taxAmount,
  discount_amount AS discountAmount,
  payable_amount AS totalAmount,
  paid_amount AS paidAmount,
  unpaid_amount AS unpaidAmount,
  expected_date AS expectedDate,
  operator_id AS operatorId,
  auditor_id AS auditorId,
  audited_at AS auditedAt,
  remark,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const ITEM_FIELDS = `
  id,
  order_no AS purchaseNo,
  sku_id AS skuId,
  sku_name AS skuName,
  barcode,
  box_qty AS boxQty,
  bottle_qty AS bottleQty,
  total_bottle_qty AS totalBottleQty,
  unit_price AS unitPrice,
  tax_rate AS taxRate,
  subtotal_amount AS subtotal,
  tax_amount AS taxAmount,
  total_amount AS totalAmount,
  in_stocked_qty AS inStockedQty,
  remark
`;

export class PurchaseDAO extends BaseDAO<PurchaseOrder> {
  constructor() {
    super({ tableName: "purchase_order", primaryKey: "order_no" });
  }

  async findPageWithFilters(
    keyword: string | undefined,
    supplierId: number | undefined,
    status: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    pageParams: PageParams,
    tenantId: string
  ): Promise<PageResult<PurchaseOrderListVO>> {
    const where: string[] = ["tenant_id = ?"];
    const params: any[] = [tenantId];

    if (supplierId) {
      where.push("supplier_id = ?");
      params.push(supplierId);
    }
    if (status) {
      where.push("order_status = ?");
      params.push(status);
    }
    if (keyword) {
      where.push("(order_no LIKE ? OR supplier_name LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startDate) {
      where.push("created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      where.push("created_at <= ?");
      params.push(endDate);
    }

    const whereSql = where.join(" AND ");

    const countSql = `SELECT COUNT(*) as total FROM purchase_order WHERE ${whereSql}`;
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = Number(countResult?.total || 0);

    const offset = (pageParams.page - 1) * pageParams.pageSize;
    const dataSql = `SELECT ${ORDER_FIELDS} FROM purchase_order WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const records = await query<PurchaseOrderListVO>(dataSql, [...params, pageParams.pageSize, offset]);

    return {
      records,
      total,
      page: pageParams.page,
      pageSize: pageParams.pageSize,
    };
  }

  async findByOrderNo(orderNo: string, tenantId: string): Promise<PurchaseOrder | null> {
    const sql = `SELECT ${ORDER_FIELDS} FROM purchase_order WHERE order_no = ? AND tenant_id = ?`;
    return queryOne<PurchaseOrder>(sql, [orderNo, tenantId]);
  }

  async findItems(orderNo: string): Promise<PurchaseOrderItem[]> {
    const sql = `SELECT ${ITEM_FIELDS} FROM purchase_order_item WHERE order_no = ? ORDER BY id ASC`;
    return query<PurchaseOrderItem>(sql, [orderNo]);
  }

  async findOperationLogs(orderNo: string): Promise<OperationLog[]> {
    const sql = `
      SELECT
        id,
        action,
        operator_id AS operatorId,
        user_name AS operator,
        detail AS remark,
        created_at AS createdAt
      FROM operation_log
      WHERE target_id = ? AND target_type = 'purchase_order'
      ORDER BY created_at DESC
    `;
    return query<OperationLog>(sql, [orderNo]);
  }

  async findDetail(orderNo: string, tenantId: string): Promise<PurchaseOrderDetailVO | null> {
    const order = await this.findByOrderNo(orderNo, tenantId);
    if (!order) return null;

    const [items, operationLogs] = await Promise.all([
      this.findItems(orderNo),
      this.findOperationLogs(orderNo),
    ]);

    return { ...order, items, operationLogs };
  }

  async insertOrder(data: {
    orderNo: string;
    supplierId: number;
    supplierName: string;
    storeId: number;
    status: string;
    goodsAmount: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    expectedDate?: string | null;
    operatorId: number;
    remark?: string | null;
    tenantId: string;
  }): Promise<number> {
    const sql = `
      INSERT INTO purchase_order (
        order_no, supplier_id, supplier_name, store_id, order_status,
        goods_amount, tax_amount, discount_amount, payable_amount,
        paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.orderNo,
      data.supplierId,
      data.supplierName,
      data.storeId,
      data.status,
      data.goodsAmount,
      data.taxAmount,
      data.discountAmount,
      data.totalAmount,
      data.paidAmount,
      data.unpaidAmount,
      data.expectedDate || null,
      data.operatorId,
      data.remark || null,
      data.tenantId,
    ]);
    return (result as any).insertId;
  }

  async insertItems(orderNo: string, items: Array<Record<string, any>>): Promise<void> {
    for (const item of items) {
      const sql = `
        INSERT INTO purchase_order_item (
          order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await query(sql, [
        orderNo,
        item.skuId,
        item.skuName,
        item.barcode || null,
        item.boxQty,
        item.bottleQty,
        item.totalBottleQty,
        item.unitPrice,
        item.taxRate,
        item.subtotal,
        item.taxAmount,
        item.totalAmount,
        item.remark || null,
      ]);
    }
  }

  async deleteItems(orderNo: string): Promise<number> {
    const result = await query("DELETE FROM purchase_order_item WHERE order_no = ?", [orderNo]);
    return (result as any).affectedRows || 0;
  }

  async updateOrder(orderNo: string, data: Record<string, any>, tenantId: string): Promise<number> {
    const fieldMap: Record<string, string> = {
      supplierId: "supplier_id",
      supplierName: "supplier_name",
      expectedDate: "expected_date",
      discountAmount: "discount_amount",
      goodsAmount: "goods_amount",
      taxAmount: "tax_amount",
      totalAmount: "payable_amount",
      unpaidAmount: "unpaid_amount",
      status: "order_status",
      warehouseStatus: "warehouse_status",
      auditorId: "auditor_id",
      remark: "remark",
    };

    const sets: string[] = [];
    const params: any[] = [];

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        sets.push(`${dbField} = ?`);
        params.push(data[key]);
      }
    }

    if (sets.length === 0) return 0;

    sets.push("updated_at = NOW()");
    params.push(orderNo, tenantId);

    const sql = `UPDATE purchase_order SET ${sets.join(", ")} WHERE order_no = ? AND tenant_id = ?`;
    const result = await query(sql, params);
    return (result as any).affectedRows || 0;
  }

  async deleteOrder(orderNo: string, tenantId: string): Promise<number> {
    const result = await query(
      "DELETE FROM purchase_order WHERE order_no = ? AND tenant_id = ?",
      [orderNo, tenantId]
    );
    return (result as any).affectedRows || 0;
  }

  async updateItemInStockedQty(orderNo: string, skuId: number, newInStockedQty: number): Promise<number> {
    const result = await query(
      "UPDATE purchase_order_item SET in_stocked_qty = ? WHERE order_no = ? AND sku_id = ?",
      [newInStockedQty, orderNo, skuId]
    );
    return (result as any).affectedRows || 0;
  }

  async getOrderItemsWithStock(orderNo: string): Promise<any[]> {
    const sql = "SELECT sku_id, total_bottle_qty, in_stocked_qty FROM purchase_order_item WHERE order_no = ?";
    return query(sql, [orderNo]);
  }

  async addOperationLog(
    module: string,
    action: string,
    targetId: string,
    targetType: string,
    userId: number,
    userName: string,
    detail: string,
    tenantId: string
  ): Promise<void> {
    await query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [module, action, targetId, targetType, userId, userName, detail, tenantId]
    );
  }

  async updateInventoryBalance(storeId: number, skuId: number, qty: number, tenantId: string): Promise<void> {
    await query(
      `INSERT INTO inventory_balance (store_id, sku_id, quantity, tenant_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [storeId, skuId, qty, tenantId, qty]
    );
  }
}

export const purchaseDAO = new PurchaseDAO();
