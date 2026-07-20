import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function createPointsProduct(data: any, tenantId: string) {
  const code = makeBizNo("JF");
  const result = await queryWithTenant(
    `INSERT INTO t_points_product (product_code, product_name, product_image, product_desc, points_required, stock_total, stock_available, exchange_limit_per_user, exchange_limit_total, market_price, sort_order, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.product_name, data.product_image ?? null, data.product_desc ?? null, data.points_required, data.stock_total ?? 0, data.stock_total ?? 0, data.exchange_limit_per_user ?? null, data.exchange_limit_total ?? null, data.market_price ?? null, data.sort_order ?? 0, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, product_code: code };
}

export async function listPointsProducts(params: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_points_product ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM t_points_product ${where} ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getPointsProductDetail(id: number, tenantId: string) {
  return queryOneWithTenant<any>("SELECT * FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function updatePointsProduct(id: number, data: any, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.product_name !== undefined) { fields.push("product_name = ?"); values.push(data.product_name); }
  if (data.product_image !== undefined) { fields.push("product_image = ?"); values.push(data.product_image); }
  if (data.product_desc !== undefined) { fields.push("product_desc = ?"); values.push(data.product_desc); }
  if (data.points_required !== undefined) { fields.push("points_required = ?"); values.push(data.points_required); }
  if (data.stock_total !== undefined) { fields.push("stock_total = ?"); values.push(data.stock_total); }
  if (data.exchange_limit_per_user !== undefined) { fields.push("exchange_limit_per_user = ?"); values.push(data.exchange_limit_per_user); }
  if (data.exchange_limit_total !== undefined) { fields.push("exchange_limit_total = ?"); values.push(data.exchange_limit_total); }
  if (data.market_price !== undefined) { fields.push("market_price = ?"); values.push(data.market_price); }
  if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_points_product SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deletePointsProduct(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function togglePointsProduct(id: number, tenantId: string) {
  const product = await queryOneWithTenant<any>("SELECT status FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!product) throw new Error("商品不存在");
  const newStatus = product.status === "ON" ? "OFF" : "ON";
  await queryWithTenant("UPDATE t_points_product SET status = ? WHERE id = ? AND tenant_id = ?", [newStatus, id, tenantId], tenantId);
  return { status: newStatus };
}

export async function listExchangeRecords(params: { tenantId: string; userId?: number; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, userId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["per.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (userId) { conditions.push("per.user_id = ?"); values.push(userId); }
  if (status) { conditions.push("per.status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM t_points_exchange_record per ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT per.*, pp.product_name, pp.product_image FROM t_points_exchange_record per LEFT JOIN t_points_product pp ON pp.id = per.product_id ${where} ORDER BY per.created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getExchangeRecordDetail(id: number, tenantId: string) {
  return queryOneWithTenant<any>(
    `SELECT per.*, pp.product_name, pp.product_image FROM t_points_exchange_record per LEFT JOIN t_points_product pp ON pp.id = per.product_id WHERE per.id = ? AND per.tenant_id = ?`,
    [id, tenantId], tenantId
  );
}

export async function exchangeProduct(data: { product_id: number; user_id: number; quantity?: number; delivery_type?: string }, tenantId: string) {
  const product = await queryOneWithTenant<any>("SELECT * FROM t_points_product WHERE id = ? AND tenant_id = ?", [data.product_id, tenantId], tenantId);
  if (!product) throw new Error("商品不存在");
  if (product.status !== "ON") throw new Error("商品已下架");
  const qty = data.quantity ?? 1;
  if (product.stock_available < qty) throw new Error("库存不足");
  const totalPoints = product.points_required * qty;
  const userPoints = await queryOneWithTenant<any>("SELECT points FROM t_member WHERE id = ? AND tenant_id = ?", [data.user_id, tenantId], tenantId);
  if (!userPoints || userPoints.points < totalPoints) throw new Error("积分不足");
  const recordNo = makeBizNo("DH");
  await queryWithTenant("UPDATE t_member SET points = points - ? WHERE id = ? AND tenant_id = ?", [totalPoints, data.user_id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_points_product SET stock_available = stock_available - ? WHERE id = ? AND tenant_id = ?", [qty, data.product_id, tenantId], tenantId);
  const result = await queryWithTenant(
    "INSERT INTO t_points_exchange_record (record_no, product_id, user_id, points_used, quantity, delivery_type, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [recordNo, data.product_id, data.user_id, totalPoints, qty, data.delivery_type ?? "SELF_PICKUP", tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, record_no: recordNo, points_used: totalPoints };
}

export async function cancelExchange(id: number, tenantId: string) {
  const record = await queryOneWithTenant<any>("SELECT * FROM t_points_exchange_record WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!record) throw new Error("记录不存在");
  if (record.status !== "PENDING") throw new Error("只能取消待处理的兑换");
  await queryWithTenant("UPDATE t_points_exchange_record SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_member SET points = points + ? WHERE id = ? AND tenant_id = ?", [record.points_used, record.user_id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_points_product SET stock_available = stock_available + ? WHERE id = ? AND tenant_id = ?", [record.quantity, record.product_id, tenantId], tenantId);
}

export async function confirmExchange(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_points_exchange_record SET status = 'CONFIRMED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}