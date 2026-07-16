import { query, queryOne, transaction } from "../shared/db";
import { hashPassword, validatePassword } from "../shared/password";
import { AppError } from "../shared/app-error";
import logger from "../shared/logger";

export interface TenantRegisterInput {
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
  adminUsername: string;
  adminPassword: string;
  adminRealName: string;
}

export interface TenantApplication {
  id: number;
  companyName: string;
  contactPerson: string;
  contactMobile: string;
  adminUsername: string;
  status: string;
  rejectReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

export async function applyTenantRegister(body: TenantRegisterInput): Promise<{ applicationId: number }> {
  const { companyName, contactMobile, adminUsername, adminPassword } = body;

  const validation = validatePassword(adminPassword);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const existingCompany = await queryOne<any>(
    "SELECT id FROM t_tenant_register_application WHERE company_name = ?",
    [companyName]
  );
  if (existingCompany) {
    throw new AppError("该公司名称已提交过注册申请", 400);
  }

  const existingMobile = await queryOne<any>(
    "SELECT id FROM t_tenant_register_application WHERE contact_mobile = ?",
    [contactMobile]
  );
  if (existingMobile) {
    throw new AppError("该手机号已提交过注册申请", 400);
  }

  const existingUsername = await queryOne<any>(
    "SELECT id FROM t_tenant_register_application WHERE admin_username = ?",
    [adminUsername]
  );
  if (existingUsername) {
    throw new AppError("该管理员账号已被使用", 400);
  }

  const userExists = await queryOne<any>(
    "SELECT id FROM t_sys_user WHERE username = ?",
    [adminUsername]
  );
  if (userExists) {
    throw new AppError("该管理员账号已被使用", 400);
  }

  const passwordHash = await hashPassword(adminPassword);

  const result = await query<any>(
    `INSERT INTO t_tenant_register_application (
      company_name, company_short_name, contact_person, contact_mobile, contact_email,
      province, city, district, address, business_license, legal_person,
      industry, company_scale, admin_username, admin_password_hash, admin_real_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyName, body.companyShortName || "", contactMobile, body.contactPerson, body.contactEmail || "",
      body.province || "", body.city || "", body.district || "", body.address || "", body.businessLicense || "",
      body.legalPerson || "", body.industry || "", body.companyScale || "", adminUsername, passwordHash, body.adminRealName
    ]
  );

  const applicationId = (result as unknown as { insertId: number }).insertId;
  logger.info(`[租户注册] 申请提交成功 applicationId=${applicationId} companyName=${companyName}`);

  return { applicationId };
}

export async function approveTenantApplication(applicationId: number, reviewerId: number): Promise<{ tenantId: string; applicationId: number }> {
  const application = await queryOne<any>(
    `SELECT * FROM t_tenant_register_application WHERE id = ? AND status = 'PENDING'`,
    [applicationId]
  );

  if (!application) {
    throw new AppError("申请不存在或已处理", 404);
  }

  let tenantId = "";

  await transaction(async (conn) => {
    const tenantResult = await conn.query(
      `INSERT INTO t_tenant (name, contact_name, contact_phone, contact_email, status, review_status)
       VALUES (?, ?, ?, ?, 'ACTIVE', 'APPROVED')`,
      [application.company_name, application.contact_person, application.contact_mobile, application.contact_email || ""]
    );
    tenantId = (tenantResult as unknown as { insertId: number }).insertId.toString();

    await conn.query(
      `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, status, role)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'ADMIN')`,
      [tenantId, application.admin_username, application.admin_password_hash, application.admin_real_name, application.contact_mobile]
    );

    await conn.query(
      `INSERT INTO t_tenant_admin (tenant_id, user_id, role, is_primary)
       SELECT ?, id, 'ADMIN', 1 FROM t_sys_user WHERE tenant_id = ? AND username = ?`,
      [tenantId, tenantId, application.admin_username]
    );

    await conn.query(
      `UPDATE t_tenant_register_application SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [reviewerId, applicationId]
    );
  });

  logger.info(`[租户注册审核] 申请通过 applicationId=${applicationId} tenantId=${tenantId}`);

  return { tenantId: tenantId!, applicationId };
}

export async function rejectTenantApplication(applicationId: number, reviewerId: number, rejectReason: string): Promise<{ applicationId: number }> {
  const application = await queryOne<any>(
    `SELECT id FROM t_tenant_register_application WHERE id = ? AND status = 'PENDING'`,
    [applicationId]
  );

  if (!application) {
    throw new AppError("申请不存在或已处理", 404);
  }

  await query(
    `UPDATE t_tenant_register_application SET status = 'REJECTED', reject_reason = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
    [rejectReason, reviewerId, applicationId]
  );

  logger.info(`[租户注册审核] 申请驳回 applicationId=${applicationId} reason=${rejectReason}`);

  return { applicationId };
}

export async function listTenantApplications(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: TenantApplication[]; total: number; page: number; pageSize: number }> {
  const { status, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    values.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, rows] = await Promise.all([
    queryOne<any>(`SELECT COUNT(*) AS total FROM t_tenant_register_application ${where}`, values),
    query<any>(
      `SELECT id, company_name AS companyName, contact_person AS contactPerson,
              contact_mobile AS contactMobile, admin_username AS adminUsername,
              status, reject_reason AS rejectReason, reviewed_at AS reviewedAt, created_at AS createdAt
       FROM t_tenant_register_application ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    )
  ]);

  return {
    list: rows as TenantApplication[],
    total: Number(totalResult?.total || 0),
    page,
    pageSize
  };
}

export async function getTenantApplication(applicationId: number): Promise<TenantApplication | null> {
  const row = await queryOne<any>(
    `SELECT id, company_name AS companyName, company_short_name AS companyShortName,
            contact_person AS contactPerson, contact_mobile AS contactMobile,
            contact_email AS contactEmail, province, city, district, address,
            business_license AS businessLicense, legal_person AS legalPerson,
            industry, company_scale AS companyScale, admin_username AS adminUsername,
            admin_real_name AS adminRealName, status, reject_reason AS rejectReason,
            reviewed_at AS reviewedAt, reviewed_by AS reviewedBy, created_at AS createdAt
     FROM t_tenant_register_application WHERE id = ?`,
    [applicationId]
  );
  return row ? (row as TenantApplication) : null;
}
