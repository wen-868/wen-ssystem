import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchaseReturnRouter = Router();

// 列表查询
purchaseReturnRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplier_id, return_status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId;

  let sql = "SELECT * FROM purchase_return WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (supplier_id) {
    sql += " AND supplier_id = ?";
    params.push(Number(supplier_id));
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
purchaseReturnRouter.get("/:returnNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId;

  const returnOrder = await queryOne<any>(
    "SELECT * FROM purchase_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  const items = await query<any>(
    "SELECT * FROM purchase_return_item WHERE return_no = ? ORDER BY id ASC",
    [returnNo]
  );

  res.json(ok({ ...returnOrder, items }));
}));

// 创建退货单
purchaseReturnRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    order_no: z.string().max(64).optional(),
    stock_no: z.string().max(64).optional(),
    supplier_id: z.number().int().positive(),
    supplier_name: z.string().min(1).max(128),
    store_id: z.number().int().positive(),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      sku_id: z.number().int().positive(),
      sku_name: z.string().min(1).max(128),
      box_qty: z.number().int().min(0).default(0),
      bottle_qty: z.number().int().min(0).default(0),
      unit_price: z.number().min(0),
      tax_rate: z.number().min(0).max(1).default(0),
      reason: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const returnNo = makeBizNo("CGTH");

  // 计算金额
  let goodsAmount = 0;
  let taxAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = item.box_qty * 12 + item.bottle_qty;
    const subtotalAmount = totalBottleQty * item.unit_price;
    const itemTaxAmount = subtotalAmount * item.tax_rate;
    const totalAmount = subtotalAmount + itemTaxAmount;

    goodsAmount += subtotalAmount;
    taxAmount += itemTaxAmount;

    return {
      ...item,
      total_bottle_qty: totalBottleQty,
      subtotal_amount: subtotalAmount,
      tax_amount: itemTaxAmount,
      total_amount: totalAmount,
    };
  });

  const totalAmount = goodsAmount + taxAmount;
  const refundAmount = totalAmount;

  await transaction(async (conn) => {
    // 插入主表
    await conn.execute(
      `INSERT INTO purchase_return (
        return_no, order_no, stock_no, supplier_id, supplier_name, store_id, return_status,
        goods_amount, tax_amount, total_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        returnNo, body.order_no || null, body.stock_no || null,
        body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, totalAmount, refundAmount,
        req.user?.id, body.remark || null, tenantId
      ]
    );

    // 插入明细表
    for (const item of itemsWithAmount) {
      await conn.execute(
        `INSERT INTO purchase_return_item (
          return_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnNo, item.sku_id, item.sku_name,
          item.box_qty, item.bottle_qty, item.total_bottle_qty,
          item.unit_price, item.tax_rate, item.subtotal_amount, item.tax_amount, item.total_amount,
          item.reason || null
        ]
      );
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "CREATE", returnNo, "purchase_return", req.user?.id, req.user?.username, `创建采购退货单: ${returnNo}`, tenantId]
    );
  });

  res.json(ok({ return_no: returnNo }));
}));

// 审核通过（PENDING -> COMPLETED）
purchaseReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId;

  const returnOrder = await queryOne<any>(
    "SELECT id, return_status, store_id FROM purchase_return WHERE return_no = ? AND tenant_id = ?",
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
    // 更新退货单状态
    await conn.execute(
      "UPDATE purchase_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE return_no = ?",
      [req.user?.id, returnNo]
    );

    // 获取明细
    const items = await conn.execute(
      "SELECT sku_id, total_bottle_qty FROM purchase_return_item WHERE return_no = ?",
      [returnNo]
    );

    const itemRows = items[0] as any[];

    // 减少库存
    for (const item of itemRows) {
      // 检查库存是否足够
      const balance = await conn.execute(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );

      const balanceRow = (balance[0] as any[])?.[0];
      const currentQty = balanceRow?.physical_qty || 0;

      if (currentQty < item.total_bottle_qty) {
        throw new Error(`库存不足: SKU ${item.sku_id} 当前库存 ${currentQty}, 退货数量 ${item.total_bottle_qty}`);
      }

      // 更新库存余额
      await conn.execute(
        `UPDATE inventory_balance
         SET physical_qty = physical_qty - ?,
             available_qty = available_qty - ?
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'`,
        [item.total_bottle_qty, item.total_bottle_qty, returnOrder.store_id, item.sku_id]
      );

      // 获取变动后库存
      const newBalance = await conn.execute(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [returnOrder.store_id, item.sku_id]
      );

      const newBalanceRow = (newBalance[0] as any[])?.[0];
      const afterQty = newBalanceRow?.physical_qty || 0;
      const beforeQty = afterQty + item.total_bottle_qty;

      // 写库存流水
      const ledgerNo = makeBizNo("LL");
      const idempotencyKey = `${returnNo}_${item.sku_id}`;

      await conn.execute(
        `INSERT INTO inventory_ledger (
          ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
          change_qty, before_qty, after_qty, operator_id, idempotency_key, remark, tenant_id
        ) VALUES (?, ?, ?, 'OFFLINE', 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ledgerNo, returnOrder.store_id, item.sku_id, returnNo,
          -item.total_bottle_qty, beforeQty, afterQty,
          req.user?.id, idempotencyKey, `采购退货出库: ${returnNo}`, tenantId
        ]
      );
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_return", "APPROVE", returnNo, "purchase_return", req.user?.id, req.user?.username, `审核通过: ${returnNo}`, tenantId]
    );
  });

  res.json(ok({ return_no: returnNo }));
}));

// 作废退货单（PENDING -> VOIDED）
purchaseReturnRouter.post("/:returnNo/void", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const tenantId = req.tenantId;

  const returnOrder = await queryOne<any>(
    "SELECT id, return_status FROM purchase_return WHERE return_no = ? AND tenant_id = ?",
    [returnNo, tenantId]
  );

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  if (returnOrder.return_status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的退货单可以作废" });
    return;
  }

  await query(
    "UPDATE purchase_return SET return_status = 'VOIDED' WHERE return_no = ?",
    [returnNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_return", "VOID", returnNo, "purchase_return", req.user?.id, req.user?.username, `作废退货单: ${returnNo}`, tenantId]
  );

  res.json(ok({ return_no: returnNo }));
}));
