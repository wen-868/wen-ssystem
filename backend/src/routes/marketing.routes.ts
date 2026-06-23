import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

// ========== Admin Router ==========
export const adminMarketingRouter = Router();
// ========== Miniapp Router ==========
export const miniappMarketingRouter = Router();

// ========================================================================
// 优惠券模板管理 (Admin)
// ========================================================================

// 创建优惠券模板
adminMarketingRouter.post(
  "/coupons/templates",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      name: z.string().min(1).max(128),
      type: z.enum(["FIXED", "PERCENT", "SHIPPING", "FREE_GIFT"]),
      value: z.number().min(0),
      minAmount: z.number().min(0).default(0),
      maxDiscount: z.number().min(0).nullable().default(null),
      applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).default("ALL"),
      applicableIds: z.array(z.number().int()).nullable().default(null),
      totalCount: z.number().int().min(0).default(0),
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      description: z.string().max(512).default("")
    }).parse(req.body);

    await query(
      `INSERT INTO coupon_template (name, type, value, min_amount, max_discount,
        applicable_scope, applicable_ids, total_count, start_time, end_time, description, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name, body.type, body.value, body.minAmount, body.maxDiscount,
        body.applicableScope, JSON.stringify(body.applicableIds), body.totalCount,
        body.startTime, body.endTime, body.description, tenantId
      ]
    );

    const record = await queryOne<any>(
      `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
              start_time AS startTime, end_time AS endTime, status, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM coupon_template WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );

    res.json(ok(record));
  })
);

// 优惠券模板列表（分页+状态筛选+类型筛选）
adminMarketingRouter.get(
  "/coupons/templates",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["ct.tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.status) {
      conditions.push("ct.status = ?");
      params.push(req.query.status);
    }
    if (req.query.type) {
      conditions.push("ct.type = ?");
      params.push(req.query.type);
    }
    if (req.query.keyword) {
      conditions.push("ct.name LIKE ?");
      params.push(`%${req.query.keyword}%`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT ct.id, ct.name, ct.type, ct.value, ct.min_amount AS minAmount,
              ct.max_discount AS maxDiscount, ct.applicable_scope AS applicableScope,
              ct.applicable_ids AS applicableIds, ct.total_count AS totalCount,
              ct.claimed_count AS claimedCount, ct.used_count AS usedCount,
              ct.start_time AS startTime, ct.end_time AS endTime, ct.status,
              ct.description, ct.created_at AS createdAt, ct.updated_at AS updatedAt
       FROM coupon_template ct
       ${where}
       ORDER BY ct.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM coupon_template ct ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// 优惠券模板详情
adminMarketingRouter.get(
  "/coupons/templates/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const record = await queryOne<any>(
      `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
              start_time AS startTime, end_time AS endTime, status, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM coupon_template WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (!record) {
      res.status(404).json({ code: "404", message: "优惠券模板不存在" });
      return;
    }
    res.json(ok(record));
  })
);

// 更新优惠券模板
adminMarketingRouter.put(
  "/coupons/templates/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM coupon_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "优惠券模板不存在" });
      return;
    }

    const body = z.object({
      name: z.string().min(1).max(128).optional(),
      type: z.enum(["FIXED", "PERCENT", "SHIPPING", "FREE_GIFT"]).optional(),
      value: z.number().min(0).optional(),
      minAmount: z.number().min(0).optional(),
      maxDiscount: z.number().min(0).nullable().optional(),
      applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).optional(),
      applicableIds: z.array(z.number().int()).nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
      startTime: z.string().min(1).optional(),
      endTime: z.string().min(1).optional(),
      description: z.string().max(512).optional()
    }).parse(req.body);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
    if (body.type !== undefined) { updates.push("type = ?"); params.push(body.type); }
    if (body.value !== undefined) { updates.push("value = ?"); params.push(body.value); }
    if (body.minAmount !== undefined) { updates.push("min_amount = ?"); params.push(body.minAmount); }
    if (body.maxDiscount !== undefined) { updates.push("max_discount = ?"); params.push(body.maxDiscount); }
    if (body.applicableScope !== undefined) { updates.push("applicable_scope = ?"); params.push(body.applicableScope); }
    if (body.applicableIds !== undefined) { updates.push("applicable_ids = ?"); params.push(JSON.stringify(body.applicableIds)); }
    if (body.totalCount !== undefined) { updates.push("total_count = ?"); params.push(body.totalCount); }
    if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
    if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }
    if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }

    if (updates.length > 0) {
      await query(`UPDATE coupon_template SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId]);
    }

    const record = await queryOne<any>(
      `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
              start_time AS startTime, end_time AS endTime, status, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM coupon_template WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    res.json(ok(record));
  })
);

// 删除优惠券模板（仅DRAFT可删）
adminMarketingRouter.delete(
  "/coupons/templates/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM coupon_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "优惠券模板不存在" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ code: "400", message: "仅草稿状态的优惠券模板可删除" });
      return;
    }

    await query("DELETE FROM coupon_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, deleted: true }));
  })
);

// 激活优惠券模板
adminMarketingRouter.post(
  "/coupons/templates/:id/activate",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM coupon_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "优惠券模板不存在" });
      return;
    }
    if (!["DRAFT", "PAUSED"].includes(existing.status)) {
      res.status(400).json({ code: "400", message: "仅草稿或暂停状态的优惠券可激活" });
      return;
    }

    await query("UPDATE coupon_template SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "ACTIVE" }));
  })
);

// 暂停优惠券模板
adminMarketingRouter.post(
  "/coupons/templates/:id/pause",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM coupon_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "优惠券模板不存在" });
      return;
    }
    if (existing.status !== "ACTIVE") {
      res.status(400).json({ code: "400", message: "仅激活状态的优惠券可暂停" });
      return;
    }

    await query("UPDATE coupon_template SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "PAUSED" }));
  })
);

// 用户优惠券列表（分页+状态筛选）
adminMarketingRouter.get(
  "/coupons/users",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["ct.tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.status) {
      conditions.push("uc.status = ?");
      params.push(req.query.status);
    }
    if (req.query.userId) {
      conditions.push("uc.user_id = ?");
      params.push(Number(req.query.userId));
    }
    if (req.query.templateId) {
      conditions.push("uc.template_id = ?");
      params.push(Number(req.query.templateId));
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId, uc.order_id AS orderId,
              uc.status, uc.claimed_at AS claimedAt, uc.used_at AS usedAt,
              uc.expires_at AS expiresAt, uc.created_at AS createdAt,
              ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
              ct.min_amount AS minAmount, ct.applicable_scope AS applicableScope
       FROM user_coupon uc
       JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
       ${where}
       ORDER BY uc.claimed_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM user_coupon uc
       JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
       ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// 优惠券统计（各类型发放/使用/核销率）
adminMarketingRouter.get(
  "/coupons/statistics",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const byType = await query<any>(
      `SELECT type, COUNT(*) AS templateCount,
              SUM(total_count) AS totalIssued, SUM(claimed_count) AS totalClaimed, SUM(used_count) AS totalUsed
       FROM coupon_template WHERE tenant_id = ? GROUP BY type`,
      [tenantId]
    );

    const overall = await queryOne<any>(
      `SELECT COUNT(*) AS totalTemplates, SUM(total_count) AS totalIssued,
              SUM(claimed_count) AS totalClaimed, SUM(used_count) AS totalUsed
       FROM coupon_template WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json(ok({
      overall: {
        totalTemplates: Number(overall?.totalTemplates ?? 0),
        totalIssued: Number(overall?.totalIssued ?? 0),
        totalClaimed: Number(overall?.totalClaimed ?? 0),
        totalUsed: Number(overall?.totalUsed ?? 0),
        claimRate: Number(overall?.totalIssued) > 0
          ? (Number(overall?.totalClaimed) / Number(overall?.totalIssued) * 100).toFixed(2) + "%"
          : "0%",
        useRate: Number(overall?.totalClaimed) > 0
          ? (Number(overall?.totalUsed) / Number(overall?.totalClaimed) * 100).toFixed(2) + "%"
          : "0%"
      },
      byType: byType.map((r: any) => ({
        type: r.type,
        templateCount: Number(r.templateCount),
        totalIssued: Number(r.totalIssued),
        totalClaimed: Number(r.totalClaimed),
        totalUsed: Number(r.totalUsed),
        claimRate: Number(r.totalIssued) > 0
          ? (Number(r.totalClaimed) / Number(r.totalIssued) * 100).toFixed(2) + "%"
          : "0%",
        useRate: Number(r.totalClaimed) > 0
          ? (Number(r.totalUsed) / Number(r.totalClaimed) * 100).toFixed(2) + "%"
          : "0%"
      }))
    }));
  })
);

// ========================================================================
// 满减活动管理 (Admin)
// ========================================================================

// 创建满减活动
adminMarketingRouter.post(
  "/promotions/full-reduction",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      name: z.string().min(1).max(128),
      rules: z.array(z.object({
        minAmount: z.number().min(0),
        reduceAmount: z.number().min(0)
      })).min(1),
      applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).default("ALL"),
      applicableIds: z.array(z.number().int()).nullable().default(null),
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      priority: z.number().int().default(0),
      stackable: z.boolean().default(false),
      description: z.string().max(512).default("")
    }).parse(req.body);

    await query(
      `INSERT INTO full_reduction (name, rules, applicable_scope, applicable_ids,
        start_time, end_time, priority, stackable, description, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name, JSON.stringify(body.rules), body.applicableScope,
        JSON.stringify(body.applicableIds), body.startTime, body.endTime,
        body.priority, body.stackable ? 1 : 0, body.description, tenantId
      ]
    );

    const record = await queryOne<any>(
      `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              start_time AS startTime, end_time AS endTime, status, priority, stackable,
              description, created_at AS createdAt, updated_at AS updatedAt
       FROM full_reduction WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );

    res.json(ok(record));
  })
);

// 满减活动列表
adminMarketingRouter.get(
  "/promotions/full-reduction",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.status) {
      conditions.push("status = ?");
      params.push(req.query.status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              start_time AS startTime, end_time AS endTime, status, priority, stackable,
              description, created_at AS createdAt, updated_at AS updatedAt
       FROM full_reduction
       ${where}
       ORDER BY priority DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM full_reduction ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// 满减活动详情
adminMarketingRouter.get(
  "/promotions/full-reduction/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const record = await queryOne<any>(
      `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              start_time AS startTime, end_time AS endTime, status, priority, stackable,
              description, created_at AS createdAt, updated_at AS updatedAt
       FROM full_reduction WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (!record) {
      res.status(404).json({ code: "404", message: "满减活动不存在" });
      return;
    }
    res.json(ok(record));
  })
);

// 更新满减活动
adminMarketingRouter.put(
  "/promotions/full-reduction/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM full_reduction WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "满减活动不存在" });
      return;
    }

    const body = z.object({
      name: z.string().min(1).max(128).optional(),
      rules: z.array(z.object({
        minAmount: z.number().min(0),
        reduceAmount: z.number().min(0)
      })).min(1).optional(),
      applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).optional(),
      applicableIds: z.array(z.number().int()).nullable().optional(),
      startTime: z.string().min(1).optional(),
      endTime: z.string().min(1).optional(),
      priority: z.number().int().optional(),
      stackable: z.boolean().optional(),
      description: z.string().max(512).optional()
    }).parse(req.body);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
    if (body.rules !== undefined) { updates.push("rules = ?"); params.push(JSON.stringify(body.rules)); }
    if (body.applicableScope !== undefined) { updates.push("applicable_scope = ?"); params.push(body.applicableScope); }
    if (body.applicableIds !== undefined) { updates.push("applicable_ids = ?"); params.push(JSON.stringify(body.applicableIds)); }
    if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
    if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }
    if (body.priority !== undefined) { updates.push("priority = ?"); params.push(body.priority); }
    if (body.stackable !== undefined) { updates.push("stackable = ?"); params.push(body.stackable ? 1 : 0); }
    if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }

    if (updates.length > 0) {
      await query(`UPDATE full_reduction SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId]);
    }

    const record = await queryOne<any>(
      `SELECT id, name, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              start_time AS startTime, end_time AS endTime, status, priority, stackable,
              description, created_at AS createdAt, updated_at AS updatedAt
       FROM full_reduction WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    res.json(ok(record));
  })
);

// 删除满减活动
adminMarketingRouter.delete(
  "/promotions/full-reduction/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM full_reduction WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "满减活动不存在" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ code: "400", message: "仅草稿状态的满减活动可删除" });
      return;
    }

    await query("DELETE FROM full_reduction WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, deleted: true }));
  })
);

// 激活满减活动
adminMarketingRouter.post(
  "/promotions/full-reduction/:id/activate",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM full_reduction WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "满减活动不存在" });
      return;
    }
    if (!["DRAFT", "PAUSED"].includes(existing.status)) {
      res.status(400).json({ code: "400", message: "仅草稿或暂停状态的活动可激活" });
      return;
    }

    await query("UPDATE full_reduction SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "ACTIVE" }));
  })
);

// 暂停满减活动
adminMarketingRouter.post(
  "/promotions/full-reduction/:id/pause",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM full_reduction WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "满减活动不存在" });
      return;
    }
    if (existing.status !== "ACTIVE") {
      res.status(400).json({ code: "400", message: "仅激活状态的活动可暂停" });
      return;
    }

    await query("UPDATE full_reduction SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "PAUSED" }));
  })
);

// ========================================================================
// 秒杀活动管理 (Admin)
// ========================================================================

// 创建秒杀活动
adminMarketingRouter.post(
  "/promotions/flash-sale",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      name: z.string().min(1).max(128),
      productId: z.number().int().positive(),
      skuId: z.number().int().positive(),
      flashPrice: z.number().min(0),
      originalPrice: z.number().min(0),
      totalStock: z.number().int().min(0),
      limitPerUser: z.number().int().min(1).default(1),
      startTime: z.string().min(1),
      endTime: z.string().min(1)
    }).parse(req.body);

    await query(
      `INSERT INTO flash_sale (name, product_id, sku_id, flash_price, original_price,
        total_stock, limit_per_user, start_time, end_time, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name, body.productId, body.skuId, body.flashPrice, body.originalPrice,
        body.totalStock, body.limitPerUser, body.startTime, body.endTime, tenantId
      ]
    );

    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              flash_price AS flashPrice, original_price AS originalPrice,
              total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
              start_time AS startTime, end_time AS endTime, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM flash_sale WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );

    res.json(ok(record));
  })
);

// 秒杀活动列表
adminMarketingRouter.get(
  "/promotions/flash-sale",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.status) {
      conditions.push("status = ?");
      params.push(req.query.status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              flash_price AS flashPrice, original_price AS originalPrice,
              total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
              start_time AS startTime, end_time AS endTime, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM flash_sale
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM flash_sale ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// 秒杀活动详情
adminMarketingRouter.get(
  "/promotions/flash-sale/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              flash_price AS flashPrice, original_price AS originalPrice,
              total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
              start_time AS startTime, end_time AS endTime, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM flash_sale WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (!record) {
      res.status(404).json({ code: "404", message: "秒杀活动不存在" });
      return;
    }
    res.json(ok(record));
  })
);

// 更新秒杀活动
adminMarketingRouter.put(
  "/promotions/flash-sale/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM flash_sale WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "秒杀活动不存在" });
      return;
    }

    const body = z.object({
      name: z.string().min(1).max(128).optional(),
      productId: z.number().int().positive().optional(),
      skuId: z.number().int().positive().optional(),
      flashPrice: z.number().min(0).optional(),
      originalPrice: z.number().min(0).optional(),
      totalStock: z.number().int().min(0).optional(),
      limitPerUser: z.number().int().min(1).optional(),
      startTime: z.string().min(1).optional(),
      endTime: z.string().min(1).optional()
    }).parse(req.body);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
    if (body.productId !== undefined) { updates.push("product_id = ?"); params.push(body.productId); }
    if (body.skuId !== undefined) { updates.push("sku_id = ?"); params.push(body.skuId); }
    if (body.flashPrice !== undefined) { updates.push("flash_price = ?"); params.push(body.flashPrice); }
    if (body.originalPrice !== undefined) { updates.push("original_price = ?"); params.push(body.originalPrice); }
    if (body.totalStock !== undefined) { updates.push("total_stock = ?"); params.push(body.totalStock); }
    if (body.limitPerUser !== undefined) { updates.push("limit_per_user = ?"); params.push(body.limitPerUser); }
    if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
    if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }

    if (updates.length > 0) {
      await query(`UPDATE flash_sale SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId]);
    }

    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              flash_price AS flashPrice, original_price AS originalPrice,
              total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
              start_time AS startTime, end_time AS endTime, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM flash_sale WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    res.json(ok(record));
  })
);

// 删除秒杀活动
adminMarketingRouter.delete(
  "/promotions/flash-sale/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM flash_sale WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "秒杀活动不存在" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ code: "400", message: "仅草稿状态的秒杀活动可删除" });
      return;
    }

    await query("DELETE FROM flash_sale WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, deleted: true }));
  })
);

// 激活秒杀活动
adminMarketingRouter.post(
  "/promotions/flash-sale/:id/activate",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM flash_sale WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "秒杀活动不存在" });
      return;
    }
    if (!["DRAFT", "PAUSED"].includes(existing.status)) {
      res.status(400).json({ code: "400", message: "仅草稿或暂停状态的活动可激活" });
      return;
    }

    await query("UPDATE flash_sale SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "ACTIVE" }));
  })
);

// 暂停秒杀活动
adminMarketingRouter.post(
  "/promotions/flash-sale/:id/pause",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM flash_sale WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "秒杀活动不存在" });
      return;
    }
    if (existing.status !== "ACTIVE") {
      res.status(400).json({ code: "400", message: "仅激活状态的活动可暂停" });
      return;
    }

    await query("UPDATE flash_sale SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "PAUSED" }));
  })
);

// 秒杀统计
adminMarketingRouter.get(
  "/promotions/flash-sale/statistics",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const stats = await query<any>(
      `SELECT fs.id, fs.name, fs.flash_price AS flashPrice, fs.original_price AS originalPrice,
              fs.total_stock AS totalStock, fs.sold_count AS soldCount, fs.status,
              COUNT(fsr.id) AS orderCount, SUM(fsr.quantity) AS totalQuantity,
              SUM(fsr.price * fsr.quantity) AS totalAmount
       FROM flash_sale fs
       LEFT JOIN flash_sale_record fsr ON fsr.flash_sale_id = fs.id
       WHERE fs.tenant_id = ?
       GROUP BY fs.id
       ORDER BY fs.created_at DESC`,
      [tenantId]
    );

    const overall = await queryOne<any>(
      `SELECT COUNT(*) AS totalActivities, SUM(total_stock) AS totalStock,
              SUM(sold_count) AS totalSold
       FROM flash_sale WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json(ok({
      overall: {
        totalActivities: Number(overall?.totalActivities ?? 0),
        totalStock: Number(overall?.totalStock ?? 0),
        totalSold: Number(overall?.totalSold ?? 0),
        sellThroughRate: Number(overall?.totalStock) > 0
          ? (Number(overall?.totalSold) / Number(overall?.totalStock) * 100).toFixed(2) + "%"
          : "0%"
      },
      details: stats.map((r: any) => ({
        id: r.id,
        name: r.name,
        flashPrice: Number(r.flashPrice),
        originalPrice: Number(r.originalPrice),
        totalStock: Number(r.totalStock),
        soldCount: Number(r.soldCount),
        orderCount: Number(r.orderCount),
        totalQuantity: Number(r.totalQuantity),
        totalAmount: Number(r.totalAmount),
        sellThroughRate: Number(r.totalStock) > 0
          ? (Number(r.soldCount) / Number(r.totalStock) * 100).toFixed(2) + "%"
          : "0%",
        status: r.status
      }))
    }));
  })
);

// ========================================================================
// 拼团活动管理 (Admin)
// ========================================================================

// 创建拼团活动
adminMarketingRouter.post(
  "/promotions/group-buy",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      name: z.string().min(1).max(128),
      productId: z.number().int().positive(),
      skuId: z.number().int().positive(),
      groupPrice: z.number().min(0),
      originalPrice: z.number().min(0),
      minGroupSize: z.number().int().min(2),
      maxGroupSize: z.number().int().min(2),
      timeLimitHours: z.number().int().min(1).default(24),
      totalStock: z.number().int().min(0),
      startTime: z.string().min(1),
      endTime: z.string().min(1)
    }).parse(req.body);

    await query(
      `INSERT INTO group_buy (name, product_id, sku_id, group_price, original_price,
        min_group_size, max_group_size, time_limit_hours, total_stock, start_time, end_time, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name, body.productId, body.skuId, body.groupPrice, body.originalPrice,
        body.minGroupSize, body.maxGroupSize, body.timeLimitHours, body.totalStock,
        body.startTime, body.endTime, tenantId
      ]
    );

    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              group_price AS groupPrice, original_price AS originalPrice,
              min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
              time_limit_hours AS timeLimitHours, total_stock AS totalStock,
              sold_count AS soldCount, status,
              start_time AS startTime, end_time AS endTime,
              created_at AS createdAt, updated_at AS updatedAt
       FROM group_buy WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );

    res.json(ok(record));
  })
);

// 拼团活动列表
adminMarketingRouter.get(
  "/promotions/group-buy",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.status) {
      conditions.push("status = ?");
      params.push(req.query.status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              group_price AS groupPrice, original_price AS originalPrice,
              min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
              time_limit_hours AS timeLimitHours, total_stock AS totalStock,
              sold_count AS soldCount, status,
              start_time AS startTime, end_time AS endTime,
              created_at AS createdAt, updated_at AS updatedAt
       FROM group_buy
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM group_buy ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// 拼团活动详情
adminMarketingRouter.get(
  "/promotions/group-buy/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              group_price AS groupPrice, original_price AS originalPrice,
              min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
              time_limit_hours AS timeLimitHours, total_stock AS totalStock,
              sold_count AS soldCount, status,
              start_time AS startTime, end_time AS endTime,
              created_at AS createdAt, updated_at AS updatedAt
       FROM group_buy WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (!record) {
      res.status(404).json({ code: "404", message: "拼团活动不存在" });
      return;
    }
    res.json(ok(record));
  })
);

// 更新拼团活动
adminMarketingRouter.put(
  "/promotions/group-buy/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM group_buy WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "拼团活动不存在" });
      return;
    }

    const body = z.object({
      name: z.string().min(1).max(128).optional(),
      productId: z.number().int().positive().optional(),
      skuId: z.number().int().positive().optional(),
      groupPrice: z.number().min(0).optional(),
      originalPrice: z.number().min(0).optional(),
      minGroupSize: z.number().int().min(2).optional(),
      maxGroupSize: z.number().int().min(2).optional(),
      timeLimitHours: z.number().int().min(1).optional(),
      totalStock: z.number().int().min(0).optional(),
      startTime: z.string().min(1).optional(),
      endTime: z.string().min(1).optional()
    }).parse(req.body);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
    if (body.productId !== undefined) { updates.push("product_id = ?"); params.push(body.productId); }
    if (body.skuId !== undefined) { updates.push("sku_id = ?"); params.push(body.skuId); }
    if (body.groupPrice !== undefined) { updates.push("group_price = ?"); params.push(body.groupPrice); }
    if (body.originalPrice !== undefined) { updates.push("original_price = ?"); params.push(body.originalPrice); }
    if (body.minGroupSize !== undefined) { updates.push("min_group_size = ?"); params.push(body.minGroupSize); }
    if (body.maxGroupSize !== undefined) { updates.push("max_group_size = ?"); params.push(body.maxGroupSize); }
    if (body.timeLimitHours !== undefined) { updates.push("time_limit_hours = ?"); params.push(body.timeLimitHours); }
    if (body.totalStock !== undefined) { updates.push("total_stock = ?"); params.push(body.totalStock); }
    if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
    if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }

    if (updates.length > 0) {
      await query(`UPDATE group_buy SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId]);
    }

    const record = await queryOne<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              group_price AS groupPrice, original_price AS originalPrice,
              min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
              time_limit_hours AS timeLimitHours, total_stock AS totalStock,
              sold_count AS soldCount, status,
              start_time AS startTime, end_time AS endTime,
              created_at AS createdAt, updated_at AS updatedAt
       FROM group_buy WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    res.json(ok(record));
  })
);

// 删除拼团活动
adminMarketingRouter.delete(
  "/promotions/group-buy/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM group_buy WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "拼团活动不存在" });
      return;
    }
    if (existing.status !== "DRAFT") {
      res.status(400).json({ code: "400", message: "仅草稿状态的拼团活动可删除" });
      return;
    }

    await query("DELETE FROM group_buy WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, deleted: true }));
  })
);

// 激活拼团活动
adminMarketingRouter.post(
  "/promotions/group-buy/:id/activate",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id, status FROM group_buy WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "拼团活动不存在" });
      return;
    }
    if (!["DRAFT", "PAUSED"].includes(existing.status)) {
      res.status(400).json({ code: "400", message: "仅草稿或暂停状态的活动可激活" });
      return;
    }

    await query("UPDATE group_buy SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, status: "ACTIVE" }));
  })
);

// 拼团组列表
adminMarketingRouter.get(
  "/promotions/group-buy/teams",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["gb.tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (req.query.activityId) {
      conditions.push("gbt.activity_id = ?");
      params.push(Number(req.query.activityId));
    }
    if (req.query.status) {
      conditions.push("gbt.status = ?");
      params.push(req.query.status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const records = await query<any>(
      `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
              gbt.leader_order_id AS leaderOrderId, gbt.current_size AS currentSize,
              gbt.target_size AS targetSize, gbt.status,
              gbt.expires_at AS expiresAt, gbt.created_at AS createdAt, gbt.completed_at AS completedAt,
              gb.name AS activityName, gb.group_price AS groupPrice
       FROM group_buy_team gbt
       JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       ${where}
       ORDER BY gbt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM group_buy_team gbt
       JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// ========================================================================
// 叠加规则管理 (Admin)
// ========================================================================

// 创建叠加规则
adminMarketingRouter.post(
  "/promotions/stack-rules",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      name: z.string().min(1).max(128),
      typeCombination: z.array(z.array(z.string())).min(1),
      maxTotalDiscountRate: z.number().min(0).max(1.9999).default(1.0),
      priority: z.number().int().default(0),
      enabled: z.boolean().default(true)
    }).parse(req.body);

    await query(
      `INSERT INTO promo_stack_rule (name, type_combination, max_total_discount_rate, priority, enabled, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.name, JSON.stringify(body.typeCombination),
        body.maxTotalDiscountRate, body.priority, body.enabled ? 1 : 0, tenantId
      ]
    );

    const record = await queryOne<any>(
      `SELECT id, name, type_combination AS typeCombination,
              max_total_discount_rate AS maxTotalDiscountRate,
              priority, enabled, created_at AS createdAt
       FROM promo_stack_rule WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );

    res.json(ok(record));
  })
);

// 叠加规则列表
adminMarketingRouter.get(
  "/promotions/stack-rules",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const records = await query<any>(
      `SELECT id, name, type_combination AS typeCombination,
              max_total_discount_rate AS maxTotalDiscountRate,
              priority, enabled, created_at AS createdAt
       FROM promo_stack_rule
       WHERE tenant_id = ?
       ORDER BY priority DESC, id ASC`,
      [tenantId]
    );

    res.json(ok({ total: records.length, records }));
  })
);

// 更新叠加规则
adminMarketingRouter.put(
  "/promotions/stack-rules/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id FROM promo_stack_rule WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "叠加规则不存在" });
      return;
    }

    const body = z.object({
      name: z.string().min(1).max(128).optional(),
      typeCombination: z.array(z.array(z.string())).min(1).optional(),
      maxTotalDiscountRate: z.number().min(0).max(1.9999).optional(),
      priority: z.number().int().optional(),
      enabled: z.boolean().optional()
    }).parse(req.body);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
    if (body.typeCombination !== undefined) { updates.push("type_combination = ?"); params.push(JSON.stringify(body.typeCombination)); }
    if (body.maxTotalDiscountRate !== undefined) { updates.push("max_total_discount_rate = ?"); params.push(body.maxTotalDiscountRate); }
    if (body.priority !== undefined) { updates.push("priority = ?"); params.push(body.priority); }
    if (body.enabled !== undefined) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }

    if (updates.length > 0) {
      await query(`UPDATE promo_stack_rule SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId]);
    }

    const record = await queryOne<any>(
      `SELECT id, name, type_combination AS typeCombination,
              max_total_discount_rate AS maxTotalDiscountRate,
              priority, enabled, created_at AS createdAt
       FROM promo_stack_rule WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    res.json(ok(record));
  })
);

// 删除叠加规则
adminMarketingRouter.delete(
  "/promotions/stack-rules/:id",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const id = Number(req.params.id);
    const existing = await queryOne<any>("SELECT id FROM promo_stack_rule WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    if (!existing) {
      res.status(404).json({ code: "404", message: "叠加规则不存在" });
      return;
    }

    await query("DELETE FROM promo_stack_rule WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    res.json(ok({ id, deleted: true }));
  })
);

// 试算接口：输入商品列表+优惠券+活动，返回最优组合
adminMarketingRouter.post(
  "/promotions/calculate",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const body = z.object({
      items: z.array(z.object({
        skuId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        categoryId: z.number().int().optional(),
        brandId: z.number().int().optional()
      })).min(1),
      couponTemplateId: z.number().int().positive().optional(),
      flashSaleId: z.number().int().positive().optional(),
      groupBuyTeamId: z.number().int().positive().optional(),
      fullReductionIds: z.array(z.number().int().positive()).optional()
    }).parse(req.body);

    const now = new Date().toISOString();
    let originalTotal = 0;
    let discountedTotal = 0;
    const breakdown: any[] = [];

    // 1. 计算原价
    for (const item of body.items) {
      originalTotal += item.unitPrice * item.quantity;
    }
    discountedTotal = originalTotal;

    // 2. 秒杀价
    if (body.flashSaleId) {
      const flashSale = await queryOne<any>(
        `SELECT id, sku_id, flash_price, status, start_time, end_time
         FROM flash_sale WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?`,
        [body.flashSaleId, tenantId, now, now]
      );
      if (flashSale) {
        let flashDiscount = 0;
        for (const item of body.items) {
          if (item.skuId === Number(flashSale.sku_id)) {
            flashDiscount += (item.unitPrice - Number(flashSale.flash_price)) * item.quantity;
          }
        }
        if (flashDiscount > 0) {
          discountedTotal -= flashDiscount;
          breakdown.push({
            type: "FLASH_SALE",
            id: body.flashSaleId,
            discount: Number(flashDiscount.toFixed(2)),
            description: `秒杀优惠`
          });
        }
      }
    }

    // 3. 拼团价
    if (body.groupBuyTeamId) {
      const team = await queryOne<any>(
        `SELECT gbt.id, gbt.activity_id, gbt.status, gbt.target_size, gbt.current_size,
                gb.group_price, gb.sku_id, gb.status AS activityStatus
         FROM group_buy_team gbt
         JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
         WHERE gbt.id = ? AND gbt.status = 'PENDING' AND gb.status = 'ACTIVE'`,
        [tenantId, body.groupBuyTeamId]
      );
      if (team) {
        let groupDiscount = 0;
        for (const item of body.items) {
          if (item.skuId === Number(team.sku_id)) {
            groupDiscount += (item.unitPrice - Number(team.group_price)) * item.quantity;
          }
        }
        if (groupDiscount > 0) {
          discountedTotal -= groupDiscount;
          breakdown.push({
            type: "GROUP_BUY",
            id: body.groupBuyTeamId,
            discount: Number(groupDiscount.toFixed(2)),
            description: `拼团优惠`
          });
        }
      }
    }

    // 4. 满减
    if (body.fullReductionIds && body.fullReductionIds.length > 0) {
      const fullReductions = await query<any>(
        `SELECT id, rules, applicable_scope, applicable_ids, stackable
         FROM full_reduction
         WHERE id IN (?) AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
         ORDER BY priority DESC`,
        [body.fullReductionIds, tenantId, now, now]
      );
      for (const fr of fullReductions) {
        const rules: Array<{ minAmount: number; reduceAmount: number }> = JSON.parse(fr.rules);
        // 从大到小匹配满减规则
        const sortedRules = [...rules].sort((a, b) => b.minAmount - a.minAmount);
        for (const rule of sortedRules) {
          if (discountedTotal >= rule.minAmount) {
            discountedTotal -= rule.reduceAmount;
            breakdown.push({
              type: "FULL_REDUCTION",
              id: fr.id,
              discount: Number(rule.reduceAmount.toFixed(2)),
              description: `满${rule.minAmount}减${rule.reduceAmount}`
            });
            break; // 每个满减活动只匹配一条最优规则
          }
        }
      }
    }

    // 5. 优惠券
    if (body.couponTemplateId) {
      const coupon = await queryOne<any>(
        `SELECT id, type, value, min_amount, max_discount, applicable_scope, applicable_ids
         FROM coupon_template WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?`,
        [body.couponTemplateId, tenantId, now, now]
      );
      if (coupon && discountedTotal >= Number(coupon.min_amount)) {
        let couponDiscount = 0;
        if (coupon.type === "FIXED") {
          couponDiscount = Number(coupon.value);
        } else if (coupon.type === "PERCENT") {
          const rawDiscount = discountedTotal * (1 - Number(coupon.value) / 100);
          couponDiscount = coupon.max_discount
            ? Math.min(rawDiscount, Number(coupon.max_discount))
            : rawDiscount;
        }
        if (couponDiscount > 0) {
          discountedTotal -= couponDiscount;
          breakdown.push({
            type: "COUPON",
            id: body.couponTemplateId,
            discount: Number(couponDiscount.toFixed(2)),
            description: coupon.type === "FIXED"
              ? `优惠券抵扣${coupon.value}元`
              : `优惠券${coupon.value}%折扣`
          });
        }
      }
    }

    // 确保不低于0
    discountedTotal = Math.max(0, discountedTotal);

    res.json(ok({
      originalTotal: Number(originalTotal.toFixed(2)),
      discountedTotal: Number(discountedTotal.toFixed(2)),
      totalSaved: Number((originalTotal - discountedTotal).toFixed(2)),
      breakdown
    }));
  })
);

// ========================================================================
// 小程序 - 优惠券 (Miniapp)
// ========================================================================

// 我可领取的优惠券列表
miniappMarketingRouter.get(
  "/coupons/available",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const now = new Date().toISOString();
    const records = await query<any>(
      `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, total_count AS totalCount,
              claimed_count AS claimedCount,
              start_time AS startTime, end_time AS endTime, description
       FROM coupon_template
       WHERE tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
         AND (total_count = 0 OR claimed_count < total_count)
       ORDER BY created_at DESC`,
      [tenantId, now, now]
    );

    res.json(ok({ total: records.length, records }));
  })
);

// 领取优惠券（防重复+库存扣减事务）
miniappMarketingRouter.post(
  "/coupons/:templateId/claim",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const templateId = Number(req.params.templateId);
    const userId = Number(req.user?.id || req.body.userId || req.query.userId || 0);
    if (!userId) {
      res.status(400).json({ code: "400", message: "缺少用户ID" });
      return;
    }

    const now = new Date().toISOString();

    await transaction(async (conn) => {
      // 锁定模板行
      const [templateRows] = await conn.execute(
        `SELECT id, name, type, value, min_amount, max_discount, total_count, claimed_count,
                end_time, status
         FROM coupon_template
         WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
         FOR UPDATE`,
        [templateId, tenantId, now, now]
      ) as any;

      const template = (templateRows as any[])[0];
      if (!template) {
        res.status(404).json({ code: "404", message: "优惠券不存在或已过期" });
        return;
      }

      // 检查库存
      if (template.total_count > 0 && template.claimed_count >= template.total_count) {
        res.status(400).json({ code: "400", message: "优惠券已被领完" });
        return;
      }

      // 防重复领取
      const [existingRows] = await conn.execute(
        `SELECT uc.id FROM user_coupon uc
         JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
         WHERE uc.template_id = ? AND uc.user_id = ? AND uc.status = 'AVAILABLE'`,
        [tenantId, templateId, userId]
      ) as any;

      if ((existingRows as any[]).length > 0) {
        res.status(400).json({ code: "400", message: "您已领取过该优惠券" });
        return;
      }

      // 计算过期时间（取模板结束时间和领取后N天的较早者）
      const endTime = new Date(String(template.end_time));
      const expiresAt = endTime.toISOString();

      // 插入用户优惠券
      await conn.execute(
        `INSERT INTO user_coupon (template_id, user_id, status, expires_at, tenant_id)
         VALUES (?, ?, 'AVAILABLE', ?, ?)`,
        [templateId, userId, expiresAt, tenantId]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE coupon_template SET claimed_count = claimed_count + 1 WHERE id = ? AND tenant_id = ?`,
        [templateId, tenantId]
      );
    });

    const record = await queryOne<any>(
      `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId,
              uc.status, uc.claimed_at AS claimedAt, uc.expires_at AS expiresAt,
              ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
              ct.min_amount AS minAmount, ct.applicable_scope AS applicableScope
       FROM user_coupon uc
       JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
       WHERE uc.template_id = ? AND uc.user_id = ? AND uc.tenant_id = ?
       ORDER BY uc.id DESC LIMIT 1`,
      [tenantId, templateId, userId, tenantId]
    );

    res.json(ok(record));
  })
);

// 我的优惠券（分页+状态筛选）
miniappMarketingRouter.get(
  "/coupons/mine",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const userId = Number(req.user?.id || req.query.userId || 0);
    if (!userId) {
      res.status(400).json({ code: "400", message: "缺少用户ID" });
      return;
    }
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["uc.user_id = ?", "uc.tenant_id = ?"];
    const params: unknown[] = [userId, tenantId];

    if (req.query.status) {
      conditions.push("uc.status = ?");
      params.push(req.query.status);
    }

    const where = conditions.join(" AND ");

    const records = await query<any>(
      `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId,
              uc.order_id AS orderId, uc.status, uc.claimed_at AS claimedAt,
              uc.used_at AS usedAt, uc.expires_at AS expiresAt,
              ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
              ct.min_amount AS minAmount, ct.max_discount AS maxDiscount,
              ct.applicable_scope AS applicableScope, ct.description
       FROM user_coupon uc
       JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
       WHERE ${where}
       ORDER BY uc.claimed_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, ...params, pageSize, offset]
    );

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM user_coupon uc WHERE ${where}`,
      params
    );

    res.json(ok({
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    }));
  })
);

// ========================================================================
// 小程序 - 秒杀 (Miniapp)
// ========================================================================

// 进行中的秒杀列表
miniappMarketingRouter.get(
  "/promotions/flash-sale/active",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const now = new Date().toISOString();
    const records = await query<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              flash_price AS flashPrice, original_price AS originalPrice,
              total_stock AS totalStock, sold_count AS soldCount, limit_per_user AS limitPerUser,
              start_time AS startTime, end_time AS endTime
       FROM flash_sale
       WHERE tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       ORDER BY start_time ASC`,
      [tenantId, now, now]
    );

    res.json(ok({ total: records.length, records }));
  })
);

// 秒杀下单（库存扣减+限购检查+事务）
miniappMarketingRouter.post(
  "/promotions/flash-sale/:id/buy",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const flashSaleId = Number(req.params.id);
    const body = z.object({
      userId: z.number().int().positive(),
      quantity: z.number().int().min(1)
    }).parse(req.body);

    const now = new Date().toISOString();

    await transaction(async (conn) => {
      // 锁定秒杀活动行
      const [flashRows] = await conn.execute(
        `SELECT id, flash_price, total_stock, sold_count, limit_per_user, status,
                start_time, end_time
         FROM flash_sale
         WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
         FOR UPDATE`,
        [flashSaleId, tenantId, now, now]
      ) as any;

      const flash = (flashRows as any[])[0];
      if (!flash) {
        res.status(404).json({ code: "404", message: "秒杀活动不存在或已结束" });
        return;
      }

      // 检查库存
      const remaining = Number(flash.total_stock) - Number(flash.sold_count);
      if (remaining < body.quantity) {
        res.status(400).json({ code: "400", message: "秒杀库存不足" });
        return;
      }

      // 限购检查
      const [purchaseRows] = await conn.execute(
        `SELECT COALESCE(SUM(quantity), 0) AS totalQty
         FROM flash_sale_record fsr
         JOIN flash_sale fs ON fs.id = fsr.flash_sale_id AND fs.tenant_id = ?
         WHERE fsr.flash_sale_id = ? AND fsr.user_id = ?`,
        [tenantId, flashSaleId, body.userId]
      ) as any;

      const purchased = Number((purchaseRows as any[])[0]?.totalQty || 0);
      if (purchased + body.quantity > Number(flash.limit_per_user)) {
        res.status(400).json({ code: "400", message: `每人限购${flash.limit_per_user}件，您已购买${purchased}件` });
        return;
      }

      // 扣减库存
      await conn.execute(
        `UPDATE flash_sale SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
        [body.quantity, flashSaleId, tenantId]
      );

      // 创建秒杀记录（orderId为null，后续由订单系统关联）
      await conn.execute(
        `INSERT INTO flash_sale_record (flash_sale_id, user_id, quantity, price, tenant_id)
         VALUES (?, ?, ?, ?, ?)`,
        [flashSaleId, body.userId, body.quantity, flash.flash_price, tenantId]
      );
    });

    res.json(ok({
      flashSaleId,
      userId: body.userId,
      quantity: body.quantity,
      message: "秒杀下单成功"
    }));
  })
);

// ========================================================================
// 小程序 - 拼团 (Miniapp)
// ========================================================================

// 进行中的拼团列表
miniappMarketingRouter.get(
  "/promotions/group-buy/active",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const now = new Date().toISOString();
    const records = await query<any>(
      `SELECT id, name, product_id AS productId, sku_id AS skuId,
              group_price AS groupPrice, original_price AS originalPrice,
              min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
              time_limit_hours AS timeLimitHours, total_stock AS totalStock,
              sold_count AS soldCount,
              start_time AS startTime, end_time AS endTime
       FROM group_buy
       WHERE tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       ORDER BY start_time ASC`,
      [tenantId, now, now]
    );

    res.json(ok({ total: records.length, records }));
  })
);

// 开团（创建team+leader记录+扣库存）
miniappMarketingRouter.post(
  "/promotions/group-buy/:id/create-team",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const activityId = Number(req.params.id);
    const body = z.object({
      userId: z.number().int().positive(),
      quantity: z.number().int().min(1).default(1)
    }).parse(req.body);

    const now = new Date().toISOString();

    await transaction(async (conn) => {
      // 锁定活动行
      const [activityRows] = await conn.execute(
        `SELECT id, group_price, min_group_size, max_group_size, time_limit_hours,
                total_stock, sold_count, status, start_time, end_time
         FROM group_buy
         WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
         FOR UPDATE`,
        [activityId, tenantId, now, now]
      ) as any;

      const activity = (activityRows as any[])[0];
      if (!activity) {
        res.status(404).json({ code: "404", message: "拼团活动不存在或已结束" });
        return;
      }

      // 检查库存
      const remaining = Number(activity.total_stock) - Number(activity.sold_count);
      if (remaining < body.quantity) {
        res.status(400).json({ code: "400", message: "拼团库存不足" });
        return;
      }

      // 计算过期时间
      const expiresAt = new Date(Date.now() + Number(activity.time_limit_hours) * 3600 * 1000).toISOString();

      // 创建拼团组
      const [teamResult] = await conn.execute(
        `INSERT INTO group_buy_team (activity_id, leader_id, current_size, target_size, status, expires_at, tenant_id)
         VALUES (?, ?, 1, ?, 'PENDING', ?, ?)`,
        [activityId, body.userId, activity.min_group_size, expiresAt, tenantId]
      ) as any;

      const teamId = (teamResult as any).insertId;

      // 创建团长记录
      await conn.execute(
        `INSERT INTO group_buy_member (team_id, user_id, is_leader, tenant_id)
         VALUES (?, ?, 1, ?)`,
        [teamId, body.userId, tenantId]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
        [body.quantity, activityId, tenantId]
      );

      // 返回团信息
      const team = await conn.execute(
        `SELECT id, activity_id AS activityId, leader_id AS leaderId,
                current_size AS currentSize, target_size AS targetSize,
                status, expires_at AS expiresAt, created_at AS createdAt
         FROM group_buy_team WHERE id = ? AND tenant_id = ?`,
        [teamId, tenantId]
      ) as any;

      res.json(ok((team as any[])[0]));
    });
  })
);

// 团详情
miniappMarketingRouter.get(
  "/promotions/group-buy/team/:teamId",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const teamId = Number(req.params.teamId);

    const team = await queryOne<any>(
      `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
              gbt.leader_order_id AS leaderOrderId, gbt.current_size AS currentSize,
              gbt.target_size AS targetSize, gbt.status,
              gbt.expires_at AS expiresAt, gbt.created_at AS createdAt, gbt.completed_at AS completedAt,
              gb.name AS activityName, gb.group_price AS groupPrice, gb.original_price AS originalPrice
       FROM group_buy_team gbt
       JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       WHERE gbt.id = ? AND gbt.tenant_id = ?`,
      [tenantId, teamId, tenantId]
    );

    if (!team) {
      res.status(404).json({ code: "404", message: "拼团组不存在" });
      return;
    }

    // 获取团员列表
    const members = await query<any>(
      `SELECT id, user_id AS userId, order_id AS orderId, is_leader AS isLeader, joined_at AS joinedAt
       FROM group_buy_member WHERE team_id = ? AND tenant_id = ?`,
      [teamId, tenantId]
    );

    res.json(ok({ ...team, members }));
  })
);

// 参团（检查人数+扣库存）
miniappMarketingRouter.post(
  "/promotions/group-buy/team/:teamId/join",
  requireAuthWithTenant,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const teamId = Number(req.params.teamId);
    const body = z.object({
      userId: z.number().int().positive(),
      quantity: z.number().int().min(1).default(1)
    }).parse(req.body);

    const now = new Date().toISOString();

    await transaction(async (conn) => {
      // 锁定拼团组行
      const [teamRows] = await conn.execute(
        `SELECT gbt.id, gbt.activity_id, gbt.current_size, gbt.target_size, gbt.status, gbt.expires_at,
                gb.max_group_size, gb.total_stock, gb.sold_count, gb.status AS activityStatus
         FROM group_buy_team gbt
         JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
         WHERE gbt.id = ? AND gbt.tenant_id = ? AND gbt.status = 'PENDING' AND gbt.expires_at > ?
         FOR UPDATE`,
        [tenantId, teamId, tenantId, now]
      ) as any;

      const team = (teamRows as any[])[0];
      if (!team) {
        res.status(404).json({ code: "404", message: "拼团组不存在或已结束" });
        return;
      }

      // 检查是否已是团员
      const [memberRows] = await conn.execute(
        `SELECT id FROM group_buy_member WHERE team_id = ? AND user_id = ? AND tenant_id = ?`,
        [teamId, body.userId, tenantId]
      ) as any;

      if ((memberRows as any[]).length > 0) {
        res.status(400).json({ code: "400", message: "您已参与该团" });
        return;
      }

      // 检查人数是否已满
      if (Number(team.current_size) >= Number(team.target_size)) {
        res.status(400).json({ code: "400", message: "该团已满员" });
        return;
      }

      // 检查活动库存
      const remaining = Number(team.total_stock) - Number(team.sold_count);
      if (remaining < body.quantity) {
        res.status(400).json({ code: "400", message: "拼团库存不足" });
        return;
      }

      // 添加团员
      await conn.execute(
        `INSERT INTO group_buy_member (team_id, user_id, is_leader, tenant_id) VALUES (?, ?, 0, ?)`,
        [teamId, body.userId, tenantId]
      );

      // 更新团人数
      const newSize = Number(team.current_size) + 1;
      const isCompleted = newSize >= Number(team.target_size);

      await conn.execute(
        `UPDATE group_buy_team
         SET current_size = ?, status = ?, completed_at = ?
         WHERE id = ? AND tenant_id = ?`,
        [
          newSize,
          isCompleted ? "COMPLETED" : "PENDING",
          isCompleted ? now : null,
          teamId,
          tenantId
        ]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
        [body.quantity, team.activity_id, tenantId]
      );
    });

    // 返回更新后的团信息
    const team = await queryOne<any>(
      `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
              gbt.current_size AS currentSize, gbt.target_size AS targetSize,
              gbt.status, gbt.expires_at AS expiresAt,
              gb.name AS activityName, gb.group_price AS groupPrice
       FROM group_buy_team gbt
       JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       WHERE gbt.id = ? AND gbt.tenant_id = ?`,
      [tenantId, teamId, tenantId]
    );

    res.json(ok({
      ...team,
      message: team?.status === "COMPLETED" ? "拼团成功" : "参团成功"
    }));
  })
);
