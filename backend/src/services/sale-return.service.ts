import { query, queryOne, transaction, queryWithTenant, queryOneWithTenant } from "../shared/db";
import { makeBizNo } from "../shared/id";
import type { ServiceContext, PageResult } from "../types/index";

// ── 数据库行接口定义 ──

/** 销售单原始行 — t_sale_bill SELECT *（用于退货关联销售单查询） */
interface SaleBillRow {
  id: number;
  bill_no: string;
  store_id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_type: string | null;
  business_status: string;
  collection_status: string;
  goods_amount: number | string;
  discount_amount: number | string;
  rounding_amount: number | string;
  receivable_amount: number | string;
  received_amount: number | string;
  unreceived_amount: number | string;
  operator_id: number;
  remark: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 销售单明细行 — t_sale_bill_item SELECT * */
interface SaleBillItemRow {
  id: number;
  bill_no: string;
  sku_id: number;
  sku_name: string;
  box_qty: number;
  bottle_qty: number;
  total_bottle_qty: number;
  unit_price: number | string;
  price_type: string;
  subtotal_amount: number | string;
  tenant_id: string;
  created_at: string | Date;
}

/** 销售单 + 明细组合（getSaleBill 返回类型） */
interface SaleBillWithItemsRow extends SaleBillRow {
  items: SaleBillItemRow[];
}

// ── Type definitions (formerly in models/sale-return.model.ts) ──

interface SaleReturnItem {
  id: number;
  return_no: string;
  sku_id: number;
  sku_name: string;
  box_qty: number;
  bottle_qty: number;
  total_bottle_qty: number;
  unit_price: number;
  subtotal_amount: number;
  reason: string | null;
  created_at: string;
}

interface SaleReturn {
  id: number;
  return_no: string;
  source_bill_no: string | null;
  store_id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  return_status: string;
  goods_amount: number;
  discount_amount: number;
  refund_amount: number;
  refunded_amount: number;
  refund_method: string | null;
  operator_id: number;
  remark: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface SaleReturnListVO extends SaleReturn {
  store_name?: string;
}

interface SaleReturnDetailVO extends SaleReturn {
  items: SaleReturnItem[];
}

interface CreateSaleReturnDTO {
  sourceBillNo?: string;
  storeId: number;
  customerId?: number;
  customerName?: string;
  customerMobile?: string;
  discountAmount?: number;
  remark?: string;
  items: CreateSaleReturnItemDTO[];
}

interface CreateSaleReturnItemDTO {
  skuId: number;
  skuName: string;
  boxQty: number;
  bottleQty: number;
  unitPrice: number;
  reason?: string;
}

interface RefundDTO {
  refundMethod: string;
}

// ── Service ──

class SaleReturnService {
  async getPageList(
    keyword: string | undefined,
    storeId: number | undefined,
    customerId: number | undefined,
    status: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<SaleReturnListVO>> {
    let where = "WHERE sr.tenant_id = ?";
    const params: unknown[] = [ctx.tenantId];

    if (storeId !== undefined) {
      where += " AND sr.store_id = ?";
      params.push(storeId);
    }
    if (customerId !== undefined) {
      where += " AND sr.customer_id = ?";
      params.push(customerId);
    }
    if (status) {
      where += " AND sr.return_status = ?";
      params.push(status);
    }
    if (startDate) {
      where += " AND sr.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND sr.created_at <= ?";
      params.push(endDate + " 23:59:59");
    }
    if (keyword) {
      where += " AND (sr.return_no LIKE ? OR sr.customer_name LIKE ? OR sr.customer_mobile LIKE ?)";
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const countSql = `SELECT COUNT(*) AS total FROM t_sale_return sr ${where}`;
    const countRow = await queryOneWithTenant<{ total: number }>(countSql, params, ctx.tenantId);
    const total = Number(countRow?.total ?? 0);

    const offset = (page - 1) * pageSize;
    const dataSql = `SELECT sr.*, s.name AS store_name FROM t_sale_return sr LEFT JOIN t_store s ON sr.store_id = s.id AND s.tenant_id = ? ${where} ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`;
    const dataParams = [ctx.tenantId, ...params, pageSize, offset];
    const records = await queryWithTenant<SaleReturnListVO>(dataSql, dataParams, ctx.tenantId);

    return { records, total, page, pageSize };
  }

  async getDetail(returnNo: string, ctx: ServiceContext): Promise<SaleReturnDetailVO | null> {
    const returnOrder = await queryOneWithTenant<SaleReturn>(
      "SELECT * FROM t_sale_return WHERE return_no = ? AND tenant_id = ?",
      [returnNo, ctx.tenantId],
      ctx.tenantId
    );
    if (!returnOrder) return null;

    const items = await query<SaleReturnItem>(
      "SELECT * FROM t_sale_return_item WHERE return_no = ? AND tenant_id = ?",
      [returnNo, ctx.tenantId]
    );

    return { ...returnOrder, items };
  }

  async createReturn(dto: CreateSaleReturnDTO, ctx: ServiceContext): Promise<{ returnNo: string }> {
    const returnNo = makeBizNo("TH");

    let goodsAmount = 0;

    const itemsWithAmount = dto.items.map(item => {
      const totalBottleQty = item.boxQty * 12 + item.bottleQty;
      const subtotal = totalBottleQty * item.unitPrice;
      goodsAmount += subtotal;

      return {
        ...item,
        totalBottleQty,
        subtotal,
      };
    });

    const discountAmount = dto.discountAmount ?? 0;
    const refundAmount = goodsAmount - discountAmount;

    await transaction(async (conn) => {
      await (conn as any).execute(
        `INSERT INTO t_sale_return (
          return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
          return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
          operator_id, remark, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?)`,
        [
          returnNo,
          dto.sourceBillNo || null,
          dto.storeId,
          dto.customerId || null,
          dto.customerName || null,
          dto.customerMobile || null,
          goodsAmount,
          discountAmount,
          refundAmount,
          ctx.userId,
          dto.remark || null,
          ctx.tenantId
        ]
      );

      for (const item of itemsWithAmount) {
        await (conn as any).execute(
          `INSERT INTO t_sale_return_item (
            return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
            unit_price, subtotal_amount, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnNo,
            item.skuId,
            item.skuName,
            item.boxQty,
            item.bottleQty,
            item.totalBottleQty,
            item.unitPrice,
            item.subtotal,
            item.reason || null
          ]
        );
      }

      await (conn as any).execute(
        "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "CREATE", returnNo, "sale_return", ctx.userId, ctx.username, `创建退货单: ${returnNo}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async approve(returnNo: string, ctx: ServiceContext): Promise<{ returnNo: string } | null> {
    const returnOrder = await queryOneWithTenant<SaleReturn>(
      "SELECT * FROM t_sale_return WHERE return_no = ? AND tenant_id = ?",
      [returnNo, ctx.tenantId],
      ctx.tenantId
    );
    if (!returnOrder) return null;

    if (returnOrder.return_status !== "PENDING") {
      throw new Error("只有待审核状态的退货单可以审核");
    }

    await transaction(async (conn) => {
      await (conn as any).execute(
        "UPDATE t_sale_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?",
        [ctx.userId, returnNo]
      );

      const [items] = await (conn as any).execute(
        "SELECT sku_id, total_bottle_qty FROM t_sale_return_item WHERE return_no = ? AND tenant_id = ?",
        [returnNo, ctx.tenantId]
      ) as [Record<string, unknown>[], unknown];

      const itemRows = items as Record<string, unknown>[];
      for (const item of itemRows) {
        await (conn as any).execute(
          `INSERT INTO t_inventory_balance (store_id, sku_id, physical_qty, available_qty, tenant_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE physical_qty = physical_qty + ?, available_qty = available_qty + ?`,
          [returnOrder.store_id, item.sku_id, item.total_bottle_qty, item.total_bottle_qty, ctx.tenantId, item.total_bottle_qty, item.total_bottle_qty]
        );
      }

      if (itemRows.length > 0) {
        const totalQty = itemRows.reduce((sum: number, i: any) => sum + i.total_bottle_qty, 0);
        await (conn as any).execute(
          `INSERT INTO t_inventory_ledger (
            store_id, sku_id, change_type, change_qty, before_qty, after_qty,
            source_no, source_type, operator_id, remark, tenant_id
          ) VALUES (?, ?, 'RETURN_IN', ?, ?, ?, ?, 'sale_return', ?, ?, ?)`,
          [
            returnOrder.store_id,
            itemRows[0].sku_id,
            totalQty,
            0,
            totalQty,
            returnNo,
            ctx.userId,
            `退货入库: ${returnNo}`,
            ctx.tenantId
          ]
        );
      }

      await (conn as any).execute(
        "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "APPROVE", returnNo, "sale_return", ctx.userId, ctx.username, `审核通过: ${returnNo}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async refund(returnNo: string, dto: RefundDTO, ctx: ServiceContext): Promise<{ returnNo: string } | null> {
    const returnOrder = await queryOneWithTenant<SaleReturn>(
      "SELECT * FROM t_sale_return WHERE return_no = ? AND tenant_id = ?",
      [returnNo, ctx.tenantId],
      ctx.tenantId
    );
    if (!returnOrder) return null;

    if (returnOrder.return_status !== "COMPLETED") {
      throw Object.assign(new Error("只有已完成的退货单可以退款"), { statusCode: 400 });
    }

    if (Number(returnOrder.refunded_amount) >= Number(returnOrder.refund_amount)) {
      throw Object.assign(new Error("退货单已全额退款"), { statusCode: 400 });
    }

    await transaction(async (conn) => {
      await (conn as any).execute(
        "UPDATE t_sale_return SET refunded_amount = refund_amount, refund_method = ? WHERE return_no = ?",
        [dto.refundMethod, returnNo]
      );

      await (conn as any).execute(
        "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "REFUND", returnNo, "sale_return", ctx.userId, ctx.username, `确认退款: ${returnNo}, 方式: ${dto.refundMethod}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async getSaleBill(billNo: string, ctx: ServiceContext): Promise<SaleBillWithItemsRow | null> {
    const bill = await queryOneWithTenant<SaleBillRow>(
      "SELECT * FROM t_sale_bill WHERE bill_no = ? AND tenant_id = ?",
      [billNo, ctx.tenantId],
      ctx.tenantId
    );
    if (!bill) return null;

    const items = await queryWithTenant<SaleBillItemRow>(
      "SELECT * FROM t_sale_bill_item WHERE bill_no = ?",
      [billNo],
      ctx.tenantId
    );

    return { ...bill, items };
  }
}

export const saleReturnService = new SaleReturnService();