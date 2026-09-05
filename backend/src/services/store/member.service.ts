import { queryOneWithTenant, queryWithTenant, executeWithTenant } from "../../shared/db";

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
  const row = await queryOneWithTenant<MemberDetailRow & { contact: string | null; address: string | null; remark: string | null }>(
    `SELECT m.id, m.name, m.mobile, m.customer_type AS customerType, m.points,
            m.level_code AS levelCode, ml.level_name AS levelName, m.status,
            m.contact, m.address, m.remark,
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
  // 储值余额：t_store_value_card ACTIVE 卡实盘（此前硬编码 0 属假数据，已改真实查询）
  const card = await queryOneWithTenant<{ balance: number | string }>(
    "SELECT balance FROM t_store_value_card WHERE customer_id = ? AND tenant_id = ? AND status = 'ACTIVE'",
    [id, tenantId],
    tenantId
  );
  return {
    id: row.id,
    name: row.name || "",
    mobile: row.mobile,
    customerType: row.customerType,
    levelCode: row.levelCode || "",
    levelName: row.levelName || "",
    status: row.status,
    contact: row.contact ?? null,
    address: row.address ?? null,
    remark: row.remark ?? null,
    points: available,
    totalPoints: Number(cp?.total_points ?? available),
    frozenPoints: Number(cp?.frozen_points ?? 0),
    balance: Number(card?.balance ?? 0),
    totalSpent: Number(spent?.total ?? 0),
    lastConsumeAt: row.lastOrderAt,
    createdAt: row.createdAt,
  };
}

/** 会员管理列表（设计稿 UI v1.2：总会员/本月新增/活跃率 + 会员列表等级/最近消费/累计消费） */
export async function listMemberManage(
  tenantId: string,
  page: number,
  pageSize: number,
  keyword = ""
) {
  const stats = await queryOneWithTenant<{
    total: number | string;
    monthNew: number | string;
    active30d: number | string;
    wholesaleCount: number | string;
    retailCount: number | string;
    balanceSum: number | string;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS monthNew,
            COALESCE(SUM(CASE WHEN last_order_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END), 0) AS active30d,
            COALESCE(SUM(CASE WHEN UPPER(customer_type) = 'WHOLESALE' THEN 1 ELSE 0 END), 0) AS wholesaleCount,
            COALESCE(SUM(CASE WHEN UPPER(customer_type) <> 'WHOLESALE' THEN 1 ELSE 0 END), 0) AS retailCount,
            COALESCE((SELECT SUM(balance) FROM t_store_value_card WHERE tenant_id = ? AND status = 'ACTIVE'), 0) AS balanceSum
     FROM t_member
     WHERE tenant_id = ?`,
    [tenantId, tenantId],
    tenantId
  );

  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<{
    id: number;
    name: string | null;
    nickname: string | null;
    mobile: string;
    customerType: string | null;
    levelCode: string | null;
    levelName: string | null;
    points: number | string;
    status: number;
    contact: string | null;
    address: string | null;
    balance: number | string | null;
    lastOrderAt: Date | string | null;
    createdAt: Date | string;
    totalConsume: number | string;
  }>(
    `SELECT m.id, m.name, m.nickname, m.mobile,
            m.customer_type AS customerType,
            m.level_code AS levelCode, ml.level_name AS levelName, m.points,
            m.status, m.contact, m.address,
            vc.balance,
            m.last_order_at AS lastOrderAt, m.created_at AS createdAt,
            COALESCE((SELECT SUM(o.payable_amount) FROM t_miniapp_order o
                      WHERE o.member_id = m.id AND o.order_status NOT IN ('CANCELLED', 'CLOSED')), 0) AS totalConsume
     FROM t_member m
     LEFT JOIN t_member_level ml ON ml.level_code = m.level_code AND ml.tenant_id = m.tenant_id
     LEFT JOIN (
       SELECT customer_id, SUM(balance) AS balance
       FROM t_store_value_card
       WHERE tenant_id = ? AND status = 'ACTIVE'
       GROUP BY customer_id
     ) vc ON vc.customer_id = m.id
     WHERE m.tenant_id = ?
       AND (? = '' OR m.name LIKE ? OR m.nickname LIKE ? OR m.mobile LIKE ?)
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, tenantId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM t_member WHERE tenant_id = ?
       AND (? = '' OR name LIKE ? OR nickname LIKE ? OR mobile LIKE ?)`,
    [tenantId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
    tenantId
  );

  const total = Number(totalRow?.total ?? 0);
  const totalMembers = Number(stats?.total ?? 0);
  const active30d = Number(stats?.active30d ?? 0);
  return {
    total,
    page,
    pageSize,
    records: records.map((r) => ({
      ...r,
      name: r.name || r.nickname || "会员",
      totalConsume: Number(r.totalConsume ?? 0),
    })),
    stats: {
      totalMembers,
      monthNew: Number(stats?.monthNew ?? 0),
      activeRate: totalMembers > 0 ? Number(((active30d / totalMembers) * 100).toFixed(1)) : 0,
      /** 客户类型分布（批发 / 零售），对齐移动端会员管理汇总卡 */
      wholesaleCount: Number(stats?.wholesaleCount ?? 0),
      retailCount: Number(stats?.retailCount ?? 0),
      /** 储值余额合计（t_store_value_card ACTIVE 卡汇总） */
      balanceSum: Number(stats?.balanceSum ?? 0),
    },
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

/** 新增会员（会员管理页维护；字段以 t_member 真实列为准） */
export async function createMemberManage(
  tenantId: string,
  body: { name: string; mobile: string; customerType: "RETAIL" | "WHOLESALE"; address?: string }
) {
  await executeWithTenant(
    `INSERT INTO t_member (name, mobile, customer_type, address, points, level_code, status, tenant_id)
     VALUES (?, ?, ?, ?, 0, NULL, 1, ?)`,
    [body.name, body.mobile, body.customerType, body.address ?? null, tenantId],
    tenantId
  );
  const row = await queryOneWithTenant<{ id: number }>(
    `SELECT id FROM t_member WHERE tenant_id = ? AND mobile = ? ORDER BY id DESC LIMIT 1`,
    [tenantId, body.mobile],
    tenantId
  );
  return { id: row?.id ?? 0 };
}

/** 更新会员（仅 t_member 真实存在的列：名称/手机号/客户类型/地址） */
export async function updateMemberManage(
  tenantId: string,
  id: number,
  body: { name?: string; mobile?: string; customerType?: "RETAIL" | "WHOLESALE"; address?: string; remark?: string }
) {
  const exists = await queryOneWithTenant<{ id: number }>(
    `SELECT id FROM t_member WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!exists) {
    throw Object.assign(new Error("会员不存在"), { statusCode: 404 });
  }
  await executeWithTenant(
    `UPDATE t_member
     SET name = COALESCE(?, name),
         mobile = COALESCE(?, mobile),
         customer_type = COALESCE(?, customer_type),
         address = COALESCE(?, address),
         remark = COALESCE(?, remark)
     WHERE id = ? AND tenant_id = ?`,
    [body.name ?? null, body.mobile ?? null, body.customerType ?? null, body.address ?? null, body.remark ?? null, id, tenantId],
    tenantId
  );
}
