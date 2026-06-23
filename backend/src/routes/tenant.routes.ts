import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const tenantRouter = Router();

// ========== 租户管理 ==========

// 获取租户列表（支持搜索/状态筛选/分页）
tenantRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const {
    keyword, status, page = 1, pageSize = 20
  } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  if (keyword) {
    conditions.push("(t.company_name LIKE ? OR t.contact_person LIKE ? OR t.contact_mobile LIKE ?)");
    const kw = `%${String(keyword)}%`;
    params.push(kw, kw, kw);
  }
  if (status) {
    conditions.push("t.status = ?");
    params.push(status);
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
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM tenant t ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 获取租户详情
tenantRouter.get("/:tenantId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.tenantId);

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
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
  }

  // 查询租户的模块访问权限
  const modules = await query<any>(
    `SELECT module_code AS moduleCode, module_name AS moduleName,
            enabled, granted_by AS grantedBy, granted_at AS grantedAt,
            expire_at AS expireAt
     FROM tenant_module_access
     WHERE tenant_id = ?
     ORDER BY module_code`,
    [tenantId]
  );

  res.json(ok({ ...record, modules }));
}));

// 创建租户
tenantRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    companyName: z.string().min(1).max(128),
    companyShortName: z.string().max(64).optional(),
    contactPerson: z.string().min(1).max(64),
    contactMobile: z.string().min(1).max(20),
    contactEmail: z.string().email().max(128).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    businessLicense: z.string().max(128).optional(),
    legalPerson: z.string().max(64).optional(),
    industry: z.string().max(64).optional(),
    companyScale: z.string().max(32).optional(),
    source: z.enum(["MANUAL", "SELF_REGISTER", "INVITATION"]).default("MANUAL"),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

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

    const tenantId = (result as any).insertId;

    // 插入操作日志
    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["tenant", "CREATE", tenantCode, "tenant", req.user!.id, req.user!.username,
       `创建租户: ${tenantCode}, 公司: ${body.companyName}`, tenantId]
    );
  });

  res.json(ok({ tenant_code: tenantCode }));
}));

// 更新租户信息
tenantRouter.put("/:tenantId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  const body = z.object({
    companyName: z.string().min(1).max(128).optional(),
    companyShortName: z.string().max(64).optional(),
    contactPerson: z.string().min(1).max(64).optional(),
    contactMobile: z.string().min(1).max(20).optional(),
    contactEmail: z.string().email().max(128).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    businessLicense: z.string().max(128).optional(),
    legalPerson: z.string().max(64).optional(),
    industry: z.string().max(64).optional(),
    companyScale: z.string().max(32).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
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
    const value = (body as any)[key];
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
      ["tenant", "UPDATE", String(tenantId), "tenant", req.user!.id, req.user!.username,
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

  res.json(ok(record));
}));

// 停用/启用租户
tenantRouter.put("/:tenantId/status", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  const body = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED", "CLOSED"]),
    reason: z.string().max(255).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
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
    ["tenant", "STATUS_CHANGE", String(tenantId), "tenant", req.user!.id, req.user!.username,
     `租户状态变更: ${existing.status} -> ${body.status}`, tenantId]
  );

  const record = await queryOne<any>(
    `SELECT id, tenant_code AS tenantCode, company_name AS companyName,
            status, suspend_reason AS suspendReason, suspended_at AS suspendedAt
     FROM tenant WHERE id = ?`,
    [tenantId]
  );

  res.json(ok(record));
}));

// 获取租户模块访问权限
tenantRouter.get("/:tenantId/modules", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  const modules = await query<any>(
    `SELECT module_code AS moduleCode, module_name AS moduleName,
            enabled, granted_by AS grantedBy, granted_at AS grantedAt,
            expire_at AS expireAt, remark
     FROM tenant_module_access
     WHERE tenant_id = ?
     ORDER BY module_code`,
    [tenantId]
  );

  res.json(ok({ total: modules.length, records: modules }));
}));

// 设置租户模块访问权限
tenantRouter.put("/:tenantId/modules", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.tenantId);

  const body = z.object({
    modules: z.array(z.object({
      moduleCode: z.string().min(1).max(64),
      moduleName: z.string().min(1).max(128),
      enabled: z.number().int().min(0).max(1),
      grantedBy: z.enum(["PLAN", "MANUAL", "ADDON"]).default("MANUAL"),
      expireAt: z.string().optional(),
      remark: z.string().max(255).optional(),
    })),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM tenant WHERE id = ?",
    [tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
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
      ["tenant", "MODULE_UPDATE", String(tenantId), "tenant", req.user!.id, req.user!.username,
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

  res.json(ok({ total: modules.length, records: modules }));
}));
