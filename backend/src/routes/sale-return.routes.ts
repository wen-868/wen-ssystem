import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const saleReturnRouter = Router();

saleReturnRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { storeId, customerId, returnStatus, startDate, endDate, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = `SELECT 
    id,
    return_no AS returnNo,
    source_bill_no AS sourceBillNo,
    store_id AS storeId,
    customer_id AS customerId,
    customer_name AS customerName,
    customer_mobile AS customerMobile,
    return_status AS returnStatus,
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
  FROM sale_return WHERE tenant_id = ?`;
  const params: any[] = [tenantId];

  if (storeId) {
    sql += " AND store_id = ?";
    params.push(Number(storeId));
  }

  if (customerId) {
    sql += " AND customer_id = ?";
    params.push(Number(customerId));
  }

  if (returnStatus) {
    sql += " AND return_status = ?";
    params.push(returnStatus);
  }

  if (startDate) {
    sql += " AND created_at >= ?";
    params.push(startDate);
  }

  if (endDate) {
    sql += " AND created_at <= ?";
    params.push(endDate);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const returns = await query<any>(sql, params);
  res.json(ok(returns));
}));

saleReturnRouter.get("/:returnNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId!;

  const returnOrder = await queryOne<any>(
    `SELECT 
      id,
      return_no AS returnNo,
      source_bill_no AS sourceBillNo,
      store_id AS storeId,
      customer_id AS customerId,
      customer_name AS customerName,
      customer_mobile AS customerMobile,
      return_status AS returnStatus,
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
    FROM sale_return WHERE return_no = ? AND tenant_id = ?`,
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  const items = await query<any>(
    `SELECT 
      id,
      return_no AS returnNo,
      sku_id AS skuId,
      sku_name AS skuName,
      box_qty AS boxQty,
      bottle_qty AS bottleQty,
      total_bottle_qty AS totalBottleQty,
      unit_price AS unitPrice,
      subtotal_amount AS subtotalAmount,
      reason
    FROM sale_return_item WHERE return_no = ? ORDER BY id ASC`,
    [returnNo]
  );

  res.json(ok({ ...returnOrder, items }));
}));

saleReturnRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    sourceBillNo: z.string().max(64).optional(),
    storeId: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    customerName: z.string().max(64).optional(),
    customerMobile: z.string().max(20).optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      reason: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const returnNo = makeBizNo("TH");

  let goodsAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = item.boxQty * 12 + item.bottleQty;
    const subtotalAmount = totalBottleQty * item.unitPrice;
    goodsAmount += subtotalAmount;

    return {
      ...item,
      totalBottleQty,
      subtotalAmount,
    };
  });

  const refundAmount = goodsAmount - body.discountAmount;

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO sale_return (
        return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
        return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?)`,
      [
        returnNo, body.sourceBillNo || null, body.storeId,
        body.customerId || null, body.customerName || null, body.customerMobile || null,
        goodsAmount, body.discountAmount, refundAmount,
        req.user!.id, body.remark || null, tenantId
      ]
    );

    for (const item of itemsWithAmount) {
      await conn.execute(
        `INSERT INTO sale_return_item (
          return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, subtotal_amount, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnNo, item.skuId, item.skuName,
          item.boxQty, item.bottleQty, item.totalBottleQty,
          item.unitPrice, item.subtotalAmount, item.reason || null
        ]
      );
    }

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["sale_return", "CREATE", returnNo, "sale_return", req.user!.id, req.user!.username, `创建退货单: ${returnNo}`, tenantId]
    );
  });

  res.json(ok({ returnNo }));
}));

saleReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId!;

  const returnOrder = await queryOne<any>(
    "SELECT id, return_status, store_id, source_bill_no FROM sale_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  if (returnOrder.return_status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的退货单可以审核" });
    return;
  }

  await transaction(async (conn) => {
    await conn.execute(
      "UPDATE sale_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?",
      [req.user!.id, returnNo]
    );

    const items = await conn.execute(
      "SELECT sku_id, total_bottle_qty FROM sale_return_item WHERE return_no = ?",
      [returnNo]
    );

    const itemRows = items[0] as any[];
    for (const item of itemRows) {
      await conn.execute(
        `INSERT INTO inventory_balance (store_id, sku_id, quantity, tenant_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [returnOrder.store_id, item.sku_id, item.total_bottle_qty, tenantId, item.total_bottle_qty]
      );
    }

    await conn.execute(
      `INSERT INTO inventory_ledger (
        store_id, sku_id, change_type, change_qty, before_qty, after_qty,
        source_no, source_type, operator_id, remark, tenant_id
      ) VALUES (?, ?, 'RETURN_IN', ?, ?, ?, ?, 'sale_return', ?, ?, ?)`,
      [
        returnOrder.store_id, itemRows[0]?.sku_id || 0, 
        itemRows.reduce((sum: number, i: any) => sum + i.total_bottle_qty, 0),
        0, itemRows.reduce((sum: number, i: any) => sum + i.total_bottle_qty, 0),
        returnNo, req.user!.id, `退货入库: ${returnNo}`, tenantId
      ]
    );

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["sale_return", "APPROVE", returnNo, "sale_return", req.user!.id, req.user!.username, `审核通过: ${returnNo}`, tenantId]
    );
  });

  res.json(ok({ returnNo }));
}));

saleReturnRouter.post("/:returnNo/refund", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId!;

  const body = z.object({
    refundMethod: z.enum(["CASH", "WECHAT", "BANK"]),
  }).parse(req.body);

  const returnOrder = await queryOne<any>(
    "SELECT id, return_status, refund_amount, refunded_amount FROM sale_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  if (returnOrder.return_status !== "COMPLETED") {
    res.status(400).json({ code: "400", message: "只有已完成的退货单可以退款" });
    return;
  }

  if (Number(returnOrder.refunded_amount) >= Number(returnOrder.refund_amount)) {
    res.status(400).json({ code: "400", message: "退货单已全额退款" });
    return;
  }

  await transaction(async (conn) => {
    await conn.execute(
      "UPDATE sale_return SET refunded_amount = refund_amount, refund_method = ? WHERE return_no = ?",
      [body.refundMethod, returnNo]
    );

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["sale_return", "REFUND", returnNo, "sale_return", req.user!.id, req.user!.username, `确认退款: ${returnNo}, 方式: ${body.refundMethod}`, tenantId]
    );
  });

  res.json(ok({ returnNo }));
}));
