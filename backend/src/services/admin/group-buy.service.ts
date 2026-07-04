import { query, queryOne } from "../../shared/db.js";

export async function getGroupBuyActivities(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.status) { where += " AND gba.status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<any>(`SELECT gba.*, p.name AS productName FROM group_buy_activity gba LEFT JOIN product p ON gba.product_id = p.id ${where} ORDER BY gba.start_time ASC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<any>(`SELECT COUNT(*) AS cnt FROM group_buy_activity ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createGroupBuyActivity(data: any) {
  const result = await query(
    `INSERT INTO group_buy_activity (product_id, group_price, min_group_size, max_group_size, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.productId, data.groupPrice, data.minGroupSize, data.maxGroupSize || 10, data.startTime, data.endTime, data.status || 'PENDING']
  );
  return { id: (result as any).insertId };
}

export async function updateGroupBuyActivity(id: number, data: any) {
  await query(
    `UPDATE group_buy_activity SET product_id=?, group_price=?, min_group_size=?, max_group_size=?, start_time=?, end_time=?, status=? WHERE id=?`,
    [data.productId, data.groupPrice, data.minGroupSize, data.maxGroupSize, data.startTime, data.endTime, data.status, id]
  );
  return { success: true };
}

export async function deleteGroupBuyActivity(id: number) {
  await query(`DELETE FROM group_buy_activity WHERE id=?`, [id]);
  return { success: true };
}

export async function getGroupBuyRecords(tenantId: string, params?: { activityId?: number; status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.activityId) { where += " AND gbr.activity_id = ?"; vals.push(params.activityId); }
  if (params?.status) { where += " AND gbr.status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<any>(`SELECT gbr.*, gba.product_id AS productId, p.name AS productName FROM group_buy_record gbr LEFT JOIN group_buy_activity gba ON gbr.activity_id = gba.id LEFT JOIN product p ON gba.product_id = p.id ${where} ORDER BY gbr.id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<any>(`SELECT COUNT(*) AS cnt FROM group_buy_record ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function getGroupBuyDetail(groupNo: string) {
  const row = await queryOne<any>(
    `SELECT gbr.*, gba.product_id AS productId, p.name AS productName, gba.group_price AS groupPrice, gba.min_group_size AS minGroupSize
     FROM group_buy_record gbr
     LEFT JOIN group_buy_activity gba ON gbr.activity_id = gba.id
     LEFT JOIN product p ON gba.product_id = p.id
     WHERE gbr.group_no = ?`,
    [groupNo]
  );
  if (!row) throw new Error("拼团记录不存在");
  return row;
}

export async function cancelGroupBuy(groupNo: string) {
  await query(
    `UPDATE group_buy_record SET status='CANCELLED', cancelled_at=NOW() WHERE group_no=? AND status IN ('ACTIVE','PENDING')`,
    [groupNo]
  );
  return { success: true };
}