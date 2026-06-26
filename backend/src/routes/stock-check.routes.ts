import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok, fail } from "../shared/response.js";
import { makeBizNo } from "../shared/id.js";

// ==================== Admin 盘点路由 ====================
export const adminStockCheckRouter = Router();

adminStockCheckRouter.use(requireAuthWithTenant);

// POST / - 创建盘点单
adminStockCheckRouter.post("/", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    storeId: z.number().int().positive(),
    remark: z.string().default("")
  }).parse(req.body);

  const checkNo = makeBizNo("PD");

  const result = await transaction(async (conn) => {
    const [insertResult] = await conn.execute(
      `INSERT INTO stock_check (check_no, store_id, status, remark, tenant_id)
       VALUES (?, ?, 'DRAFT', ?, ?)`,
      [checkNo, body.storeId, body.remark, tenantId] as any[]
    );
    return (insertResult as any).insertId;
  });

  res.json(ok({ checkId: result, checkNo }));
}));

// GET / - 盘点单列表
adminStockCheckRouter.get("/", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    storeId: z.coerce.number().optional(),
    status: z.enum(["DRAFT", "CHECKING", "COMPLETED", "CANCELLED"]).optional()
  }).parse(req.query);

  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["sc.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.storeId) {
    conditions.push("sc.store_id = ?");
    values.push(params.storeId);
  }
  if (params.status) {
    conditions.push("sc.status = ?");
    values.push(params.status);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE ${where}
     ORDER BY sc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM stock_check sc WHERE ${where}`,
    values
  );

  res.json(ok({ total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records }));
}));

// GET /statistics - 盘点统计
adminStockCheckRouter.get("/statistics", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const monthTotal = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM stock_check WHERE created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffCount = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM stock_check WHERE status = 'COMPLETED' AND diff_sku > 0 AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  const diffAmount = await queryOne<any>(
    "SELECT COALESCE(SUM(diff_amount), 0) AS total FROM stock_check WHERE status = 'COMPLETED' AND created_at >= ? AND tenant_id = ?",
    [monthStartStr, tenantId]
  );

  res.json(ok({
    monthTotal: monthTotal?.total ?? 0,
    diffCount: diffCount?.total ?? 0,
    diffAmount: Number(diffAmount?.total ?? 0)
  }));
}));

// GET /:id - 盘点单详情
adminStockCheckRouter.get("/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  const check = await queryOne<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) {
    res.status(404).json(fail("盘点单不存在"));
    return;
  }

  const items = await query<any>(
    "SELECT * FROM stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  res.json(ok({ ...check, items }));
}));

// PUT /:id - 更新盘点单(仅DRAFT)
adminStockCheckRouter.put("/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    remark: z.string().optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可编辑");

    if (body.remark !== undefined) {
      await conn.execute("UPDATE stock_check SET remark = ? WHERE id = ? AND tenant_id = ?", [body.remark, id, tenantId] as any[]);
    }
  });

  res.json(ok({ checkId: id }));
}));

// POST /:id/start - 开始盘点(自动生成明细)
adminStockCheckRouter.post("/:id/start", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT") throw new Error("仅草稿状态可开始盘点");

    // 查询该门店所有有库存的SKU+批次
    const [skuRows] = await conn.execute<any[]>(
      `SELECT ib.sku_id, ps.sku_name, ib.batch_no, ib.quantity
       FROM inventory_batch ib
       LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.store_id = ? AND ib.quantity > 0 AND ib.tenant_id = ?
       ORDER BY ib.sku_id, ib.batch_no`,
      [check.store_id, tenantId]
    );

    // 清除旧明细
    await conn.execute("DELETE FROM stock_check_item WHERE check_id = ? AND tenant_id = ?", [id, tenantId]);

    // 生成明细
    let totalSku = 0;
    for (const row of skuRows as any[]) {
      await conn.execute(
        `INSERT INTO stock_check_item (check_id, sku_id, sku_name, batch_no, system_qty, actual_qty, diff_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
        [id, row.sku_id, row.sku_name || "", row.batch_no || "", row.quantity, tenantId] as any[]
      );
      totalSku++;
    }

    // 更新盘点单状态
    await conn.execute(
      "UPDATE stock_check SET status = 'CHECKING', total_sku = ? WHERE id = ? AND tenant_id = ?",
      [totalSku, id, tenantId] as any[]
    );
  });

  res.json(ok({ checkId: id }));
}));

// POST /:id/complete - 完成盘点(计算差异汇总)
adminStockCheckRouter.post("/:id/complete", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可完成");

    // 计算差异汇总
    const [summaryRows] = await conn.execute<any[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as any[])[0];

    await conn.execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId] as any[]
    );
  });

  res.json(ok({ checkId: id }));
}));

// POST /:id/cancel - 取消盘点
adminStockCheckRouter.post("/:id/cancel", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "DRAFT" && check.status !== "CHECKING") {
      throw new Error("仅草稿或盘点中状态可取消");
    }

    await conn.execute(
      "UPDATE stock_check SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  res.json(ok({ checkId: id }));
}));

// POST /:id/handle-diff - 处理差异
adminStockCheckRouter.post("/:id/handle-diff", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    itemId: z.number().int().positive()
  }).parse(req.body);

  const userId = req.user!.id;

  await transaction(async (conn) => {
    // 锁定盘点单
    const [checkRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (checkRows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "COMPLETED") throw new Error("仅已完成状态可处理差异");

    // 锁定明细
    const [itemRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [body.itemId, id, tenantId]
    );
    const item = (itemRows as any[])[0];
    if (!item) throw new Error("明细不存在");
    if (item.handled) throw new Error("该差异已处理");
    if (item.diff_qty === 0) throw new Error("无差异需要处理");

    // 根据实际数量更新库存
    const diffQty = item.diff_qty; // actual_qty - system_qty
    const [invRows] = await conn.execute<any[]>(
      "SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND tenant_id = ? FOR UPDATE",
      [check.store_id, item.sku_id, tenantId]
    );
    const inv = (invRows as any[])[0];

    if (inv) {
      await conn.execute(
        "UPDATE inventory_balance SET available_qty = available_qty + ? WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
        [diffQty, check.store_id, item.sku_id, tenantId] as any[]
      );
    } else {
      if (diffQty > 0) {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, sku_name, available_qty, locked_qty, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [check.store_id, item.sku_id, item.sku_name, diffQty, tenantId] as any[]
        );
      }
    }

    // 记录库存流水
    const changeType = diffQty > 0 ? "STOCK_CHECK_IN" : "STOCK_CHECK_OUT";
    await conn.execute(
      `INSERT INTO inventory_ledger (store_id, sku_id, sku_name, change_type, change_qty, ref_no, operator_id, created_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [check.store_id, item.sku_id, item.sku_name, changeType, Math.abs(diffQty), check.check_no, userId ?? null, tenantId] as any[]
    );

    // 标记已处理
    await conn.execute(
      "UPDATE stock_check_item SET handled = 1 WHERE id = ? AND tenant_id = ?",
      [body.itemId, tenantId] as any[]
    );
  });

  res.json(ok({ checkId: id }));
}));

// ==================== Store 盘点路由 ====================
export const storeStockCheckRouter = Router();

// GET /my - 当前门店的盘点单列表
storeStockCheckRouter.get("/my", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId;
  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }

  const records = await query<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.store_id = ? AND sc.tenant_id = ?
     ORDER BY sc.created_at DESC`,
    [storeId, tenantId]
  );

  res.json(ok(records));
}));

// GET /:id - 盘点单详情(含明细)
storeStockCheckRouter.get("/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  const check = await queryOne<any>(
    `SELECT sc.*, s.name AS store_name
     FROM stock_check sc
     LEFT JOIN store s ON s.id = sc.store_id AND s.tenant_id = sc.tenant_id
     WHERE sc.id = ? AND sc.tenant_id = ?`,
    [id, tenantId]
  );

  if (!check) {
    res.status(404).json(fail("盘点单不存在"));
    return;
  }

  const items = await query<any>(
    "SELECT * FROM stock_check_item WHERE check_id = ? AND tenant_id = ?",
    [id, tenantId]
  );

  res.json(ok({ ...check, items }));
}));

// PUT /:id/items/:itemId - 录入实盘数量
storeStockCheckRouter.put("/:id/items/:itemId", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);
  const itemId = z.coerce.number().parse(req.params.itemId);
  const body = z.object({
    actualQty: z.number().int().min(0)
  }).parse(req.body);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可录入");

    // 获取明细
    const [itemRows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check_item WHERE id = ? AND check_id = ? AND tenant_id = ? FOR UPDATE",
      [itemId, id, tenantId]
    );
    const item = (itemRows as any[])[0];
    if (!item) throw new Error("明细不存在");

    // 获取SKU单价用于计算差异金额
    const [skuRows] = await conn.execute<any[]>(
      "SELECT cost_price FROM product_sku WHERE id = ? AND tenant_id = ?",
      [item.sku_id, tenantId]
    );
    const unitPrice = (skuRows as any[])[0]?.cost_price ?? 0;
    const diffQty = body.actualQty - item.system_qty;
    const diffAmount = Math.abs(diffQty) * Number(unitPrice);

    await conn.execute(
      "UPDATE stock_check_item SET actual_qty = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [body.actualQty, diffAmount, itemId, tenantId] as any[]
    );
  });

  res.json(ok({ checkId: id, itemId }));
}));

// POST /:id/submit - 提交盘点(门店端完成录入)
storeStockCheckRouter.post("/:id/submit", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().parse(req.params.id);

  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM stock_check WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const check = (rows as any[])[0];
    if (!check) throw new Error("盘点单不存在");
    if (check.status !== "CHECKING") throw new Error("仅盘点中状态可提交");

    // 计算差异汇总
    const [summaryRows] = await conn.execute<any[]>(
      `SELECT
         COUNT(*) AS total_sku,
         SUM(CASE WHEN diff_qty != 0 THEN 1 ELSE 0 END) AS diff_sku,
         SUM(ABS(diff_amount)) AS diff_amount
       FROM stock_check_item WHERE check_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const summary = (summaryRows as any[])[0];

    await conn.execute(
      "UPDATE stock_check SET status = 'COMPLETED', completed_at = NOW(), total_sku = ?, diff_sku = ?, diff_amount = ? WHERE id = ? AND tenant_id = ?",
      [summary.total_sku, summary.diff_sku, summary.diff_amount, id, tenantId] as any[]
    );
  });

  res.json(ok({ checkId: id }));
}));
