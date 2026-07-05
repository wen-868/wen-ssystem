import { query, queryOne } from "../../shared/db.js";

export async function listPlans(status?: string) {
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

  return { total: records.length, records };
}

export async function getPlan(planId: number) {
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
  const existing = await queryOne<any>(
    "SELECT id FROM subscription_plan WHERE id = ?",
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
      `UPDATE subscription_plan SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  const record = await queryOne<any>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, price, status, updated_at AS updatedAt
     FROM subscription_plan WHERE id = ?`,
    [planId]
  );

  return record;
}
