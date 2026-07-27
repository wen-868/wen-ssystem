import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 积分商城商品行 */
interface PointsMallItemRow {
  id: number;
  name: string;
  image: string | null;
  points: number;
  stock: number;
  limit_per_user: number;
  valid_start: string | Date | null;
  valid_end: string | Date | null;
  status: string;
  sort_order: number;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/** 积分商城订单行 */
interface PointsMallOrderRow {
  id: number;
  order_no: string;
  user_id: number;
  item_id: number;
  item_name: string;
  points: number;
  status: string;
  cancelled_at?: string | Date | null;
  delivered_at?: string | Date | null;
  created_at?: string | Date;
}

/** 计数行 */
interface CountCntRow {
  cnt: number;
}

interface PointsMallItemInput {
  name: string;
  image?: string;
  points: number | string;
  stock: number | string;
  limitPerUser?: number;
  validStart?: string | Date;
  validEnd?: string | Date;
  status?: string;
  sortOrder?: number;
}

export async function getPointsMallItems(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<PointsMallItemRow>(`SELECT * FROM t_points_mall_item ${where} ORDER BY sort_order ASC, id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_points_mall_item ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createPointsMallItem(data: PointsMallItemInput) {
  const result = await query(
    `INSERT INTO t_points_mall_item (name, image, points, stock, limit_per_user, valid_start, valid_end, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.image, data.points, data.stock, data.limitPerUser || 1, data.validStart, data.validEnd, data.status || 'ACTIVE', data.sortOrder || 0]
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updatePointsMallItem(id: number, data: PointsMallItemInput) {
  await query(
    `UPDATE t_points_mall_item SET name=?, image=?, points=?, stock=?, limit_per_user=?, valid_start=?, valid_end=?, status=?, sort_order=? WHERE id=?`,
    [data.name, data.image, data.points, data.stock, data.limitPerUser, data.validStart, data.validEnd, data.status, data.sortOrder, id]
  );
  return { success: true };
}

export async function cancelPointsMallOrder(id: number) {
  await query(
    `UPDATE t_points_mall_order SET status='CANCELLED', cancelled_at=NOW() WHERE id=? AND status='PENDING'`,
    [id]
  );
  return { success: true };
}

export async function deletePointsMallItem(id: number) {
  await query(`DELETE FROM t_points_mall_item WHERE id=?`, [id]);
  return { success: true };
}

export async function getPointsMallOrders(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<PointsMallOrderRow>(`SELECT * FROM t_points_mall_order ${where} ORDER BY id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_points_mall_order ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function deliverPointsMallOrder(id: number, _data: { trackingNo?: string; logisticsCompany?: string }) {
  await query(
    `UPDATE t_points_mall_order SET status='DELIVERED', delivered_at=NOW() WHERE id=? AND status='PENDING'`,
    [id]
  );
  return { success: true };
}