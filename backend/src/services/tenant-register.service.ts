import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import { connExecute, query, queryOne, transaction } from "../shared/db";
import { hashPassword, validatePassword } from "../shared/password";
import { AppError } from "../shared/app-error";
import logger from "../shared/logger";
import { makeBizNo } from "../shared/id";
import { verifySmsCode, isSmsVerifyEnabled, sendSms } from "./sms.service";

export interface TenantRegisterInput {
  // 与前端注册表单字段一致（snake_case）
  company_name: string;
  company_short_name?: string;
  contact_person: string;
  contact_mobile: string;
  contact_email?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  business_license?: string;
  legal_person?: string;
  industry?: string;
  company_scale?: string;
  admin_username: string;
  admin_password: string;
  admin_real_name: string;
  sms_code?: string;
}

export interface TenantApplication {
  id: number;
  company_name: string;
  contact_person: string;
  contact_mobile: string;
  admin_username: string;
  status: string;
  reject_reason?: string;
  reviewed_at?: string;
  created_at: string;
}

interface IdRow {
  id: number;
}

interface InsertResult {
  insertId: number;
}

interface CountTotalRow {
  total: number;
}

interface TenantApplicationFullRow {
  id: number;
  company_name: string;
  company_short_name: string;
  contact_person: string;
  contact_mobile: string;
  contact_email: string;
  province: string;
  city: string;
  district: string;
  address: string;
  business_license: string;
  legal_person: string;
  industry: string;
  company_scale: string;
  admin_username: string;
  admin_real_name: string;
  status: string;
  reject_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  created_at: string;
}

interface TenantRegisterAppRawRow {
  id: number;
  company_name: string;
  company_short_name: string;
  contact_person: string;
  contact_mobile: string;
  contact_email: string;
  admin_username: string;
  admin_password_hash: string;
  admin_real_name: string;
  status: string;
  [key: string]: unknown;
}

export async function applyTenantRegister(body: TenantRegisterInput): Promise<{ applicationId: number }> {
  const companyName = body.company_name;
  const contactMobile = body.contact_mobile;
  const adminUsername = body.admin_username;
  const adminPassword = body.admin_password;
  const contactPerson = body.contact_person;
  const adminRealName = body.admin_real_name;

  // 手机短信验证码校验（总台开关开启时必填，防止恶意注册；关闭时无需验证码）
  if (!contactMobile) {
    throw new AppError("联系电话不能为空", 400);
  }
  if (await isSmsVerifyEnabled("default")) {
    if (!body.sms_code) {
      throw new AppError("请输入短信验证码", 400);
    }
    await verifySmsCode(contactMobile, body.sms_code, "TENANT_REGISTER", "default");
  }

  const validation = validatePassword(adminPassword);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const existingCompany = await queryOne<IdRow>(
    "SELECT id FROM t_tenant_register_application WHERE company_name = ?",
    [companyName]
  );
  if (existingCompany) {
    throw new AppError("该公司名称已提交过注册申请", 400);
  }

  const existingMobile = await queryOne<IdRow>(
    "SELECT id FROM t_tenant_register_application WHERE contact_mobile = ?",
    [contactMobile]
  );
  if (existingMobile) {
    throw new AppError("该手机号已提交过注册申请", 400);
  }

  const existingUsername = await queryOne<IdRow>(
    "SELECT id FROM t_tenant_register_application WHERE admin_username = ?",
    [adminUsername]
  );
  if (existingUsername) {
    throw new AppError("该管理员账号已被使用", 400);
  }

  const userExists = await queryOne<IdRow>(
    "SELECT id FROM t_sys_user WHERE username = ?",
    [adminUsername]
  );
  if (userExists) {
    throw new AppError("该管理员账号已被使用", 400);
  }

  const passwordHash = await hashPassword(adminPassword);

  const result = await query<InsertResult>(
    `INSERT INTO t_tenant_register_application (
      company_name, company_short_name, contact_person, contact_mobile, contact_email,
      province, city, district, address, business_license, legal_person,
      industry, company_scale, admin_username, admin_password_hash, admin_real_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyName, body.company_short_name || "", contactMobile, contactPerson, body.contact_email || "",
      body.province || "", body.city || "", body.district || "", body.address || "", body.business_license || "",
      body.legal_person || "", body.industry || "", body.company_scale || "", adminUsername, passwordHash, adminRealName
    ]
  );

  const applicationId = (result as unknown as { insertId: number }).insertId;
  logger.info(`[租户注册] 申请提交成功 applicationId=${applicationId} companyName=${companyName}`);

  return { applicationId };
}

export async function approveTenantApplication(applicationId: number, reviewerId: number): Promise<{ tenantId: string; applicationId: number }> {
  const application = await queryOne<TenantRegisterAppRawRow>(
    `SELECT * FROM t_tenant_register_application WHERE id = ? AND status = 'PENDING'`,
    [applicationId]
  );

  if (!application) {
    throw new AppError("申请不存在或已处理", 404);
  }

  const tenantId = randomUUID();
  const tenantCode = makeBizNo("T");

  await transaction(async (conn) => {
    // 1) 创建租户（id 为 UUID，status 为 ACTIVE）
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_tenant (
        id, tenant_code, company_name, company_short_name,
        contact_person, contact_mobile, contact_email,
        province, city, district, address,
        business_license, legal_person, industry, company_scale,
        source, status, review_status, reviewed_at, reviewed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SELF_REGISTER', 'ACTIVE', 'APPROVED', NOW(), ?)`,
      [
        tenantId, tenantCode, application.company_name, application.company_short_name || "",
        application.contact_person, application.contact_mobile, application.contact_email || "",
        application.province || "", application.city || "", application.district || "", application.address || "",
        application.business_license || "", application.legal_person || "",
        application.industry || "", application.company_scale || "",
        reviewerId
      ]
    );

    // 2) 创建管理员账号（tenant_id 关联新租户）
    const [userResult] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, status)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [tenantId, application.admin_username, application.admin_password_hash, application.admin_real_name, application.contact_mobile]
    );
    const userId = userResult.insertId;

    // 3) 绑定超级管理员角色（优先当前租户角色，其次 default 全局角色）
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
       SELECT ?, id, ? FROM t_sys_role
       WHERE role_code = 'SUPER_ADMIN' AND status = 'ACTIVE'
       ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [userId, tenantId, tenantId]
    );

    // 4) 记录租户管理员
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_tenant_admin (tenant_id, user_id, role, is_primary)
       VALUES (?, ?, 'ADMIN', 1)`,
      [tenantId, userId]
    );

    // 5) 更新申请状态
    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_tenant_register_application SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [reviewerId, applicationId]
    );

    // 6) 初始化租户默认数据（门店/价格等级/支付方式），保证审核通过即可使用
    const storeName = application.company_short_name || application.company_name;
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_store (
         tenant_id, store_code, name, address, contact, phone,
         delivery_radius, business_status, status,
         fulfillment_delivery_enabled, fulfillment_pickup_enabled
       ) VALUES (?, 'S001', ?, '', ?, ?, 5.00, 'OPEN', 'OPEN', 1, 1)`,
      [tenantId, storeName, application.contact_person, application.contact_mobile]
    );
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_price_level (tenant_id, level_code, level_name, discount_rate, min_order_amount, description, sort_order)
       VALUES (?, 'RETAIL', '零售价', 100.00, 0, '默认零售价格', 1),
              (?, 'WHOLESALE', '批发价', 90.00, 0, '默认批发价格', 2)`,
      [tenantId, tenantId]
    );
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_payment_method (tenant_id, method_name, method_code, status)
       VALUES (?, '现金', 'CASH', 'ACTIVE'),
              (?, '微信支付', 'WECHAT', 'ACTIVE'),
              (?, '支付宝', 'ALIPAY', 'ACTIVE')`,
      [tenantId, tenantId, tenantId]
    );
  });

  logger.info(`[租户注册审核] 申请通过 applicationId=${applicationId} tenantId=${tenantId}`);

  // 7) 审核结果短信通知（短信开关关闭/未配置时不阻塞审核，静默跳过）
  try {
    if (await isSmsVerifyEnabled("default")) {
      await sendSms({
        mobile: application.contact_mobile,
        templateCode: await getRegisterResultTemplateCode("default"),
        templateParam: { companyName: application.company_name, status: "审核通过" },
        tenantId: "default",
      });
      logger.info(`[租户注册审核] 已发送通过通知 mobile=${application.contact_mobile}`);
    }
  } catch (e: any) {
    logger.warn(`[租户注册审核] 短信通知发送失败（不影响审核结果）：${e?.message || e}`);
  }

  return { tenantId, applicationId };
}

/** 获取注册结果通知模板（用途 TENANT_REGISTER_RESULT） */
async function getRegisterResultTemplateCode(tenantId: string): Promise<string> {
  const row = await queryOne<{ code: string }>(
    `SELECT code FROM t_sms_template
     WHERE tenant_id = ? AND purpose = 'TENANT_REGISTER_RESULT' AND status = 'ENABLED'
     ORDER BY id DESC LIMIT 1`,
    [tenantId]
  );
  if (!row?.code) {
    throw new AppError(`短信模板未配置（用途：TENANT_REGISTER_RESULT）`, 500);
  }
  return row.code;
}

export async function rejectTenantApplication(applicationId: number, reviewerId: number, rejectReason: string): Promise<{ applicationId: number }> {
  const application = await queryOne<IdRow>(
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
}): Promise<{ items: TenantApplication[]; total: number; page: number; pageSize: number }> {
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
    queryOne<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_tenant_register_application ${where}`, values),
    query<TenantApplication>(
      `SELECT id, company_name, contact_person, contact_mobile, admin_username,
              status, reject_reason, reviewed_at, created_at
       FROM t_tenant_register_application ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    )
  ]);

  return {
    items: rows as TenantApplication[],
    total: Number(totalResult?.total || 0),
    page,
    pageSize
  };
}

export async function getTenantApplication(applicationId: number): Promise<TenantApplication | null> {
  const row = await queryOne<TenantApplicationFullRow>(
    `SELECT id, company_name, company_short_name, contact_person, contact_mobile,
            contact_email, province, city, district, address,
            business_license, legal_person, industry, company_scale, admin_username,
            admin_real_name, status, reject_reason, reviewed_at, reviewed_by, created_at
     FROM t_tenant_register_application WHERE id = ?`,
    [applicationId]
  );
  return row ? (row as unknown as TenantApplication) : null;
}
