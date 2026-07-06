import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function listPriceLevels(tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_price_level
     WHERE tenant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [tenantId],
    tenantId
  );
  return { total: records.length, records };
}

export async function createPriceLevel(body: {
  levelCode: string;
  levelName: string;
  discountRate: number;
  minOrderAmount: number;
  description: string;
  sortOrder: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_price_level WHERE level_code = ? AND tenant_id = ?",
    [body.levelCode, tenantId],
    tenantId
  );
  if (existing) {
    return { error: { code: "400", message: "等级编码已存在" } };
  }

  await queryWithTenant(
    `INSERT INTO t_price_level (level_code, level_name, discount_rate, min_order_amount, description, sort_order, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [body.levelCode, body.levelName, body.discountRate, body.minOrderAmount, body.description, body.sortOrder, tenantId],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt
     FROM t_price_level WHERE level_code = ? AND tenant_id = ?`,
    [body.levelCode, tenantId],
    tenantId
  );

  return { data: record };
}

export async function updatePriceLevel(levelId: number, body: {
  levelName?: string;
  discountRate?: number;
  minOrderAmount?: number;
  description?: string;
  sortOrder?: number;
  status?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_price_level WHERE id = ? AND tenant_id = ?",
    [levelId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "价格等级不存在" } };
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.levelName !== undefined) { updates.push("level_name = ?"); params.push(body.levelName); }
  if (body.discountRate !== undefined) { updates.push("discount_rate = ?"); params.push(body.discountRate); }
  if (body.minOrderAmount !== undefined) { updates.push("min_order_amount = ?"); params.push(body.minOrderAmount); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }
  if (body.sortOrder !== undefined) { updates.push("sort_order = ?"); params.push(body.sortOrder); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await queryWithTenant(
      `UPDATE t_price_level SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, levelId, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<any>(
    `SELECT id, level_code AS levelCode, level_name AS levelName,
            discount_rate AS discountRate, min_order_amount AS minOrderAmount,
            description, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_price_level WHERE id = ? AND tenant_id = ?`,
    [levelId, tenantId],
    tenantId
  );

  return { data: record };
}

export async function disablePriceLevel(levelId: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, level_code FROM t_price_level WHERE id = ? AND tenant_id = ?",
    [levelId, tenantId],
    tenantId
  );
  if (!existing) {
    return { error: { code: "404", message: "价格等级不存在" } };
  }
  if (existing.level_code === "RETAIL") {
    return { error: { code: "400", message: "零售价等级不可停用" } };
  }

  await queryWithTenant(
    "UPDATE t_price_level SET status = 0 WHERE id = ? AND tenant_id = ?",
    [levelId, tenantId],
    tenantId
  );

  return { data: { levelId, status: "disabled" } };
}
