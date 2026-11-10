import { z } from "zod";
import { v4 as uuid } from "uuid";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
// TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01-F1（缺口②）：legacy 启停审计行操作者不得为 0/空 ——
// updateTenant 必须从 req 构造 auditCtx 传入 service（来源归一与活路径同一真源）。
import { normalizeTenantToggleSource } from "../../services/admin/platform-audit-tenant-toggle.service";
import * as tenantAdminService from "../../services/platform/tenant-admin.service";
import * as adminAccountService from "../../services/platform/admin-account.service";
import * as overviewService from "../../services/platform/platform-overview.service";
import * as subscriptionAdminService from "../../services/platform/subscription-admin.service";
import * as configService from "../../services/platform/platform-config.service";

// ─── 租户管理 ────────────────────────────────────────────────

export const listTenants = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const planCode = req.query.planCode as string | undefined;

  const result = await tenantAdminService.listPlatformTenants(
    page,
    pageSize,
    { status, keyword, planCode }
  );
  res.json(ok(result));
});

export const getTenantDetail = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId;

  const result = await tenantAdminService.getPlatformTenantDetail(tenantId);
  if (!result) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const createTenant = asyncHandler(async (req, res) => {
  const body = z.object({
    tenantName: z.string().min(2).max(100),
    tenantCode: z.string().min(2).max(50),
    contactName: z.string().min(2).max(50),
    contactPhone: z.string().min(11).max(20),
    contactEmail: z.string().email().optional(),
    planCode: z.string().optional(),
    durationDays: z.number().int().min(1).max(3650).default(30)
  }).parse(req.body);

  const result = await tenantAdminService.createPlatformTenant(body);
  res.json(ok(result));
});

export const updateTenant = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId;
  const body = z.object({
    tenantName: z.string().min(2).max(100).optional(),
    contactName: z.string().min(2).max(50).optional(),
    contactPhone: z.string().min(11).max(20).optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    status: z.enum(["ACTIVE", "DISABLED", "EXPIRED"]).optional()
  }).parse(req.body);

  // TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01-F1（缺口②）：真实控制器构造 auditCtx 传入 service，
  // legacy 启停审计行 operatorId/operatorName 取真实平台账号，禁止再落 0/空 ——
  //   · operator：req.user（id/username/realName，与平台认证中间件注入的 JWT 载荷同源）；
  //   · source：x-platform-source 头 / body.source 归一（缺省 api），与活路径同一真源；
  //   · traceId：控制器生成，并覆盖到响应体（traceId 四方一致：响应 ↔ 审计行）；
  //   · ip：req.ip。
  // 响应契约不变：仍为 ok(result) 的 {code:"0",msg,data,traceId}，仅 traceId 由
  // 控制器定值（原先 ok() 内部自生成的 uuid 同形字段）。
  const traceId = uuid();
  const result = await tenantAdminService.updatePlatformTenant(tenantId, body, {
    operatorId: req.user?.id ?? 0,
    operatorName: String(req.user?.username ?? req.user?.realName ?? ""),
    source: normalizeTenantToggleSource(req),
    traceId,
    ip: typeof req.ip === "string" ? req.ip : null,
  });
  res.json({ ...ok(result), traceId });
});

// ─── 平台管理员 ──────────────────────────────────────────────

export const listAdmins = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const role = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = await adminAccountService.listPlatformAdmins(
    page,
    pageSize,
    { role, status, keyword }
  );
  res.json(ok(result));
});

export const createAdmin = asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().min(4).max(50),
    password: z.string().min(6).max(50),
    realName: z.string().min(2).max(50),
    phone: z.string().min(11).max(20),
    email: z.string().email().optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT"])
  }).parse(req.body);

  const result = await adminAccountService.createPlatformAdmin(body);
  res.json(ok(result));
});

export const updateAdminStatus = asyncHandler(async (req, res) => {
  const adminId = Number(req.params.id);
  // S3-138：与 resetAdminPassword 同语义、同文案（非数字 / 非正整数 ⇒ 400）。
  // 修复前 Number("abc")=NaN 直接进 service，参数化后 NaN 被转义成字面量 NaN 打到 SQL 上，
  // 落到 errorHandler 的「未知错误」分支返回 500，污染监控与告警。
  if (!Number.isInteger(adminId) || adminId <= 0) {
    res.status(400).json(fail("管理员 ID 不合法", "400"));
    return;
  }

  const body = z.object({
    status: z.enum(["ACTIVE", "DISABLED"])
  }).parse(req.body);

  const result = await adminAccountService.updatePlatformAdminStatus(
    adminId,
    body.status
  );
  res.json(ok(result));
});

// ─── C6-1A 平台管理员建号 / 重置密码（零 DDL） ────────────────────

/**
 * 操作人上下文：从 requirePlatformAuth 解出的 req.user 取（middleware/auth.ts:147）
 * 用途：写 t_platform_audit_log 留痕（admin_id / admin_name / ip）
 */
function operatorOf(req: any): adminAccountService.PlatformAdminOperator {
  return {
    adminId: Number(req.user?.id ?? 0),
    adminName: String(req.user?.realName || req.user?.username || "platform"),
    ip: req.ip ?? null
  };
}

/**
 * POST /api/platform/admins/invite —— 建号（「邀请」落地实现）
 *
 * 清账依据：C6-0 §三.1 #45（AdminPermissions.vue:256）「无邀请/建号端点」⇒ 零 DDL 可做。
 * 口径依据：凌舟裁定 C6-0-R6「不发邮件短信：建号 + 生成初始口令 + 页面一次性展示」。
 * 入参兼容：`realName` 与 `name` 二者取一（前端 TODO 写的是 name）；`roleId`/`dataScope`
 * 依赖平台角色表（未建，属 T6 立项），本端点不接受、生效范围以 `role` 枚举为准。
 */
export const inviteAdmin = asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().min(4).max(50),
    realName: z.string().min(2).max(50).optional(),
    name: z.string().min(2).max(50).optional(),
    phone: z.string().min(11).max(20),
    email: z.string().email().optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT"]).default("ADMIN")
  }).refine((v) => Boolean(v.realName || v.name), {
    message: "请填写姓名"
  }).parse(req.body);

  const result = await adminAccountService.invitePlatformAdmin(
    {
      username: body.username,
      realName: (body.realName ?? body.name) as string,
      phone: body.phone,
      email: body.email,
      role: body.role
    },
    operatorOf(req)
  );
  res.json(ok(result));
});

/**
 * POST /api/platform/admins/:id/reset-password —— 管理员代重置密码
 *
 * 清账依据：C6-0 §三.1 #51（AdminPermissions.vue:281）「无重置密码端点」⇒ 零 DDL
 * （UPDATE t_platform_admin.password_hash）。新口令只在响应里一次性返回（裁定 R6）。
 */
export const resetAdminPassword = asyncHandler(async (req, res) => {
  const adminId = Number(req.params.id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    res.status(400).json(fail("管理员 ID 不合法", "400"));
    return;
  }

  const result = await adminAccountService.resetPlatformAdminPassword(
    adminId,
    operatorOf(req)
  );
  res.json(ok(result));
});

// ─── 数据统计 ────────────────────────────────────────────────

export const getOverview = asyncHandler(async (_req, res) => {
  const result = await overviewService.getPlatformOverview();
  res.json(ok(result));
});

// ─── 订阅管理 ────────────────────────────────────────────────

export const listSubscriptions = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const tenantId = req.query.tenantId as string | undefined;
  const status = req.query.status as string | undefined;
  const planCode = req.query.planCode as string | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = await subscriptionAdminService.listPlatformSubscriptions(
    page,
    pageSize,
    { tenantId, status, planCode, keyword }
  );
  res.json(ok(result));
});

export const createSubscription = asyncHandler(async (req, res) => {
  const body = z.object({
    tenantId: z.string(),
    planCode: z.string(),
    planName: z.string(),
    durationDays: z.number().int().min(1).max(3650),
    amount: z.number().min(0).default(0),
    operator: z.string().default("platform")
  }).parse(req.body);

  const result = await subscriptionAdminService.createPlatformSubscription(
    body.tenantId,
    body.planCode,
    body.planName,
    body.durationDays,
    body.amount,
    body.operator
  );
  res.json(ok(result));
});

// ─── 系统配置 ────────────────────────────────────────────────

export const listConfigs = asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const result = await configService.listPlatformConfigs(category);
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const configKey = req.params.key;
  const body = z.object({
    configValue: z.string(),
    operator: z.string().default("platform")
  }).parse(req.body);

  const result = await configService.updatePlatformConfig(
    configKey,
    body.configValue,
    body.operator
  );
  res.json(ok(result));
});

// ─── 操作日志 ────────────────────────────────────────────────

export const listAuditLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const adminId = req.query.adminId ? Number(req.query.adminId) : undefined;
  const action = req.query.action as string | undefined;
  const module = req.query.module as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await configService.listPlatformAuditLogs(
    page,
    pageSize,
    { adminId, action, module, keyword, startDate, endDate }
  );
  res.json(ok(result));
});
