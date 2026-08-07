import { query, queryOne, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

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

export async function getTenantDetail(id: number): Promise<TenantDetail | null> {
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
     FROM DUAL`,
    [id, id, id, id, id]
  );

  return { ...record, stats: stats ?? undefined };
}

export async function createTenant(body: TenantCreateRequest): Promise<Tenant> {
  const tenantCode = makeBizNo("T");

  const result = await query(
    `INSERT INTO t_tenant (
      tenant_code, company_name, company_short_name,
      contact_person, contact_mobile, contact_email,
      province, city, district, address,
      business_license, legal_person, industry, company_scale,
      source, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [
      tenantCode, body.companyName, body.companyShortName || null,
      body.contactPerson, body.contactMobile, body.contactEmail || null,
      body.province || null, body.city || null, body.district || null, body.address || null,
      body.businessLicense || null, body.legalPerson || null,
      body.industry || null, body.companyScale || null,
      body.source || "MANUAL", body.remark || null
    ]
  );

  const insertId = (result as unknown as { insertId: number }).insertId;

  const newTenant = await getTenantDetail(insertId);
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
  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.status === "SUSPENDED") {
    updates.push("status = ?", "suspend_reason = ?", "suspended_at = NOW()");
    params.push(body.status, body.remark || null);
  } else if (body.status === "ACTIVE") {
    updates.push("status = ?", "suspend_reason = NULL", "suspended_at = NULL");
    params.push(body.status);
  } else {
    updates.push("status = ?");
    params.push(body.status);
  }

  params.push(id);
  await query(
    `UPDATE t_tenant SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
    params
  );

  return getTenantDetail(id);
}

export async function toggleTenantStatus(id: number, status: string): Promise<Tenant | null> {
  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }

  await query(
    "UPDATE t_tenant SET status = ?, updated_at = NOW() WHERE id = ?",
    [status, id]
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
     FROM DUAL`
  );

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    suspendedTenants: Number(stats?.suspendedTenants ?? 0),
    expiredTenants: Number(stats?.expiredTenants ?? 0),
    todayNewTenants: Number(stats?.todayNewTenants ?? 0),
  };
}
