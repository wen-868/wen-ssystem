import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export interface LogListParams {
  page: number;
  pageSize: number;
  module?: string;
  action?: string;
  operatorName?: string;
  bizNo?: string;
  dateStart?: string;
  dateEnd?: string;
}

export async function listLogs(tenantId: string, params: LogListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.module) { conditions.push("module = ?"); sqlParams.push(params.module); }
  if (params.action) { conditions.push("action = ?"); sqlParams.push(params.action); }
  if (params.operatorName) { conditions.push("operator_name LIKE ?"); sqlParams.push(`%${params.operatorName}%`); }
  if (params.bizNo) { conditions.push("biz_no = ?"); sqlParams.push(params.bizNo); }
  if (params.dateStart) { conditions.push("DATE(created_at) >= ?"); sqlParams.push(params.dateStart); }
  if (params.dateEnd) { conditions.push("DATE(created_at) <= ?"); sqlParams.push(params.dateEnd); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_operation_log ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, operator_id AS operatorId, operator_name AS operatorName,
            module, action, biz_no AS bizNo, target_id AS targetId,
            target_type AS targetType, after_data AS afterData,
            remark, created_at AS createdAt
     FROM t_operation_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function getStatistics(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [todayCount, weekCount, moduleDist, actionDist] = await Promise.all([
    queryOneWithTenant<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM t_operation_log WHERE tenant_id = ? AND DATE(created_at) = ?",
      [tenantId, today], tenantId
    ),
    queryOneWithTenant<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM t_operation_log WHERE tenant_id = ? AND DATE(created_at) >= ?",
      [tenantId, weekStart], tenantId
    ),
    queryWithTenant<{ module: string; cnt: number }>(
      "SELECT module, COUNT(*) AS cnt FROM t_operation_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY module ORDER BY cnt DESC LIMIT 10",
      [tenantId, weekStart], tenantId
    ),
    queryWithTenant<{ action: string; cnt: number }>(
      "SELECT action, COUNT(*) AS cnt FROM t_operation_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY action ORDER BY cnt DESC LIMIT 10",
      [tenantId, weekStart], tenantId
    ),
  ]);

  return {
    todayCount: todayCount?.cnt ?? 0,
    weekCount: weekCount?.cnt ?? 0,
    moduleDistribution: moduleDist,
    actionDistribution: actionDist,
  };
}