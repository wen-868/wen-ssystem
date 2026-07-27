/**
 * 平台总后台 - 租户管理服务
 *
 * 功能：创建、编辑、禁用/启用租户，查看租户详情
 */

import { query, queryOne, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

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

/** 租户列表行 */
interface TenantListRow {
  id: number;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  status: string;
  userCount: number;
  storeCount: number;
  createdAt: Date | string;
  expireAt: Date | string | null;
  planCode: string | null;
  planName: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  subscriptionStatus: string | null;
}

/** 总数行 */
interface CountRow {
  total: number;
}

/** 租户详情行 */
interface TenantDetailRow {
  id: number;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  status: string;
  userCount: number;
  storeCount: number;
  createdAt: Date | string;
  expireAt: Date | string | null;
  remark: string | null;
}

/** 订阅行 */
interface SubscriptionRow {
  id: number;
  orderNo: string;
  planCode: string;
  planName: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  amount: number;
  createdAt: Date | string;
}

/** 租户统计行 */
interface TenantStatsRow {
  totalUsers: number;
  totalStores: number;
  totalProducts: number;
  totalMembers: number;
  recentOrders: number;
}

/** ID存在性检查行 */
interface IdRow {
  id: number;
}

/** INSERT/UPDATE 返回结果 */
interface AffectedResult extends ResultSetHeader { }

/** 事务连接查询行 */
interface TenantCodeRow extends RowDataPacket {
  id: number;
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

  const rows = await query<TenantListRow>(
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName, t.tenant_code AS tenantCode,
            t.contact_name AS contactName, t.contact_phone AS contactPhone,
            t.contact_email AS contactEmail, t.status,
            t.user_count AS userCount, t.store_count AS storeCount,
            t.created_at AS createdAt, t.expire_at AS expireAt,
            s.plan_code AS planCode, s.plan_name AS planName,
            s.start_date AS startDate, s.end_date AS endDate,
            s.status AS subscriptionStatus
     FROM t_tenant t
     LEFT JOIN t_subscription s ON s.tenant_id = t.tenant_id AND s.status = 'ACTIVE'
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM t_tenant t WHERE ${where}`,
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
  const tenant = await queryOne<TenantDetailRow>(
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName, t.tenant_code AS tenantCode,
            t.contact_name AS contactName, t.contact_phone AS contactPhone,
            t.contact_email AS contactEmail, t.status,
            t.user_count AS userCount, t.store_count AS storeCount,
            t.created_at AS createdAt, t.expire_at AS expireAt,
            t.remark
     FROM t_tenant t WHERE t.tenant_id = ?`,
    [tenantId]
  );

  if (!tenant) return null;

  // 订阅信息
  const subscriptions = await query<SubscriptionRow>(
    `SELECT id, order_no AS orderNo, plan_code AS planCode, plan_name AS planName,
            start_date AS startDate, end_date AS endDate, status,
            amount, created_at AS createdAt
     FROM t_subscription WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [tenantId]
  );

  // 用户统计
  const stats = await queryOne<TenantStatsRow>(
    `SELECT
       (SELECT COUNT(*) FROM t_sys_user WHERE tenant_id = ?) AS totalUsers,
       (SELECT COUNT(*) FROM t_store WHERE tenant_id = ?) AS totalStores,
       (SELECT COUNT(*) FROM t_product_spu WHERE tenant_id = ?) AS totalProducts,
       (SELECT COUNT(*) FROM t_member WHERE tenant_id = ?) AS totalMembers,
       (SELECT COUNT(*) FROM t_sale_order WHERE tenant_id = ? AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentOrders
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
    const [existing] = await conn.query<TenantCodeRow[]>(
      "SELECT id FROM t_tenant WHERE tenant_code = ?",
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
      `INSERT INTO t_tenant
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
        `INSERT INTO t_subscription
         (tenant_id, order_no, plan_code, plan_name, start_date, end_date, status, amount)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [tenantId, orderNo, params.planCode, params.planCode, startDate, endDate]
      );
    }

    // 初始化租户默认数据
    await initializeTenantDefaults(conn, tenantId, params.contactName, params.contactPhone);

    return { tenantId, tenantCode };
  });

  return result;
}

/**
 * 初始化租户默认数据
 */
async function initializeTenantDefaults(
  conn: mysql.PoolConnection,
  tenantId: string,
  adminName: string,
  adminPhone: string
) {
  // 创建默认管理员账号
  const adminPassword = await import("bcryptjs").then(m => m.hash("123456", 10));
  await conn.query(
    `INSERT INTO t_sys_user
     (tenant_id, username, password, real_name, phone, role, status, is_default)
     VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE', 1)`,
    [tenantId, "admin", adminPassword, adminName, adminPhone]
  );

  // 创建默认仓库
  await conn.query(
    `INSERT INTO t_store
     (tenant_id, store_name, store_code, store_type, status, is_default)
     VALUES (?, '默认仓库', 'WH001', 'WAREHOUSE', 'ACTIVE', 1)`,
    [tenantId]
  );

  // 创建默认价格等级
  await conn.query(
    `INSERT INTO t_price_level
     (tenant_id, level_name, level_code, sort_order)
     VALUES (?, '零售价', 'RETAIL', 1)`,
    [tenantId]
  );

  await conn.query(
    `INSERT INTO t_price_level
     (tenant_id, level_name, level_code, sort_order)
     VALUES (?, '批发价', 'WHOLESALE', 2)`,
    [tenantId]
  );

  // 创建默认支付方式
  await conn.query(
    `INSERT INTO t_payment_method
     (tenant_id, method_name, method_code, status)
     VALUES (?, '现金', 'CASH', 'ACTIVE')`,
    [tenantId]
  );

  await conn.query(
    `INSERT INTO t_payment_method
     (tenant_id, method_name, method_code, status)
     VALUES (?, '微信支付', 'WECHAT', 'ACTIVE')`,
    [tenantId]
  );

  await conn.query(
    `INSERT INTO t_payment_method
     (tenant_id, method_name, method_code, status)
     VALUES (?, '支付宝', 'ALIPAY', 'ACTIVE')`,
    [tenantId]
  );
}

/**
 * 更新租户
 */
export async function updatePlatformTenant(
  tenantId: string,
  params: PlatformTenantUpdate
) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_tenant WHERE tenant_id = ?",
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
    `UPDATE t_tenant SET ${fields.join(", ")} WHERE tenant_id = ?`,
    values
  );

  return { tenantId, updated: true };
}