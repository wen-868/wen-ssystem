/**
 * 平台总后台 - 租户管理服务
 *
 * 功能：创建、编辑、禁用/启用租户，查看租户详情
 */

import { query, queryOne, transaction } from "../../shared/db";
// S3-205（总清单第 26 项）：口令哈希一律走 `shared/password.ts` 的唯一封装（`v2$` + cost 12），
// 禁止裸 `bcrypt.hash`（两种口径并存会让按裸 bcrypt 校验的代码/测试对 `v2$` 哈希恒 false，S3-172）。
import { hashPassword } from "../../shared/password";
import { makeBizNo } from "../../shared/id";
import { generateInitialPassword } from "../../shared/initial-password";
import type mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
// S3-183（收口总清单第 18 项）：开通链路必须克隆角色/菜单并把首个管理员绑到本租户的角色行
import {
  bindTenantAdminToOwnSuperAdmin,
  provisionTenantRbac,
  type SqlRunner,
} from "./tenant-rbac-provision.service";

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
  /** 名称真源：库内真值透传（TOTAL-TENANT-NAME-SERVER-TRUTH-01） */
  name: string | null;
  companyName: string | null;
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
  /** 名称真源：库内真值透传（TOTAL-TENANT-NAME-SERVER-TRUTH-01） */
  name: string | null;
  companyName: string | null;
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

// ─── 租户名称真源单点（TOTAL-TENANT-NAME-SERVER-TRUTH-01 服务端阶段）─────────
/**
 * P1-1：租户名称 DB→API→UI 三层同一真源（后端两层 = DB→API 在本文件单点收口）。
 *
 * 权威列（侦察定案，见回传卡 §一）：
 *   · `t_tenant.tenant_name`（152 增量列，「与 company_name 同义」）—— 平台侧既有读写主口径；
 *   · `t_tenant.name`（migration.ts 第 1 步基线列 NOT NULL「租户名称」）—— 存量行（如 default 租户）
 *     只有该列有值；
 *   · `t_tenant.company_name`（016 定义、192 补齐）—— S3-150 起与 tenant_name 同值写入。
 * 回退链 `tenantName → name → companyName` 只在值**确实为空**时才降级；全空 → 「未命名租户」。
 * 任何一层不得用「—」冒充真名：历史数据若真存了「—」占位，同样视为空继续回退（占位清零）。
 *
 * 前端对齐说明：saas-admin 的 TenantList/TenantDetail（UI 阶段，林夕）将用同一规则实现
 * 单一 `tenantDisplayName`（tenantName → name → companyName → 「未命名租户」），
 * API 出口在本文件 `enrichTenantRecords` 里补齐 name / companyName / tenantDisplayName 三字段，
 * 前端可完全复算出与后端一致的显示名（后端出口语义与前端单点 helper 对齐）。
 *
 * tenantCode / contactMobile 同类核验口径：二者是**标识/联系方式**字段，不是名称——
 * 空值不适用「未命名租户」这种显示兜底（那是名称语义），一律**透传库内真实值**
 * （空串/null 原样出口，不产生「—」占位），由 UI 以空态呈现。
 */

/** 全空回退终值（后端出口语义与前端单点 helper 对齐，注释见上） */
export const TENANT_DISPLAY_NAME_FALLBACK = "未命名租户";

/** 名称空值判定：null/undefined/纯空白/「—」占位 都算空（占位清零，不得冒充真名） */
export function isBlankNameValue(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim();
  return text === "" || text === "—";
}

/**
 * 名称字段出口归一：空白/「—」占位 → null（占位不出口），其余 trim 后原样透出。
 * 真值透传字段（tenantName/name/companyName）都过这里，保证 API 出口不携带占位垃圾。
 */
export function normalizeNameField(value: unknown): string | null {
  return isBlankNameValue(value) ? null : String(value).trim();
}

/**
 * 名称回退链单点实现：tenantName → name → companyName，全空 → 「未命名租户」。
 * 命中项做 trim（只去首尾空白，不改真名内容）。
 */
export function resolveTenantDisplayName(
  tenantName?: string | null,
  name?: string | null,
  companyName?: string | null
): string {
  const first = normalizeNameField(tenantName);
  if (first) return first;
  const second = normalizeNameField(name);
  if (second) return second;
  const third = normalizeNameField(companyName);
  if (third) return third;
  return TENANT_DISPLAY_NAME_FALLBACK;
}

/** t_tenant 名称真值行（loadTenantNameTruthMap 的查询出口） */
export interface TenantNameTruthRow {
  id: string;
  tenantName: string | null;
  name: string | null;
  companyName: string | null;
}

/** enrichTenantRecords 附加到出口行的名称真源三字段 */
export interface TenantDisplayNameFields {
  name: string | null;
  companyName: string | null;
  tenantDisplayName: string;
}

/**
 * 批量读取 t_tenant 名称真值（一条 IN 参数绑定查询；id 去重、空列表直接短路不落库）。
 * 供列表/详情/导出三类出口共用，保证「导出与列表口径同源」。
 */
export async function loadTenantNameTruthMap(
  ids: Array<string | number>
): Promise<Map<string, TenantNameTruthRow>> {
  const map = new Map<string, TenantNameTruthRow>();
  const unique = [...new Set(ids.filter((v) => v != null && String(v) !== "").map(String))];
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => "?").join(", ");
  const rows = await query<TenantNameTruthRow>(
    `SELECT id, tenant_name AS tenantName, name, company_name AS companyName
     FROM t_tenant WHERE id IN (${placeholders})`,
    unique
  );
  for (const row of rows || []) {
    map.set(String(row.id), row);
  }
  return map;
}

/**
 * 给租户行（列表 records / 详情单行 / 导出 records）补齐名称真源三字段：
 *   · name / companyName：库内真值透传（消费方可复算回退链）；
 *   · tenantDisplayName：resolveTenantDisplayName 单点回退结果。
 * 真值查询未覆盖的 id（理论不可能：行来自同一张表）按自身 tenantName 兜底解析，不抛错。
 */
export async function enrichTenantRecords<T extends { id: string | number }>(
  records: T[]
): Promise<(T & TenantDisplayNameFields)[]> {
  const truthMap = await loadTenantNameTruthMap(records.map((r) => r.id));
  return records.map((record) => {
    const truth = truthMap.get(String(record.id));
    const tenantName = normalizeNameField(
      truth?.tenantName ?? (record as { tenantName?: string | null }).tenantName
    );
    const name = normalizeNameField(truth?.name);
    const companyName = normalizeNameField(truth?.companyName);
    return {
      ...record,
      name,
      companyName,
      tenantDisplayName: resolveTenantDisplayName(tenantName, name, companyName),
    };
  });
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
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName,
            t.name, t.company_name AS companyName, t.tenant_code AS tenantCode,
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
    // 名称真源三字段（占位归一 + tenantDisplayName）与列表接口同一单点规则
    records: rows.map((row) => ({
      ...row,
      tenantName: normalizeNameField(row.tenantName),
      name: normalizeNameField(row.name),
      companyName: normalizeNameField(row.companyName),
      tenantDisplayName: resolveTenantDisplayName(row.tenantName, row.name, row.companyName)
    }))
  };
}

/**
 * 租户详情
 */
export async function getPlatformTenantDetail(tenantId: string) {
  const tenant = await queryOne<TenantDetailRow>(
    `SELECT t.id, t.tenant_id AS tenantId, t.tenant_name AS tenantName,
            t.name, t.company_name AS companyName, t.tenant_code AS tenantCode,
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
       (SELECT COUNT(*) FROM t_sale_bill WHERE tenant_id = ? AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentOrders
     `,
    [tenantId, tenantId, tenantId, tenantId, tenantId]
  );

  return {
    ...tenant,
    // 名称真源三字段与列表同一单点规则（占位归一 + 回退链，TOTAL-TENANT-NAME-SERVER-TRUTH-01）
    tenantName: normalizeNameField(tenant.tenantName),
    name: normalizeNameField(tenant.name),
    companyName: normalizeNameField(tenant.companyName),
    tenantDisplayName: resolveTenantDisplayName(tenant.tenantName, tenant.name, tenant.companyName),
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
    const adminInitialPassword = await initializeTenantDefaults(conn, tenantId, params.contactName, params.contactPhone);

    // MS-SECURITY-BASELINE-01：管理员一次性初始口令仅在创建租户响应中返回一次
    return { tenantId, tenantCode, adminInitialPassword };
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
): Promise<string> {
  // 创建默认管理员账号
  // S3-205（总清单第 26 项）：原为裸 `await import("bcryptjs")…hash("123456", 10)`，统一到唯一封装。
  // MS-SECURITY-BASELINE-01：取消硬编码默认口令 "123456"，改为生成不可预测的一次性初始口令
  // （crypto 随机源），仅在创建租户响应中返回一次，库中仅存哈希。
  const adminInitialPassword = generateInitialPassword();
  const adminPassword = await hashPassword(adminInitialPassword);
  const [adminResult] = await conn.query(
    `INSERT INTO t_sys_user
     (tenant_id, username, password, real_name, phone, role, status, is_default)
     VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE', 1)`,
    [tenantId, "admin", adminPassword, adminName, adminPhone]
  );

  // S3-183：克隆 default 的角色/菜单到本租户，并把首个管理员绑到本租户自己的 SUPER_ADMIN 角色行
  // （改前只建账号、不建角色行也不建绑定 ⇒ 该租户登录后 permissions=[]、menus=[]）
  const rbacRun: SqlRunner = (sql, params) => conn.query(sql, params as never);
  await provisionTenantRbac(rbacRun, tenantId);
  const adminUserId = Number((adminResult as unknown as { insertId?: number })?.insertId ?? 0);
  if (adminUserId > 0) {
    await bindTenantAdminToOwnSuperAdmin(rbacRun, tenantId, adminUserId);
  }

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

  return adminInitialPassword;
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
