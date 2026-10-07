import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/tenant.service";

export const listTenants = asyncHandler(async (req, res) => {
  const result = await service.listTenants({
    keyword: req.query.keyword as string | undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  res.json(ok(result));
});

export const getTenantDetail = asyncHandler(async (req, res) => {
  const result = await service.getTenantDetail(Number(req.params.tenantId));
  res.json(ok(result));
});

export const createTenant = asyncHandler(async (req, res) => {
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

  const result = await service.createTenant(body, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const updateTenant = asyncHandler(async (req, res) => {
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

  const result = await service.updateTenant(Number(req.params.tenantId), body, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const changeTenantStatus = asyncHandler(async (req, res) => {
  const body = z.object({
    // S3-176 B0：租户状态**可写值唯一口径** = ACTIVE / DISABLED（与 platform-tenant.service 的
    //   TenantStatus、与服务层 toTenantStatusValue、与 saas-admin 前端发送值一致）。
    //   SUSPENDED/EXPIRED/CLOSED 不再是可写状态：EXPIRED 由 expire_at 派生展示；
    //   停用原因改由 DISABLED 携带（服务层写 suspend_reason/suspended_at）。
    //   未知值一律 400（原枚举与前端不发同一套值，导致「冻结租户」走 400）。
    status: z.enum(["ACTIVE", "DISABLED"]),
    reason: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await service.changeTenantStatus(Number(req.params.tenantId), body, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const getTenantModules = asyncHandler(async (req, res) => {
  const result = await service.getTenantModules(Number(req.params.tenantId));
  res.json(ok(result));
});

export const setTenantModules = asyncHandler(async (req, res) => {
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

  const result = await service.setTenantModules(Number(req.params.tenantId), body, req.user!.id, req.user!.username);
  res.json(ok(result));
});
