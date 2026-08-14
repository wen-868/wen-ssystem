import { queryOneWithTenant, queryWithTenant } from "../../shared/db";

/**
 * 门店会员服务（R100-04）：
 * 会员详情 / 积分 / 积分明细 / 会员订单，全部基于真实数据。
 */

interface MemberDetailRow {
  id: number;
  name: string | null;
  mobile: string;
  customerType: string;
  points: number | string;
  levelCode: string | null;
  levelName: string | null;
  status: number;
  lastOrderAt: Date | string | null;
  createdAt: Date | string;
}

/** 会员详情（含等级名、累计消费、积分账户） */
export async function getMemberDetail(tenantId: string, id: number) {
  const row = await queryOneWithTenant<MemberDetailRow>(
    `SELECT m.id, m.name, m.mobile, m.customer_type AS customerType, m.points,
            m.level_code AS levelCode, ml.level_name AS levelName, m.status,
            m.last_order_at AS lastOrderAt, m.created_at AS createdAt
     FROM t_member m
     LEFT JOIN t_member_level ml ON ml.level_code = m.level_code AND ml.tenant_id = m.tenant_id
     WHERE m.id = ?`,
    [id],
    tenantId
  );
  if (!row) {
    throw Object.assign(new Error("会员不存在"), { statusCode: 404 });
  }
  const spent = await queryOneWithTenant<{ total: number | string }>(
    `SELECT COALESCE(SUM(received_amount), 0) AS total
     FROM t_sale_bill
     WHERE customer_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [id],
    tenantId
  );
  const cp = await queryOneWithTenant<{
    available_points: number | string;
    total_points: number | string;
    frozen_points: number | string;
  }>(
    `SELECT available_points, total_points, frozen_points
     FROM t_customer_points
     WHERE customer_id = ?`,
    [id],
    tenantId
  );
  const available = Number(cp?.available_points ?? row.points ?? 0);
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile,
    customerType: row.customerType,
    levelCode: row.levelCode || "",
    levelName: row.levelName || "",
    status: row.status,
    points: available,
    totalPoints: Number(cp?.total_points ?? available),
    frozenPoints: Number(cp?.frozen_points ?? 0),
    balance: 0,
    totalSpent: Number(spent?.total ?? 0),
    lastConsumeAt: row.lastOrderAt,
    createdAt: row.createdAt,
  };
}

/** 会员积分（可用/累计/冻结） */
export async function getMemberPoints(tenantId: string, id: number) {
  const member = await queryOneWithTenant<{ points: number | string }>(
    "SELECT points FROM t_member WHERE id = ?",
    [id],
    tenantId
  );
  if (!member) {
    throw Object.assign(new Error("会员不存在"), { statusCode: 404 });
  }
  const cp = await queryOneWithTenant<{
    available_points: number | string;
    total_points: number | string;
    frozen_points: number | string;
  }>(
    `SELECT available_points, total_points, frozen_points
     FROM t_customer_points
     WHERE customer_id = ?`,
    [id],
    tenantId
  );
  const available = Number(cp?.available_points ?? member.points ?? 0);
  return {
    memberId: id,
    points: available,
    availablePoints: available,
    totalPoints: Number(cp?.total_points ?? available),
    frozenPoints: Number(cp?.frozen_points ?? 0),
  };
}

/** 会员积分明细（t_points_record） */
export async function getMemberPointsLogs(tenantId: string, id: number, page: number, pageSize: number, type?: string) {
  const offset = (page - 1) * pageSize;
  const conditions = ["customer_id = ?"];
  const args: unknown[] = [id];
  if (type) {
    conditions.push("type = ?");
    args.push(type);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const totalRow = await queryWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_points_record ${where}`,
    args,
    tenantId
  );
  const rows = await queryWithTenant<any>(
    `SELECT id, record_no AS recordNo, type, points AS change, balance_after AS afterPoints,
            source_type AS sourceType, source_no AS sourceNo, remark AS reason, created_at AS createdAt
     FROM t_points_record
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset],
    tenantId
  );
  return {
    records: rows.map((r: any) => ({
      id: r.id,
      change: Number(r.change ?? 0),
      afterPoints: Number(r.afterPoints ?? 0),
      beforePoints: Number(r.afterPoints ?? 0) - Number(r.change ?? 0),
      reason: r.reason || "",
      type: r.type || "",
      sourceType: r.sourceType || "",
      sourceNo: r.sourceNo || "",
      createdAt: r.createdAt,
    })),
    total: totalRow?.[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/** 会员订单（线下销售单） */
export async function getMemberOrders(tenantId: string, id: number, page: number, pageSize: number, status?: string) {
  const offset = (page - 1) * pageSize;
  const conditions = ["customer_id = ?", "business_status NOT IN ('DRAFT', 'VOIDED')"];
  const args: unknown[] = [id];
  if (status) {
    conditions.push("collection_status = ?");
    args.push(status);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const totalRow = await queryWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_sale_bill ${where}`,
    args,
    tenantId
  );
  const rows = await queryWithTenant<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, collection_status AS collectionStatus,
            business_status AS businessStatus, created_at AS createdAt
     FROM t_sale_bill
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...args, pageSize, offset],
    tenantId
  );
  return {
    records: rows.map((r: any) => ({
      billNo: r.billNo,
      storeId: r.storeId,
      receivableAmount: Number(r.receivableAmount ?? 0),
      receivedAmount: Number(r.receivedAmount ?? 0),
      collectionStatus: r.collectionStatus,
      businessStatus: r.businessStatus,
      createdAt: r.createdAt,
    })),
    total: totalRow?.[0]?.total ?? 0,
    page,
    pageSize,
  };
}
