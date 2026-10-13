import { query, queryOne } from "../../shared/db";
import { randomUUID } from "node:crypto";
import { makeBizNo } from "../../shared/id";
import { AppError } from "../../shared/app-error";
import { toTenantStatusValue } from "../platform-tenant.service";

export interface Tenant {
  id: number;
  tenantCode: string;
  companyName: string;
  companyShortName?: string;
  contactPerson: string;
  contactMobile: string;
  contactEmail?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  businessLicense?: string;
  legalPerson?: string;
  industry?: string;
  companyScale?: string;
  source: string;
  status: string;
  suspendReason?: string;
  suspendedAt?: Date;
  expireAt?: Date;
  remark?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantCreateRequest {
  companyName: string;
  companyShortName?: string;
  contactPerson: string;
  contactMobile: string;
  contactEmail?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  businessLicense?: string;
  legalPerson?: string;
  industry?: string;
  companyScale?: string;
  source?: string;
  remark?: string;
}

export interface TenantUpdateRequest {
  companyName?: string;
  companyShortName?: string;
  contactPerson?: string;
  contactMobile?: string;
  contactEmail?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  businessLicense?: string;
  legalPerson?: string;
  industry?: string;
  companyScale?: string;
  remark?: string;
}

export interface TenantStats {
  totalUsers: number;
  totalStores: number;
  totalProducts: number;
  totalMembers: number;
  recentOrders: number;
}

export interface TenantDetail extends Tenant {
  stats?: TenantStats;
}

export async function listTenants(params: {
  keyword?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const { keyword, status, page, pageSize } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (keyword) {
    conditions.push("(t.company_name LIKE ? OR t.contact_person LIKE ? OR t.contact_mobile LIKE ?)");
    const kw = `%${String(keyword)}%`;
    queryParams.push(kw, kw, kw);
  }
  if (status) {
    conditions.push("t.status = ?");
    queryParams.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<Tenant>(
    `SELECT t.id, t.tenant_code AS tenantCode, t.company_name AS companyName,
            t.company_short_name AS companyShortName,
            t.contact_person AS contactPerson, t.contact_mobile AS contactMobile,
            t.contact_email AS contactEmail,
            t.province, t.city, t.district, t.address,
            t.business_license AS businessLicense, t.legal_person AS legalPerson,
            t.industry, t.company_scale AS companyScale,
            t.source, t.status, t.suspend_reason AS suspendReason,
            t.suspended_at AS suspendedAt, t.expire_at AS expireAt,
            t.remark, t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM t_tenant t
     ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, (page - 1) * pageSize]
  );

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_tenant t ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getTenantDetail(id: number | string): Promise<TenantDetail | null> {
  const record = await queryOne<Tenant>(
    `SELECT t.id, t.tenant_code AS tenantCode, t.company_name AS companyName,
            t.company_short_name AS companyShortName,
            t.contact_person AS contactPerson, t.contact_mobile AS contactMobile,
            t.contact_email AS contactEmail,
            t.province, t.city, t.district, t.address,
            t.business_license AS businessLicense, t.legal_person AS legalPerson,
            t.industry, t.company_scale AS companyScale,
            t.source, t.status, t.suspend_reason AS suspendReason,
            t.suspended_at AS suspendedAt, t.expire_at AS expireAt,
            t.remark, t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM t_tenant t
     WHERE t.id = ?`,
    [id]
  );

  if (!record) {
    return null;
  }

  const stats = await queryOne<TenantStats>(
    `SELECT
       COALESCE((SELECT COUNT(*) FROM t_sys_user WHERE tenant_id = ?), 0) AS totalUsers,
       COALESCE((SELECT COUNT(*) FROM t_store WHERE tenant_id = ?), 0) AS totalStores,
       COALESCE((SELECT COUNT(*) FROM t_product_spu WHERE tenant_id = ?), 0) AS totalProducts,
       COALESCE((SELECT COUNT(*) FROM t_member WHERE tenant_id = ?), 0) AS totalMembers,
       COALESCE((SELECT COUNT(*) FROM t_sale_bill WHERE tenant_id = ? AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) AS recentOrders
     `,
    [id, id, id, id, id]
  );

  return { ...record, stats: stats ?? undefined };
}

export async function createTenant(body: TenantCreateRequest): Promise<Tenant> {
  const tenantCode = makeBizNo("T");
  // S3-183-F1（收口总清单第 48 项）：t_tenant.id 是 varchar(36) NOT NULL 且**无默认值**，
  // 原 INSERT 不写 id ⇒ MySQL 1364 ⇒ 被 error-handler 映射成 400「缺少必填参数：id」
  // （生产实测 POST /api/saas/tenants 400）。口径照主链路 services/platform-tenant.service.ts：
  // 应用层 randomUUID() 生成主键。
  // 同一处还有第二个 NOT NULL 无默认列 `name`（本机同构库实测：补上 id 后立刻报
  // 400「缺少必填参数：name」）⇒ 必须一并写入；`tenant_name` / `contact_name` 是
  // `name` / `contact_person` 的同义列，平台租户清单（GET /api/platform/tenants）正是读这两列，
  // 主链路也是同写，缺了会建出一个在清单里没有名字/联系人的租户。
  const tenantId = randomUUID();

  await query(
    `INSERT INTO t_tenant (
      id, tenant_code, name, tenant_name, company_name, company_short_name,
      contact_name, contact_person, contact_mobile, contact_email,
      province, city, district, address,
      business_license, legal_person, industry, company_scale,
      source, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      tenantId, tenantCode, body.companyName, body.companyName, body.companyName, body.companyShortName || null,
      body.contactPerson, body.contactPerson, body.contactMobile, body.contactEmail || null,
      body.province || null, body.city || null, body.district || null, body.address || null,
      body.businessLicense || null, body.legalPerson || null,
      body.industry || null, body.companyScale || null,
      body.source || "MANUAL", body.remark || null
    ]
  );

  // 按**生成的主键**取回真实落库行：varchar 主键无 AUTO_INCREMENT ⇒ insertId 恒 0，
  // 沿用原写法会取不到行（接口 200 但 data 为 null）
  const newTenant = await getTenantDetail(tenantId);
  return newTenant!;
}

export async function updateTenant(id: number, body: TenantUpdateRequest): Promise<Tenant | null> {
  const existing = await queryOne(
    "SELECT id FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const fieldMap: Record<string, string> = {
    companyName: "company_name",
    companyShortName: "company_short_name",
    contactPerson: "contact_person",
    contactMobile: "contact_mobile",
    contactEmail: "contact_email",
    province: "province",
    city: "city",
    district: "district",
    address: "address",
    businessLicense: "business_license",
    legalPerson: "legal_person",
    industry: "industry",
    companyScale: "company_scale",
    remark: "remark",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value || null);
    }
  }

  if (updates.length > 0) {
    params.push(id);
    await query(
      `UPDATE t_tenant SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  return getTenantDetail(id);
}

export async function auditTenant(id: number, body: {
  status: string;
  remark?: string;
}): Promise<Tenant | null> {
  // S3-192（收口总清单第 59 项）：t_tenant.status 的**唯一可写值域 = ACTIVE / DISABLED**。
  //  · 原实现把入参原样写库：SUSPENDED 分支与 else 分支（任意值，如 PENDING）都会落库；
  //    且字符串写进 `t_tenant.status`（TINYINT，见 S3-150 口径）在严格模式报 1366 ⇒ 端点 500。
  //  · 现按凌舟裁定的方案 (b)：非 ACTIVE / DISABLED 的入参**直接 400 拒绝**，不静默改写、不落脏值；
  //    "暂停 / 到期停用"是**原因**不是状态 —— 由既有列 suspend_reason + suspended_at 表达，
  //    status 一律落 DISABLED（库值 0，取自唯一映射点 toTenantStatusValue）。
  const statusValue = toTenantStatusValue(body.status);
  if (statusValue === null) {
    throw new AppError("无效的状态值，仅允许 ACTIVE / DISABLED", 400);
  }

  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (statusValue === 0) {
    // DISABLED（原 SUSPENDED 的落库语义：记停用原因与时间）
    updates.push("status = ?", "suspend_reason = ?", "suspended_at = NOW()");
    params.push(statusValue, body.remark || null);
  } else {
    updates.push("status = ?", "suspend_reason = NULL", "suspended_at = NULL");
    params.push(statusValue);
  }

  params.push(id);
  await query(
    `UPDATE t_tenant SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
    params
  );

  return getTenantDetail(id);
}

export async function toggleTenantStatus(id: number, status: string): Promise<Tenant | null> {
  // S3-192：与 auditTenant 同域同口径 —— 可写值域 ACTIVE / DISABLED，非法直接 400；
  // 且**写入库值**（TINYINT 1/0）。原实现 `[status, id]` 把字符串写进数值列 ⇒ 严格模式 1366 → 500。
  const statusValue = toTenantStatusValue(status);
  if (statusValue === null) {
    throw new AppError("无效的状态值，仅允许 ACTIVE / DISABLED", 400);
  }

  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }

  await query(
    "UPDATE t_tenant SET status = ?, updated_at = NOW() WHERE id = ?",
    [statusValue, id]
  );

  return getTenantDetail(id);
}

interface TenantStatsRow {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  expiredTenants: number;
  todayNewTenants: number;
}

export async function getTenantStatistics(): Promise<{
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  expiredTenants: number;
  todayNewTenants: number;
}> {
  const stats = await queryOne<TenantStatsRow>(
    `SELECT
       COALESCE((SELECT COUNT(*) FROM t_tenant), 0) AS totalTenants,
       COALESCE((SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE'), 0) AS activeTenants,
       COALESCE((SELECT COUNT(*) FROM t_tenant WHERE status = 'SUSPENDED'), 0) AS suspendedTenants,
       COALESCE((SELECT COUNT(*) FROM t_tenant WHERE status = 'EXPIRED'), 0) AS expiredTenants,
       COALESCE((SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) = CURDATE()), 0) AS todayNewTenants
     `
  );

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    suspendedTenants: Number(stats?.suspendedTenants ?? 0),
    expiredTenants: Number(stats?.expiredTenants ?? 0),
    todayNewTenants: Number(stats?.todayNewTenants ?? 0),
  };
}
