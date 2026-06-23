import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchaseRouter = Router();

// 列表查询
purchaseRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplier_id, order_status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId;

  let sql = "SELECT * FROM purchase_order WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (supplier_id) {
    sql += " AND supplier_id = ?";
    params.push(Number(supplier_id));
  }

  if (order_status) {
    sql += " AND order_status = ?";
    params.push(order_status);
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

  const orders = await query<any>(sql, params);
  res.json(ok(orders));
}));

// 详情查询（含明细）
purchaseRouter.get("/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId;

  const order = await queryOne<any>(
    "SELECT * FROM purchase_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }

  const items = await query<any>(
    "SELECT * FROM purchase_order_item WHERE order_no = ? ORDER BY id ASC",
    [orderNo]
  );

  res.json(ok({ ...order, items }));
}));

// 创建采购订单
purchaseRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    supplier_id: z.number().int().positive(),
    supplier_name: z.string().min(1).max(128),
    store_id: z.number().int().positive(),
    expected_date: z.string().optional(),
    discount_amount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      sku_id: z.number().int().positive(),
      sku_name: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      box_qty: z.number().int().min(0).default(0),
      bottle_qty: z.number().int().min(0).default(0),
      unit_price: z.number().min(0),
      tax_rate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const orderNo = makeBizNo("CGDD");

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

  const payableAmount = goodsAmount + taxAmount - body.discount_amount;

  await transaction(async (conn) => {
    // 插入主表
    await conn.execute(
      `INSERT INTO purchase_order (
        order_no, supplier_id, supplier_name, store_id, order_status,
        goods_amount, tax_amount, discount_amount, payable_amount,
        paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        orderNo, body.supplier_id, body.supplier_name, body.store_id,
        goodsAmount, taxAmount, body.discount_amount, payableAmount,
        payableAmount, body.expected_date || null, req.user?.id, body.remark || null, tenantId
      ]
    );

    // 插入明细表
    for (const item of itemsWithAmount) {
      await conn.execute(
        `INSERT INTO purchase_order_item (
          order_no, sku_id, sku_name, barcode, box_qty, bottle_qty, total_bottle_qty,
          unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo, item.sku_id, item.sku_name, item.barcode || null,
          item.box_qty, item.bottle_qty, item.total_bottle_qty,
          item.unit_price, item.tax_rate, item.subtotal_amount, item.tax_amount,
          item.total_amount, item.remark || null
        ]
      );
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase", "CREATE", orderNo, "purchase_order", req.user?.id, req.user?.username, `创建采购订单: ${orderNo}`, tenantId]
    );
  });

  res.json(ok({ order_no: orderNo }));
}));

// 提交审核（DRAFT -> PENDING）
purchaseRouter.post("/:orderNo/submit", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId;

  const order = await queryOne<any>(
    "SELECT id, order_status FROM purchase_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }

  if (order.order_status !== "DRAFT") {
    res.status(400).json({ code: "400", message: "只有草稿状态的订单可以提交审核" });
    return;
  }

  await query(
    "UPDATE purchase_order SET order_status = 'PENDING' WHERE order_no = ?",
    [orderNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase", "SUBMIT", orderNo, "purchase_order", req.user?.id, req.user?.username, `提交审核: ${orderNo}`, tenantId]
  );

  res.json(ok({ order_no: orderNo }));
}));

// 审核通过（PENDING -> APPROVED）
purchaseRouter.post("/:orderNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId;

  const order = await queryOne<any>(
    "SELECT id, order_status FROM purchase_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }

  if (order.order_status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的订单可以审核" });
    return;
  }

  await query(
    "UPDATE purchase_order SET order_status = 'APPROVED', auditor_id = ?, audited_at = NOW() WHERE order_no = ?",
    [req.user?.id, orderNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase", "APPROVE", orderNo, "purchase_order", req.user?.id, req.user?.username, `审核通过: ${orderNo}`, tenantId]
  );

  res.json(ok({ order_no: orderNo }));
}));

// 取消订单（DRAFT/PENDING -> CANCELLED）
purchaseRouter.post("/:orderNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId;

  const order = await queryOne<any>(
    "SELECT id, order_status FROM purchase_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }

  if (!["DRAFT", "PENDING"].includes(order.order_status)) {
    res.status(400).json({ code: "400", message: "只有草稿或待审核状态的订单可以取消" });
    return;
  }

  await query(
    "UPDATE purchase_order SET order_status = 'CANCELLED' WHERE order_no = ?",
    [orderNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase", "CANCEL", orderNo, "purchase_order", req.user?.id, req.user?.username, `取消订单: ${orderNo}`, tenantId]
  );

  res.json(ok({ order_no: orderNo }));
}));
