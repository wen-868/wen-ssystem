/**
 * 平台总后台服务
 *
 * 功能模块：
 * 1. 租户管理：创建、编辑、禁用/启用租户，查看租户详情
 * 2. 平台用户管理：平台管理员账号管理
 * 3. 订阅管理：租户订阅套餐管理、订单管理
 * 4. 数据统计：平台总览、租户活跃度、收入统计
 * 5. 系统配置：全局配置、版本管理
 * 6. 操作日志：平台级审计日志
 */

import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";
import bcrypt from "bcryptjs";

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

export interface PlatformAdminCreate {
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT";
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

// ─── 平台用户管理 ────────────────────────────────────────────

/**
 * 平台管理员列表
 */
export async function listPlatformAdmins(
  page: number,
  pageSize: number,
  filters?: {
    role?: string;
    status?: string;
    keyword?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.role) {
    conditions.push("role = ?");
    params.push(filters.role);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.keyword) {
    conditions.push("(username LIKE ? OR real_name LIKE ? OR phone LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT id, username, real_name AS realName, phone, email,
            role, status, last_login_at AS lastLoginAt, created_at AS createdAt
     FROM platform_admin
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM platform_admin WHERE ${where}`,
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
 * 创建平台管理员
 */
export async function createPlatformAdmin(params: PlatformAdminCreate) {
  const existing = await queryOne<any>(
    "SELECT id FROM platform_admin WHERE username = ?",
    [params.username]
  );
  if (existing) {
    throw Object.assign(new Error("用户名已存在"), { statusCode: 400 });
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  const result = await query<any>(
    `INSERT INTO platform_admin
     (username, password_hash, real_name, phone, email, role, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'system')`,
    [
      params.username,
      passwordHash,
      params.realName,
      params.phone,
      params.email || null,
      params.role
    ]
  );

  return {
    id: (result as any).insertId as number,
    username: params.username,
    realName: params.realName,
    role: params.role
  };
}

/**
 * 更新平台管理员状态
 */
export async function updatePlatformAdminStatus(
  adminId: number,
  status: "ACTIVE" | "DISABLED"
) {
  const existing = await queryOne<any>(
    "SELECT id FROM platform_admin WHERE id = ?",
    [adminId]
  );
  if (!existing) {
    throw Object.assign(new Error("管理员不存在"), { statusCode: 404 });
  }

  await query(
    "UPDATE platform_admin SET status = ? WHERE id = ?",
    [status, adminId]
  );

  return { id: adminId, status };
}

// ─── 数据统计 ────────────────────────────────────────────────

/**
 * 平台总览统计
 */
export async function getPlatformOverview() {
  const stats = await queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM tenant) AS totalTenants,
       (SELECT COUNT(*) FROM tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek,
       (SELECT COUNT(*) FROM subscription WHERE status = 'ACTIVE') AS activeSubscriptions,
       (SELECT IFNULL(SUM(amount), 0) FROM subscription WHERE status = 'ACTIVE' AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT COUNT(*) FROM platform_admin) AS totalAdmins
     FROM DUAL`
  );

  // 近7天新增租户趋势
  const trend = await query<any[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM tenant
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  // 套餐分布
  const planDistribution = await query<any[]>(
    `SELECT s.plan_code AS planCode, s.plan_name AS planName, COUNT(*) AS count
     FROM subscription s
     WHERE s.status = 'ACTIVE'
     GROUP BY s.plan_code, s.plan_name
     ORDER BY count DESC`
  );

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    newTenantsWeek: Number(stats?.newTenantsWeek ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    monthlyRevenue: Number(stats?.monthlyRevenue ?? 0),
    totalAdmins: Number(stats?.totalAdmins ?? 0),
    trend,
    planDistribution
  };
}

// ─── 订阅管理 ────────────────────────────────────────────────

/**
 * 订阅订单列表
 */
export async function listPlatformSubscriptions(
  page: number,
  pageSize: number,
  filters?: {
    tenantId?: string;
    status?: string;
    planCode?: string;
    keyword?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.tenantId) {
    conditions.push("s.tenant_id = ?");
    params.push(filters.tenantId);
  }
  if (filters?.status) {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters?.planCode) {
    conditions.push("s.plan_code = ?");
    params.push(filters.planCode);
  }
  if (filters?.keyword) {
    conditions.push("(s.order_no LIKE ? OR t.tenant_name LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT s.id, s.order_no AS orderNo, s.tenant_id AS tenantId,
            t.tenant_name AS tenantName,
            s.plan_code AS planCode, s.plan_name AS planName,
            s.start_date AS startDate, s.end_date AS endDate,
            s.status, s.amount, s.created_at AS createdAt
     FROM subscription s
     LEFT JOIN tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM subscription s
     LEFT JOIN tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}`,
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
 * 手动创建订阅（赠送/开通）
 */
export async function createPlatformSubscription(
  tenantId: string,
  planCode: string,
  planName: string,
  durationDays: number,
  amount: number,
  operator: string
) {
  const orderNo = makeBizNo("SUB");
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  const result = await query<any>(
    `INSERT INTO subscription
     (tenant_id, order_no, plan_code, plan_name, start_date, end_date, status, amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [tenantId, orderNo, planCode, planName, startDate, endDate, amount, operator]
  );

  // 同时更新租户过期时间
  await query(
    "UPDATE tenant SET expire_at = ? WHERE tenant_id = ?",
    [endDate, tenantId]
  );

  return {
    id: (result as any).insertId as number,
    orderNo,
    tenantId,
    planCode,
    endDate
  };
}

// ─── 系统配置 ────────────────────────────────────────────────

/**
 * 获取全局配置列表
 */
export async function listPlatformConfigs(
  category?: string
) {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT config_key AS configKey, config_value AS configValue,
            category, description, updated_at AS updatedAt
     FROM platform_config
     WHERE ${where}
     ORDER BY category, sort_order ASC`,
    params
  );

  return rows;
}

/**
 * 更新全局配置
 */
export async function updatePlatformConfig(
  configKey: string,
  configValue: string,
  operator: string
) {
  const existing = await queryOne<any>(
    "SELECT config_key FROM platform_config WHERE config_key = ?",
    [configKey]
  );

  if (!existing) {
    throw Object.assign(new Error("配置项不存在"), { statusCode: 404 });
  }

  await query(
    "UPDATE platform_config SET config_value = ?, updated_by = ? WHERE config_key = ?",
    [configValue, operator, configKey]
  );

  return { configKey, updated: true };
}

// ─── 操作日志 ────────────────────────────────────────────────

/**
 * 平台操作日志列表
 */
export async function listPlatformAuditLogs(
  page: number,
  pageSize: number,
  filters?: {
    adminId?: number;
    action?: string;
    module?: string;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.adminId) {
    conditions.push("admin_id = ?");
    params.push(filters.adminId);
  }
  if (filters?.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters?.module) {
    conditions.push("module = ?");
    params.push(filters.module);
  }
  if (filters?.keyword) {
    conditions.push("(detail LIKE ? OR ip_address LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like);
  }
  if (filters?.startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(filters.endDate);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT l.id, l.admin_id AS adminId, a.real_name AS adminName,
            l.module, l.action, l.detail, l.ip_address AS ipAddress,
            l.created_at AS createdAt
     FROM platform_audit_log l
     LEFT JOIN platform_admin a ON a.id = l.admin_id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM platform_audit_log l WHERE ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}
