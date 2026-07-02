import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

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
  if (params.status !== undefined) { conditions.push("status = ?"); sqlParams.push(params.status); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM miniapp_order_sync_log ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, order_no AS orderNo, platform_order_no AS platformOrderNo,
            status, response, created_at AS createdAt, updated_at AS updatedAt
     FROM miniapp_order_sync_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function retrySync(tenantId: string, orderNo: string) {
  await queryWithTenant(
    "UPDATE miniapp_order_sync_log SET status = 0, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );
  return { orderNo, status: 0 };
}