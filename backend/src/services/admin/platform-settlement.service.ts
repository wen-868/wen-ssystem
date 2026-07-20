import { query, queryOne } from "../../shared/db";

export interface SettlementListParams {
  page: number;
  pageSize: number;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  tenantName?: string;
}

export interface SettlementItem {
  id: number;
  settlementNo: string;
  tenantId: string;
  tenantName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  settledAmount: number;
  pendingAmount: number;
  status: string;
  settledAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementStats {
  currentMonthRevenue: number;
  pendingSettlement: number;
  settledAmount: number;
  settlementCount: number;
}

export interface SettlementCreate {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  remark?: string;
}

export async function listSettlements(params: SettlementListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.status) {
    conditions.push("s.status = ?");
    sqlParams.push(params.status);
  }
  if (params.dateStart) {
    conditions.push("DATE(s.created_at) >= ?");
    sqlParams.push(params.dateStart);
  }
  if (params.dateEnd) {
    conditions.push("DATE(s.created_at) <= ?");
    sqlParams.push(params.dateEnd);
  }
  if (params.tenantName) {
    conditions.push("t.tenant_name LIKE ?");
    sqlParams.push(`%${params.tenantName}%`);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM t_platform_settlement s
     LEFT JOIN t_tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const records = await query<SettlementItem[]>(
    `SELECT s.id, s.settlement_no AS settlementNo, s.tenant_id AS tenantId,
            t.tenant_name AS tenantName,
            s.period_start AS periodStart, s.period_end AS periodEnd,
            s.total_amount AS totalAmount, s.settled_amount AS settledAmount,
            s.pending_amount AS pendingAmount, s.status,
            s.settled_at AS settledAt, s.created_by AS createdBy,
            s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_platform_settlement s
     LEFT JOIN t_tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function getSettlementById(id: number) {
  return queryOne<SettlementItem>(
    `SELECT s.id, s.settlement_no AS settlementNo, s.tenant_id AS tenantId,
            t.tenant_name AS tenantName,
            s.period_start AS periodStart, s.period_end AS periodEnd,
            s.total_amount AS totalAmount, s.settled_amount AS settledAmount,
            s.pending_amount AS pendingAmount, s.status, s.remark,
            s.settled_at AS settledAt, s.created_by AS createdBy,
            s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_platform_settlement s
     LEFT JOIN t_tenant t ON t.tenant_id = s.tenant_id
     WHERE s.id = ?`,
    [id]
  );
}

export async function createSettlement(data: SettlementCreate) {
  const settlementNo = `SET${Date.now()}`;
  const result = await query(
    `INSERT INTO t_platform_settlement
     (settlement_no, tenant_id, period_start, period_end,
      total_amount, pending_amount, status, remark, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 'system')`,
    [
      settlementNo,
      data.tenantId,
      data.periodStart,
      data.periodEnd,
      data.totalAmount,
      data.totalAmount,
      data.remark || null,
    ]
  );
  const insertId = (result as any).insertId;
  return { id: insertId, settlementNo };
}

export async function updateSettlementStatus(id: number, status: string) {
  const updates: string[] = ["status = ?", "updated_at = NOW()"];
  const values: unknown[] = [status];

  if (status === "SETTLED") {
    updates.push("settled_at = NOW()");
    updates.push("settled_amount = pending_amount");
    updates.push("pending_amount = 0");
  }

  values.push(id);

  await query(
    `UPDATE t_platform_settlement SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  return { id, status };
}

export async function getSettlementStats(): Promise<SettlementStats> {
  const row = await queryOne<any>(
    `SELECT
       (SELECT IFNULL(SUM(total_amount), 0) FROM t_platform_settlement
        WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')) AS currentMonthRevenue,
       (SELECT IFNULL(SUM(pending_amount), 0) FROM t_platform_settlement
        WHERE status = 'PENDING') AS pendingSettlement,
       (SELECT IFNULL(SUM(settled_amount), 0) FROM t_platform_settlement
        WHERE status = 'SETTLED') AS settledAmount,
       (SELECT COUNT(*) FROM t_platform_settlement) AS settlementCount
     FROM DUAL`
  );

  return {
    currentMonthRevenue: Number(row?.currentMonthRevenue ?? 0),
    pendingSettlement: Number(row?.pendingSettlement ?? 0),
    settledAmount: Number(row?.settledAmount ?? 0),
    settlementCount: Number(row?.settlementCount ?? 0),
  };
}
