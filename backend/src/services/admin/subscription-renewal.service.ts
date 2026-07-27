﻿﻿﻿import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** 订阅详情行 */
interface SubscriptionDetailRow {
  id: number;
  subscription_no: string;
  tenant_id: string;
  plan_id: number;
  plan_name: string;
  end_date: Date | string;
  price: number;
  duration_days: number;
  plan_price: number;
}

/** 套餐行 */
interface PlanRow {
  id: number;
  plan_name: string;
  plan_type: string;
  price: number;
  duration_days: number;
  module_access: string;
}

/** 即将到期订阅行 */
interface ExpiringSubscriptionRow {
  id: number;
  subscriptionNo: string;
  tenantId: string;
  tenantName: string | null;
  contactMobile: string | null;
  planName: string;
  endDate: string | Date;
  autoRenew: number | string;
  expireNotifySent: number | string;
  daysRemaining: number | string;
}

/** 已过期订阅行 */
interface ExpiredSubscriptionRow {
  id: number;
  subscriptionNo: string;
  tenantId: string;
  tenantName: string | null;
  contactMobile: string | null;
  planName: string;
  endDate: string | Date;
  overdueDays: number | string;
}

export async function renewSubscription(
  subscriptionId: number,
  body: {
    planId?: number;
    paymentMethod?: string;
    remark?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<SubscriptionDetailRow>(
    `SELECT s.id, s.subscription_no, s.tenant_id, s.plan_id, s.plan_name, s.end_date, s.price,
            p.duration_days, p.price AS plan_price
     FROM t_subscription s
     LEFT JOIN t_subscription_plan p ON p.id = ?
     WHERE s.id = ?`,
    [body.planId || 0, subscriptionId],
    tenantId
  );

  if (!existing) {
    return { code: "404", message: "订阅不存在" };
  }

  const planId = body.planId || existing.plan_id;
  const plan = await queryOne<PlanRow>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM t_subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [planId]
  );
  if (!plan) {
    return { code: "404", message: "套餐不存在或已下架" };
  }

  const renewStartDate = new Date(existing.end_date);
  const renewEndDate = new Date(renewStartDate);
  renewEndDate.setDate(renewEndDate.getDate() + plan.duration_days);

  const subscriptionNo = makeBizNo("SUB");

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_subscription (
        subscription_no, tenant_id, plan_id, plan_name, plan_type,
        start_date, end_date, duration_days, price,
        payment_status, payment_method, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, 'ACTIVE', ?)`,
      [
        subscriptionNo, existing.tenant_id, plan.id, plan.plan_name, plan.plan_type,
        renewStartDate.toISOString().slice(0, 10), renewEndDate.toISOString().slice(0, 10),
        plan.duration_days, plan.price,
        body.paymentMethod || null, body.remark || null
      ]
    );

    await conn.execute(
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, old_end_date, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'RENEW', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, existing.plan_id, plan.id, existing.end_date,
        renewEndDate.toISOString().slice(0, 10), plan.price,
        userId, username, `续费订阅: ${subscriptionNo}`]
    );

    await conn.execute(
      "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
      [renewEndDate.toISOString().slice(0, 19).replace("T", " "), existing.tenant_id]
    );

    if (plan.module_access) {
      const modules = JSON.parse(plan.module_access);
      await conn.execute("DELETE FROM t_tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO t_tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod, mod, renewEndDate.toISOString().slice(0, 19).replace("T", " ")]
        );
      }
    }

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "RENEW", subscriptionNo, "subscription", userId, username,
        `续费订阅: ${subscriptionNo}, 套餐: ${plan.plan_name}`, existing.tenant_id]
    );
  });

  return { subscription_no: subscriptionNo };
}

export async function listExpiring(days: number, tenantId: string) {
  const records = await queryWithTenant<ExpiringSubscriptionRow>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            t.contact_mobile AS contactMobile,
            s.plan_name AS planName, s.end_date AS endDate,
            s.auto_renew AS autoRenew,
            s.expire_notify_sent AS expireNotifySent,
            DATEDIFF(s.end_date, CURDATE()) AS daysRemaining
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     WHERE s.status = 'ACTIVE'
       AND s.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY s.end_date ASC`,
    [days],
    tenantId
  );

  return { total: records.length, records };
}

export async function listExpired(tenantId: string) {
  const records = await queryWithTenant<ExpiredSubscriptionRow>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            t.contact_mobile AS contactMobile,
            s.plan_name AS planName, s.end_date AS endDate,
            DATEDIFF(CURDATE(), s.end_date) AS overdueDays
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     WHERE s.status = 'ACTIVE'
       AND s.end_date < CURDATE()
     ORDER BY s.end_date ASC`,
    [],
    tenantId
  );

  return { total: records.length, records };
}
