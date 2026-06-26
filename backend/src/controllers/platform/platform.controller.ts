import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as platformService from "../../services/platform/platform.service.js";

// ─── 租户管理 ────────────────────────────────────────────────

export const listTenants = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const planCode = req.query.planCode as string | undefined;

  const result = await platformService.listPlatformTenants(
    page,
    pageSize,
    { status, keyword, planCode }
  );
  res.json(ok(result));
});

export const getTenantDetail = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId;

  const result = await platformService.getPlatformTenantDetail(tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "租户不存在" });
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

  const result = await platformService.createPlatformTenant(body);
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

  const result = await platformService.updatePlatformTenant(tenantId, body);
  res.json(ok(result));
});

// ─── 平台管理员 ──────────────────────────────────────────────

export const listAdmins = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const role = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = await platformService.listPlatformAdmins(
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

  const result = await platformService.createPlatformAdmin(body);
  res.json(ok(result));
});

export const updateAdminStatus = asyncHandler(async (req, res) => {
  const adminId = Number(req.params.id);
  const body = z.object({
    status: z.enum(["ACTIVE", "DISABLED"])
  }).parse(req.body);

  const result = await platformService.updatePlatformAdminStatus(
    adminId,
    body.status
  );
  res.json(ok(result));
});

// ─── 数据统计 ────────────────────────────────────────────────

export const getOverview = asyncHandler(async (_req, res) => {
  const result = await platformService.getPlatformOverview();
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

  const result = await platformService.listPlatformSubscriptions(
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

  const result = await platformService.createPlatformSubscription(
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
  const result = await platformService.listPlatformConfigs(category);
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const configKey = req.params.key;
  const body = z.object({
    configValue: z.string(),
    operator: z.string().default("platform")
  }).parse(req.body);

  const result = await platformService.updatePlatformConfig(
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

  const result = await platformService.listPlatformAuditLogs(
    page,
    pageSize,
    { adminId, action, module, keyword, startDate, endDate }
  );
  res.json(ok(result));
});
