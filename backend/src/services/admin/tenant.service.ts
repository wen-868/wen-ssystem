import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ========== 租户列表 ==========
export async function listTenants(params: {
  keyword?: string; status?: string; page: number; pageSize: number;
}) {
  const { keyword, status, page, pageSize } = params;
  const conditions: string[] = [];
  const queryParams: any[] = [];

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

  const records = await query<any>(
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
     FROM tenant t
     ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, (page - 1) * pageSize]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM tenant t ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

// ========== 租户详情 ==========
export async function getTenantDetail(tenantId: number) {
  const record = await queryOne<any>(
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
     FROM tenant t
     WHERE t.id = ?`,
    [tenantId]
  );

  if (!record) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const modules = await query<any>(
    `SELECT module_code AS moduleCode, module_name AS moduleName,
            enabled, granted_by AS grantedBy, granted_at AS grantedAt,
            expire_at AS expireAt
     FROM tenant_module_access
     WHERE tenant_id = ?
     ORDER BY module_code`,
    [tenantId]
  );

  return { ...record, modules };
}

// ========== 创建租户 ==========
export async function createTenant(body: {
  companyName: string; companyShortName?: string;
  contactPerson: string; contactMobile: string; contactEmail?: string;
  province?: string; city?: string; district?: string; address?: string;
  businessLicense?: string; legalPerson?: string; industry?: string;
  companyScale?: string; source: string; remark?: string;
}, userId: number, username: string) {
  const tenantCode = makeBizNo("T");

  await transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO tenant (
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
        body.source, body.remark || null
      ]
    );

    const tenantId = (result as unknown as { insertId: number }).insertId;

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["tenant", "CREATE", tenantCode, "tenant", userId, username,
       `创建租户: ${tenantCode}, 公司: ${body.companyName}`, tenantId]
    );
  });

  return { tenant_code: tenantCode };
}

// ========== 更新租户 ==========
export async function updateTenant(tenantId: number, body: {
  companyName?: string; companyShortName?: string;
  contactPerson?: string; contactMobile?: string; contactEmail?: string;
  province?: string; city?: string; district?: string; address?: string;
  businessLicense?: string; legalPerson?: string; industry?: string;
  companyScale?: string; remark?: string;
}, userId: number, username: string) {
  const existing = await queryOne<any>(
    "SELECT id FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: any[] = [];

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
    params.push(tenantId);
    await query(
      `UPDATE tenant SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );

    await query(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["tenant", "UPDATE", String(tenantId), "tenant", userId, username,
       `更新租户信息: ${tenantId}`, tenantId]
    );
  }

  const record = await queryOne<any>(
    `SELECT id, tenant_code AS tenantCode, company_name AS companyName,
            contact_person AS contactPerson, contact_mobile AS contactMobile,
            status, updated_at AS updatedAt
     FROM tenant WHERE id = ?`,
    [tenantId]
  );

  return record;
}

// ========== 停用/启用租户 ==========
export async function changeTenantStatus(tenantId: number, body: {
  status: string; reason?: string;
}, userId: number, username: string) {
  const existing = await queryOne<any>(
    "SELECT id, status FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const updates: string[] = ["status = ?", "updated_at = NOW()"];
  const params: any[] = [body.status];

  if (body.status === "SUSPENDED") {
    updates.push("suspend_reason = ?", "suspended_at = NOW()");
    params.push(body.reason || null, new Date());
  } else if (body.status === "ACTIVE") {
    updates.push("suspend_reason = NULL", "suspended_at = NULL");
  }

  params.push(tenantId);
  await query(
    `UPDATE tenant SET ${updates.join(", ")} WHERE id = ?`,
    params
  );

  await query(
    `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["tenant", "STATUS_CHANGE", String(tenantId), "tenant", userId, username,
     `租户状态变更: ${existing.status} -> ${body.status}`, tenantId]
  );

  const record = await queryOne<any>(
    `SELECT id, tenant_code AS tenantCode, company_name AS companyName,
            status, suspend_reason AS suspendReason, suspended_at AS suspendedAt
     FROM tenant WHERE id = ?`,
    [tenantId]
  );

  return record;
}

// ========== 获取租户模块访问权限 ==========
export async function getTenantModules(tenantId: number) {
  const modules = await query<any>(
    `SELECT module_code AS moduleCode, module_name AS moduleName,
            enabled, granted_by AS grantedBy, granted_at AS grantedAt,
            expire_at AS expireAt, remark
     FROM tenant_module_access
     WHERE tenant_id = ?
     ORDER BY module_code`,
    [tenantId]
  );

  return { total: modules.length, records: modules };
}

// ========== 设置租户模块访问权限 ==========
export async function setTenantModules(tenantId: number, body: {
  modules: Array<{
    moduleCode: string; moduleName: string; enabled: number;
    grantedBy: string; expireAt?: string; remark?: string;
  }>;
}, userId: number, username: string) {
  const existing = await queryOne<any>(
    "SELECT id FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  await transaction(async (conn) => {
    for (const mod of body.modules) {
      await conn.execute(
        `INSERT INTO tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by, expire_at, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           module_name = VALUES(module_name),
           enabled = VALUES(enabled),
           granted_by = VALUES(granted_by),
           expire_at = VALUES(expire_at),
           remark = VALUES(remark),
           updated_at = NOW()`,
        [tenantId, mod.moduleCode, mod.moduleName, mod.enabled, mod.grantedBy,
         mod.expireAt || null, mod.remark || null]
      );
    }

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["tenant", "MODULE_UPDATE", String(tenantId), "tenant", userId, username,
       `更新租户模块权限: ${tenantId}`, tenantId]
    );
  });

  const modules = await query<any>(
    `SELECT module_code AS moduleCode, module_name AS moduleName,
            enabled, granted_by AS grantedBy, expire_at AS expireAt
     FROM tenant_module_access
     WHERE tenant_id = ?
     ORDER BY module_code`,
    [tenantId]
  );

  return { total: modules.length, records: modules };
}