import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok, fail } from "../shared/response.js";
import { makeBizNo } from "../shared/id.js";

// ==================== Admin 调拨路由 ====================
export const adminTransferRouter = Router();

adminTransferRouter.use(requireAuthWithTenant);

// POST / - 创建调拨单
adminTransferRouter.post("/", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    fromStoreId: z.number().int().positive(),
    toStoreId: z.number().int().positive(),
    expectedDate: z.string().optional(),
    remark: z.string().default(""),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative()
    })).min(1)
  }).parse(req.body);

  if (body.fromStoreId === body.toStoreId) {
    res.status(400).json(fail("调出门店和调入门店不能相同"));
    return;
  }

  const userId = req.user!.id;
  const transferNo = makeBizNo("DB");

  const result = await transaction(async (conn) => {
    // 计算总金额和总数量
    let totalAmount = 0;
    let totalItems = body.items.length;
    for (const item of body.items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO transfer_order (transfer_no, from_store_id, to_store_id, status, expected_date, total_amount, total_items, remark, created_by, tenant_id)
       VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
      [transferNo, body.fromStoreId, body.toStoreId, body.expectedDate ?? null, totalAmount, totalItems, body.remark, userId ?? null, tenantId] as any[]
    );
    const orderId = (insertResult as any).insertId;

    for (const item of body.items) {
      const subtotal = item.quantity * item.unitPrice;
      await conn.execute(
        `INSERT INTO transfer_order_item (transfer_order_id, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId] as any[]
      );
    }

    return orderId;
  });

  res.json(ok({ transferOrderId: result, transferNo }));
}));

// GET / - 调拨单列表
adminTransferRouter.get("/", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    status: z.enum(["DRAFT", "PENDING", "APPROVED", "TRANSIT", "RECEIVED", "CANCELLED"]).optional(),
    storeId: z.coerce.number().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional()
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["to.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.status) {
    conditions.push("to.status = ?");
    values.push(params.status);
  }
  if (params.storeId) {
    conditions.push("(to.from_store_id = ? OR to.to_store_id = ?)");
    values.push(params.storeId, params.storeId);
  }
  if (params.dateStart) {
    conditions.push("to.created_at >= ?");
    values.push(params.dateStart);
  }
  if (params.dateEnd) {
    conditions.push("to.created_at <= ?");
    values.push(params.dateEnd + " 23:59:59");
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE ${where}
     ORDER BY to.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM transfer_order to WHERE ${where}`,
    values
  );

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records }));
}));

// GET /statistics - 调拨统计
adminTransferRouter.get("/statistics", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotal = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const transitCount = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE status = 'TRANSIT' AND tenant_id = ?",
    [tenantId]
  );

  const receivedCount = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM transfer_order WHERE status = 'RECEIVED' AND tenant_id = ?",
    [tenantId]
  );

  res.json(ok({
    monthTotal: monthTotal?.total ?? 0,
    transitCount: transitCount?.total ?? 0,
    receivedCount: receivedCount?.total ?? 0
  }));
}));

// GET /:id - 调拨单详情
adminTransferRouter.get("/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  const order = await queryOne<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.id = ? AND to.tenant_id = ?`,
    [id, tenantId]
  );

  if (!order) {
    res.status(404).json(fail("调拨单不存在"));
    return;
  }

  const items = await query<any>(
    "SELECT * FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  res.json(ok({ ...order, items }));
}));

// PUT /:id - 更新调拨单(仅DRAFT)
adminTransferRouter.put("/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    expectedDate: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative()
    })).optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.expectedDate !== undefined) { sets.push("expected_date = ?"); values.push(body.expectedDate); }
    if (body.remark !== undefined) { sets.push("remark = ?"); values.push(body.remark); }
    if (sets.length > 0) {
      values.push(id, tenantId);
      await conn.execute(`UPDATE transfer_order SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values as any[]);
    }

    // 如果传了items，替换明细
    if (body.items && body.items.length > 0) {
      await conn.execute("DELETE FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?", [id, tenantId]);
      let totalAmount = 0;
      for (const item of body.items) {
        const subtotal = item.quantity * item.unitPrice;
        totalAmount += subtotal;
        await conn.execute(
          `INSERT INTO transfer_order_item (transfer_order_id, sku_id, sku_name, quantity, unit_price, subtotal, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, item.skuId, item.skuName, item.quantity, item.unitPrice, subtotal, tenantId] as any[]
        );
      }
      await conn.execute("UPDATE transfer_order SET total_amount = ?, total_items = ? WHERE id = ? AND tenant_id = ?", [totalAmount, body.items.length, id, tenantId] as any[]);
    }
  });

  res.json(ok({ transferOrderId: id }));
}));

// POST /:id/submit - 提交审核
adminTransferRouter.post("/:id/submit", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT") throw new Error("仅草稿状态可提交");

    await conn.execute(
      "UPDATE transfer_order SET status = 'PENDING' WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  res.json(ok({ transferOrderId: id }));
}));

// POST /:id/approve - 审核通过
adminTransferRouter.post("/:id/approve", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const userId = req.user!.id;

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "PENDING") throw new Error("仅待审核状态可审批");

    await conn.execute(
      "UPDATE transfer_order SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ? AND tenant_id = ?",
      [userId ?? null, id, tenantId] as any[]
    );
  });

  res.json(ok({ transferOrderId: id }));
}));

// POST /:id/reject - 审核拒绝(退回DRAFT)
adminTransferRouter.post("/:id/reject", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "PENDING") throw new Error("仅待审核状态可拒绝");

    await conn.execute(
      "UPDATE transfer_order SET status = 'DRAFT', approved_by = NULL, approved_at = NULL WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  res.json(ok({ transferOrderId: id }));
}));

// POST /:id/cancel - 取消
adminTransferRouter.post("/:id/cancel", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "DRAFT" && order.status !== "PENDING") {
      throw new Error("仅草稿或待审核状态可取消");
    }

    await conn.execute(
      "UPDATE transfer_order SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  res.json(ok({ transferOrderId: id }));
}));

// POST /:id/ship - 发货出库
adminTransferRouter.post("/:id/ship", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const userId = req.user!.id;

  await transaction(async (conn) => {
    // 锁定调拨单
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "APPROVED") throw new Error("仅已审核状态可发货");

    // 获取明细
    const [itemRows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const items = itemRows as any[];

    // 逐项锁定库存并扣减
    for (const item of items) {
      const shipQty = item.quantity - item.transferred_qty;
      if (shipQty <= 0) continue;

      // 锁定调出门店库存
      const [invRows] = await conn.execute<any[]>(
        "SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.from_store_id, item.sku_id, tenantId]
      );
      const inv = (invRows as any[])[0];
      if (!inv || Number(inv.available_qty) < shipQty) {
        throw new Error(`SKU ${item.sku_name} 库存不足，可用 ${inv?.available_qty ?? 0}，需要 ${shipQty}`);
      }

      // 扣减库存
      await conn.execute(
        "UPDATE inventory_balance SET available_qty = available_qty - ?, locked_qty = locked_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [shipQty, shipQty, order.from_store_id, item.sku_id, tenantId] as any[]
      );

      // 记录库存流水
      await conn.execute(
        `INSERT INTO inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_OUT', ?, available_qty, available_qty - ?, ?, ?, NOW(), ?
         FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.from_store_id, item.sku_id, item.sku_name, shipQty, shipQty, order.transfer_no, userId ?? null, tenantId, order.from_store_id, item.sku_id, tenantId] as any[]
      );

      // 更新明细已发货数量
      await conn.execute(
        "UPDATE transfer_order_item SET transferred_qty = transferred_qty + ? WHERE id = ? AND tenant_id = ?",
        [shipQty, item.id, tenantId] as any[]
      );

      // 记录调拨出库日志
      await conn.execute(
        `INSERT INTO transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'OUT', ?, ?, ?)`,
        [id, item.id, order.from_store_id, item.sku_id, shipQty, userId ?? null, tenantId] as any[]
      );
    }

    // 更新调拨单状态为在途
    await conn.execute(
      "UPDATE transfer_order SET status = 'TRANSIT' WHERE id = ? AND tenant_id = ?",
      [id, tenantId] as any[]
    );
  });

  res.json(ok({ transferOrderId: id }));
}));

// ==================== Store 调拨路由 ====================
export const storeTransferRouter = Router();

// POST /:id/receive - 收货入库
storeTransferRouter.post("/:id/receive", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    items: z.array(z.object({
      itemId: z.number().int().positive(),
      receivedQty: z.number().int().min(0)
    })).min(1)
  }).parse(req.body);

  const userId = req.user!.id;

  await transaction(async (conn) => {
    // 锁定调拨单
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM transfer_order WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const order = (rows as any[])[0];
    if (!order) throw new Error("调拨单不存在");
    if (order.status !== "TRANSIT") throw new Error("仅在途状态可收货");

    let allReceived = true;

    for (const item of body.items) {
      // 获取明细并锁定
      const [itemRows] = await conn.execute<any[]>(
        "SELECT * FROM transfer_order_item WHERE id = ? AND transfer_order_id = ? AND tenant_id = ? FOR UPDATE",
        [item.itemId, id, tenantId]
      );
      const detail = (itemRows as any[])[0];
      if (!detail) throw new Error("明细不存在");

      const remaining = detail.quantity - detail.received_qty;
      if (item.receivedQty > remaining) {
        throw new Error(`SKU ${detail.sku_name} 收货数量超出待收数量(剩余 ${remaining})`);
      }

      // 增加调入门店库存
      // 先检查库存记录是否存在
      const [invRows] = await conn.execute<any[]>(
        "SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
        [order.to_store_id, detail.sku_id, tenantId]
      );
      const inv = (invRows as any[])[0];

      if (inv) {
        await conn.execute(
          "UPDATE inventory_balance SET available_qty = available_qty + ?, locked_qty = GREATEST(locked_qty - ?, 0) WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
          [item.receivedQty, item.receivedQty, order.to_store_id, detail.sku_id, tenantId] as any[]
        );
      } else {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, tenantId] as any[]
        );
      }

      // 记录库存流水
      await conn.execute(
        `INSERT INTO inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, before_qty, after_qty, ref_no, operator_id, created_at, tenant_id)
         SELECT ?, ?, ?, 'TRANSFER_IN', ?, available_qty - ?, available_qty, ?, ?, NOW(), ?
         FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [order.to_store_id, detail.sku_id, detail.sku_name, item.receivedQty, item.receivedQty, order.transfer_no, userId ?? null, tenantId, order.to_store_id, detail.sku_id, tenantId] as any[]
      );

      // 更新明细已收货数量
      await conn.execute(
        "UPDATE transfer_order_item SET received_qty = received_qty + ? WHERE id = ? AND tenant_id = ?",
        [item.receivedQty, item.itemId, tenantId] as any[]
      );

      // 记录调拨入库日志
      await conn.execute(
        `INSERT INTO transfer_stock_log (transfer_order_id, item_id, store_id, sku_id, direction, quantity, operator_id, tenant_id)
         VALUES (?, ?, ?, ?, 'IN', ?, ?, ?)`,
        [id, item.itemId, order.to_store_id, detail.sku_id, item.receivedQty, userId ?? null, tenantId] as any[]
      );

      // 检查是否全部收齐
      const [checkRows] = await conn.execute<any[]>(
        "SELECT received_qty, quantity FROM transfer_order_item WHERE transfer_order_id = ? AND tenant_id = ?",
        [id, tenantId]
      );
      for (const row of checkRows as any[]) {
        if (row.received_qty < row.quantity) {
          allReceived = false;
          break;
        }
      }
    }

    // 如果全部收齐，自动完成
    if (allReceived) {
      await conn.execute(
        "UPDATE transfer_order SET status = 'RECEIVED', actual_date = CURDATE(), received_by = ?, received_at = NOW() WHERE id = ? AND tenant_id = ?",
        [userId ?? null, id, tenantId] as any[]
      );
    }
  });

  res.json(ok({ transferOrderId: id }));
}));

// GET /in-transit - 当前门店在途调拨单(作为调入方)
storeTransferRouter.get("/in-transit", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId;
  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }

  const records = await query<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.to_store_id = ? AND to.tenant_id = ? AND to.status IN ('APPROVED', 'TRANSIT')
     ORDER BY to.created_at DESC`,
    [storeId, tenantId]
  );

  res.json(ok(records));
}));

// GET /my-shipments - 当前门店已发货调拨单(作为调出方)
storeTransferRouter.get("/my-shipments", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId;
  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }

  const records = await query<any>(
    `SELECT to.*, fs.name AS from_store_name, ts.name AS to_store_name
     FROM transfer_order to
     LEFT JOIN store fs ON fs.id = to.from_store_id AND fs.tenant_id = to.tenant_id
     LEFT JOIN store ts ON ts.id = to.to_store_id AND ts.tenant_id = to.tenant_id
     WHERE to.from_store_id = ? AND to.tenant_id = ? AND to.status IN ('TRANSIT', 'RECEIVED')
     ORDER BY to.created_at DESC`,
    [storeId, tenantId]
  );

  res.json(ok(records));
}));
