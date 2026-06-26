import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const subscriptionRouter = Router();

// ========== 套餐管理 ==========

// 获取套餐列表
subscriptionRouter.get("/plans", asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, plan_type AS planType,
            price, original_price AS originalPrice,
            duration_days AS durationDays,
            max_users AS maxUsers, max_stores AS maxStores,
            max_customers AS maxCustomers, max_products AS maxProducts,
            max_storage_mb AS maxStorageMb,
            features, module_access AS moduleAccess,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM subscription_plan
     ${where}
     ORDER BY sort_order ASC, id ASC`,
    params
  );

  res.json(ok({ total: records.length, records }));
}));

// 获取套餐详情
subscriptionRouter.get("/plans/:planId", asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId);

  const record = await queryOne<any>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, plan_type AS planType,
            price, original_price AS originalPrice,
            duration_days AS durationDays,
            max_users AS maxUsers, max_stores AS maxStores,
            max_customers AS maxCustomers, max_products AS maxProducts,
            max_storage_mb AS maxStorageMb,
            features, module_access AS moduleAccess,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM subscription_plan
     WHERE id = ?`,
    [planId]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "套餐不存在" });
    return;
  }

  res.json(ok(record));
}));

// 创建套餐
subscriptionRouter.post("/plans", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    planCode: z.string().min(1).max(32),
    planName: z.string().min(1).max(64),
    planType: z.enum(["MONTHLY", "YEARLY", "PERMANENT"]),
    price: z.number().min(0),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1),
    maxUsers: z.number().int().min(1).default(5),
    maxStores: z.number().int().min(1).default(1),
    maxCustomers: z.number().int().min(1).default(1000),
    maxProducts: z.number().int().min(1).default(500),
    maxStorageMb: z.number().int().min(1).default(1024),
    features: z.any().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().default(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  }).parse(req.body);

  await query(
    `INSERT INTO subscription_plan (
      plan_code, plan_name, plan_type, price, original_price,
      duration_days, max_users, max_stores, max_customers, max_products,
      max_storage_mb, features, module_access, description, sort_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.planCode, body.planName, body.planType,
      body.price, body.originalPrice || body.price,
      body.durationDays, body.maxUsers, body.maxStores,
      body.maxCustomers, body.maxProducts, body.maxStorageMb,
      body.features ? JSON.stringify(body.features) : null,
      body.moduleAccess ? JSON.stringify(body.moduleAccess) : null,
      body.description || null, body.sortOrder, body.status
    ]
  );

  res.json(ok({ plan_code: body.planCode }));
}));

// 更新套餐
subscriptionRouter.put("/plans/:planId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId);

  const body = z.object({
    planName: z.string().min(1).max(64).optional(),
    planType: z.enum(["MONTHLY", "YEARLY", "PERMANENT"]).optional(),
    price: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1).optional(),
    maxUsers: z.number().int().min(1).optional(),
    maxStores: z.number().int().min(1).optional(),
    maxCustomers: z.number().int().min(1).optional(),
    maxProducts: z.number().int().min(1).optional(),
    maxStorageMb: z.number().int().min(1).optional(),
    features: z.any().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM subscription_plan WHERE id = ?",
    [planId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "套餐不存在" });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, string> = {
    planName: "plan_name",
    planType: "plan_type",
    price: "price",
    originalPrice: "original_price",
    durationDays: "duration_days",
    maxUsers: "max_users",
    maxStores: "max_stores",
    maxCustomers: "max_customers",
    maxProducts: "max_products",
    maxStorageMb: "max_storage_mb",
    description: "description",
    sortOrder: "sort_order",
    status: "status",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (body as any)[key];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (body.features !== undefined) {
    updates.push("features = ?");
    params.push(JSON.stringify(body.features));
  }
  if (body.moduleAccess !== undefined) {
    updates.push("module_access = ?");
    params.push(JSON.stringify(body.moduleAccess));
  }

  if (updates.length > 0) {
    params.push(planId);
    await query(
      `UPDATE subscription_plan SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  const record = await queryOne<any>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, price, status, updated_at AS updatedAt
     FROM subscription_plan WHERE id = ?`,
    [planId]
  );

  res.json(ok(record));
}));

// ========== 订阅管理 ==========

// 获取订阅列表
subscriptionRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const {
    tenantId, status, paymentStatus, page = 1, pageSize = 20
  } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  if (tenantId) {
    conditions.push("s.tenant_id = ?");
    params.push(Number(tenantId));
  }
  if (status) {
    conditions.push("s.status = ?");
    params.push(status);
  }
  if (paymentStatus) {
    conditions.push("s.payment_status = ?");
    params.push(paymentStatus);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM subscription s
     LEFT JOIN tenant t ON t.id = s.tenant_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM subscription s ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 获取订阅详情
subscriptionRouter.get("/:subscriptionId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.subscriptionId);

  const record = await queryOne<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM subscription s
     LEFT JOIN tenant t ON t.id = s.tenant_id
     WHERE s.id = ?`,
    [subscriptionId]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "订阅不存在" });
    return;
  }

  // 查询操作日志
  const logs = await query<any>(
    `SELECT id, operation_type AS operationType,
            old_plan_id AS oldPlanId, new_plan_id AS newPlanId,
            old_end_date AS oldEndDate, new_end_date AS newEndDate,
            amount, operator_name AS operatorName, remark, created_at AS createdAt
     FROM subscription_operation_log
     WHERE subscription_id = ?
     ORDER BY created_at DESC`,
    [subscriptionId]
  );

  res.json(ok({ ...record, logs }));
}));

// 创建订阅（购买套餐）
subscriptionRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    tenantId: z.number().int().positive(),
    planId: z.number().int().positive(),
    startDate: z.string(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    autoRenew: z.number().int().min(0).max(1).default(0),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  // 验证租户存在
  const tenant = await queryOne<any>(
    "SELECT id, company_name, expire_at FROM tenant WHERE id = ?",
    [body.tenantId]
  );
  if (!tenant) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
  }

  // 验证套餐存在
  const plan = await queryOne<any>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.planId]
  );
  if (!plan) {
    res.status(404).json({ code: "404", message: "套餐不存在或已下架" });
    return;
  }

  const subscriptionNo = makeBizNo("SUB");
  const startDate = new Date(body.startDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration_days);

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO subscription (
        subscription_no, tenant_id, plan_id, plan_name, plan_type,
        start_date, end_date, duration_days, price,
        payment_status, payment_method, auto_renew, renew_price,
        status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, 'ACTIVE', ?)`,
      [
        subscriptionNo, body.tenantId, body.planId, plan.plan_name, plan.plan_type,
        body.startDate, endDate.toISOString().slice(0, 10), plan.duration_days, plan.price,
        body.paymentMethod || null, body.autoRenew, plan.price,
        body.remark || null
      ]
    );

    // 记录操作日志
    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, new_plan_id, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?)`,
      [subscriptionNo, body.planId, endDate.toISOString().slice(0, 10), plan.price,
       req.user!.id, req.user!.username, `创建订阅: ${subscriptionNo}`]
    );

    // 更新租户到期时间
    await conn.execute(
      "UPDATE tenant SET expire_at = ? WHERE id = ?",
      [endDate.toISOString().slice(0, 19).replace("T", " "), body.tenantId]
    );

    // 同步模块访问权限
    if (plan.module_access) {
      const modules = JSON.parse(plan.module_access);
      // 先清除旧的权限
      await conn.execute("DELETE FROM tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [body.tenantId]);
      // 插入新权限
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [body.tenantId, mod, mod, endDate.toISOString().slice(0, 19).replace("T", " ")]
        );
      }
    }

    // 插入操作日志
    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CREATE", subscriptionNo, "subscription", req.user!.id, req.user!.username,
       `创建订阅: ${subscriptionNo}, 套餐: ${plan.plan_name}`, body.tenantId]
    );
  });

  res.json(ok({ subscription_no: subscriptionNo }));
}));

// 续费订阅
subscriptionRouter.post("/:subscriptionId/renew", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.subscriptionId);

  const body = z.object({
    planId: z.number().int().positive().optional(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    `SELECT s.id, s.subscription_no, s.tenant_id, s.plan_id, s.plan_name, s.end_date, s.price,
            p.duration_days, p.price AS plan_price
     FROM subscription s
     LEFT JOIN subscription_plan p ON p.id = ?
     WHERE s.id = ?`,
    [body.planId || 0, subscriptionId]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "订阅不存在" });
    return;
  }

  const planId = body.planId || existing.plan_id;
  const plan = await queryOne<any>(
    "SELECT id, plan_name, plan_type, price, duration_days FROM subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [planId]
  );
  if (!plan) {
    res.status(404).json({ code: "404", message: "套餐不存在或已下架" });
    return;
  }

  // 续费从当前到期日开始
  const renewStartDate = new Date(existing.end_date);
  const renewEndDate = new Date(renewStartDate);
  renewEndDate.setDate(renewEndDate.getDate() + plan.duration_days);

  const subscriptionNo = makeBizNo("SUB");

  await transaction(async (conn) => {
    // 创建新的订阅记录（续费）
    await conn.execute(
      `INSERT INTO subscription (
        subscription_no, tenant_id, plan_id, plan_name, plan_type,
        start_date, end_date, duration_days, price,
        payment_status, payment_method, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, 'ACTIVE', ?)`,
      [
        subscriptionNo, existing.tenant_id, plan.id, plan.plan_name, plan.plan_type,
        renewStartDate.toISOString().slice(0, 10), renewEndDate.toISOString().slice(0, 10),
        plan.duration_days, plan.price,
        body.paymentMethod || null, body.remark || null
      ]
    );

    // 记录操作日志
    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, old_end_date, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'RENEW', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, existing.plan_id, plan.id, existing.end_date,
       renewEndDate.toISOString().slice(0, 10), plan.price,
       req.user!.id, req.user!.username, `续费订阅: ${subscriptionNo}`]
    );

    // 更新租户到期时间
    await conn.execute(
      "UPDATE tenant SET expire_at = ? WHERE id = ?",
      [renewEndDate.toISOString().slice(0, 19).replace("T", " "), existing.tenant_id]
    );

    // 同步模块访问权限
    if (plan.module_access) {
      const modules = JSON.parse(plan.module_access);
      await conn.execute("DELETE FROM tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod, mod, renewEndDate.toISOString().slice(0, 19).replace("T", " ")]
        );
      }
    }

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "RENEW", subscriptionNo, "subscription", req.user!.id, req.user!.username,
       `续费订阅: ${subscriptionNo}, 套餐: ${plan.plan_name}`, existing.tenant_id]
    );
  });

  res.json(ok({ subscription_no: subscriptionNo }));
}));

// 升级/降级套餐
subscriptionRouter.post("/:subscriptionId/change-plan", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.subscriptionId);

  const body = z.object({
    newPlanId: z.number().int().positive(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    `SELECT s.id, s.subscription_no, s.tenant_id, s.plan_id, s.plan_name, s.end_date, s.status
     FROM subscription s WHERE s.id = ?`,
    [subscriptionId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "订阅不存在" });
    return;
  }
  if (existing.status !== "ACTIVE") {
    res.status(400).json({ code: "400", message: "只有活跃订阅可以变更套餐" });
    return;
  }

  const newPlan = await queryOne<any>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.newPlanId]
  );
  if (!newPlan) {
    res.status(404).json({ code: "404", message: "目标套餐不存在或已下架" });
    return;
  }

  const oldPlan = await queryOne<any>(
    "SELECT id, plan_name, price FROM subscription_plan WHERE id = ?",
    [existing.plan_id]
  );

  // 计算差价（按比例）
  const priceDiff = Math.max(0, newPlan.price - (oldPlan?.price || 0));

  await transaction(async (conn) => {
    // 更新订阅的套餐信息
    await conn.execute(
      `UPDATE subscription SET plan_id = ?, plan_name = ?, price = ?, updated_at = NOW() WHERE id = ?`,
      [body.newPlanId, newPlan.plan_name, newPlan.price, subscriptionId]
    );

    // 记录操作日志
    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, amount, operator_id, operator_name, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, priceDiff > 0 ? "UPGRADE" : "DOWNGRADE",
       existing.plan_id, body.newPlanId, priceDiff,
       req.user!.id, req.user!.username,
       `套餐变更: ${oldPlan?.plan_name} -> ${newPlan.plan_name}`]
    );

    // 同步模块访问权限
    if (newPlan.module_access) {
      const modules = JSON.parse(newPlan.module_access);
      await conn.execute("DELETE FROM tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod, mod, existing.end_date]
        );
      }
    }

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CHANGE_PLAN", String(subscriptionId), "subscription",
       req.user!.id, req.user!.username,
       `套餐变更: ${oldPlan?.plan_name} -> ${newPlan.plan_name}`, existing.tenant_id]
    );
  });

  res.json(ok({ price_diff: priceDiff }));
}));

// 取消订阅
subscriptionRouter.post("/:subscriptionId/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.subscriptionId);

  const body = z.object({
    reason: z.string().max(255).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, subscription_no, tenant_id, status FROM subscription WHERE id = ?",
    [subscriptionId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "订阅不存在" });
    return;
  }
  if (existing.status === "CANCELLED") {
    res.status(400).json({ code: "400", message: "订阅已取消" });
    return;
  }

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE subscription SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [body.reason || null, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
       VALUES (?, 'CANCEL', ?, ?, ?)`,
      [subscriptionId, req.user!.id, req.user!.username, body.reason || "取消订阅"]
    );

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CANCEL", String(subscriptionId), "subscription",
       req.user!.id, req.user!.username, `取消订阅: ${existing.subscription_no}`, existing.tenant_id]
    );
  });

  res.json(ok({ subscription_id: subscriptionId, status: "CANCELLED" }));
}));

// 确认支付
subscriptionRouter.post("/:subscriptionId/pay", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.subscriptionId);

  const body = z.object({
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]),
    transactionNo: z.string().max(128).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, subscription_no, tenant_id, payment_status FROM subscription WHERE id = ?",
    [subscriptionId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "订阅不存在" });
    return;
  }
  if (existing.payment_status === "PAID") {
    res.status(400).json({ code: "400", message: "订阅已支付" });
    return;
  }

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE subscription SET payment_status = 'PAID', payment_method = ?,
       transaction_no = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [body.paymentMethod, body.transactionNo || null, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
       VALUES (?, 'PAY', ?, ?, ?)`,
      [subscriptionId, req.user!.id, req.user!.username, `确认支付: ${body.paymentMethod}`]
    );

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "PAY", String(subscriptionId), "subscription",
       req.user!.id, req.user!.username,
       `确认支付: ${existing.subscription_no}, 方式: ${body.paymentMethod}`, existing.tenant_id]
    );
  });

  res.json(ok({ subscription_id: subscriptionId, payment_status: "PAID" }));
}));

// ========== 到期检查（定时任务调用） ==========

// 获取即将到期的订阅列表
subscriptionRouter.get("/expiring/list", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 7);

  const records = await query<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            t.contact_mobile AS contactMobile,
            s.plan_name AS planName, s.end_date AS endDate,
            s.auto_renew AS autoRenew,
            s.expire_notify_sent AS expireNotifySent,
            DATEDIFF(s.end_date, CURDATE()) AS daysRemaining
     FROM subscription s
     LEFT JOIN tenant t ON t.id = s.tenant_id
     WHERE s.status = 'ACTIVE'
       AND s.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY s.end_date ASC`,
    [days]
  );

  res.json(ok({ total: records.length, records }));
}));

// 获取已过期但未停用的订阅
subscriptionRouter.get("/expired/list", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const records = await query<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            t.contact_mobile AS contactMobile,
            s.plan_name AS planName, s.end_date AS endDate,
            DATEDIFF(CURDATE(), s.end_date) AS overdueDays
     FROM subscription s
     LEFT JOIN tenant t ON t.id = s.tenant_id
     WHERE s.status = 'ACTIVE'
       AND s.end_date < CURDATE()
     ORDER BY s.end_date ASC`
  );

  res.json(ok({ total: records.length, records }));
}));
