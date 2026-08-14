import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 营销资产行 */
interface MarketingAssetRow {
  id: number;
  name: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  content: string | null;
  category: string | null;
  tags: string | null;
  file_size: number | null;
  status: string;
  tenant_id?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/** 计数行 */
interface CountCntRow {
  cnt: number;
}

/** 创建营销资产入参 */
interface CreateMarketingAssetBody {
  name: string;
  type: string;
  url?: string | null;
  thumbnailUrl?: string | null;
  content?: string | null;
  category?: string | null;
  tags?: unknown[];
  fileSize?: number | null;
  status?: string;
}

/** 更新营销资产入参 */
interface UpdateMarketingAssetBody {
  name: string;
  category?: string | null;
  tags?: unknown[];
  status?: string;
}

export async function getMarketingAssets(tenantId: string, params?: { type?: string; category?: string; status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.type) { where += " AND type = ?"; vals.push(params.type); }
  if (params?.category) { where += " AND category = ?"; vals.push(params.category); }
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<MarketingAssetRow>(`SELECT * FROM t_marketing_asset ${where} ORDER BY id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_marketing_asset ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createMarketingAsset(data: CreateMarketingAssetBody) {
  const result = await query(
    `INSERT INTO t_marketing_asset (name, type, url, thumbnail_url, content, category, tags, file_size, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.type, data.url, data.thumbnailUrl, data.content, data.category, JSON.stringify(data.tags || []), data.fileSize, data.status || 'ACTIVE']
  );
  // database.ts 将 ResultSetHeader 归一化为数组返回，需从首元素取 insertId
  const raw = result as unknown as Array<{ insertId?: number }> | { insertId?: number } | null;
  const insertId = Array.isArray(raw) ? raw[0]?.insertId : raw?.insertId;
  return { id: insertId ?? 0 };
}

export async function updateMarketingAsset(id: number, data: UpdateMarketingAssetBody) {
  await query(
    `UPDATE t_marketing_asset SET name=?, category=?, tags=?, status=? WHERE id=?`,
    [data.name, data.category, JSON.stringify(data.tags || []), data.status, id]
  );
  return { success: true };
}

export async function deleteMarketingAsset(id: number) {
  await query(`DELETE FROM t_marketing_asset WHERE id=?`, [id]);
  return { success: true };
}
