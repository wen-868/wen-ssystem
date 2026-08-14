import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ========== 类型定义 ==========

interface OperationLogRow {
  id: number;
  operatorId: number;
  operatorName: string;
  module: string;
  action: string;
  bizNo: string;
  targetId: string | null;
  targetType: string | null;
  afterData: string | null;
  remark: string | null;
  createdAt: string;
}

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

/** 操作日志详情行（含变更前后数据） */
interface OperationLogDetailRow {
  id: number;
  operatorId: number | null;
  operatorName: string | null;
  module: string;
  action: string;
  bizNo: string | null;
  targetId: string | null;
  targetType: string | null;
  beforeData: string | null;
  afterData: string | null;
  ip: string | null;
  userAgent: string | null;
  remark: string | null;
  createdAt: string;
}

/**
 * 操作类型枚举（与各模块写入 t_operation_log 的 action 语义对齐）
 */
export const OPERATION_LOG_TYPES: Array<{ value: string; label: string }> = [
  { value: "CREATE", label: "创建" },
  { value: "UPDATE", label: "修改" },
  { value: "DELETE", label: "删除" },
  { value: "APPROVE", label: "审核" },
  { value: "REJECT", label: "驳回" },
  { value: "LOGIN", label: "登录" },
  { value: "LOGOUT", label: "登出" },
  { value: "EXPORT", label: "导出" },
  { value: "IMPORT", label: "导入" },
  { value: "PRINT", label: "打印" },
  { value: "CANCEL", label: "取消" },
  { value: "STATUS_CHANGE", label: "状态变更" },
  { value: "REMARK", label: "备注" },
  { value: "SETTLE", label: "结算" },
  { value: "RECEIVE", label: "收款" },
  { value: "PAY", label: "付款" },
  { value: "TRANSFER", label: "调拨" },
  { value: "OTHER", label: "其他" },
];

/** 安全解析 JSON（解析失败时原样返回字符串） */
function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

  const records = await queryWithTenant<OperationLogRow>(
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

/** 单条操作日志详情 */
export async function getLogById(tenantId: string, id: number) {
  const row = await queryOneWithTenant<OperationLogDetailRow>(
    `SELECT id, operator_id AS operatorId, operator_name AS operatorName,
            module, action, biz_no AS bizNo, target_id AS targetId,
            target_type AS targetType, before_data AS beforeData,
            after_data AS afterData, ip, user_agent AS userAgent,
            remark, created_at AS createdAt
     FROM t_operation_log
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!row) return null;
  return {
    ...row,
    beforeValue: safeParseJson(row.beforeData),
    afterValue: safeParseJson(row.afterData),
  };
}

/** 操作类型枚举 */
export function getLogTypes() {
  return { list: OPERATION_LOG_TYPES };
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
