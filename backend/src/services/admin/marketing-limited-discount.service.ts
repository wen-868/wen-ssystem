import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** COUNT(*) AS cnt 通用返回 */
interface CountCntRow {
  cnt: number;
}

/** t_limited_discount 表行 */
interface LimitedDiscountRow {
  id: number | string;
  activity_code: string;
  activity_name: string;
  activity_desc: string | null;
  discount_type: string;
  discount_value: number | string;
  min_purchase: number | string;
  applicable_scope: string;
  applicable_ids: string | null;
  start_time: string | Date;
  end_time: string | Date;
  total_stock: number | string;
  available_stock: number | string;
  limit_per_user: number | string | null;
  per_order_limit: number | string | null;
  tenant_id: string;
  created_by: number | string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** t_limited_discount_product 表行 */
interface LimitedDiscountProductRow {
  id: number | string;
  discount_id: number | string;
  product_id: number | string;
  sku_id: number | string | null;
  original_price: number | string;
  discount_price: number | string;
  stock: number | string;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 创建限时折扣入参（camelCase，与 controller Zod schema 对齐） */
interface CreateLimitedDiscountBody {
  name: string;
  description?: string | null;
  discountType?: string;
  discountValue: number | string;
  startTime: string;
  endTime: string;
  limitPerUser?: number | string | null;
  totalLimit?: number | string;
  status?: string;
  applicableScope?: string;  
}    

/** 更新限时折扣入参（camelCase，与 controller Zod schema 对齐） */
interface UpdateLimitedDiscountBody {
  name?: string;
  description?: string | null;
  discountType?: string;
  discountValue?: number | string;
  startTime?: string;
  endTime?: string;
  limitPerUser?: number | string | null;
  totalLimit?: number | string;
  status?: string;
  applicableScope?: string;
}

/** 添加折扣商品入参（camelCase，与 controller Zod schema 对齐） */
interface AddDiscountProductBody {
  skuIds: number[];
}

/** SKU 原价查询行 */
interface SkuPriceInfoRow {
  spu_id: number | string;
  price: number | string;
}

/** INSERT 返回结果 */
interface InsertResult {
  insertId: number | string;
}

export async function createLimitedDiscount(data: CreateLimitedDiscountBody, tenantId: string, userId: number) {
  const code = makeBizNo("XS");
  const result = await queryWithTenant<InsertResult>(
    `INSERT INTO t_limited_discount (activity_code, activity_name, activity_desc, discount_type, discount_value, min_purchase, applicable_scope, applicable_ids, start_time, end_time, total_stock, available_stock, limit_per_user, per_order_limit, tenant_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.name, data.description ?? null, data.discountType ?? "PERCENT", data.discountValue, 0, data.applicableScope ?? "ALL", null, data.startTime, data.endTime, data.totalLimit ?? 0, data.totalLimit ?? 0, data.limitPerUser ?? null, null, tenantId, userId], tenantId
  );
  const insertId = Array.isArray(result) ? (result[0] as InsertResult)?.insertId : (result as InsertResult)?.insertId;
  return { id: insertId, activity_code: code };
}

export async function listLimitedDiscounts(params: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_limited_discount ${where}`, values, tenantId);
  const rows = await queryWithTenant<LimitedDiscountRow>(
    `SELECT * FROM t_limited_discount ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getLimitedDiscountDetail(id: number, tenantId: string) {
  const discount = await queryOneWithTenant<LimitedDiscountRow>("SELECT * FROM t_limited_discount WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!discount) return null;
  const products = await queryWithTenant<LimitedDiscountProductRow>("SELECT * FROM t_limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { ...discount, products };
}

export async function updateLimitedDiscount(id: number, data: UpdateLimitedDiscountBody, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("activity_name = ?"); values.push(data.name); }
  if (data.description !== undefined) { fields.push("activity_desc = ?"); values.push(data.description); }
  if (data.discountType !== undefined) { fields.push("discount_type = ?"); values.push(data.discountType); }
  if (data.discountValue !== undefined) { fields.push("discount_value = ?"); values.push(data.discountValue); }
  if (data.applicableScope !== undefined) { fields.push("applicable_scope = ?"); values.push(data.applicableScope); }
  if (data.startTime !== undefined) { fields.push("start_time = ?"); values.push(data.startTime); }
  if (data.endTime !== undefined) { fields.push("end_time = ?"); values.push(data.endTime); }
  if (data.totalLimit !== undefined) { fields.push("total_stock = ?"); values.push(data.totalLimit); }
  if (data.limitPerUser !== undefined) { fields.push("limit_per_user = ?"); values.push(data.limitPerUser); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_limited_discount SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deleteLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM t_limited_discount WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function activateLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_limited_discount SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function pauseLimitedDiscount(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_limited_discount SET status = 'PAUSED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function getDiscountProducts(discountId: number, tenantId: string) {
  return queryWithTenant<LimitedDiscountProductRow>("SELECT * FROM t_limited_discount_product WHERE discount_id = ? AND tenant_id = ?", [discountId, tenantId], tenantId);
}

export async function addDiscountProduct(discountId: number, data: AddDiscountProductBody, tenantId: string) {
  for (const skuId of data.skuIds) {
    const skuInfo = await queryOneWithTenant<SkuPriceInfoRow>(
      "SELECT spu_id, price FROM t_product_sku WHERE id = ? AND tenant_id = ?",
      [skuId, tenantId],
      tenantId
    );
    if (skuInfo) {
      const originalPrice = Number(skuInfo.price) || 0;
      await queryWithTenant(
        "INSERT INTO t_limited_discount_product (discount_id, product_id, sku_id, original_price, discount_price, stock, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [discountId, skuInfo.spu_id, skuId, originalPrice, originalPrice, 0, tenantId], tenantId
      );
    }
  }
}

export async function removeDiscountProduct(discountId: number, productId: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_limited_discount_product WHERE discount_id = ? AND product_id = ? AND tenant_id = ?", [discountId, productId, tenantId], tenantId);
}
