import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const priceRouter = Router();

// ========== 价格等级管理 ==========

// 获取所有价格等级列表
priceRouter.get("/levels", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM price_level
     ORDER BY sort_order ASC, id ASC`
  );
  res.json(ok({ total: records.length, records }));
}));

// 创建价格等级
priceRouter.post("/levels", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    levelCode: z.string().min(1).max(32),
    levelName: z.string().min(1).max(64),
    discountRate: z.number().min(0).max(1.9999).default(1.0),
    minOrderAmount: z.number().min(0).default(0),
    description: z.string().max(255).default(""),
    sortOrder: z.number().int().default(0)
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM price_level WHERE level_code = ?",
    [body.levelCode]
  );
  if (existing) {
    res.status(400).json({ code: "400", message: "等级编码已存在" });
    return;
  }

  await query(
    `INSERT INTO price_level (level_code, level_name, discount_rate, min_order_amount, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [body.levelCode, body.levelName, body.discountRate, body.minOrderAmount, body.description, body.sortOrder]
  );

  const record = await queryOne<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt
     FROM price_level WHERE level_code = ?`,
    [body.levelCode]
  );

  res.json(ok(record));
}));

// 编辑价格等级
priceRouter.put("/levels/:id", requireAuth, asyncHandler(async (req, res) => {
  const levelId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM price_level WHERE id = ?",
    [levelId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "价格等级不存在" });
    return;
  }

  const body = z.object({
    levelName: z.string().min(1).max(64).optional(),
    discountRate: z.number().min(0).max(1.9999).optional(),
    minOrderAmount: z.number().min(0).optional(),
    description: z.string().max(255).optional(),
    sortOrder: z.number().int().optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.levelName !== undefined) { updates.push("level_name = ?"); params.push(body.levelName); }
  if (body.discountRate !== undefined) { updates.push("discount_rate = ?"); params.push(body.discountRate); }
  if (body.minOrderAmount !== undefined) { updates.push("min_order_amount = ?"); params.push(body.minOrderAmount); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }
  if (body.sortOrder !== undefined) { updates.push("sort_order = ?"); params.push(body.sortOrder); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await query(
      `UPDATE price_level SET ${updates.join(", ")} WHERE id = ?`,
      [...params, levelId]
    );
  }

  const record = await queryOne<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM price_level WHERE id = ?`,
    [levelId]
  );

  res.json(ok(record));
}));

// 停用价格等级（软删除）
priceRouter.delete("/levels/:id", requireAuth, asyncHandler(async (req, res) => {
  const levelId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id, level_code FROM price_level WHERE id = ?",
    [levelId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "价格等级不存在" });
    return;
  }
  if (existing.levelCode === "RETAIL") {
    res.status(400).json({ code: "400", message: "零售价等级不可停用" });
    return;
  }

  await query(
    "UPDATE price_level SET status = 0 WHERE id = ?",
    [levelId]
  );

  res.json(ok({ levelId, status: "disabled" }));
}));

// ========== 阶梯价格管理 ==========

// 获取SKU的所有阶梯价格
priceRouter.get("/skus/:skuId/prices", requireAuth, asyncHandler(async (req, res) => {
  const skuId = Number(req.params.skuId);
  const records = await query<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id
     WHERE sp.sku_id = ?
     ORDER BY pl.sort_order ASC, sp.min_qty ASC`,
    [skuId]
  );
  res.json(ok({ total: records.length, records }));
}));

// 设置SKU阶梯价格（批量，事务）
priceRouter.post("/skus/:skuId/prices", requireAuth, asyncHandler(async (req, res) => {
  const skuId = Number(req.params.skuId);

  const body = z.object({
    prices: z.array(z.object({
      priceLevelId: z.number().int().positive(),
      minQty: z.number().int().min(1).default(1),
      price: z.number().min(0),
      costPrice: z.number().min(0).default(0),
      suggestedRetailPrice: z.number().min(0).default(0),
      effectiveStart: z.string().nullable().default(null),
      effectiveEnd: z.string().nullable().default(null)
    })).min(1)
  }).parse(req.body);

  // 校验价格等级是否存在
  const levelIds = [...new Set(body.prices.map(p => p.priceLevelId))];
  const levels = await query<any>(
    "SELECT id FROM price_level WHERE id IN (?) AND status = 1",
    [levelIds]
  );
  if (levels.length !== levelIds.length) {
    res.status(400).json({ code: "400", message: "部分价格等级不存在或已停用" });
    return;
  }

  await transaction(async (conn) => {
    for (const item of body.prices) {
      // 查询是否已存在相同 sku+level+minQty 的记录
      const existing = await conn.execute(
        "SELECT id, price FROM sku_price WHERE sku_id = ? AND price_level_id = ? AND min_qty = ?",
        [skuId, item.priceLevelId, item.minQty]
      ) as any;

      if ((existing[0] as any[]).length > 0) {
        const oldRecord = (existing[0] as any[])[0];
        // 更新已有记录
        await conn.execute(
          `UPDATE sku_price
           SET price = ?, cost_price = ?, suggested_retail_price = ?,
               effective_start = ?, effective_end = ?, status = 1, updated_at = NOW()
           WHERE id = ?`,
          [item.price, item.costPrice, item.suggestedRetailPrice,
           item.effectiveStart, item.effectiveEnd, oldRecord.id]
        );
        // 记录价格变更日志
        if (Number(oldRecord.price) !== item.price) {
          await conn.execute(
            `INSERT INTO price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [skuId, item.priceLevelId, oldRecord.price, item.price, "批量更新阶梯价", req.user!.id]
          );
        }
      } else {
        // 插入新记录
        await conn.execute(
          `INSERT INTO sku_price (sku_id, price_level_id, min_qty, price, cost_price, suggested_retail_price, effective_start, effective_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [skuId, item.priceLevelId, item.minQty, item.price, item.costPrice, item.suggestedRetailPrice,
           item.effectiveStart, item.effectiveEnd]
        );
      }
    }
  });

  // 返回更新后的完整列表
  const records = await query<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id
     WHERE sp.sku_id = ?
     ORDER BY pl.sort_order ASC, sp.min_qty ASC`,
    [skuId]
  );

  res.json(ok({ total: records.length, records }));
}));

// 编辑单条阶梯价
priceRouter.put("/prices/:id", requireAuth, asyncHandler(async (req, res) => {
  const priceId = Number(req.params.id);
  const existing = await queryOne<any>(
    `SELECT sp.id, sp.sku_id, sp.price_level_id, sp.min_qty, sp.price, sp.status
     FROM sku_price sp WHERE sp.id = ?`,
    [priceId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "阶梯价格记录不存在" });
    return;
  }

  const body = z.object({
    minQty: z.number().int().min(1).optional(),
    price: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    suggestedRetailPrice: z.number().min(0).optional(),
    effectiveStart: z.string().nullable().optional(),
    effectiveEnd: z.string().nullable().optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.minQty !== undefined) { updates.push("min_qty = ?"); params.push(body.minQty); }
  if (body.price !== undefined) { updates.push("price = ?"); params.push(body.price); }
  if (body.costPrice !== undefined) { updates.push("cost_price = ?"); params.push(body.costPrice); }
  if (body.suggestedRetailPrice !== undefined) { updates.push("suggested_retail_price = ?"); params.push(body.suggestedRetailPrice); }
  if (body.effectiveStart !== undefined) { updates.push("effective_start = ?"); params.push(body.effectiveStart); }
  if (body.effectiveEnd !== undefined) { updates.push("effective_end = ?"); params.push(body.effectiveEnd); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    // 如果价格发生变化，记录变更日志
    if (body.price !== undefined && body.price !== Number(existing.price)) {
      await query(
        `INSERT INTO price_change_log (sku_id, price_level_id, old_price, new_price, change_reason, changed_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [existing.sku_id, existing.price_level_id, existing.price, body.price, "手动修改阶梯价", req.user!.id]
      );
    }

    await query(
      `UPDATE sku_price SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      [...params, priceId]
    );
  }

  const record = await queryOne<any>(
    `SELECT sp.id, sp.sku_id AS skuId, sp.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pl.discount_rate AS discountRate,
            sp.min_qty AS minQty, sp.price,
            sp.cost_price AS costPrice, sp.suggested_retail_price AS suggestedRetailPrice,
            sp.effective_start AS effectiveStart, sp.effective_end AS effectiveEnd,
            sp.status, sp.created_at AS createdAt, sp.updated_at AS updatedAt
     FROM sku_price sp
     JOIN price_level pl ON pl.id = sp.price_level_id
     WHERE sp.id = ?`,
    [priceId]
  );

  res.json(ok(record));
}));

// 删除单条阶梯价
priceRouter.delete("/prices/:id", requireAuth, asyncHandler(async (req, res) => {
  const priceId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM sku_price WHERE id = ?",
    [priceId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "阶梯价格记录不存在" });
    return;
  }

  await query("DELETE FROM sku_price WHERE id = ?", [priceId]);
  res.json(ok({ priceId, deleted: true }));
}));

// ========== 最优价查询（核心） ==========

// 根据customerId + skuId + quantity 查询最优价格
priceRouter.post("/best-price", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    customerId: z.number().int().positive(),
    skuId: z.number().int().positive(),
    quantity: z.number().int().min(1)
  }).parse(req.body);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1. 查找客户绑定的价格等级（已审批通过且未过期）
  const binding = await queryOne<any>(
    `SELECT cpb.price_level_id, pl.level_code, pl.level_name, pl.discount_rate
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id
     WHERE cpb.customer_id = ? AND cpb.status = 'APPROVED'
       AND (cpb.expire_at IS NULL OR cpb.expire_at > NOW())
     LIMIT 1`,
    [body.customerId]
  );

  // 2. 确定优先级：协议价 > 客户绑定等级 > RETAIL兜底
  let priceLevelId: number | null = null;
  let levelCode = "RETAIL";
  let levelName = "零售价";
  let discountRate = 1.0;

  if (binding) {
    priceLevelId = binding.price_level_id;
    levelCode = binding.level_code;
    levelName = binding.level_name;
    discountRate = Number(binding.discount_rate);
  }

  // 获取零售等级ID作为兜底
  const retailLevel = await queryOne<any>(
    "SELECT id FROM price_level WHERE level_code = 'RETAIL' AND status = 1 LIMIT 1"
  );

  // 3. 在对应等级下查找匹配的阶梯价格
  //    阶梯匹配：min_qty <= quantity 中取 min_qty 最大的
  //    检查生效时间：effective_start <= today <= effective_end
  const matchParams: unknown[] = [];
  let matchSql = "";

  if (priceLevelId) {
    matchSql = `
      SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
             sp.suggested_retail_price AS suggestedRetailPrice,
             pl.level_code AS levelCode, pl.level_name AS levelName,
             pl.discount_rate AS discountRate
      FROM sku_price sp
      JOIN price_level pl ON pl.id = sp.price_level_id
      WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
        AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
        AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
      ORDER BY sp.min_qty DESC
      LIMIT 1`;
    matchParams.push(body.skuId, priceLevelId, body.quantity, today, today);
  } else if (retailLevel) {
    matchSql = `
      SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
             sp.suggested_retail_price AS suggestedRetailPrice,
             pl.level_code AS levelCode, pl.level_name AS levelName,
             pl.discount_rate AS discountRate
      FROM sku_price sp
      JOIN price_level pl ON pl.id = sp.price_level_id
      WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
        AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
        AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
      ORDER BY sp.min_qty DESC
      LIMIT 1`;
    matchParams.push(body.skuId, retailLevel.id, body.quantity, today, today);
  }

  let bestPrice: any = null;
  if (matchSql) {
    bestPrice = await queryOne<any>(matchSql, matchParams);
  }

  // 4. 如果绑定等级没有匹配的价格，回退到零售价
  if (!bestPrice && priceLevelId && retailLevel && retailLevel.id !== priceLevelId) {
    bestPrice = await queryOne<any>(
      `SELECT sp.id, sp.min_qty AS minQty, sp.price, sp.cost_price AS costPrice,
              sp.suggested_retail_price AS suggestedRetailPrice,
              pl.level_code AS levelCode, pl.level_name AS levelName,
              pl.discount_rate AS discountRate
       FROM sku_price sp
       JOIN price_level pl ON pl.id = sp.price_level_id
       WHERE sp.sku_id = ? AND sp.price_level_id = ? AND sp.min_qty <= ? AND sp.status = 1
         AND (sp.effective_start IS NULL OR sp.effective_start <= ?)
         AND (sp.effective_end IS NULL OR sp.effective_end >= ?)
       ORDER BY sp.min_qty DESC
       LIMIT 1`,
      [body.skuId, retailLevel.id, body.quantity, today, today]
    );
  }

  if (!bestPrice) {
    res.status(404).json({ code: "404", message: "未找到匹配的价格，请先设置SKU阶梯价" });
    return;
  }

  // 成本价仅对管理员可见
  const isAdmin = req.user?.roles?.includes("SUPER_ADMIN") || req.user?.roles?.includes("OPERATION_ADMIN");
  if (!isAdmin) {
    delete bestPrice.costPrice;
  }

  res.json(ok({
    skuId: body.skuId,
    quantity: body.quantity,
    price: bestPrice.price,
    minQty: bestPrice.minQty,
    levelCode: bestPrice.levelCode,
    levelName: bestPrice.levelName,
    discountRate: Number(bestPrice.discountRate),
    suggestedRetailPrice: bestPrice.suggestedRetailPrice,
    costPrice: bestPrice.costPrice,
    totalPrice: Number(bestPrice.price) * body.quantity
  }));
}));

// ========== 客户价格绑定 ==========

// 获取所有客户绑定
priceRouter.get("/customer-bindings", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.status) {
    conditions.push("cpb.status = ?");
    params.push(req.query.status);
  }
  if (req.query.customerId) {
    conditions.push("cpb.customer_id = ?");
    params.push(Number(req.query.customerId));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.approved_by AS approvedBy, cpb.approved_at AS approvedAt,
            cpb.expire_at AS expireAt,
            cpb.created_at AS createdAt, cpb.updated_at AS updatedAt
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id
     ${where}
     ORDER BY cpb.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_price_binding cpb ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 申请绑定（需审批）
priceRouter.post("/customer-bindings", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    customerId: z.number().int().positive(),
    priceLevelId: z.number().int().positive(),
    applyReason: z.string().max(255).default(""),
    expireAt: z.string().nullable().default(null)
  }).parse(req.body);

  // 校验价格等级是否存在
  const level = await queryOne<any>(
    "SELECT id FROM price_level WHERE id = ? AND status = 1",
    [body.priceLevelId]
  );
  if (!level) {
    res.status(400).json({ code: "400", message: "价格等级不存在或已停用" });
    return;
  }

  // 检查是否已有绑定记录
  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_price_binding WHERE customer_id = ?",
    [body.customerId]
  );
  if (existing && existing.status === "APPROVED") {
    res.status(400).json({ code: "400", message: "该客户已有生效的价格等级绑定，请先取消后再申请" });
    return;
  }

  // 如果已有PENDING/REJECTED记录，更新为新的申请
  if (existing && (existing.status === "PENDING" || existing.status === "REJECTED")) {
    await query(
      `UPDATE customer_price_binding
       SET price_level_id = ?, apply_reason = ?, status = 'PENDING',
           approved_by = NULL, approved_at = NULL, expire_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [body.priceLevelId, body.applyReason, body.expireAt, existing.id]
    );
  } else {
    await query(
      `INSERT INTO customer_price_binding (customer_id, price_level_id, apply_reason, expire_at, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [body.customerId, body.priceLevelId, body.applyReason, body.expireAt]
    );
  }

  const record = await queryOne<any>(
    `SELECT cpb.id, cpb.customer_id AS customerId, cpb.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            cpb.apply_reason AS applyReason, cpb.status,
            cpb.created_at AS createdAt
     FROM customer_price_binding cpb
     JOIN price_level pl ON pl.id = cpb.price_level_id
     WHERE cpb.customer_id = ?
     ORDER BY cpb.id DESC LIMIT 1`,
    [body.customerId]
  );

  res.json(ok(record));
}));

// 审批通过
priceRouter.put("/customer-bindings/:id/approve", requireAuth, asyncHandler(async (req, res) => {
  const bindingId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id, customer_id, status FROM customer_price_binding WHERE id = ?",
    [bindingId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "绑定记录不存在" });
    return;
  }
  if (existing.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "仅待审批的记录可以审批" });
    return;
  }

  await query(
    `UPDATE customer_price_binding
     SET status = 'APPROVED', approved_by = ?, approved_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [req.user!.id, bindingId]
  );

  res.json(ok({
    bindingId,
    status: "APPROVED",
    approvedBy: req.user!.id,
    approvedAt: new Date().toISOString()
  }));
}));

// 审批拒绝
priceRouter.put("/customer-bindings/:id/reject", requireAuth, asyncHandler(async (req, res) => {
  const bindingId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_price_binding WHERE id = ?",
    [bindingId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "绑定记录不存在" });
    return;
  }
  if (existing.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "仅待审批的记录可以拒绝" });
    return;
  }

  await query(
    `UPDATE customer_price_binding
     SET status = 'REJECTED', approved_by = ?, approved_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [req.user!.id, bindingId]
  );

  res.json(ok({
    bindingId,
    status: "REJECTED",
    approvedBy: req.user!.id,
    approvedAt: new Date().toISOString()
  }));
}));

// 取消绑定
priceRouter.delete("/customer-bindings/:id", requireAuth, asyncHandler(async (req, res) => {
  const bindingId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_price_binding WHERE id = ?",
    [bindingId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "绑定记录不存在" });
    return;
  }

  await query(
    "UPDATE customer_price_binding SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?",
    [bindingId]
  );

  res.json(ok({ bindingId, status: "EXPIRED" }));
}));

// ========== 价格变更历史 ==========

// 查询价格变更历史（支持skuId筛选+分页）
priceRouter.get("/change-logs", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.skuId) {
    conditions.push("pcl.sku_id = ?");
    params.push(Number(req.query.skuId));
  }
  if (req.query.priceLevelId) {
    conditions.push("pcl.price_level_id = ?");
    params.push(Number(req.query.priceLevelId));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT pcl.id, pcl.sku_id AS skuId, pcl.price_level_id AS priceLevelId,
            pl.level_code AS levelCode, pl.level_name AS levelName,
            pcl.old_price AS oldPrice, pcl.new_price AS newPrice,
            pcl.change_reason AS changeReason, pcl.changed_by AS changedBy,
            pcl.created_at AS createdAt
     FROM price_change_log pcl
     JOIN price_level pl ON pl.id = pcl.price_level_id
     ${where}
     ORDER BY pcl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM price_change_log pcl ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));
