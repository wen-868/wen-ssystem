import { query, queryOne, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export interface Subscription {
  id: number;
  subscriptionNo: string;
  tenantId: number;
  planId: number;
  planName: string;
  planType: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  price: number;
  paymentStatus: string;
  paymentMethod?: string;
  paidAt?: Date;
  transactionNo?: string;
  autoRenew: number;
  renewPrice?: number;
  status: string;
  cancelReason?: string;
  cancelledAt?: Date;
  expireNotifySent: number;
  expireNotifyAt?: Date;
  remark?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionDetail extends Subscription {
  tenantName?: string;
  tenantCode?: string;
}

export interface RenewRequest {
  durationDays: number;
  price?: number;
  remark?: string;
}

export interface UpgradeRequest {
  newPlanId: number;
  remark?: string;
}

export async function listSubscriptions(params: {
  tenantId?: number;
  status?: string;
  planId?: number;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, status, planId, keyword, page, pageSize } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (tenantId) {
    conditions.push("s.tenant_id = ?");
    queryParams.push(tenantId);
  }
  if (status) {
    conditions.push("s.status = ?");
    queryParams.push(status);
  }
  if (planId) {
    conditions.push("s.plan_id = ?");
    queryParams.push(planId);
  }
  if (keyword) {
    conditions.push("(s.subscription_no LIKE ? OR t.company_name LIKE ?)");
    const kw = `%${String(keyword)}%`;
    queryParams.push(kw, kw);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<SubscriptionDetail>(
    `SELECT s.id, s.subscription_no AS subscriptionNo, s.tenant_id AS tenantId,
            s.plan_id AS planId, s.plan_name AS planName,
            s.plan_type AS planType, s.start_date AS startDate,
            s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo, s.auto_renew AS autoRenew,
            s.renew_price AS renewPrice, s.status,
            s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent, s.expire_notify_at AS expireNotifyAt,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt,
            t.company_name AS tenantName, t.tenant_code AS tenantCode
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, (page - 1) * pageSize]
  );

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getSubscriptionDetail(id: number): Promise<SubscriptionDetail | null> {
  const record = await queryOne<SubscriptionDetail>(
    `SELECT s.id, s.subscription_no AS subscriptionNo, s.tenant_id AS tenantId,
            s.plan_id AS planId, s.plan_name AS planName,
            s.plan_type AS planType, s.start_date AS startDate,
            s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo, s.auto_renew AS autoRenew,
            s.renew_price AS renewPrice, s.status,
            s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent, s.expire_notify_at AS expireNotifyAt,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt,
            t.company_name AS tenantName, t.tenant_code AS tenantCode
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     WHERE s.id = ?`,
    [id]
  );

  return record || null;
}

export async function createSubscription(body: {
  tenantId: number;
  planId: number;
  planName: string;
  planType: string;
  durationDays: number;
  price: number;
  startDate?: Date;
  remark?: string;
}): Promise<SubscriptionDetail> {
  const subscriptionNo = makeBizNo("SUB");
  const startDate = body.startDate || new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + body.durationDays);

  const result = await query(
    `INSERT INTO t_subscription (
      subscription_no, tenant_id, plan_id, plan_name, plan_type,
      start_date, end_date, duration_days, price, payment_status,
      auto_renew, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 0, 'ACTIVE', ?)`,
    [
      subscriptionNo, body.tenantId, body.planId, body.planName, body.planType,
      startDate, endDate, body.durationDays, body.price, body.remark || null
    ]
  );

  const insertId = (result as unknown as { insertId: number }).insertId;

  await query(
    "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
    [endDate, body.tenantId]
  );

  const newSubscription = await getSubscriptionDetail(insertId);
  return newSubscription!;
}

export async function renewSubscription(id: number, body: RenewRequest): Promise<SubscriptionDetail | null> {
  const existing = await queryOne<Subscription>(
    `SELECT id, tenant_id AS tenantId, end_date AS endDate, plan_id AS planId,
            plan_name AS planName, plan_type AS planType, price
     FROM t_subscription WHERE id = ?`,
    [id]
  );

  if (!existing) {
    return null;
  }

  const newEndDate = new Date(existing.endDate);
  newEndDate.setDate(newEndDate.getDate() + body.durationDays);
  const renewPrice = body.price || existing.price;

  await query(
    `UPDATE t_subscription
     SET end_date = ?, duration_days = duration_days + ?, renew_price = ?,
         status = 'ACTIVE', updated_at = NOW()
     WHERE id = ?`,
    [newEndDate, body.durationDays, renewPrice, id]
  );

  await query(
    "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
    [newEndDate, existing.tenantId]
  );

  return getSubscriptionDetail(id);
}

export async function upgradeSubscription(id: number, body: UpgradeRequest): Promise<SubscriptionDetail | null> {
  const existing = await queryOne<Subscription>(
    `SELECT id, tenant_id AS tenantId, end_date AS endDate, plan_id AS planId,
            plan_name AS planName, plan_type AS planType, price
     FROM t_subscription WHERE id = ?`,
    [id]
  );

  if (!existing) {
    return null;
  }

  const newPlan = await queryOne<{
    id: number;
    plan_name: string;
    plan_type: string;
    price: number;
    duration_days: number;
  }>(
    "SELECT id, plan_name, plan_type, price, duration_days FROM t_subscription_plan WHERE id = ?",
    [body.newPlanId]
  );

  if (!newPlan) {
    return null;
  }

  await query(
    `UPDATE t_subscription
     SET plan_id = ?, plan_name = ?, plan_type = ?, price = ?,
         duration_days = ?, status = 'ACTIVE', updated_at = NOW()
     WHERE id = ?`,
    [newPlan.id, newPlan.plan_name, newPlan.plan_type, newPlan.price, newPlan.duration_days, id]
  );

  return getSubscriptionDetail(id);
}

export async function cancelSubscription(id: number, body: {
  cancelReason?: string;
}): Promise<SubscriptionDetail | null> {
  const existing = await queryOne<Subscription>(
    "SELECT id, tenant_id AS tenantId, status FROM t_subscription WHERE id = ?",
    [id]
  );

  if (!existing) {
    return null;
  }

  await query(
    `UPDATE t_subscription
     SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [body.cancelReason || null, id]
  );

  return getSubscriptionDetail(id);
}

export async function getSubscriptionStatistics(): Promise<{
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  cancelledSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
}> {
  const stats = await queryOne<any>(
    `SELECT
       COALESCE((SELECT COUNT(*) FROM t_subscription), 0) AS totalSubscriptions,
       COALESCE((SELECT COUNT(*) FROM t_subscription WHERE status = 'ACTIVE'), 0) AS activeSubscriptions,
       COALESCE((SELECT COUNT(*) FROM t_subscription WHERE status = 'EXPIRED'), 0) AS expiredSubscriptions,
       COALESCE((SELECT COUNT(*) FROM t_subscription WHERE status = 'CANCELLED'), 0) AS cancelledSubscriptions,
       COALESCE((SELECT SUM(price) FROM t_subscription WHERE payment_status = 'PAID'), 0) AS totalRevenue,
       COALESCE((SELECT SUM(price) FROM t_subscription WHERE payment_status = 'PAID' AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) AS monthlyRevenue
     FROM DUAL`
  );

  return {
    totalSubscriptions: Number(stats?.totalSubscriptions ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    expiredSubscriptions: Number(stats?.expiredSubscriptions ?? 0),
    cancelledSubscriptions: Number(stats?.cancelledSubscriptions ?? 0),
    totalRevenue: Number(stats?.totalRevenue ?? 0),
    monthlyRevenue: Number(stats?.monthlyRevenue ?? 0),
  };
}
