import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchaseInStockRouter = Router();

// 列表查询
purchaseInStockRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplier_id, stock_status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId;

  let sql = "SELECT * FROM purchase_in_stock WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (supplier_id) {
    sql += " AND supplier_id = ?";
    params.push(Number(supplier_id));
  }

  if (stock_status) {
    sql += " AND stock_status = ?";
    params.push(stock_status);
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

  const stocks = await query<any>(sql, params);
  res.json(ok(stocks));
}));

// 详情查询（含明细）
purchaseInStockRouter.get("/:stockNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { stockNo } = req.params;
  const tenantId = req.tenantId;

  const stock = await queryOne<any>(
    "SELECT * FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );

  if (!stock) {
    res.status(404).json({ code: "404", message: "入库单不存在" });
    return;
  }

  const items = await query<any>(
    "SELECT * FROM purchase_in_stock_item WHERE stock_no = ? ORDER BY id ASC",
    [stockNo]
  );

  res.json(ok({ ...stock, items }));
}));

// 创建入库单
purchaseInStockRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    order_no: z.string().max(64).optional(),
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
      batch_no: z.string().max(64).optional(),
      production_date: z.string().optional(),
      expiry_date: z.string().optional(),
      remark: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const stockNo = makeBizNo("RK");

  // 计算金额
  let goodsAmount = 0;
  let taxAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = item.box_qty * 12 + item.bottle_qty; // 假设1箱=12瓶
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

  await transaction(async (conn) => {
    // 插入主表
    await conn.execute(
      `INSERT INTO purchase_in_stock (
        stock_no, order_no, supplier_id, supplier_name, store_id, stock_status,
        goods_amount, tax_amount, total_amount, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [
        stockNo, body.order_no || null, body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, totalAmount, req.user?.id, body.remark || null, tenantId
      ]
    );

    // 插入明细表
    for (const item of itemsWithAmount) {
      await conn.execute(
        `INSERT INTO purchase_in_stock_item (
          stock_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount,
          batch_no, production_date, expiry_date, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stockNo, item.sku_id, item.sku_name,
          item.box_qty, item.bottle_qty, item.total_bottle_qty,
          item.unit_price, item.tax_rate, item.subtotal_amount, item.tax_amount, item.total_amount,
          item.batch_no || null, item.production_date || null, item.expiry_date || null, item.remark || null
        ]
      );
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_in_stock", "CREATE", stockNo, "purchase_in_stock", req.user?.id, req.user?.username, `创建入库单: ${stockNo}`, tenantId]
    );
  });

  res.json(ok({ stock_no: stockNo }));
}));

// 审核通过（PENDING -> COMPLETED）
purchaseInStockRouter.post("/:stockNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { stockNo } = req.params;
  const tenantId = req.tenantId;

  const stock = await queryOne<any>(
    "SELECT id, stock_status, store_id FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );

  if (!stock) {
    res.status(404).json({ code: "404", message: "入库单不存在" });
    return;
  }

  if (stock.stock_status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的入库单可以审核" });
    return;
  }

  await transaction(async (conn) => {
    // 更新入库单状态
    await conn.execute(
      "UPDATE purchase_in_stock SET stock_status = 'COMPLETED', auditor_id = ?, audited_at = NOW() WHERE stock_no = ?",
      [req.user?.id, stockNo]
    );

    // 获取明细
    const items = await conn.execute(
      "SELECT sku_id, total_bottle_qty, batch_no, production_date, expiry_date FROM purchase_in_stock_item WHERE stock_no = ?",
      [stockNo]
    );

    const itemRows = items[0] as any[];

    // 增加库存
    for (const item of itemRows) {
      // 更新库存余额
      await conn.execute(
        `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE
           physical_qty = physical_qty + ?,
           available_qty = available_qty + ?`,
        [
          stock.store_id, item.sku_id, item.total_bottle_qty, item.total_bottle_qty, tenantId,
          item.total_bottle_qty, item.total_bottle_qty
        ]
      );

      // 获取当前库存（用于写流水）
      const balance = await conn.execute(
        "SELECT physical_qty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'",
        [stock.store_id, item.sku_id]
      );

      const balanceRow = (balance[0] as any[])?.[0];
      const afterQty = balanceRow?.physical_qty || 0;
      const beforeQty = afterQty - item.total_bottle_qty;

      // 写库存流水
      const ledgerNo = makeBizNo("LL");
      const idempotencyKey = `${stockNo}_${item.sku_id}`;

      await conn.execute(
        `INSERT INTO inventory_ledger (
          ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
          change_qty, before_qty, after_qty, operator_id, idempotency_key, remark, tenant_id
        ) VALUES (?, ?, ?, 'OFFLINE', 'PURCHASE_IN', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ledgerNo, stock.store_id, item.sku_id, stockNo,
          item.total_bottle_qty, beforeQty, afterQty,
          req.user?.id, idempotencyKey, `采购入库: ${stockNo}`, tenantId
        ]
      );

      // 如果有批次信息，写入批次表
      if (item.batch_no) {
        await conn.execute(
          `INSERT INTO inventory_batch (
            store_id, sku_id, batch_no, quantity, locked_quantity,
            production_date, expiry_date, supplier_id, inbound_order_id, tenant_id
          ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
          [
            stock.store_id, item.sku_id, item.batch_no, item.total_bottle_qty,
            item.production_date || null, item.expiry_date || null,
            null, null, tenantId
          ]
        );
      }
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_in_stock", "APPROVE", stockNo, "purchase_in_stock", req.user?.id, req.user?.username, `审核通过: ${stockNo}`, tenantId]
    );
  });

  res.json(ok({ stock_no: stockNo }));
}));

// 作废入库单（PENDING -> VOIDED）
purchaseInStockRouter.post("/:stockNo/void", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { stockNo } = req.params;
  const tenantId = req.tenantId;

  const stock = await queryOne<any>(
    "SELECT id, stock_status FROM purchase_in_stock WHERE stock_no = ? AND tenant_id = ?",
    [stockNo, tenantId]
  );

  if (!stock) {
    res.status(404).json({ code: "404", message: "入库单不存在" });
    return;
  }

  if (stock.stock_status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的入库单可以作废" });
    return;
  }

  await query(
    "UPDATE purchase_in_stock SET stock_status = 'VOIDED' WHERE stock_no = ?",
    [stockNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_in_stock", "VOID", stockNo, "purchase_in_stock", req.user?.id, req.user?.username, `作废入库单: ${stockNo}`, tenantId]
  );

  res.json(ok({ stock_no: stockNo }));
}));
