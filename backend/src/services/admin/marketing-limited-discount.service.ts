import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { makeBizNo } from "../../shared/biz-no.js";

export async function createLimitedDiscount(data: any, tenantId: string, userId: number) {
  const code = makeBizNo("XS");
  const result = await queryWithTenant(
    `INSERT INTO limited_discount (activity_code, activity_name, activity_desc, discount_type, discount_value, min_purchase, applicable_scope, applicable_ids, start_time, end_time, total_stock, available_stock, limit_per_user, per_order_limit, tenant_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.activity_name, data.activity_desc ?? null, data.discount_type ?? "PERCENT", data.discount_value, data.min_purchase ?? 0, data.applicable_scope ?? "ALL", data.applicable_ids ? JSON.stringify(data.applicable_ids) : null, data.start_time, data.end_time, data.total_stock ?? 0, data.total_stock ?? 0, data.limit_per_user ?? null, data.per_order_limit ?? null, tenantId, userId], tenantId
  );
  return { id: (result as any).insertId, activity_code: code };
}

export async function listLimitedDiscounts(params: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM limited_discount ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM limited_discount ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getLimitedDiscountDetail(id: number, tenantId: string) {
  const discount = await queryOneWithTenant<any>("SELECT * FROM limited_discount WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!discount) return null;
  const products = await queryWithTenant<any>("SELECT * FROM limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { ...discount, products };
}

export async function updateLimitedDiscount(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.activity_name !== undefined) { fields.push("activity_name = ?"); values.push(data.activity_name); }
  if (data.activity_desc !== undefined) { fields.push("activity_desc = ?"); values.push(data.activity_desc); }
  if (data.discount_type !== undefined) { fields.push("discount_type = ?"); values.push(data.discount_type); }
  if (data.discount_value !== undefined) { fields.push("discount_value = ?"); values.push(data.discount_value); }
  if (data.min_purchase !== undefined) { fields.push("min_purchase = ?"); values.push(data.min_purchase); }
  if (data.applicable_scope !== undefined) { fields.push("applicable_scope = ?"); values.push(data.applicable_scope); }
  if (data.applicable_ids !== undefined) { fields.push("applicable_ids = ?"); values.push(JSON.stringify(data.applicable_ids)); }
  if (data.start_time !== undefined) { fields.push("start_time = ?"); values.push(data.start_time); }
  if (data.end_time !== undefined) { fields.push("end_time = ?"); values.push(data.end_time); }
  if (data.total_stock !== undefined) { fields.push("total_stock = ?"); values.push(data.total_stock); }
  if (data.limit_per_user !== undefined) { fields.push("limit_per_user = ?"); values.push(data.limit_per_user); }
  if (data.per_order_limit !== undefined) { fields.push("per_order_limit = ?"); values.push(data.per_order_limit); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE limited_discount SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM limited_discount WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function activateLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("UPDATE limited_discount SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function pauseLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("UPDATE limited_discount SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function getDiscountProducts(discountId: number, tenantId: string) {
  return queryWithTenant<any>("SELECT * FROM limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [discountId, tenantId], tenantId);
}

export async function addDiscountProduct(discountId: number, data: any, tenantId: string) {
  await queryWithTenant(
    "INSERT INTO limited_discount_product (discount_id, product_id, sku_id, original_price, discount_price, stock, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [discountId, data.product_id, data.sku_id ?? null, data.original_price, data.discount_price, data.stock ?? 0, tenantId], tenantId
  );
}

export async function removeDiscountProduct(discountId: number, productId: number, tenantId: string) {
  await queryWithTenant("DELETE FROM limited_discount_product WHERE discount_id = ? AND product_id = ? AND tenant_id = ?", [discountId, productId, tenantId], tenantId);
}