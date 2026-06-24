import { BaseService } from "./base.service.js";
import { saleReturnDAO } from "../daos/sale-return.dao.js";
import type { ServiceContext, PageResult, PageParams } from "../types/index.js";
import type {
  SaleReturn,
  SaleReturnListVO,
  SaleReturnDetailVO,
  CreateSaleReturnDTO,
  RefundDTO,
} from "../models/sale-return.model.js";
import { makeBizNo } from "../shared/id.js";
import { transaction } from "../shared/db.js";

class SaleReturnService extends BaseService<SaleReturn> {
  constructor() {
    super(saleReturnDAO);
  }

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
    const pageParams: PageParams = { page, pageSize };
    return saleReturnDAO.findPageWithFilters(keyword, storeId, customerId, status, startDate, endDate, pageParams, ctx.tenantId);
  }

  async getDetail(returnNo: string, ctx: ServiceContext): Promise<SaleReturnDetailVO | null> {
    return saleReturnDAO.findDetail(returnNo, ctx.tenantId);
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
      await conn.execute(
        `INSERT INTO sale_return (
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
        await conn.execute(
          `INSERT INTO sale_return_item (
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

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "CREATE", returnNo, "sale_return", ctx.userId, ctx.username, `创建退货单: ${returnNo}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async approve(returnNo: string, ctx: ServiceContext): Promise<{ returnNo: string } | null> {
    const returnOrder = await saleReturnDAO.findByReturnNo(returnNo, ctx.tenantId);
    if (!returnOrder) return null;

    if (returnOrder.status !== "PENDING") {
      throw new Error("只有待审核状态的退货单可以审核");
    }

    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE sale_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?",
        [ctx.userId, returnNo]
      );

      const [items] = await conn.execute(
        "SELECT sku_id, total_bottle_qty FROM sale_return_item WHERE return_no = ?",
        [returnNo]
      ) as any;

      const itemRows = items as any[];
      for (const item of itemRows) {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, quantity, tenant_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
          [returnOrder.storeId, item.sku_id, item.total_bottle_qty, ctx.tenantId, item.total_bottle_qty]
        );
      }

      if (itemRows.length > 0) {
        const totalQty = itemRows.reduce((sum: number, i: any) => sum + i.total_bottle_qty, 0);
        await conn.execute(
          `INSERT INTO inventory_ledger (
            store_id, sku_id, change_type, change_qty, before_qty, after_qty,
            source_no, source_type, operator_id, remark, tenant_id
          ) VALUES (?, ?, 'RETURN_IN', ?, ?, ?, ?, 'sale_return', ?, ?, ?)`,
          [
            returnOrder.storeId,
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

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "APPROVE", returnNo, "sale_return", ctx.userId, ctx.username, `审核通过: ${returnNo}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async refund(returnNo: string, dto: RefundDTO, ctx: ServiceContext): Promise<{ returnNo: string } | null> {
    const returnOrder = await saleReturnDAO.findByReturnNo(returnNo, ctx.tenantId);
    if (!returnOrder) return null;

    if (returnOrder.status !== "COMPLETED") {
      throw new Error("只有已完成的退货单可以退款");
    }

    if (Number(returnOrder.refundedAmount) >= Number(returnOrder.refundAmount)) {
      throw new Error("退货单已全额退款");
    }

    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE sale_return SET refunded_amount = refund_amount, refund_method = ? WHERE return_no = ?",
        [dto.refundMethod, returnNo]
      );

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["sale_return", "REFUND", returnNo, "sale_return", ctx.userId, ctx.username, `确认退款: ${returnNo}, 方式: ${dto.refundMethod}`, ctx.tenantId]
      );
    });

    return { returnNo };
  }

  async getSaleBill(billNo: string, ctx: ServiceContext): Promise<any | null> {
    return saleReturnDAO.findSaleBill(billNo, ctx.tenantId);
  }
}

export const saleReturnService = new SaleReturnService();
