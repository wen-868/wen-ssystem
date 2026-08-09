import { query, queryOne, queryWithTenant } from "../../shared/db";

/**
 * 即时零售补全服务（R100 商用化）：
 * - 订单同步日志 / 统计（t_miniapp_order_sync_log）
 * - 平台商品映射 / 统计（t_platform_product_map）
 */

// ==================== 1. 订单同步日志 ====================
export async function listSyncLogs(tenantId: string, params: {
  page?: number; pageSize?: number; status?: string; platform?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.status) { where.push("status = ?"); args.push(params.status); }
  if (params.platform) { where.push("platform = ?"); args.push(params.platform); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_miniapp_order_sync_log WHERE ${whereSql}`,
    args
  );
  const rows = await query<SyncLogRow>(
    `SELECT id, order_no, platform, sync_type, sync_direction, status, error_msg, created_at
     FROM t_miniapp_order_sync_log WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      channelOrderNo: r.order_no,
      channelType: r.platform,
      syncType: r.sync_direction === "PUSH_TO_PLATFORM" ? "PUSH" : r.sync_direction === "PULL_FROM_PLATFORM" ? "PULL" : r.sync_type || "-",
      fromStatus: "-",
      toStatus: "-",
      syncResult: r.status,
      errorMessage: r.error_msg || "",
      syncedAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getSyncStats(tenantId: string) {
  const stat = await queryOne<{ totalSync: number; successCount: number; failCount: number }>(
    `SELECT COUNT(*) AS totalSync,
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END), 0) AS successCount,
            COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failCount
     FROM t_miniapp_order_sync_log WHERE tenant_id = ?`,
    [tenantId]
  );
  return {
    totalSync: stat?.totalSync ?? 0,
    successCount: stat?.successCount ?? 0,
    failCount: stat?.failCount ?? 0,
    pendingCount: 0,
  };
}

// ==================== 2. 平台商品映射 ====================
export async function listProductMaps(tenantId: string, params: {
  page?: number; pageSize?: number; platform?: string; syncStatus?: string; keyword?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["m.tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.platform) { where.push("m.platform = ?"); args.push(params.platform); }
  if (params.syncStatus) { where.push("m.sync_status = ?"); args.push(params.syncStatus); }
  if (params.keyword) {
    where.push("(m.platform_sku_id LIKE ? OR m.platform_spu_id LIKE ? OR spu.name LIKE ?)");
    const kw = `%${params.keyword}%`;
    args.push(kw, kw, kw);
  }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_product_map m LEFT JOIN t_product_sku sku ON sku.id = m.local_sku_id
     LEFT JOIN t_product_spu spu ON spu.id = sku.spu_id WHERE ${whereSql}`,
    args
  );
  const rows = await query<ProductMapRow>(
    `SELECT m.id, m.platform, m.local_sku_id, m.platform_sku_id, m.platform_spu_id, m.sync_status,
            m.sync_msg, m.synced_at, m.updated_at, sku.sku_code, spu.name AS local_product_name
     FROM t_platform_product_map m
     LEFT JOIN t_product_sku sku ON sku.id = m.local_sku_id
     LEFT JOIN t_product_spu spu ON spu.id = sku.spu_id
     WHERE ${whereSql} ORDER BY m.updated_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      channelType: r.platform,
      channelSkuId: r.platform_sku_id || "",
      channelProductName: r.platform_spu_id || "",
      channelPrice: null,
      localSkuId: r.local_sku_id,
      localSkuCode: r.sku_code || "",
      localProductName: r.local_product_name || "",
      syncStatus: r.sync_status,
      syncMsg: r.sync_msg || "",
      syncedAt: r.synced_at,
      updatedAt: r.updated_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getProductMapStats(tenantId: string) {
  const rows = await query<{ platform: string; mapped: number; unmapped: number }>(
    `SELECT platform,
            COALESCE(SUM(CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END), 0) AS mapped,
            COALESCE(SUM(CASE WHEN sync_status <> 'SYNCED' THEN 1 ELSE 0 END), 0) AS unmapped
     FROM t_platform_product_map WHERE tenant_id = ? GROUP BY platform`,
    [tenantId]
  );
  const byChannel: Record<string, { mapped: number; unmapped: number }> = {};
  let mapped = 0;
  let unmapped = 0;
  for (const r of rows) {
    byChannel[r.platform] = { mapped: r.mapped, unmapped: r.unmapped };
    mapped += r.mapped;
    unmapped += r.unmapped;
  }
  return { total: mapped + unmapped, mapped, unmapped, byChannel };
}

interface SyncLogRow {
  id: number; order_no: string; platform: string; sync_type: string;
  sync_direction: string; status: string; error_msg: string | null; created_at: string;
}
interface ProductMapRow {
  id: number; platform: string; local_sku_id: number; platform_sku_id: string | null;
  platform_spu_id: string | null; sync_status: string; sync_msg: string | null;
  synced_at: string | null; updated_at: string; sku_code: string | null; local_product_name: string | null;
}
