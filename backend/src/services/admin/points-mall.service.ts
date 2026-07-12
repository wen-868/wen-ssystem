import { query, queryOne } from "../../shared/db";

export async function getPointsMallItems(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<any>(`SELECT * FROM points_mall_item ${where} ORDER BY sort_order ASC, id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<any>(`SELECT COUNT(*) AS cnt FROM points_mall_item ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createPointsMallItem(data: any) {
  const result = await query(
    `INSERT INTO points_mall_item (name, image, points, stock, limit_per_user, valid_start, valid_end, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.image, data.points, data.stock, data.limitPerUser || 1, data.validStart, data.validEnd, data.status || 'ACTIVE', data.sortOrder || 0]
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updatePointsMallItem(id: number, data: any) {
  await query(
    `UPDATE points_mall_item SET name=?, image=?, points=?, stock=?, limit_per_user=?, valid_start=?, valid_end=?, status=?, sort_order=? WHERE id=?`,
    [data.name, data.image, data.points, data.stock, data.limitPerUser, data.validStart, data.validEnd, data.status, data.sortOrder, id]
  );
  return { success: true };
}

export async function cancelPointsMallOrder(id: number) {
  await query(
    `UPDATE points_mall_order SET status='CANCELLED', cancelled_at=NOW() WHERE id=? AND status='PENDING'`,
    [id]
  );
  return { success: true };
}

export async function deletePointsMallItem(id: number) {
  await query(`DELETE FROM points_mall_item WHERE id=?`, [id]);
  return { success: true };
}

export async function getPointsMallOrders(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<any>(`SELECT * FROM points_mall_order ${where} ORDER BY id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<any>(`SELECT COUNT(*) AS cnt FROM points_mall_order ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function deliverPointsMallOrder(id: number, data: { trackingNo?: string; logisticsCompany?: string }) {
  await query(
    `UPDATE points_mall_order SET status='DELIVERED', delivered_at=NOW() WHERE id=? AND status='PENDING'`,
    [id]
  );
  return { success: true };
}