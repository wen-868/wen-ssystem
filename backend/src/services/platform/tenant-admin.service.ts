/**
 * 平台总后台 - 租户管理服务
 *
 * 功能：创建、编辑、禁用/启用租户，查看租户详情
 */

import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface PlatformTenantCreate {
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  planCode?: string;
  durationDays?: number;
}

export interface PlatformTenantUpdate {
  tenantName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: "ACTIVE" | "DISABLED" | "EXPIRED";
}

// ─── 租户管理 ────────────────────────────────────────────────

/**
 * 租户列表
 */
export async function listPlatformTenants(
  page: number,
  pageSize: number,
  filters?: {
    status?: string;
    keyword?: string;
    planCode?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.status) {
    conditions.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters?.keyword) {
    conditions.push("(t.tenant_name LIKE ? OR t.tenant_code LIKE ? OR t.contact_phone LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like, like);
  }
  if (filters?.planCode) {
    conditions.push("s.plan_code = ?");
    params.push(filters.planCode);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName, t.tenant_code AS tenantCode,
            t.contact_name AS contactName, t.contact_phone AS contactPhone,
            t.contact_email AS contactEmail, t.status,
            t.user_count AS userCount, t.store_count AS storeCount,
            t.created_at AS createdAt, t.expire_at AS expireAt,
            s.plan_code AS planCode, s.plan_name AS planName,
            s.start_date AS startDate, s.end_date AS endDate,
            s.status AS subscriptionStatus
     FROM tenant t
     LEFT JOIN subscription s ON s.tenant_id = t.tenant_id AND s.status = 'ACTIVE'
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM tenant t WHERE ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}

/**
 * 租户详情
 */
export async function getPlatformTenantDetail(tenantId: string) {
  const tenant = await queryOne<any>(
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName, t.tenant_code AS tenantCode,
            t.contact_name AS contactName, t.contact_phone AS contactPhone,
            t.contact_email AS contactEmail, t.status,
            t.user_count AS userCount, t.store_count AS storeCount,
            t.created_at AS createdAt, t.expire_at AS expireAt,
            t.remark
     FROM tenant t WHERE t.tenant_id = ?`,
    [tenantId]
  );

  if (!tenant) return null;

  // 订阅信息
  const subscriptions = await query<any[]>(
    `SELECT id, order_no AS orderNo, plan_code AS planCode, plan_name AS planName,
            start_date AS startDate, end_date AS endDate, status,
            amount, created_at AS createdAt
     FROM subscription WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [tenantId]
  );

  // 用户统计
  const stats = await queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM sys_user WHERE tenant_id = ?) AS totalUsers,
       (SELECT COUNT(*) FROM store WHERE tenant_id = ?) AS totalStores,
       (SELECT COUNT(*) FROM product_spu WHERE tenant_id = ?) AS totalProducts,
       (SELECT COUNT(*) FROM member WHERE tenant_id = ?) AS totalMembers,
       (SELECT COUNT(*) FROM sale_order WHERE tenant_id = ? AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentOrders
     FROM DUAL`,
    [tenantId, tenantId, tenantId, tenantId, tenantId]
  );

  return {
    ...tenant,
    subscriptions,
    stats
  };
}

/**
 * 创建租户
 */
export async function createPlatformTenant(params: PlatformTenantCreate) {
  const result = await transaction(async (conn) => {
    const tenantId = `tenant_${Date.now()}`;
    const tenantCode = params.tenantCode;

    // 检查租户编码是否已存在
    const [existing] = await conn.query<any[]>(
      "SELECT id FROM tenant WHERE tenant_code = ?",
      [tenantCode]
    );
    if (existing.length > 0) {
      throw Object.assign(new Error("租户编码已存在"), { statusCode: 400 });
    }

    // 计算过期时间
    const durationDays = params.durationDays || 30;
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + durationDays);

    // 创建租户
    await conn.query(
      `INSERT INTO tenant
       (tenant_id, tenant_name, tenant_code, contact_name, contact_phone, contact_email,
        status, expire_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'platform')`,
      [
        tenantId,
        params.tenantName,
        tenantCode,
        params.contactName,
        params.contactPhone,
        params.contactEmail || null,
        expireAt
      ]
    );

    // 如果指定了套餐，创建订阅
    if (params.planCode) {
      const orderNo = makeBizNo("SUB");
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      await conn.query(
        `INSERT INTO subscription
         (tenant_id, order_no, plan_code, plan_name, start_date, end_date, status, amount)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [tenantId, orderNo, params.planCode, params.planCode, startDate, endDate]
      );
    }

    // TODO: 初始化租户默认数据（管理员账号、基础配置等）

    return { tenantId, tenantCode };
  });

  return result;
}

/**
 * 更新租户
 */
export async function updatePlatformTenant(
  tenantId: string,
  params: PlatformTenantUpdate
) {
  const existing = await queryOne<any>(
    "SELECT id FROM tenant WHERE tenant_id = ?",
    [tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (params.tenantName !== undefined) {
    fields.push("tenant_name = ?");
    values.push(params.tenantName);
  }
  if (params.contactName !== undefined) {
    fields.push("contact_name = ?");
    values.push(params.contactName);
  }
  if (params.contactPhone !== undefined) {
    fields.push("contact_phone = ?");
    values.push(params.contactPhone);
  }
  if (params.contactEmail !== undefined) {
    fields.push("contact_email = ?");
    values.push(params.contactEmail);
  }
  if (params.status !== undefined) {
    fields.push("status = ?");
    values.push(params.status);
  }

  if (fields.length === 0) {
    return { tenantId, updated: true };
  }

  values.push(tenantId);

  await query(
    `UPDATE tenant SET ${fields.join(", ")} WHERE tenant_id = ?`,
    values
  );

  return { tenantId, updated: true };
}