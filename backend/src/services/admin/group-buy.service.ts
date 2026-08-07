import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 团购活动行（关联产品名称） */
interface GroupBuyActivityRow {
  id: number;
  product_id: number;
  group_price: number | string;
  min_group_size: number;
  max_group_size: number;
  start_time: string | Date;
  end_time: string | Date;
  status: string;
  productName: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/** 团购记录行（关联产品信息） */
interface GroupBuyRecordRow {
  id: number;
  group_no: string;
  activity_id: number;
  status: string;
  current_size: number;
  leader_id: number;
  productId: number | null;
  productName: string | null;
  created_at?: string | Date;
  cancelled_at?: string | Date | null;
}

/** 团购记录详情行（含 groupPrice/minGroupSize） */
interface GroupBuyDetailRow extends GroupBuyRecordRow {
  groupPrice: number | string | null;
  minGroupSize: number | null;
}

/** 团组成员行 */
interface GroupBuyMemberRow {
  id: number;
  group_no: string;
  user_id: number;
  joined_at: string | Date;
}

/** 计数行 */
interface CountCntRow {
  cnt: number;
}

interface GroupBuyInput {
  productId: number | string;
  groupPrice: number | string;
  minGroupSize: number;
  maxGroupSize?: number;
  startTime: string | Date;
  endTime: string | Date;
  status?: string;
}

export async function getGroupBuyActivities(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.status) { where += " AND gba.status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<GroupBuyActivityRow>(`SELECT gba.*, p.name AS productName FROM t_group_buy_activity gba LEFT JOIN t_product_spu p ON gba.product_id = p.id ${where} ORDER BY gba.start_time ASC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_group_buy_activity ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function getGroupBuyRecordDetail(groupNo: string) {
  const record = await queryOne<GroupBuyRecordRow>(
    `SELECT gbr.*, gba.product_id AS productId, p.name AS productName
     FROM t_group_buy_record gbr
     LEFT JOIN t_group_buy_activity gba ON gbr.activity_id = gba.id
     LEFT JOIN t_product_spu p ON gba.product_id = p.id
     WHERE gbr.group_no = ?`,
    [groupNo]
  );
  if (!record) {
    throw new Error('拼团记录不存在');
  }
  const members = await query<GroupBuyMemberRow>(
    `SELECT * FROM t_group_buy_member WHERE group_no = ? ORDER BY joined_at ASC`,
    [groupNo]
  );
  return { ...record, members };
}

export async function cancelGroupBuyRecord(groupNo: string) {
  await query(
    `UPDATE t_group_buy_record SET status = 'CANCELLED' WHERE group_no = ? AND status IN ('PENDING', 'IN_PROGRESS')`,
    [groupNo]
  );
  return { success: true };
}

export async function createGroupBuyActivity(data: GroupBuyInput) {
  const result = await query(
    `INSERT INTO t_group_buy_activity (product_id, group_price, min_group_size, max_group_size, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.productId, data.groupPrice, data.minGroupSize, data.maxGroupSize || 10, data.startTime, data.endTime, data.status || 'PENDING']
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateGroupBuyActivity(id: number, data: GroupBuyInput) {
  await query(
    `UPDATE t_group_buy_activity SET product_id=?, group_price=?, min_group_size=?, max_group_size=?, start_time=?, end_time=?, status=? WHERE id=?`,
    [data.productId, data.groupPrice, data.minGroupSize, data.maxGroupSize, data.startTime, data.endTime, data.status, id]
  );
  return { success: true };
}

export async function deleteGroupBuyActivity(id: number) {
  await query(`DELETE FROM t_group_buy_activity WHERE id=?`, [id]);
  return { success: true };
}

export async function getGroupBuyRecords(tenantId: string, params?: { activityId?: number; status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.activityId) { where += " AND gbr.activity_id = ?"; vals.push(params.activityId); }
  if (params?.status) { where += " AND gbr.status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<GroupBuyRecordRow>(`SELECT gbr.*, gba.product_id AS productId, p.name AS productName FROM t_group_buy_record gbr LEFT JOIN t_group_buy_activity gba ON gbr.activity_id = gba.id LEFT JOIN t_product_spu p ON gba.product_id = p.id ${where} ORDER BY gbr.id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_group_buy_record ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function getGroupBuyDetail(groupNo: string) {
  const row = await queryOne<GroupBuyDetailRow>(
    `SELECT gbr.*, gba.product_id AS productId, p.name AS productName, gba.group_price AS groupPrice, gba.min_group_size AS minGroupSize
     FROM t_group_buy_record gbr
     LEFT JOIN t_group_buy_activity gba ON gbr.activity_id = gba.id
     LEFT JOIN t_product_spu p ON gba.product_id = p.id
     WHERE gbr.group_no = ?`,
    [groupNo]
  );
  if (!row) throw new Error("拼团记录不存在");
  return row;
}

export async function cancelGroupBuy(groupNo: string) {
  await query(
    `UPDATE t_group_buy_record SET status='CANCELLED', cancelled_at=NOW() WHERE group_no=? AND status IN ('ACTIVE','PENDING')`,
    [groupNo]
  );
  return { success: true };
}
