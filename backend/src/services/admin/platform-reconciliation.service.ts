import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export interface ReconciliationListParams {
  page: number;
  pageSize: number;
  reconciliationNo?: string;
  platformName?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

export interface ReconciliationCreateData {
  reconciliationNo: string;
  platformNo: string;
  platformName: string;
  type: number;
  amount: number;
  status: number;
  recordedAt?: string;
}

export interface ReconciliationUpdateData {
  status?: number;
  amount?: number;
}

export async function listReconciliations(tenantId: string, params: ReconciliationListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.reconciliationNo) { conditions.push("reconciliation_no LIKE ?"); sqlParams.push(`%${params.reconciliationNo}%`); }
  if (params.platformName) { conditions.push("platform_name LIKE ?"); sqlParams.push(`%${params.platformName}%`); }
  if (params.status !== undefined) { conditions.push("status = ?"); sqlParams.push(params.status); }
  if (params.dateStart) { conditions.push("DATE(recorded_at) >= ?"); sqlParams.push(params.dateStart); }
  if (params.dateEnd) { conditions.push("DATE(recorded_at) <= ?"); sqlParams.push(params.dateEnd); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_reconciliation ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, reconciliation_no AS reconciliationNo, platform_no AS platformNo,
            platform_name AS platformName, type, amount, status,
            recorded_at AS recordedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_reconciliation ${where}
     ORDER BY recorded_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function createReconciliation(tenantId: string, data: ReconciliationCreateData) {
  const result = await queryWithTenant<any>(
    `INSERT INTO t_platform_reconciliation (tenant_id, reconciliation_no, platform_no, platform_name, type, amount, status, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, data.reconciliationNo, data.platformNo, data.platformName, data.type, data.amount, data.status, data.recordedAt || null],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateReconciliation(tenantId: string, id: number, data: ReconciliationUpdateData) {
  const sets: string[] = [];
  const sqlParams: unknown[] = [];

  if (data.status !== undefined) { sets.push("status = ?"); sqlParams.push(data.status); }
  if (data.amount !== undefined) { sets.push("amount = ?"); sqlParams.push(data.amount); }
  sets.push("updated_at = NOW()");

  sqlParams.push(id, tenantId);

  await queryWithTenant(
    `UPDATE t_platform_reconciliation SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    sqlParams,
    tenantId
  );
  return { id };
}

export async function getDetail(tenantId: string, id: number) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, reconciliation_no AS reconciliationNo, platform_no AS platformNo,
            platform_name AS platformName, type, amount, status,
            recorded_at AS recordedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_reconciliation WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return record;
}