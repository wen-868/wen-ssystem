import { query, queryOne, transaction, queryWithTenant, queryOneWithTenant } from "../shared/db";
import type { ServiceContext, PageResult } from "../types/index";
import { makeBizNo } from "../shared/id";

// ---------------------------------------------------------------------------
// Type Definitions (previously in purchase.model.ts)
// ---------------------------------------------------------------------------

/** 采购订单项入库行 */
interface PurchaseOrderItemInStockRow {
  sku_id: number;
  in_stocked_qty: number;
}

export interface PurchaseOrder {
  id: number;
  orderNo: string;
  supplierId: number;
  supplierName: string;
  storeId: number;
  status: string;
  goodsAmount: number;
  taxAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  expectedDate: string | null;
  operatorId: number;
  remark: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderListVO {
  id: number;
  orderNo: string;
  supplierName: string;
  status: string;
  goodsAmount: number;
  payableAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  expectedDate: string | null;
  createdDate: string;
}

export interface PurchaseOrderItemVO {
  skuId: number;
  skuName: string;
  barcode: string | null;
  boxQty: number;
  bottleQty: number;
  totalBottleQty: number;
  unitPrice: number;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  inStockedQty: number;
  remark: string | null;
}

export interface PurchaseOrderDetailVO {
  id: number;
  orderNo: string;
  supplierId: number;
  supplierName: string;
  storeId: number;
  status: string;
  goodsAmount: number;
  taxAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  expectedDate: string | null;
  remark: string | null;
  createdDate: string;
  updatedDate: string;
  items: PurchaseOrderItemVO[];
}

export interface CreatePurchaseOrderDTO {
  supplierId: number;
  supplierName: string;
  storeId: number;
  expectedDate?: string;
  discountAmount?: number;
  remark?: string;
  items: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    boxQty: number;
    bottleQty: number;
    unitPrice: number;
    taxRate: number;
    remark?: string;
  }>;
}

export interface UpdatePurchaseOrderDTO {
  supplierId?: number;
  supplierName?: string;
  expectedDate?: string;
  discountAmount?: number;
  remark?: string;
  items?: Array<{
    skuId: number;
    skuName: string;
    barcode?: string;
    boxQty: number;
    bottleQty: number;
    unitPrice: number;
    taxRate: number;
    remark?: string;
  }>;
}

export interface InStockDTO {
  warehouseId?: number;
  remark?: string;
  items: Array<{
    skuId: number;
    boxQty: number;
    bottleQty: number;
  }>;
}

// ---------------------------------------------------------------------------
// Internal helpers (replacing DAO methods)
// ---------------------------------------------------------------------------

async function findByOrderNo(orderNo: string, tenantId: string): Promise<PurchaseOrder | null> {
  const row = await queryOneWithTenant<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS status, goods_amount AS goodsAmount,
            tax_amount AS taxAmount, discount_amount AS discountAmount,
            payable_amount AS payableAmount, paid_amount AS paidAmount,
            unpaid_amount AS unpaidAmount, expected_date AS expectedDate,
            operator_id AS operatorId, remark, tenant_id AS tenantId,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_purchase_order
     WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId],
    tenantId
  );
  return row ?? null;
}

async function updateOrderStatus(
  orderNo: string,
  status: string,
  tenantId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const sets: string[] = ["order_status = ?", "updated_at = NOW()"];
  const params: unknown[] = [status];

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      const snakeKey = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      sets.push(`${snakeKey} = ?`);
      params.push(value);
    }
  }

  params.push(orderNo, tenantId);
  await queryWithTenant(`UPDATE t_purchase_order SET ${sets.join(", ")} WHERE order_no = ? AND tenant_id = ?`, params, tenantId);
}

async function addOperationLog(
  module: string,
  action: string,
  targetId: string,
  targetType: string,
  userId: number,
  username: string,
  detail: string,
  tenantId: string
): Promise<void> {
  await queryWithTenant(
    `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [module, action, targetId, targetType, userId, username, detail, tenantId],
    tenantId
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class PurchaseService {
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
    const conditions: string[] = ["po.tenant_id = ?"];
    const params: unknown[] = [ctx.tenantId];

    if (keyword) {
      conditions.push("(po.order_no LIKE ? OR po.supplier_name LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (supplierId !== undefined) {
      conditions.push("po.supplier_id = ?");
      params.push(supplierId);
    }
    if (status) {
      conditions.push("po.order_status = ?");
      params.push(status);
    }
    if (startDate) {
      conditions.push("po.created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("po.created_at <= ?");
      params.push(endDate + " 23:59:59");
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await queryOneWithTenant<{ total: number }>(
      `SELECT COUNT(*) AS total FROM t_purchase_order po WHERE ${whereClause}`,
      params,
      ctx.tenantId
    );
    const total = Number(countResult?.total ?? 0);

    const offset = (page - 1) * pageSize;
    const rows = await queryWithTenant<PurchaseOrderListVO>(
      `SELECT po.id, po.order_no AS orderNo, po.supplier_name AS supplierName,
              po.order_status AS status, po.goods_amount AS goodsAmount,
              po.payable_amount AS payableAmount, po.paid_amount AS paidAmount,
              po.unpaid_amount AS unpaidAmount, po.expected_date AS expectedDate,
              po.created_at AS createdDate
       FROM t_purchase_order po
       WHERE ${whereClause}
       ORDER BY po.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
      ctx.tenantId
    );

    return { records: rows, total, page, pageSize };
  }

  async getDetail(orderNo: string, ctx: ServiceContext): Promise<PurchaseOrderDetailVO | null> {
    const order = await queryOneWithTenant<any>(
      `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
              store_id AS storeId, order_status AS status, goods_amount AS goodsAmount,
              tax_amount AS taxAmount, discount_amount AS discountAmount,
              payable_amount AS payableAmount, paid_amount AS paidAmount,
              unpaid_amount AS unpaidAmount, expected_date AS expectedDate,
              remark, created_at AS createdDate, updated_at AS updatedDate
       FROM t_purchase_order
       WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, ctx.tenantId],
      ctx.tenantId
    );

    if (!order) return null;

    const items = await query<PurchaseOrderItemVO>(
      `SELECT sku_id AS skuId, sku_name AS skuName, barcode, box_qty AS boxQty,
              bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
              unit_price AS unitPrice, tax_rate AS taxRate,
              subtotal_amount AS subtotalAmount, tax_amount AS taxAmount,
              total_amount AS totalAmount, COALESCE(in_stocked_qty, 0) AS inStockedQty,
              remark
       FROM t_purchase_order_item
       WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, ctx.tenantId]
    );

    return { ...order, items };
  }

  async createOrder(dto: CreatePurchaseOrderDTO, ctx: ServiceContext): Promise<{ purchaseNo: string }> {
    const orderNo = makeBizNo("CGDD");

    let goodsAmount = 0;
    let taxAmount = 0;

    const itemsWithAmount = dto.items.map((item) => {
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
      await (conn as any).execute(
        `INSERT INTO t_purchase_order (
          order_no, supplier_id, supplier_name, store_id, order_status,
          goods_amount, tax_amount, discount_amount, payable_amount,
          paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id
        ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          orderNo,
          dto.supplierId,
          dto.supplierName,
          dto.storeId,
          goodsAmount,
          taxAmount,
          discountAmount,
          totalAmount,
          totalAmount,
          dto.expectedDate || null,
          ctx.userId,
          dto.remark || null,
          ctx.tenantId,
        ]
      );

      for (const item of itemsWithAmount) {
        await (conn as any).execute(
          `INSERT INTO t_purchase_order_item (
            order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
            unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ]
        );
      }

      await (conn as any).execute(
        `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["purchase", "CREATE", orderNo, "purchase_order", ctx.userId, ctx.username, `创建采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async updateOrder(
    orderNo: string,
    dto: UpdatePurchaseOrderDTO,
    ctx: ServiceContext
  ): Promise<{ purchaseNo: string } | null> {
    const existing = await findByOrderNo(orderNo, ctx.tenantId);
    if (!existing) return null;

    if (!["DRAFT", "PENDING"].includes(existing.status)) {
      throw Object.assign(new Error("当前状态不允许修改"), { statusCode: 400 });
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

        const itemsWithAmount = dto.items.map((item) => {
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

        await (conn as any).execute("DELETE FROM t_purchase_order_item WHERE order_no = ? AND tenant_id = ?", [orderNo, ctx.tenantId]);
        for (const item of itemsWithAmount) {
          await (conn as any).execute(
            `INSERT INTO t_purchase_order_item (
              order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
              unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark, tenant_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
              ctx.tenantId,
            ]
          );
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = NOW()");
        params.push(orderNo, ctx.tenantId);
        await (conn as any).execute(
          `UPDATE t_purchase_order SET ${updates.join(", ")} WHERE order_no = ? AND tenant_id = ?`,
          params as any[]
        );
      }

      await (conn as any).execute(
        `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["purchase", "UPDATE", orderNo, "purchase_order", ctx.userId, ctx.username, `修改采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async delete(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const existing = await findByOrderNo(orderNo, ctx.tenantId);
    if (!existing) return null;

    if (!["DRAFT"].includes(existing.status)) {
      throw Object.assign(new Error("只有草稿状态的订单可以删除"), { statusCode: 400 });
    }

    await transaction(async (conn) => {
      await (conn as any).execute("DELETE FROM t_purchase_order_item WHERE order_no = ? AND tenant_id = ?", [orderNo, ctx.tenantId]);
      await (conn as any).execute("DELETE FROM t_purchase_order WHERE order_no = ? AND tenant_id = ?", [orderNo, ctx.tenantId]);
      await (conn as any).execute(
        `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["purchase", "DELETE", orderNo, "purchase_order", ctx.userId, ctx.username, `删除采购订单: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }

  async submit(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "DRAFT") {
      throw Object.assign(new Error("只有草稿状态的订单可以提交审核"), { statusCode: 400 });
    }

    await updateOrderStatus(orderNo, "PENDING", ctx.tenantId);
    await addOperationLog(
      "purchase",
      "SUBMIT",
      orderNo,
      "purchase_order",
      ctx.userId,
      ctx.username,
      `提交审核: ${orderNo}`,
      ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async approve(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "PENDING") {
      throw Object.assign(new Error("只有待审核状态的订单可以审核"), { statusCode: 400 });
    }

    await updateOrderStatus(orderNo, "APPROVED", ctx.tenantId, { auditorId: ctx.userId });
    await addOperationLog(
      "purchase",
      "APPROVE",
      orderNo,
      "purchase_order",
      ctx.userId,
      ctx.username,
      `审核通过: ${orderNo}`,
      ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async cancel(orderNo: string, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (!["DRAFT", "PENDING"].includes(order.status)) {
      throw Object.assign(new Error("只有草稿或待审核状态的订单可以取消"), { statusCode: 400 });
    }

    await updateOrderStatus(orderNo, "CANCELLED", ctx.tenantId);
    await addOperationLog(
      "purchase",
      "CANCEL",
      orderNo,
      "purchase_order",
      ctx.userId,
      ctx.username,
      `取消订单: ${orderNo}`,
      ctx.tenantId
    );

    return { purchaseNo: orderNo };
  }

  async inStock(orderNo: string, dto: InStockDTO, ctx: ServiceContext): Promise<{ purchaseNo: string } | null> {
    const order = await findByOrderNo(orderNo, ctx.tenantId);
    if (!order) return null;

    if (order.status !== "APPROVED") {
      throw Object.assign(new Error("只有已审核的订单可以入库"), { statusCode: 400 });
    }

    const orderItems = await query<PurchaseOrderItemInStockRow>(
      `SELECT sku_id, COALESCE(in_stocked_qty, 0) AS in_stocked_qty
       FROM t_purchase_order_item
       WHERE order_no = ?`,
      [orderNo]
    );
    const itemMap = new Map<number, PurchaseOrderItemInStockRow>(orderItems.map((i) => [i.sku_id, i]));

    await transaction(async (conn) => {
      for (const item of dto.items) {
        const orderItem = itemMap.get(item.skuId);
        if (!orderItem) continue;

        const inStockBottleQty = item.boxQty * 12 + item.bottleQty;
        const newInStockedQty = Number(orderItem.in_stocked_qty || 0) + inStockBottleQty;

        await (conn as any).execute(
          "UPDATE t_purchase_order_item SET in_stocked_qty = ? WHERE order_no = ? AND sku_id = ?",
          [newInStockedQty, orderNo, item.skuId]
        );

        await (conn as any).execute(
          `INSERT INTO t_inventory_balance (store_id, sku_id, physical_qty, available_qty, tenant_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE physical_qty = physical_qty + ?, available_qty = available_qty + ?`,
          [order.storeId, item.skuId, inStockBottleQty, inStockBottleQty, ctx.tenantId, inStockBottleQty, inStockBottleQty]
        );
      }

      const [rows] = (await (conn as any).execute(
        "SELECT total_bottle_qty, in_stocked_qty FROM t_purchase_order_item WHERE order_no = ? AND tenant_id = ?",
        [orderNo, ctx.tenantId]
      )) as [Record<string, unknown>[], unknown];
      const totalOrdered = rows.reduce((sum: number, i: any) => sum + Number(i.total_bottle_qty), 0);
      const totalInStocked = rows.reduce((sum: number, i: any) => sum + Number(i.in_stocked_qty || 0), 0);

      let warehouseStatus = "PARTIAL";
      if (totalInStocked >= totalOrdered) {
        warehouseStatus = "FULL";
      }

      await (conn as any).execute("UPDATE t_purchase_order SET warehouse_status = ?, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?", [
        warehouseStatus,
        orderNo,
        ctx.tenantId,
      ]);

      await (conn as any).execute(
        `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["purchase", "IN_STOCK", orderNo, "purchase_order", ctx.userId, ctx.username, `采购入库: ${orderNo}`, ctx.tenantId]
      );
    });

    return { purchaseNo: orderNo };
  }
}

export const purchaseService = new PurchaseService();