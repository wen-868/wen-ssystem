import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/**
 * t_miniapp_order_sync_log 列表行（带别名）
 *
 * 注意：表内 status 为 VARCHAR（SUCCESS/FAILED），前端契约要求数字（0=待同步/1=成功/2=失败），
 * 查询时用 CASE 做归一化映射；platform_order_no / response / updated_at / tenant_id
 * 由迁移脚本 125 补齐（原 049 建表缺失，是生产 500 的根因）。
 */
interface SyncLogRow {
  id: number | string;
  orderNo: string;
  platformOrderNo: string;
  status: number;
  response: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SyncLogListParams {
  page: number;
  pageSize: number;
  orderNo?: string;
  status?: number;
}

export async function listSyncLogs(tenantId: string, params: SyncLogListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.orderNo) { conditions.push("order_no LIKE ?"); sqlParams.push(`%${params.orderNo}%`); }
  // status 过滤：前端传数字（0/1/2），与表内 VARCHAR（SUCCESS/FAILED）做同一套 CASE 归一化比较
  if (params.status !== undefined) {
    conditions.push("CASE WHEN status IN ('SUCCESS','1') THEN 1 WHEN status IN ('FAILED','2') THEN 2 ELSE 0 END = ?");
    sqlParams.push(params.status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_miniapp_order_sync_log ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<SyncLogRow>(
    `SELECT id, order_no AS orderNo, platform_order_no AS platformOrderNo,
            CASE WHEN status IN ('SUCCESS','1') THEN 1 WHEN status IN ('FAILED','2') THEN 2 ELSE 0 END AS status,
            response, created_at AS createdAt, updated_at AS updatedAt
     FROM t_miniapp_order_sync_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function retrySync(tenantId: string, orderNo: string) {
  await queryWithTenant(
    // 重试语义：置为待同步（PENDING），前端数字 0 与 CASE 归一化映射对应
    "UPDATE t_miniapp_order_sync_log SET status = 'PENDING', updated_at = NOW() WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );
  return { orderNo, status: 0 };
}
