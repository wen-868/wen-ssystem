import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler";
import { ok } from "../shared/response";
import * as service from "../services/admin/tenant.service";

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
    status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED", "CLOSED"]),
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