import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as tenantService from "../../services/saas/tenant.service";

export const listTenants = asyncHandler(async (req, res) => {
  const { keyword, status, page = 1, pageSize = 20 } = req.query;
  const result = await tenantService.listTenants({
    keyword: keyword as string | undefined,
    status: status as string | undefined,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.json(ok(result));
});

export const getTenantDetail = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  const result = await tenantService.getTenantDetail(tenantId);
  if (!result) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const createTenant = asyncHandler(async (req, res) => {
  const body = z.object({
    companyName: z.string().min(1).max(200),
    companyShortName: z.string().max(100).optional(),
    contactPerson: z.string().min(1).max(50),
    contactMobile: z.string().regex(/^1[3-9]\d{9}$/),
    contactEmail: z.string().email().optional(),
    province: z.string().max(50).optional(),
    city: z.string().max(50).optional(),
    district: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    businessLicense: z.string().max(100).optional(),
    legalPerson: z.string().max(50).optional(),
    industry: z.string().max(50).optional(),
    companyScale: z.string().max(50).optional(),
    source: z.string().max(50).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await tenantService.createTenant(body);
  res.json(ok(result));
});

export const updateTenant = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  const body = z.object({
    companyName: z.string().min(1).max(200).optional(),
    companyShortName: z.string().max(100).optional(),
    contactPerson: z.string().min(1).max(50).optional(),
    contactMobile: z.string().regex(/^1[3-9]\d{9}$/).optional(),
    contactEmail: z.string().email().optional(),
    province: z.string().max(50).optional(),
    city: z.string().max(50).optional(),
    district: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    businessLicense: z.string().max(100).optional(),
    legalPerson: z.string().max(50).optional(),
    industry: z.string().max(50).optional(),
    companyScale: z.string().max(50).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await tenantService.updateTenant(tenantId, body);
  if (!result) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const auditTenant = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  // S3-192（收口总清单第 59 项）：入参值域收敛到**唯一可写值域** ACTIVE / DISABLED。
  // 原枚举含 SUSPENDED、EXPIRED、PENDING —— 这正是 G2 门禁（guard-tenant-status）头部记录的
  // 根因形态「controller 的 Zod 枚举另有一套」；且服务层已按方案 (b) 对越界值 400，
  // 若这里仍放行，会出现"校验通过但服务层 400"的自相矛盾，同时 DISABLED 反被拦在门外。
  const body = z.object({
    status: z.enum(["ACTIVE", "DISABLED"]),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await tenantService.auditTenant(tenantId, body);
  if (!result) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const toggleTenantStatus = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  // S3-192：同上，启停入参只允许 ACTIVE / DISABLED（与 platform/tenant.controller.ts:62 强校验一致）
  const body = z.object({
    status: z.enum(["ACTIVE", "DISABLED"]),
  }).parse(req.body);

  const result = await tenantService.toggleTenantStatus(tenantId, body.status);
  if (!result) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const getTenantStatistics = asyncHandler(async (req, res) => {
  const result = await tenantService.getTenantStatistics();
  res.json(ok(result));
});
