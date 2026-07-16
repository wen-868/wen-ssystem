import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function listSubscriptions(
  tenantId: string,
  filters: {
    tenantIdQuery?: string;
    status?: string;
    paymentStatus?: string;
    page: number;
    pageSize: number;
  }
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.tenantIdQuery) {
    conditions.push("s.tenant_id = ?");
    params.push(Number(filters.tenantIdQuery));
  }
  if (filters.status) {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters.paymentStatus) {
    conditions.push("s.payment_status = ?");
    params.push(filters.paymentStatus);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(filters.pageSize), (Number(filters.page) - 1) * Number(filters.pageSize)],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_subscription s ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page: Number(filters.page),
    pageSize: Number(filters.pageSize),
    records
  };
}

export async function getSubscription(subscriptionId: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     WHERE s.id = ?`,
    [subscriptionId],
    tenantId
  );

  if (!record) {
    return null;
  }

  const logs = await queryWithTenant<any>(
    `SELECT id, operation_type AS operationType,
            old_plan_id AS oldPlanId, new_plan_id AS newPlanId,
            old_end_date AS oldEndDate, new_end_date AS newEndDate,
            amount, operator_name AS operatorName, remark, created_at AS createdAt
     FROM subscription_operation_log
     WHERE subscription_id = ?
     ORDER BY created_at DESC`,
    [subscriptionId],
    tenantId
  );

  return { ...record, logs };
}

export async function createSubscription(
  body: {
    tenantId: number;
    planId: number;
    startDate: string;
    paymentMethod?: string;
    autoRenew: number;
    remark?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const tenant = await queryOne<any>(
    "SELECT id, company_name, expire_at FROM t_tenant WHERE id = ?",
    [body.tenantId]
  );
  if (!tenant) {
    return { code: "404", message: "租户不存在" };
  }

  const plan = await queryOne<any>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.planId]
  );
  if (!plan) {
    return { code: "404", message: "套餐不存在或已下架" };
  }

  const subscriptionNo = makeBizNo("SUB");
  const startDate = new Date(body.startDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration_days);

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_subscription (
        subscription_no, tenant_id, plan_id, plan_name, plan_type,
        start_date, end_date, duration_days, price,
        payment_status, payment_method, auto_renew, renew_price,
        status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, 'ACTIVE', ?)`,
      [
        subscriptionNo, body.tenantId, body.planId, plan.plan_name, plan.plan_type,
        body.startDate, endDate.toISOString().slice(0, 10), plan.duration_days, plan.price,
        body.paymentMethod || null, body.autoRenew, plan.price,
        body.remark || null
      ]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, new_plan_id, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?)`,
      [subscriptionNo, body.planId, endDate.toISOString().slice(0, 10), plan.price,
       userId, username, `创建订阅: ${subscriptionNo}`]
    );

    await conn.execute(
      "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
      [endDate.toISOString().slice(0, 19).replace("T", " "), body.tenantId]
    );

    if (plan.module_access) {
      const modules = JSON.parse(plan.module_access);
      await conn.execute("DELETE FROM tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [body.tenantId]);
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [body.tenantId, mod, mod, endDate.toISOString().slice(0, 19).replace("T", " ")]
        );
      }
    }

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CREATE", subscriptionNo, "subscription", userId, username,
       `创建订阅: ${subscriptionNo}, 套餐: ${plan.plan_name}`, body.tenantId]
    );
  });

  return { subscription_no: subscriptionNo };
}

export async function changePlan(
  subscriptionId: number,
  body: {
    newPlanId: number;
    paymentMethod?: string;
    remark?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    `SELECT s.id, s.subscription_no, s.tenant_id, s.plan_id, s.plan_name, s.end_date, s.status
     FROM t_subscription s WHERE s.id = ?`,
    [subscriptionId],
    tenantId
  );
  if (!existing) {
    return { code: "404", message: "订阅不存在" };
  }
  if (existing.status !== "ACTIVE") {
    return { code: "400", message: "只有活跃订阅可以变更套餐" };
  }

  const newPlan = await queryOne<any>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.newPlanId]
  );
  if (!newPlan) {
    return { code: "404", message: "目标套餐不存在或已下架" };
  }

  const oldPlan = await queryOne<any>(
    "SELECT id, plan_name, price FROM subscription_plan WHERE id = ?",
    [existing.plan_id]
  );

  const priceDiff = Math.max(0, newPlan.price - (oldPlan?.price || 0));

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE t_subscription SET plan_id = ?, plan_name = ?, price = ?, updated_at = NOW() WHERE id = ?`,
      [body.newPlanId, newPlan.plan_name, newPlan.price, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, amount, operator_id, operator_name, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, priceDiff > 0 ? "UPGRADE" : "DOWNGRADE",
       existing.plan_id, body.newPlanId, priceDiff,
       userId, username,
       `套餐变更: ${oldPlan?.plan_name} -> ${newPlan.plan_name}`]
    );

    if (newPlan.module_access) {
      const modules = JSON.parse(newPlan.module_access);
      await conn.execute("DELETE FROM tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of modules) {
        await conn.execute(
          `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod, mod, existing.end_date]
        );
      }
    }

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CHANGE_PLAN", String(subscriptionId), "subscription",
       userId, username,
       `套餐变更: ${oldPlan?.plan_name} -> ${newPlan.plan_name}`, existing.tenant_id]
    );
  });

  return { price_diff: priceDiff };
}

export async function cancelSubscription(
  subscriptionId: number,
  body: { reason?: string },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, subscription_no, tenant_id, status FROM t_subscription WHERE id = ?",
    [subscriptionId],
    tenantId
  );
  if (!existing) {
    return { code: "404", message: "订阅不存在" };
  }
  if (existing.status === "CANCELLED") {
    return { code: "400", message: "订阅已取消" };
  }

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE t_subscription SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [body.reason || null, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
       VALUES (?, 'CANCEL', ?, ?, ?)`,
      [subscriptionId, userId, username, body.reason || "取消订阅"]
    );

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "CANCEL", String(subscriptionId), "subscription",
       userId, username, `取消订阅: ${existing.subscription_no}`, existing.tenant_id]
    );
  });

  return { subscription_id: subscriptionId, status: "CANCELLED" };
}

export async function paySubscription(
  subscriptionId: number,
  body: {
    paymentMethod: string;
    transactionNo?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, subscription_no, tenant_id, payment_status FROM t_subscription WHERE id = ?",
    [subscriptionId],
    tenantId
  );
  if (!existing) {
    return { code: "404", message: "订阅不存在" };
  }
  if (existing.payment_status === "PAID") {
    return { code: "400", message: "订阅已支付" };
  }

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE t_subscription SET payment_status = 'PAID', payment_method = ?,
       transaction_no = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [body.paymentMethod, body.transactionNo || null, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
       VALUES (?, 'PAY', ?, ?, ?)`,
      [subscriptionId, userId, username, `确认支付: ${body.paymentMethod}`]
    );

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["subscription", "PAY", String(subscriptionId), "subscription",
       userId, username,
       `确认支付: ${existing.subscription_no}, 方式: ${body.paymentMethod}`, existing.tenant_id]
    );
  });

  return { subscription_id: subscriptionId, payment_status: "PAID" };
}
