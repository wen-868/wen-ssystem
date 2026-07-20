import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function listCustomerPrices(params: {
  customerId?: number; skuId?: number; page: number; pageSize: number; tenantId: string;
}) {
  const { customerId, skuId, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["cp.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (customerId !== undefined) {
    conditions.push("cp.customer_id = ?");
    queryParams.push(customerId);
  }
  if (skuId !== undefined) {
    conditions.push("cp.sku_id = ?");
    queryParams.push(skuId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT cp.id, cp.customer_id AS customerId, cp.sku_id AS skuId,
            cp.custom_price AS customPrice, cp.effective_start AS effectiveStart,
            cp.effective_end AS effectiveEnd, cp.status,
            m.name AS customerName, ps.sku_name AS skuName,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice
     FROM t_customer_price cp
     LEFT JOIN t_member m ON m.id = cp.customer_id
     LEFT JOIN t_product_sku ps ON ps.id = cp.sku_id
     LEFT JOIN t_product_price pp ON pp.sku_id = cp.sku_id
     ${where}
     ORDER BY cp.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_customer_price cp ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createCustomerPrice(params: {
  customerId: number; skuId: number; customPrice: number;
  effectiveStart?: string; effectiveEnd?: string; tenantId: string;
}) {
  const { customerId, skuId, customPrice, effectiveStart, effectiveEnd, tenantId } = params;
  // 检查是否已存在
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_customer_price WHERE customer_id = ? AND sku_id = ? AND tenant_id = ?",
    [customerId, skuId, tenantId],
    tenantId
  );
  if (existing) throw new Error("该客户已存在此SKU的价格记录");
  const result = await queryWithTenant<any>(
    `INSERT INTO t_customer_price (customer_id, sku_id, custom_price, effective_start, effective_end, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [customerId, skuId, customPrice, effectiveStart ?? null, effectiveEnd ?? null, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, customerId, skuId, customPrice, effectiveStart, effectiveEnd };
}

export async function updateCustomerPrice(id: number, params: {
  customPrice?: number; effectiveStart?: string; effectiveEnd?: string; status?: number;
  tenantId: string;
}) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_customer_price WHERE id = ? AND tenant_id = ?",
    [id, params.tenantId],
    params.tenantId
  );
  if (!existing) throw new Error("价格记录不存在");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (params.customPrice !== undefined) { fields.push("custom_price = ?"); values.push(params.customPrice); }
  if (params.effectiveStart !== undefined) { fields.push("effective_start = ?"); values.push(params.effectiveStart); }
  if (params.effectiveEnd !== undefined) { fields.push("effective_end = ?"); values.push(params.effectiveEnd); }
  if (params.status !== undefined) { fields.push("status = ?"); values.push(params.status); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<any>(
    `UPDATE t_customer_price SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
    values,
    params.tenantId
  );
  return { id, ...params };
}

export async function deleteCustomerPrice(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_customer_price WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) throw new Error("价格记录不存在");
  await queryWithTenant<any>(
    "DELETE FROM t_customer_price WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id };
}

// 获取客户对某SKU的有效价格（优先客户专属价格，否则返回null由调用方fallback）
export async function getCustomerPrice(customerId: number, skuId: number, tenantId: string) {
  const now = new Date().toISOString().slice(0, 10);
  const price = await queryOneWithTenant<any>(
    `SELECT custom_price AS customPrice
     FROM t_customer_price
     WHERE customer_id = ? AND sku_id = ? AND status = 1 AND tenant_id = ?
       AND (effective_start IS NULL OR effective_start <= ?)
       AND (effective_end IS NULL OR effective_end >= ?)
     LIMIT 1`,
    [customerId, skuId, tenantId, now, now],
    tenantId
  );
  return price ?? null;
}