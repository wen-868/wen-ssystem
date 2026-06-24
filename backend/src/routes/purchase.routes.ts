import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchaseRouter = Router();

purchaseRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplierId, orderStatus, startDate, endDate, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = `SELECT 
    id,
    order_no AS orderNo,
    supplier_id AS supplierId,
    supplier_name AS supplierName,
    store_id AS storeId,
    order_status AS orderStatus,
    goods_amount AS goodsAmount,
    tax_amount AS taxAmount,
    discount_amount AS discountAmount,
    payable_amount AS payableAmount,
    paid_amount AS paidAmount,
    unpaid_amount AS unpaidAmount,
    expected_date AS expectedDate,
    operator_id AS operatorId,
    auditor_id AS auditorId,
    audited_at AS auditedAt,
    remark,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM purchase_order WHERE tenant_id = ?`;
  const params: any[] = [tenantId];

  if (supplierId) {
    sql += " AND supplier_id = ?";
    params.push(Number(supplierId));
  }

  if (orderStatus) {
    sql += " AND order_status = ?";
    params.push(orderStatus);
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

  const orders = await query<any>(sql, params);
  res.json(ok(orders));
}));

purchaseRouter.get("/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId!;

  const order = await queryOne<any>(
    `SELECT 
      id,
      order_no AS orderNo,
      supplier_id AS supplierId,
      supplier_name AS supplierName,
      store_id AS storeId,
      order_status AS orderStatus,
      goods_amount AS goodsAmount,
      tax_amount AS taxAmount,
      discount_amount AS discountAmount,
      payable_amount AS payableAmount,
      paid_amount AS paidAmount,
      unpaid_amount AS unpaidAmount,
      expected_date AS expectedDate,
      operator_id AS operatorId,
      auditor_id AS auditorId,
      audited_at AS auditedAt,
      remark,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM purchase_order WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }

  const items = await query<any>(
    `SELECT 
      id,
      order_no AS orderNo,
      sku_id AS skuId,
      sku_name AS skuName,
      barcode,
      box_qty AS boxQty,
      bottle_qty AS bottleQty,
      total_bottle_qty AS totalBottleQty,
      unit_price AS unitPrice,
      tax_rate AS taxRate,
      subtotal_amount AS subtotalAmount,
      tax_amount AS taxAmount,
      total_amount AS totalAmount,
      remark
    FROM purchase_order_item WHERE order_no = ? ORDER BY id ASC`,
    [orderNo]
  );

  res.json(ok({ ...order, items }));
}));

purchaseRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    supplierId: z.number().int().positive(),
    supplierName: z.string().min(1).max(128),
    storeId: z.number().int().positive(),
    expectedDate: z.string().optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const orderNo = makeBizNo("CGDD");

  let goodsAmount = 0;
  let taxAmount = 0;

  const itemsWithAmount = body.items.map(item => {
    const totalBottleQty = item.boxQty * 12 + item.bottleQty;
    const subtotalAmount = totalBottleQty * item.unitPrice;
    const itemTaxAmount = subtotalAmount * item.taxRate;
    const totalAmount = subtotalAmount + itemTaxAmount;

    goodsAmount += subtotalAmount;
    taxAmount += itemTaxAmount;

    return {
      ...item,
      totalBottleQty,
      subtotalAmount,
      taxAmount: itemTaxAmount,
      totalAmount,
    };
  });

  const payableAmount = goodsAmount + taxAmount - body.discountAmount;

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO purchase_order (
        order_no, supplier_id, supplier_name, store_id, order_status,
        goods_amount, tax_amount, discount_amount, payable_amount,
        paid_amount, unpaid_amount, expected_date, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        orderNo, body.supplierId, body.supplierName, body.storeId,
        goodsAmount, taxAmount, body.discountAmount, payableAmount,
        payableAmount, body.expectedDate || null, req.user!.id, body.remark || null, tenantId
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
          item.unitPrice, item.taxRate, item.subtotalAmount, item.taxAmount,
          item.totalAmount, item.remark || null
        ]
      );
    }

    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase", "CREATE", orderNo, "purchase_order", req.user!.id, req.user!.username, `创建采购订单: ${orderNo}`, tenantId]
    );
  });

  res.json(ok({ orderNo }));
}));

purchaseRouter.post("/:orderNo/submit", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId!;

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
    ["purchase", "SUBMIT", orderNo, "purchase_order", req.user!.id, req.user!.username, `提交审核: ${orderNo}`, tenantId]
  );

  res.json(ok({ orderNo }));
}));

purchaseRouter.post("/:orderNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId!;

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
    [req.user!.id, orderNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase", "APPROVE", orderNo, "purchase_order", req.user!.id, req.user!.username, `审核通过: ${orderNo}`, tenantId]
  );

  res.json(ok({ orderNo }));
}));

purchaseRouter.post("/:orderNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const tenantId = req.tenantId!;

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
    ["purchase", "CANCEL", orderNo, "purchase_order", req.user!.id, req.user!.username, `取消订单: ${orderNo}`, tenantId]
  );

  res.json(ok({ orderNo }));
}));
