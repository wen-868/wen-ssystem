import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const saleReturnRouter = Router();

// 列表查询
saleReturnRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { store_id, customer_id, return_status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = "SELECT * FROM sale_return WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (store_id) {
    sql += " AND store_id = ?";
    params.push(Number(store_id));
  }

  if (customer_id) {
    sql += " AND customer_id = ?";
    params.push(Number(customer_id));
  }

  if (return_status) {
    sql += " AND return_status = ?";
    params.push(return_status);
  }

  if (start_date) {
    sql += " AND created_at >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND created_at <= ?";
    params.push(end_date);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const returns = await query<any>(sql, params);
  res.json(ok(returns));
}));

// 详情查询（含明细）
saleReturnRouter.get("/:returnNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId!;

  const returnOrder = await queryOne<any>(
    "SELECT * FROM sale_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  const items = await query<any>(
    "SELECT * FROM sale_return_item WHERE return_no = ? ORDER BY id ASC",
    [returnNo]
  );

  res.json(ok({ ...returnOrder, items }));
}));

// 创建退货单
saleReturnRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    source_bill_no: z.string().max(64).optional(),
    store_id: z.number().int().positive(),
    customer_id: z.number().int().positive().optional(),
    customer_name: z.string().max(64).optional(),
    customer_mobile: z.string().max(20).optional(),
    discount_amount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      sku_id: z.number().int().positive(),
      sku_name: z.string().min(1).max(128),
      box_qty: z.number().int().min(0).default(0),
      bottle_qty: z.number().int().min(0).default(0),
      unit_price: z.number().min(0),
      reason: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const returnNo = makeBizNo("TH");

  let goodsAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = item.box_qty * 12 + item.bottle_qty;
    const subtotalAmount = totalBottleQty * item.unit_price;
    goodsAmount += subtotalAmount;

    return {
      ...item,
      total_bottle_qty: totalBottleQty,
      subtotal_amount: subtotalAmount,
    };
  });

  const refundAmount = goodsAmount - body.discount_amount;

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO sale_return (
        return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
        return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?)`,
      [
        returnNo, body.source_bill_no || null, body.store_id,
        body.customer_id || null, body.customer_name || null, body.customer_mobile || null,
        goodsAmount, body.discount_amount, refundAmount,
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
          returnNo, item.sku_id, item.sku_name,
          item.box_qty, item.bottle_qty, item.total_bottle_qty,
          item.unit_price, item.subtotal_amount, item.reason || null
        ]
      );
    }

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["sale_return", "CREATE", returnNo, "sale_return", req.user!.id, req.user!.username, `创建退货单: ${returnNo}`, tenantId]
    );
  });

  res.json(ok({ return_no: returnNo }));
}));

// 审核通过（PENDING -> COMPLETED）
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

    // 增加库存
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

    // 写台账
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

  res.json(ok({ return_no: returnNo }));
}));

// 确认退款
saleReturnRouter.post("/:returnNo/refund", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId!;

  const body = z.object({
    refund_method: z.enum(["CASH", "WECHAT", "BANK"]),
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
      [body.refund_method, returnNo]
    );

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["sale_return", "REFUND", returnNo, "sale_return", req.user!.id, req.user!.username, `确认退款: ${returnNo}, 方式: ${body.refund_method}`, tenantId]
    );
  });

  res.json(ok({ return_no: returnNo }));
}));
