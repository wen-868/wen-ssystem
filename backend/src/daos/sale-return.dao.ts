import { BaseDAO } from "./base.dao.js";
import { query, queryOne } from "../shared/db.js";
import type {
  SaleReturn,
  SaleReturnItem,
  SaleReturnListVO,
  SaleReturnDetailVO,
} from "../models/sale-return.model.js";
import type { PageParams, PageResult } from "../types/index.js";

const RETURN_FIELDS = `
  id,
  return_no AS returnNo,
  source_bill_no AS sourceBillNo,
  store_id AS storeId,
  customer_id AS customerId,
  customer_name AS customerName,
  customer_mobile AS customerMobile,
  return_status AS status,
  goods_amount AS goodsAmount,
  discount_amount AS discountAmount,
  refund_amount AS refundAmount,
  refunded_amount AS refundedAmount,
  refund_method AS refundMethod,
  operator_id AS operatorId,
  auditor_id AS auditorId,
  audited_at AS auditedAt,
  remark,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const ITEM_FIELDS = `
  id,
  return_no AS returnNo,
  sku_id AS skuId,
  sku_name AS skuName,
  box_qty AS boxQty,
  bottle_qty AS bottleQty,
  total_bottle_qty AS totalBottleQty,
  unit_price AS unitPrice,
  subtotal_amount AS subtotal,
  reason
`;

export class SaleReturnDAO extends BaseDAO<SaleReturn> {
  constructor() {
    super({ tableName: "sale_return", primaryKey: "return_no" });
  }

  async findPageWithFilters(
    keyword: string | undefined,
    storeId: number | undefined,
    customerId: number | undefined,
    status: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    pageParams: PageParams,
    tenantId: string
  ): Promise<PageResult<SaleReturnListVO>> {
    const where: string[] = ["tenant_id = ?"];
    const params: any[] = [tenantId];

    if (storeId) {
      where.push("store_id = ?");
      params.push(storeId);
    }
    if (customerId) {
      where.push("customer_id = ?");
      params.push(customerId);
    }
    if (status) {
      where.push("return_status = ?");
      params.push(status);
    }
    if (keyword) {
      where.push("(return_no LIKE ? OR customer_name LIKE ? OR source_bill_no LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
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

    const countSql = `SELECT COUNT(*) as total FROM sale_return WHERE ${whereSql}`;
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = Number(countResult?.total || 0);

    const offset = (pageParams.page - 1) * pageParams.pageSize;
    const dataSql = `SELECT ${RETURN_FIELDS} FROM sale_return WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const records = await query<SaleReturnListVO>(dataSql, [...params, pageParams.pageSize, offset]);

    return {
      records,
      total,
      page: pageParams.page,
      pageSize: pageParams.pageSize,
    };
  }

  async findByReturnNo(returnNo: string, tenantId: string): Promise<SaleReturn | null> {
    const sql = `SELECT ${RETURN_FIELDS} FROM sale_return WHERE return_no = ? AND tenant_id = ?`;
    return queryOne<SaleReturn>(sql, [returnNo, tenantId]);
  }

  async findItems(returnNo: string): Promise<SaleReturnItem[]> {
    const sql = `SELECT ${ITEM_FIELDS} FROM sale_return_item WHERE return_no = ? ORDER BY id ASC`;
    return query<SaleReturnItem>(sql, [returnNo]);
  }

  async findDetail(returnNo: string, tenantId: string): Promise<SaleReturnDetailVO | null> {
    const returnOrder = await this.findByReturnNo(returnNo, tenantId);
    if (!returnOrder) return null;

    const items = await this.findItems(returnNo);
    return { ...returnOrder, items };
  }

  async insertReturn(data: {
    returnNo: string;
    sourceBillNo?: string | null;
    storeId: number;
    customerId?: number | null;
    customerName?: string | null;
    customerMobile?: string | null;
    status: string;
    goodsAmount: number;
    discountAmount: number;
    refundAmount: number;
    refundedAmount: number;
    operatorId: number;
    remark?: string | null;
    tenantId: string;
  }): Promise<number> {
    const sql = `
      INSERT INTO sale_return (
        return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
        return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.returnNo,
      data.sourceBillNo || null,
      data.storeId,
      data.customerId || null,
      data.customerName || null,
      data.customerMobile || null,
      data.status,
      data.goodsAmount,
      data.discountAmount,
      data.refundAmount,
      data.refundedAmount,
      data.operatorId,
      data.remark || null,
      data.tenantId,
    ]);
    return (result as any).insertId;
  }

  async insertItems(returnNo: string, items: Array<Record<string, any>>): Promise<void> {
    for (const item of items) {
      const sql = `
        INSERT INTO sale_return_item (
          return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, subtotal_amount, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await query(sql, [
        returnNo,
        item.skuId,
        item.skuName,
        item.boxQty,
        item.bottleQty,
        item.totalBottleQty,
        item.unitPrice,
        item.subtotal,
        item.reason || null,
      ]);
    }
  }

  async updateReturn(returnNo: string, data: Record<string, any>, tenantId: string): Promise<number> {
    const fieldMap: Record<string, string> = {
      status: "return_status",
      refundedAmount: "refunded_amount",
      refundMethod: "refund_method",
      auditorId: "auditor_id",
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
    params.push(returnNo, tenantId);

    const sql = `UPDATE sale_return SET ${sets.join(", ")} WHERE return_no = ? AND tenant_id = ?`;
    const result = await query(sql, params);
    return (result as any).affectedRows || 0;
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

  async insertInventoryLedger(data: {
    storeId: number;
    skuId: number;
    changeType: string;
    changeQty: number;
    beforeQty: number;
    afterQty: number;
    sourceNo: string;
    sourceType: string;
    operatorId: number;
    remark: string;
    tenantId: string;
  }): Promise<void> {
    await query(
      `INSERT INTO inventory_ledger (
        store_id, sku_id, change_type, change_qty, before_qty, after_qty,
        source_no, source_type, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.storeId,
        data.skuId,
        data.changeType,
        data.changeQty,
        data.beforeQty,
        data.afterQty,
        data.sourceNo,
        data.sourceType,
        data.operatorId,
        data.remark,
        data.tenantId,
      ]
    );
  }

  async findSaleBill(billNo: string, tenantId: string): Promise<any | null> {
    const bill = await queryOne<any>(
      `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
              customer_type AS customerType, sale_type AS saleType, business_status AS businessStatus,
              collection_status AS collectionStatus, goods_amount AS goodsAmount, discount_amount AS discountAmount,
              rounding_amount AS roundingAmount, receivable_amount AS receivableAmount,
              received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
              due_date AS dueDate, remark, created_at AS createdAt
       FROM sale_bill WHERE bill_no = ? AND tenant_id = ?`,
      [billNo, tenantId]
    );
    if (!bill) return null;

    const items = await query<any>(
      `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
              total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
       FROM sale_bill_item WHERE bill_no = ?`,
      [billNo]
    );

    return { ...bill, items };
  }
}

export const saleReturnDAO = new SaleReturnDAO();
