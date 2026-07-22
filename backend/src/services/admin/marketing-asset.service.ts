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

export async function getMarketingAssets(tenantId: string, params?: { type?: string; category?: string; status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.type) { where += " AND type = ?"; vals.push(params.type); }
  if (params?.category) { where += " AND category = ?"; vals.push(params.category); }
  if (params?.status) { where += " AND status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<MarketingAssetRow>(`SELECT * FROM t_marketing_asset ${where} ORDER BY id DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_marketing_asset ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createMarketingAsset(data: any) {
  const result = await query(
    `INSERT INTO t_marketing_asset (name, type, url, thumbnail_url, content, category, tags, file_size, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.type, data.url, data.thumbnailUrl, data.content, data.category, JSON.stringify(data.tags || []), data.fileSize, data.status || 'ACTIVE']
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateMarketingAsset(id: number, data: any) {
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