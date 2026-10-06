import { queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { resolveTenantModuleAccess } from "../../shared/module-catalog";

// ========== 类型定义 ==========

interface SubscriptionRow {
  id: number;
  subscriptionNo: string;
  tenantId: number;
  tenantName: string;
  planId: number;
  planName: string;
  planType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  price: number;
  /** S3-26：套餐原价（只读聚合，来自 t_subscription_plan.original_price；无对应套餐时为 null） */
  originalAmount: number | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: string | null;
  transactionNo: string | null;
  autoRenew: number;
  renewPrice: number | null;
  status: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  expireNotifySent: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CountTotalRow {
  total: number;
}

interface SubscriptionOperationLogRow {
  id: number;
  operationType: string;
  oldPlanId: number | null;
  newPlanId: number | null;
  oldEndDate: string | null;
  newEndDate: string | null;
  amount: number | null;
  operatorName: string | null;
  /** S3-26：操作详情（只读聚合，取既有无结构表列 remark，不改表） */
  detail: string | null;
  remark: string | null;
  createdAt: string;
}

interface TenantExpireRow {
  id: number;
  company_name: string;
  expire_at: string;
}

interface PlanModuleRow {
  id: number;
  plan_name: string;
  plan_type: string;
  price: number;
  duration_days: number;
  module_access: string | null;
}

interface SubscriptionBriefRow {
  id: number;
  subscription_no: string;
  tenant_id: number;
  plan_id: number;
  plan_name: string;
  end_date: string;
  status: string;
}

interface PlanBriefRow {
  id: number;
  plan_name: string;
  price: number;
}

/** 订阅取消检查行 */
interface SubscriptionCancelCheckRow {
  id: number;
  subscription_no: string;
  tenant_id: number;
  status: string;
}

/** 订阅支付检查行 */
interface SubscriptionPayCheckRow {
  id: number;
  subscription_no: string;
  tenant_id: number;
  payment_status: string;
}

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
  const params: unknown[] = [];

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

  const records = await queryWithTenant<SubscriptionRow>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, p.original_price AS originalAmount, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     LEFT JOIN t_subscription_plan p ON p.id = s.plan_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(filters.pageSize), (Number(filters.page) - 1) * Number(filters.pageSize)],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
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
  const record = await queryOneWithTenant<SubscriptionRow>(
    `SELECT s.id, s.subscription_no AS subscriptionNo,
            s.tenant_id AS tenantId, t.company_name AS tenantName,
            s.plan_id AS planId, s.plan_name AS planName, s.plan_type AS planType,
            s.start_date AS startDate, s.end_date AS endDate, s.duration_days AS durationDays,
            s.price, p.original_price AS originalAmount, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.paid_at AS paidAt,
            s.transaction_no AS transactionNo,
            s.auto_renew AS autoRenew, s.renew_price AS renewPrice,
            s.status, s.cancel_reason AS cancelReason, s.cancelled_at AS cancelledAt,
            s.expire_notify_sent AS expireNotifySent,
            s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_subscription s
     LEFT JOIN t_tenant t ON t.id = s.tenant_id
     LEFT JOIN t_subscription_plan p ON p.id = s.plan_id
     WHERE s.id = ?`,
    [subscriptionId],
    tenantId
  );

  if (!record) {
    return null;
  }

  const logs = await queryWithTenant<SubscriptionOperationLogRow>(
    `SELECT id, operation_type AS operationType,
            old_plan_id AS oldPlanId, new_plan_id AS newPlanId,
            old_end_date AS oldEndDate, new_end_date AS newEndDate,
            amount, operator_name AS operatorName,
            remark AS detail, remark, created_at AS createdAt
     FROM t_subscription_operation_log
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
    /** S3-29④：实付金额（前端「金额」项）。缺省回退套餐价 plan.price */
    amount?: number;
    /** S3-29④：结束日期（前端「结束日期」项）。缺省按 startDate + 套餐时长推导 */
    endDate?: string;
    paymentMethod?: string;
    autoRenew: number;
    remark?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const tenant = await queryOne<TenantExpireRow>(
    "SELECT id, company_name, expire_at FROM t_tenant WHERE id = ?",
    [body.tenantId]
  );
  if (!tenant) {
    return { code: "404", message: "租户不存在" };
  }

  const plan = await queryOne<PlanModuleRow>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM t_subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.planId]
  );
  if (!plan) {
    return { code: "404", message: "套餐不存在或已下架" };
  }

  // S3-29④：amount / endDate 显式接收并生效（禁止 zod 静默丢弃）；非法值显式拒绝
  const startDate = new Date(body.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return { code: "400", message: "开始日期格式不正确" };
  }
  let endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration_days);
  if (body.endDate !== undefined) {
    const provided = new Date(body.endDate);
    if (Number.isNaN(provided.getTime())) {
      return { code: "400", message: "结束日期格式不正确" };
    }
    if (provided.getTime() <= startDate.getTime()) {
      return { code: "400", message: "结束日期必须晚于开始日期" };
    }
    endDate = provided;
  }
  const amount = body.amount === undefined ? plan.price : body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return { code: "400", message: "金额必须为不小于 0 的数字" };
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
  const endDateStr = endDate.toISOString().slice(0, 10);
  const endDateTime = endDate.toISOString().slice(0, 19).replace("T", " ");

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
        body.startDate, endDateStr, plan.duration_days, amount,
        body.paymentMethod || null, body.autoRenew, plan.price,
        body.remark || null
      ]
    );

    await conn.execute(
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, new_plan_id, new_end_date, amount, operator_id, operator_name, remark)
       VALUES (?, 'CREATE', ?, ?, ?, ?, ?, ?)`,
      [subscriptionNo, body.planId, endDateStr, amount,
        userId, username, `创建订阅: ${subscriptionNo}`]
    );

    await conn.execute(
      "UPDATE t_tenant SET expire_at = ? WHERE id = ?",
      [endDateTime, body.tenantId]
    );

    if (plan.module_access) {
      await conn.execute("DELETE FROM t_tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [body.tenantId]);
      for (const mod of moduleAccess.modules) {
        await conn.execute(
          `INSERT INTO t_tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [body.tenantId, mod.code, mod.name, endDateTime]
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
    /** S3-29④：补差金额（前端「补差金额」项）。缺省按套餐价差推导 */
    amount?: number;
    paymentMethod?: string;
    remark?: string;
  },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<SubscriptionBriefRow>(
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

  const newPlan = await queryOne<PlanModuleRow>(
    "SELECT id, plan_name, plan_type, price, duration_days, module_access FROM t_subscription_plan WHERE id = ? AND status = 'ACTIVE'",
    [body.newPlanId]
  );
  if (!newPlan) {
    return { code: "404", message: "目标套餐不存在或已下架" };
  }

  const oldPlan = await queryOne<PlanBriefRow>(
    "SELECT id, plan_name, price FROM t_subscription_plan WHERE id = ?",
    [existing.plan_id]
  );

  // 判定口径不变：UPGRADE/DOWNGRADE 仍由套餐价差决定；amount 仅决定实际记录的补差金额
  const priceDiff = Math.max(0, newPlan.price - (oldPlan?.price || 0));
  const chargeAmount = body.amount === undefined ? priceDiff : body.amount;
  if (typeof chargeAmount !== "number" || !Number.isFinite(chargeAmount) || chargeAmount < 0) {
    return { code: "400", message: "补差金额必须为不小于 0 的数字" };
  }

  // S3-34：按码表解析 module_access；非码表值显式拒绝（禁止中文文案写进 module_code）
  const moduleAccess = resolveTenantModuleAccess(newPlan.module_access);
  if (!moduleAccess.ok) {
    return {
      code: "400",
      message: `套餐模块配置含非码表值：${moduleAccess.invalid.join("、")}`
    };
  }

  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE t_subscription SET plan_id = ?, plan_name = ?, price = ?, updated_at = NOW() WHERE id = ?`,
      [body.newPlanId, newPlan.plan_name, newPlan.price, subscriptionId]
    );

    await conn.execute(
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, old_plan_id, new_plan_id, amount, operator_id, operator_name, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subscriptionId, priceDiff > 0 ? "UPGRADE" : "DOWNGRADE",
        existing.plan_id, body.newPlanId, chargeAmount,
        userId, username,
        `套餐变更: ${oldPlan?.plan_name} -> ${newPlan.plan_name}`]
    );

    if (newPlan.module_access) {
      await conn.execute("DELETE FROM t_tenant_module_access WHERE tenant_id = ? AND granted_by = 'PLAN'", [existing.tenant_id]);
      for (const mod of moduleAccess.modules) {
        await conn.execute(
          `INSERT INTO t_tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at)
           VALUES (?, ?, ?, 1, 'PLAN', ?)`,
          [existing.tenant_id, mod.code, mod.name, existing.end_date]
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

  return { price_diff: chargeAmount };
}

export async function cancelSubscription(
  subscriptionId: number,
  body: { reason?: string },
  userId: number,
  username: string,
  tenantId: string
) {
  const existing = await queryOneWithTenant<SubscriptionCancelCheckRow>(
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
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
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
  const existing = await queryOneWithTenant<SubscriptionPayCheckRow>(
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
      `INSERT INTO t_subscription_operation_log (subscription_id, operation_type, operator_id, operator_name, remark)
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
