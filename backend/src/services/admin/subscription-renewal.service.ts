import { queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { resolveTenantModuleAccess } from "../../shared/module-catalog";

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
    /** S3-29④：续费金额（前端「续费金额」项）。缺省回退套餐价 */
    amount?: number;
    /** S3-29④：续至日期（前端「续至日期」项）。缺省按当前到期日 + 套餐时长推导 */
    endDate?: string;
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

  // S3-29④：amount / endDate 显式接收并生效（禁止 zod 静默丢弃）；非法值显式拒绝
  const renewStartDate = new Date(existing.end_date);
  let renewEndDate = new Date(renewStartDate);
  renewEndDate.setDate(renewEndDate.getDate() + plan.duration_days);
  if (body.endDate !== undefined) {
    const provided = new Date(body.endDate);
    if (Number.isNaN(provided.getTime())) {
      return { code: "400", message: "续至日期格式不正确" };
    }
    if (Number.isNaN(renewStartDate.getTime()) || provided.getTime() <= renewStartDate.getTime()) {
      return { code: "400", message: "续至日期必须晚于当前到期日" };
    }
    renewEndDate = provided;
  }
  const amount = body.amount === undefined ? plan.price : body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return { code: "400", message: "续费金额必须为不小于 0 的数字" };
  }

  // S3-34：按码表解析 module_access；非码表值显式拒绝（禁止中文文案写进 module_code）
  const moduleAccess = resolveTenantModuleAccess(plan.module_access);
  if (!moduleAccess.ok) {
    return {
      code: "400",
      message: `套餐模块配置含非码表值：${moduleAccess.invalid.join("、")}`
    };
  }

  const subscriptionNo = makeBizNo("SUB");
  const renewEndDateStr = renewEndDate.toISOString().slice(0, 10);
  const renewEndDateTime = renewEndDate.toISOString().slice(0, 19).replace("T", " ");

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_subscription (
        subscription_no, tenant_id, plan_id, plan_name, plan_type,
        start_date, end_date, duration_days, price,
        payment_status, payment_method, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, 'ACTIVE', ?)`,
      [
        subscriptionNo, existing.tenant_id, plan.id, plan.plan_name, plan.plan_type,
        renewStartDate.toISOString().slice(0, 10), renewEndDateStr,
        plan.duration_days, amount,
        body.paymentMethod || null, body.remark || null
      ]
    );

    await conn.execute(
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, old_end_date, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'RENEW', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, existing.plan_id, plan.id, existing.end_date,
        renewEndDateStr, amount,
        userId, username, `续费订阅: ${subscriptionNo}`]
    );

    await conn.execute(
      "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
      [renewEndDateTime, existing.tenant_id]
    );

    if (plan.module_access) {
      await conn.execute("DELETE FROM t_tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of moduleAccess.modules) {
        await conn.execute(
          `INSERT INTO t_tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod.code, mod.name, renewEndDateTime]
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
