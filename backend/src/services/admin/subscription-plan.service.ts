import { query, queryOne } from "../../shared/db";

// ========== 类型定义 ==========

interface SubscriptionPlanRow {
  id: number;
  planCode: string;
  planName: string;
  planType: string;
  price: number;
  originalPrice: number;
  durationDays: number;
  maxUsers: number;
  maxStores: number;
  maxCustomers: number;
  maxProducts: number;
  maxStorageMb: number;
  features: unknown;
  moduleAccess: unknown;
  description: string | null;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PlanBriefRow {
  id: number;
  planCode: string;
  planName: string;
  price: number;
  status: string;
  updatedAt: string;
}

interface PlanFeaturesRow {
  id: number;
  planCode: string;
  planName: string;
  features: unknown;
  moduleAccess: unknown;
  updatedAt: string;
}

interface IdRow {
  id: number;
}

export async function listPlans(status?: string) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<SubscriptionPlanRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, plan_type AS planType,
            price, original_price AS originalPrice,
            duration_days AS durationDays,
            max_users AS maxUsers, max_stores AS maxStores,
            max_customers AS maxCustomers, max_products AS maxProducts,
            max_storage_mb AS maxStorageMb,
            features, module_access AS moduleAccess,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_subscription_plan
     ${where}
     ORDER BY sort_order ASC, id ASC`,
    params
  );

  return { total: records.length, records };
}

export async function getPlan(planId: number) {
  const record = await queryOne<SubscriptionPlanRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, plan_type AS planType,
            price, original_price AS originalPrice,
            duration_days AS durationDays,
            max_users AS maxUsers, max_stores AS maxStores,
            max_customers AS maxCustomers, max_products AS maxProducts,
            max_storage_mb AS maxStorageMb,
            features, module_access AS moduleAccess,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_subscription_plan
     WHERE id = ?`,
    [planId]
  );
  return record;
}

export async function createPlan(body: {
  planCode: string;
  planName: string;
  planType: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  maxUsers: number;
  maxStores: number;
  maxCustomers: number;
  maxProducts: number;
  maxStorageMb: number;
  features?: any;
  moduleAccess?: any;
  description?: string;
  sortOrder: number;
  status: string;
}) {
  await query(
    `INSERT INTO t_subscription_plan (
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

  return { plan_code: body.planCode };
}

export async function updatePlan(planId: number, body: {
  planName?: string;
  planType?: string;
  price?: number;
  originalPrice?: number;
  durationDays?: number;
  maxUsers?: number;
  maxStores?: number;
  maxCustomers?: number;
  maxProducts?: number;
  maxStorageMb?: number;
  features?: any;
  moduleAccess?: any;
  description?: string;
  sortOrder?: number;
  status?: string;
}) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_subscription_plan WHERE id = ?",
    [planId]
  );
  if (!existing) {
    return null;
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
    const value = (body as Record<string, unknown>)[key];
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
      `UPDATE t_subscription_plan SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  const record = await queryOne<PlanBriefRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, price, status, updated_at AS updatedAt
     FROM t_subscription_plan WHERE id = ?`,
    [planId]
  );

  return record;
}

export async function deletePlan(planId: number) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_subscription_plan WHERE id = ?",
    [planId]
  );
  if (!existing) {
    return null;
  }

  // 检查是否有关联订阅，避免误删在用套餐
  const refRow = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM t_subscription WHERE plan_id = ?",
    [planId]
  );
  if (Number(refRow?.total ?? 0) > 0) {
    throw Object.assign(new Error("该套餐存在关联订阅，无法删除"), { statusCode: 400 });
  }

  await query("DELETE FROM t_subscription_plan WHERE id = ?", [planId]);
  return { planId, deleted: true };
}

export async function updatePlanFeatures(planId: number, body: {
  features?: unknown;
  moduleAccess?: unknown;
}) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_subscription_plan WHERE id = ?",
    [planId]
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

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
      `UPDATE t_subscription_plan SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  const record = await queryOne<PlanFeaturesRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName,
            features, module_access AS moduleAccess, updated_at AS updatedAt
     FROM t_subscription_plan WHERE id = ?`,
    [planId]
  );
  return record;
}
