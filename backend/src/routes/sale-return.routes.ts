import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuth } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const saleReturnRouter = Router();

saleReturnRouter.use(requireAuth);

// GET /api/store/sale-returns - 列表
saleReturnRouter.get("/", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = String(req.query.keyword || "");
  const status = req.query.status ? String(req.query.status) : null;
  const storeId = req.user?.storeId ?? null;

  let sql = `SELECT id, return_no AS returnNo, source_bill_no AS sourceBillNo,
                    store_id AS storeId, customer_id AS customerId,
                    customer_name AS customerName, customer_mobile AS customerMobile,
                    return_status AS returnStatus, goods_amount AS goodsAmount,
                    discount_amount AS discountAmount, refund_amount AS refundAmount,
                    refunded_amount AS refundedAmount, refund_method AS refundMethod,
                    operator_id AS operatorId, auditor_id AS auditorId,
                    audited_at AS auditedAt, remark,
                    created_at AS createdAt, updated_at AS updatedAt
             FROM sale_return WHERE 1=1`;
  const params: unknown[] = [];

  if (storeId) {
    sql += ` AND store_id = ?`;
    params.push(storeId);
  }
  if (keyword) {
    sql += ` AND (return_no LIKE ? OR customer_name LIKE ? OR source_bill_no LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    sql += ` AND return_status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const records = await query<any>(sql, params);

  let countSql = `SELECT COUNT(*) AS total FROM sale_return WHERE 1=1`;
  const countParams: unknown[] = [];
  if (storeId) countSql += ` AND store_id = ?`, countParams.push(storeId);
  if (keyword) {
    countSql += ` AND (return_no LIKE ? OR customer_name LIKE ? OR source_bill_no LIKE ?)`;
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) countSql += ` AND return_status = ?`, countParams.push(status);

  const totalRow = await queryOne<any>(countSql, countParams);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/store/sale-returns - 创建
saleReturnRouter.post("/", asyncHandler(async (req, res) => {
  const body = z.object({
    sourceBillNo: z.string().optional(),
    customerId: z.number().nullable().optional(),
    customerName: z.string().optional(),
    customerMobile: z.string().optional(),
    discountAmount: z.number().default(0),
    refundMethod: z.enum(["CASH", "WECHAT", "BANK"]).optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number().positive(),
      skuName: z.string().optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      reason: z.string().optional()
    })).min(1)
  }).parse(req.body);

  const storeId = req.user?.storeId ?? 1;

  const result = await transaction(async (conn) => {
    // 如果关联销售单，带出客户信息
    let customerName = body.customerName ?? null;
    let customerId = body.customerId ?? null;
    let customerMobile = body.customerMobile ?? null;
    let resolvedItems = body.items;

    if (body.sourceBillNo) {
      const bill = await queryOne<any>(
        `SELECT bill_no, customer_id, customer_name, customer_mobile FROM sale_bill WHERE bill_no = ?`,
        [body.sourceBillNo]
      );
      if (!bill) throw new Error("关联销售单不存在");
      customerId = bill.customer_id;
      customerName = bill.customer_name;
      customerMobile = bill.customer_mobile;

      // 自动带出商品（如果 items 只有 skuId 没有 skuName）
      const billItems = await query<any>(
        `SELECT sku_id, sku_name, unit_price FROM sale_bill_item WHERE bill_no = ?`,
        [body.sourceBillNo]
      );
      const billItemMap = new Map<string, any>(billItems.map((i: any) => [i.sku_id, i]));
      resolvedItems = body.items.map((item: any) => {
        const bi = billItemMap.get(String(item.skuId));
        return {
          ...item,
          skuName: item.skuName ?? bi?.sku_name,
          unitPrice: item.unitPrice ?? Number(bi?.unit_price ?? 0)
        };
      });
    }

    const returnNo = makeBizNo("TH");
    let goodsAmount = 0;
    const itemSnapshots: Array<{
      skuId: number;
      skuName: string;
      boxQty: number;
      bottleQty: number;
      totalBottleQty: number;
      unitPrice: number;
      subtotalAmount: number;
      reason?: string;
    }> = [];

    for (const item of resolvedItems) {
      // 获取 SKU 名称
      let skuName: string = item.skuName ?? "";
      if (!skuName) {
        const sku = await queryOne<any>("SELECT sku_name FROM product_sku WHERE id = ?", [item.skuId]);
        if (!sku) throw new Error(`SKU不存在：${item.skuId}`);
        skuName = sku.sku_name;
      }
      const totalBottleQty = item.boxQty * 12 + item.bottleQty;
      const subtotalAmount = Number((item.unitPrice * totalBottleQty).toFixed(2));
      goodsAmount += subtotalAmount;
      itemSnapshots.push({
        skuId: item.skuId,
        skuName,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        totalBottleQty,
        unitPrice: item.unitPrice,
        subtotalAmount,
        reason: item.reason
      });
    }

    const refundAmount = Number((goodsAmount - body.discountAmount).toFixed(2));

    await conn.execute(
      `INSERT INTO sale_return (return_no, source_bill_no, store_id, customer_id, customer_name,
                                customer_mobile, return_status, goods_amount, discount_amount,
                                refund_amount, refunded_amount, refund_method, operator_id, remark)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?)`,
      [
        returnNo, body.sourceBillNo ?? null, storeId, customerId, customerName,
        customerMobile, goodsAmount, body.discountAmount, refundAmount,
        body.refundMethod ?? null, req.user?.id ?? 0, body.remark ?? null
      ]
    );

    for (const item of itemSnapshots) {
      await conn.execute(
        `INSERT INTO sale_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty,
                                       total_bottle_qty, unit_price, subtotal_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.skuId, item.skuName, item.boxQty, item.bottleQty,
         item.totalBottleQty, item.unitPrice, item.subtotalAmount, item.reason ?? null]
      );
    }

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'SALE_RETURN', 'CREATE', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", returnNo, JSON.stringify({ returnNo, sourceBillNo: body.sourceBillNo })]
    );

    return {
      returnNo,
      sourceBillNo: body.sourceBillNo ?? null,
      storeId,
      customerId,
      customerName,
      returnStatus: "PENDING",
      goodsAmount,
      discountAmount: body.discountAmount,
      refundAmount,
      refundedAmount: 0,
      items: itemSnapshots
    };
  });

  res.json(ok(result));
}));

// GET /api/store/sale-returns/:returnNo - 详情
saleReturnRouter.get("/:returnNo", asyncHandler(async (req, res) => {
  const ret = await queryOne<any>(
    `SELECT id, return_no AS returnNo, source_bill_no AS sourceBillNo,
            store_id AS storeId, customer_id AS customerId,
            customer_name AS customerName, customer_mobile AS customerMobile,
            return_status AS returnStatus, goods_amount AS goodsAmount,
            discount_amount AS discountAmount, refund_amount AS refundAmount,
            refunded_amount AS refundedAmount, refund_method AS refundMethod,
            operator_id AS operatorId, auditor_id AS auditorId,
            audited_at AS auditedAt, remark,
            created_at AS createdAt, updated_at AS updatedAt
     FROM sale_return WHERE return_no = ?`,
    [req.params.returnNo]
  );
  if (!ret) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT id, sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty,
            bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount, reason
     FROM sale_return_item WHERE return_no = ?`,
    [req.params.returnNo]
  );
  res.json(ok({ ...ret, items }));
}));

// POST /api/store/sale-returns/:returnNo/approve - 审核（审核后增加库存，写台账）
saleReturnRouter.post("/:returnNo/approve", asyncHandler(async (req, res) => {
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT return_no, store_id, return_status FROM sale_return WHERE return_no = ? FOR UPDATE`,
      [req.params.returnNo]
    );
    const ret = rows[0];
    if (!ret) throw new Error("退货单不存在");
    if (ret.return_status !== "PENDING") throw new Error("退货单状态不是待审核");

    await conn.execute(
      `UPDATE sale_return SET return_status = 'COMPLETED', auditor_id = ?, audited_at = NOW(), updated_at = NOW()
       WHERE return_no = ?`,
      [req.user?.id ?? null, req.params.returnNo]
    );

    // 增加库存
    const [items] = await conn.query<any[]>(
      `SELECT sku_id, sku_name, total_bottle_qty, unit_price, subtotal_amount
       FROM sale_return_item WHERE return_no = ?`,
      [req.params.returnNo]
    );
    for (const item of items) {
      const qty = Number(item.total_bottle_qty ?? 0);
      if (qty <= 0) continue;

      // 更新库存余额（先查是否存在）
      const [existing] = await conn.query<any[]>(
        `SELECT physical_qty, available_qty FROM inventory_balance
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' FOR UPDATE`,
        [ret.store_id, item.sku_id]
      );
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, available_qty, locked_qty, updated_at)
           VALUES (?, ?, 'OFFLINE', ?, ?, 0, NOW())`,
          [ret.store_id, item.sku_id, qty, qty]
        );
      } else {
        await conn.execute(
          `UPDATE inventory_balance
           SET physical_qty = physical_qty + ?, available_qty = available_qty + ?, updated_at = NOW()
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'`,
          [qty, qty, ret.store_id, item.sku_id]
        );
      }

      // 写台账
      const beforeQty = Number(existing[0]?.available_qty ?? 0);
      await conn.execute(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                       change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                       operator_id, idempotency_key, remark)
         VALUES (?, ?, ?, 'OFFLINE', 'SALE_RETURN_IN', ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
        [
          makeBizNo("IL"), ret.store_id, item.sku_id, req.params.returnNo,
          qty, beforeQty, beforeQty + qty,
          req.user?.id ?? null,
          `SALE_RETURN_IN:${req.params.returnNo}:${item.sku_id}`,
          "销售退货入库"
        ]
      );
    }

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'SALE_RETURN', 'APPROVE', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", req.params.returnNo, JSON.stringify({ status: "COMPLETED" })]
    );

    return { returnNo: req.params.returnNo, returnStatus: "COMPLETED" };
  });
  res.json(ok(result));
}));

// POST /api/store/sale-returns/:returnNo/refund - 确认退款
saleReturnRouter.post("/:returnNo/refund", asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    refundMethod: z.enum(["CASH", "WECHAT", "BANK"]).default("CASH"),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT return_no, refund_amount, refunded_amount, return_status FROM sale_return WHERE return_no = ? FOR UPDATE`,
      [req.params.returnNo]
    );
    const ret = rows[0];
    if (!ret) throw new Error("退货单不存在");
    if (ret.return_status !== "COMPLETED") throw new Error("退货单未审核，无法退款");

    const refundedAmount = Number(ret.refunded_amount) + body.amount;
    const totalRefund = Number(ret.refund_amount);
    if (refundedAmount > totalRefund + 0.01) throw new Error("退款金额超过应退金额");

    await conn.execute(
      `UPDATE sale_return SET refunded_amount = ?, refund_method = ?, updated_at = NOW()
       WHERE return_no = ?`,
      [refundedAmount, body.refundMethod, req.params.returnNo]
    );

    // 写收款单
    const receiptNo = makeBizNo("SP");
    await conn.execute(
      `INSERT INTO sale_payment (receipt_no, source_type, source_no, amount, payment_method,
                                 payment_date, operator_id, status, remark)
       VALUES (?, 'SALE_RETURN', ?, ?, ?, CURDATE(), ?, 'COMPLETED', ?)`,
      [receiptNo, req.params.returnNo, body.amount, body.refundMethod, req.user?.id ?? 0, body.remark ?? null]
    );

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'SALE_RETURN', 'REFUND', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", req.params.returnNo, JSON.stringify({ amount: body.amount, refundedAmount })]
    );

    return { returnNo: req.params.returnNo, refundedAmount, refundMethod: body.refundMethod };
  });
  res.json(ok(result));
}));
