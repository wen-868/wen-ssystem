﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** COUNT(*) AS cnt 通用返回 */
interface CountCntRow {
  cnt: number;
}

/** t_points_product 表行 */
interface PointsProductRow {
  id: number | string;
  product_code: string;
  product_name: string;
  product_image: string | null;
  product_desc: string | null;
  points_required: number | string;
  stock_total: number | string;
  stock_available: number | string;
  exchange_limit_per_user: number | string | null;
  exchange_limit_total: number | string | null;
  market_price: number | string | null;
  sort_order: number | string;
  tenant_id: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** t_points_product 仅 status */
interface PointsProductStatusRow {
  status: string;
}

/** t_points_exchange_record 表行 */
interface PointsExchangeRecordRow {
  id: number | string;
  record_no: string;
  product_id: number | string;
  user_id: number | string;
  points_used: number | string;
  quantity: number | string;
  delivery_type: string;
  tenant_id: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** t_points_exchange_record JOIN t_points_product 查询行 */
interface ExchangeRecordDetailRow extends PointsExchangeRecordRow {
  product_name: string;
  product_image: string | null;
}

/** t_member 仅 points */
interface MemberPointsRow {
  points: number | string;
}

/** INSERT 返回结果 */
interface InsertResult {
  insertId: number | string;
}

/** 创建积分商品入参 */
interface CreatePointsProductBody {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsRequired: number | string;
  stock: number | string;
  limitPerUser?: number | string | null;
  status?: string;
  sortNo?: number | string;
}

/** 更新积分商品入参 */
interface UpdatePointsProductBody {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsRequired?: number | string;
  stock?: number | string;
  limitPerUser?: number | string | null;
  status?: string;
  sortNo?: number | string;
}

export async function createPointsProduct(data: CreatePointsProductBody, tenantId: string) {
  const code = makeBizNo("JF");
  const result = await queryWithTenant<InsertResult>(
    `INSERT INTO t_points_product (product_code, product_name, product_image, product_desc, points_required, stock_total, stock_available, exchange_limit_per_user, exchange_limit_total, market_price, sort_order, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, data.name, data.imageUrl ?? null, data.description ?? null, data.pointsRequired, data.stock ?? 0, data.stock ?? 0, data.limitPerUser ?? null, null, null, data.sortNo ?? 0, tenantId], tenantId
  );
  const insertId = Array.isArray(result) ? (result[0] as InsertResult)?.insertId : (result as InsertResult)?.insertId;
  return { id: insertId, product_code: code };
}

export async function listPointsProducts(params: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const { tenantId, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_points_product ${where}`, values, tenantId);
  const rows = await queryWithTenant<PointsProductRow>(
    `SELECT * FROM t_points_product ${where} ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getPointsProductDetail(id: number, tenantId: string) {
  return queryOneWithTenant<PointsProductRow>("SELECT * FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function updatePointsProduct(id: number, data: UpdatePointsProductBody, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("product_name = ?"); values.push(data.name); }
  if (data.imageUrl !== undefined) { fields.push("product_image = ?"); values.push(data.imageUrl); }
  if (data.description !== undefined) { fields.push("product_desc = ?"); values.push(data.description); }
  if (data.pointsRequired !== undefined) { fields.push("points_required = ?"); values.push(data.pointsRequired); }
  if (data.stock !== undefined) { fields.push("stock_total = ?"); fields.push("stock_available = ?"); values.push(data.stock); values.push(data.stock); }
  if (data.limitPerUser !== undefined) { fields.push("exchange_limit_per_user = ?"); values.push(data.limitPerUser); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (data.sortNo !== undefined) { fields.push("sort_order = ?"); values.push(data.sortNo); }
  if (fields.length === 0) return null;
  values.push(id, tenantId);
  await queryWithTenant(`UPDATE t_points_product SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, tenantId);
  return { id };
}

export async function deletePointsProduct(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function togglePointsProduct(id: number, tenantId: string) {
  const product = await queryOneWithTenant<PointsProductStatusRow>("SELECT status FROM t_points_product WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
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
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_points_exchange_record per ${where}`, values, tenantId);
  const rows = await queryWithTenant<ExchangeRecordDetailRow>(
    `SELECT per.*, pp.product_name, pp.product_image FROM t_points_exchange_record per LEFT JOIN t_points_product pp ON pp.id = per.product_id ${where} ORDER BY per.created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getExchangeRecordDetail(id: number, tenantId: string) {
  return queryOneWithTenant<ExchangeRecordDetailRow>(
    `SELECT per.*, pp.product_name, pp.product_image FROM t_points_exchange_record per LEFT JOIN t_points_product pp ON pp.id = per.product_id WHERE per.id = ? AND per.tenant_id = ?`,
    [id, tenantId], tenantId
  );
}

export async function exchangeProduct(data: { product_id: number; user_id: number; quantity?: number; delivery_type?: string }, tenantId: string) {
  const product = await queryOneWithTenant<PointsProductRow>("SELECT * FROM t_points_product WHERE id = ? AND tenant_id = ?", [data.product_id, tenantId], tenantId);
  if (!product) throw new Error("商品不存在");
  if (product.status !== "ON") throw new Error("商品已下架");
  const qty = data.quantity ?? 1;
  if (Number(product.stock_available) < qty) throw new Error("库存不足");
  const totalPoints = Number(product.points_required) * qty;
  const userPoints = await queryOneWithTenant<MemberPointsRow>("SELECT points FROM t_member WHERE id = ? AND tenant_id = ?", [data.user_id, tenantId], tenantId);
  if (!userPoints || Number(userPoints.points) < totalPoints) throw new Error("积分不足");
  const recordNo = makeBizNo("DH");
  await queryWithTenant("UPDATE t_member SET points = points - ? WHERE id = ? AND tenant_id = ?", [totalPoints, data.user_id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_points_product SET stock_available = stock_available - ? WHERE id = ? AND tenant_id = ?", [qty, data.product_id, tenantId], tenantId);
  const result = await queryWithTenant<InsertResult>(
    "INSERT INTO t_points_exchange_record (record_no, product_id, user_id, points_used, quantity, delivery_type, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [recordNo, data.product_id, data.user_id, totalPoints, qty, data.delivery_type ?? "SELF_PICKUP", tenantId], tenantId
  );
  const insertId = Array.isArray(result) ? (result[0] as InsertResult)?.insertId : (result as InsertResult)?.insertId;
  return { id: insertId, record_no: recordNo, points_used: totalPoints };
}

export async function cancelExchange(id: number, tenantId: string) {
  const record = await queryOneWithTenant<PointsExchangeRecordRow>("SELECT * FROM t_points_exchange_record WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!record) throw new Error("记录不存在");
  if (record.status !== "PENDING") throw new Error("只能取消待处理的兑换");
  await queryWithTenant("UPDATE t_points_exchange_record SET status = 'CANCELLED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_member SET points = points + ? WHERE id = ? AND tenant_id = ?", [record.points_used, record.user_id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_points_product SET stock_available = stock_available + ? WHERE id = ? AND tenant_id = ?", [record.quantity, record.product_id, tenantId], tenantId);
}

export async function confirmExchange(id: number, tenantId: string) {
  await queryWithTenant("UPDATE t_points_exchange_record SET status = 'CONFIRMED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}