import { BaseService } from "./base.service.js";
import { purchaseDAO } from "../daos/purchase.dao.js";
import type { ServiceContext, PageResult, PageParams } from "../types/index.js";
import type {
  PurchaseOrder,
  PurchaseOrderListVO,
  PurchaseOrderDetailVO,
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  InStockDTO,
} from "../models/purchase.model.js";
import { makeBizNo } from "../shared/id.js";
import { transaction } from "../shared/db.js";

class PurchaseService extends BaseService<PurchaseOrder> {
  constructor() {
    super(purchaseDAO);
  }

  async getPageList(
    keyword: string | undefined,
    supplierId: number | undefined,
    status: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<PurchaseOrderListVO>> {
    const pageParams: PageParams = { page, pageSize };
    return purchaseDAO.findPageWithFilters(keyword, supplierId, status, startDate, endDate, pageParams, ctx.tenantId);
  }

  async getDetail(orderNo: string, ctx: ServiceContext): Promise<PurchaseOrderDetailVO | null> {
    return purchaseDAO.findDetail(orderNo, ctx.tenantId);
  }

  async createOrder(dto: CreatePurchaseOrderDTO, ctx: ServiceContext): Promise<{ purchaseNo: string }> {
    const orderNo = makeBizNo("CGDD");

    let goodsAmount = 0;
    let taxAmount = 0;

    const itemsWithAmount = dto.items.map(item => {
      const totalBottleQty = item.boxQty * 12 + item.bottleQty;
      const subtotal = totalBottleQty * item.unitPrice;
      const itemTaxAmount = subtotal * item.taxRate;
      const totalAmount = subtotal + itemTaxAmount;

      goodsAmount += subtotal;
      taxAmount += itemTaxAmount;

      return {
        ...item,
        totalBottleQty,
        subtotal,
        taxAmount: itemTaxAmount,
        totalAmount,
      };
    });

    const discountAmount = dto.discountAmount ?? 0;
    const totalAmount = goodsAmount + taxAmount - discountAmount;

    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO purchase_order (
          order_no, supplier_id, supplier_name, store_id, order_status,
          goods_amount, tax_amount, discount_amount, payable_amount,
          paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id
        ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          orderNo, dto.supplierId, dto.supplierName, dto.storeId,
          goodsAmount, taxAmount, discountAmount, totalAmount,
          totalAmount, dto.expectedDate || null, ctx.userId, dto.remark || null, ctx.tenantId
        ]
      );

      for (const item of itemsWithAmount) {
        await conn.execute(
          `INSERT INTO purchase_order_item (
            order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
            unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderNo, item.skuId, item.skuName, item.barcode || null,
            item.boxQty, item.bottleQty, item.totalBottleQty,
            item.unitPrice, item.taxRate, item.subtotal, item.taxAmount,
            item.totalAmount, item.remark || null
          ]
        );
      }

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["purchase", "CREATE", orderNo, "purchase_order", ctx.userId, ctx.username, `创建采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async updateOrder(orderNo: string, dto: UpdatePurchaseOrderDTO, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const existing = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!existing) return null;

    if (!["DRAFT", "PENDING"].includes(existing.status)) {
      throw new Error("当前状态不允许修改");
    }

    await transaction(async (conn) => {
      const updates: string[] = [];
      const params: unknown[] = [];

      if (dto.supplierId !== undefined) {
        updates.push("supplier_id = ?");
        params.push(dto.supplierId);
      }
      if (dto.supplierName !== undefined) {
        updates.push("supplier_name = ?");
        params.push(dto.supplierName);
      }
      if (dto.expectedDate !== undefined) {
        updates.push("expected_date = ?");
        params.push(dto.expectedDate);
      }
      if (dto.discountAmount !== undefined) {
        updates.push("discount_amount = ?");
        params.push(dto.discountAmount);
      }
      if (dto.remark !== undefined) {
        updates.push("remark = ?");
        params.push(dto.remark);
      }

      if (dto.items && dto.items.length > 0) {
        let goodsAmount = 0;
        let taxAmount = 0;

        const itemsWithAmount = dto.items.map(item => {
          const totalBottleQty = item.boxQty * 12 + item.bottleQty;
          const subtotal = totalBottleQty * item.unitPrice;
          const itemTaxAmount = subtotal * item.taxRate;
          const totalAmount = subtotal + itemTaxAmount;
          goodsAmount += subtotal;
          taxAmount += itemTaxAmount;
          return { ...item, totalBottleQty, subtotal, taxAmount: itemTaxAmount, totalAmount };
        });

        const discount = dto.discountAmount ?? 0;
        const totalAmount = goodsAmount + taxAmount - discount;

        updates.push("goods_amount = ?", "tax_amount = ?", "payable_amount = ?", "unpaid_amount = ?");
        params.push(goodsAmount, taxAmount, totalAmount, totalAmount);

        await conn.execute("DELETE FROM purchase_order_item WHERE order_no = ?", [orderNo]);
        for (const item of itemsWithAmount) {
          await conn.execute(
            `INSERT INTO purchase_order_item (
              order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
              unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderNo, item.skuId, item.skuName, item.barcode || null,
              item.boxQty, item.bottleQty, item.totalBottleQty,
              item.unitPrice, item.taxRate, item.subtotal, item.taxAmount,
              item.totalAmount, item.remark || null
            ]
          );
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = NOW()");
        params.push(orderNo, ctx.tenantId);
        await conn.execute(
          `UPDATE purchase_order SET ${updates.join(", ")} WHERE order_no = ? AND tenant_id = ?`,
          params as any[]
        );
      }

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["purchase", "UPDATE", orderNo, "purchase_order", ctx.userId, ctx.username, `修改采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async delete(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const existing = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!existing) return null;

    if (!["DRAFT"].includes(existing.status)) {
      throw new Error("只有草稿状态的订单可以删除");
    }

    await transaction(async (conn) => {
      await conn.execute("DELETE FROM purchase_order_item WHERE order_no = ?", [orderNo]);
      await conn.execute("DELETE FROM purchase_order WHERE order_no = ? AND tenant_id = ?", [orderNo, ctx.tenantId]);
      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["purchase", "DELETE", orderNo, "purchase_order", ctx.userId, ctx.username, `删除采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async submit(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "DRAFT") {
      throw new Error("只有草稿状态的订单可以提交审核");
    }

    await purchaseDAO.updateOrder(orderNo, { status: "PENDING" }, ctx.tenantId);
    await purchaseDAO.addOperationLog(
      "purchase", "SUBMIT", orderNo, "purchase_order",
      ctx.userId, ctx.username, `提交审核: ${orderNo}`, ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async approve(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "PENDING") {
      throw new Error("只有待审核状态的订单可以审核");
    }

    await purchaseDAO.updateOrder(
      orderNo,
      { status: "APPROVED", auditorId: ctx.userId },
      ctx.tenantId
    );
    await purchaseDAO.addOperationLog(
      "purchase", "APPROVE", orderNo, "purchase_order",
      ctx.userId, ctx.username, `审核通过: ${orderNo}`, ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async cancel(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (!["DRAFT", "PENDING"].includes(order.status)) {
      throw new Error("只有草稿或待审核状态的订单可以取消");
    }

    await purchaseDAO.updateOrder(orderNo, { status: "CANCELLED" }, ctx.tenantId);
    await purchaseDAO.addOperationLog(
      "purchase", "CANCEL", orderNo, "purchase_order",
      ctx.userId, ctx.username, `取消订单: ${orderNo}`, ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async inStock(orderNo: string, dto: InStockDTO, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await purchaseDAO.findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "APPROVED") {
      throw new Error("只有已审核的订单可以入库");
    }

    const orderItems = await purchaseDAO.getOrderItemsWithStock(orderNo);
    const itemMap = new Map<number, any>(orderItems.map((i: any) => [i.sku_id, i]));

    await transaction(async (conn) => {
      for (const item of dto.items) {
        const orderItem = itemMap.get(item.skuId);
        if (!orderItem) continue;

        const inStockBottleQty = item.boxQty * 12 + item.bottleQty;
        const newInStockedQty = Number(orderItem.in_stocked_qty || 0) + inStockBottleQty;

        await conn.execute(
          "UPDATE purchase_order_item SET in_stocked_qty = ? WHERE order_no = ? AND sku_id = ?",
          [newInStockedQty, orderNo, item.skuId]
        );

        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, quantity, tenant_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
          [order.storeId, item.skuId, inStockBottleQty, ctx.tenantId, inStockBottleQty]
        );
      }

      const [rows] = await conn.execute(
        "SELECT total_bottle_qty, in_stocked_qty FROM purchase_order_item WHERE order_no = ?",
        [orderNo]
      ) as any;
      const totalOrdered = rows.reduce((sum: number, i: any) => sum + Number(i.total_bottle_qty), 0);
      const totalInStocked = rows.reduce((sum: number, i: any) => sum + Number(i.in_stocked_qty || 0), 0);

      let warehouseStatus = "PARTIAL";
      if (totalInStocked >= totalOrdered) {
        warehouseStatus = "FULL";
      }

      await conn.execute(
        "UPDATE purchase_order SET warehouse_status = ?, updated_at = NOW() WHERE order_no = ?",
        [warehouseStatus, orderNo]
      );

      await conn.execute(
        "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["purchase", "IN_STOCK", orderNo, "purchase_order", ctx.userId, ctx.username, `采购入库: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }
}

export const purchaseService = new PurchaseService();
