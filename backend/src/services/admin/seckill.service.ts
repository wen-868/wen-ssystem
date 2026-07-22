import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 秒杀商品行（关联产品名称） */
interface SeckillProductRow {
  id: number;
  product_id: number;
  seckill_price: number | string;
  seckill_stock: number;
  limit_per_user: number;
  start_time: string | Date;
  end_time: string | Date;
  status: string;
  productName: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/** 计数行 */
interface CountCntRow {
  cnt: number;
}

export async function getSeckillProducts(tenantId: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.status) { where += " AND sp.status = ?"; vals.push(params.status); }
  const [rows, total] = await Promise.all([
    query<SeckillProductRow>(`SELECT sp.*, p.name AS productName FROM t_seckill_product sp LEFT JOIN t_product p ON sp.product_id = p.id ${where} ORDER BY sp.start_time ASC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_seckill_product ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function createSeckillProduct(data: any) {
  const result = await query(
    `INSERT INTO t_seckill_product (product_id, seckill_price, seckill_stock, limit_per_user, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.productId, data.seckillPrice, data.seckillStock, data.limitPerUser || 1, data.startTime, data.endTime, data.status || 'PENDING']
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateSeckillProduct(id: number, data: any) {
  await query(
    `UPDATE t_seckill_product SET product_id=?, seckill_price=?, seckill_stock=?, limit_per_user=?, start_time=?, end_time=?, status=? WHERE id=?`,
    [data.productId, data.seckillPrice, data.seckillStock, data.limitPerUser, data.startTime, data.endTime, data.status, id]
  );
  return { success: true };
}

export async function deleteSeckillProduct(id: number) {
  await query(`DELETE FROM t_seckill_product WHERE id=?`, [id]);
  return { success: true };
}