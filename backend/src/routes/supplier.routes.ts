import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { ok } from "../shared/response.js";
import { supplierService } from "../services/supplier.service.js";
import type { ServiceContext } from "../types/index.js";

export const supplierRouter = Router();

function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

supplierRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { keyword, supplyType, status, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);

  const result = await supplierService.getPageList(
    keyword as string | undefined,
    supplyType as string | undefined,
    status as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );

  res.json(ok(result));
}));

supplierRouter.get("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);

  const supplier = await supplierService.getDetail(Number(id), ctx);

  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(supplier));
}));

supplierRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    shortName: z.string().max(64).optional(),
    supplyType: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    creditLevel: z.string().max(16).default("B"),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).default("CASH"),
    settlementDay: z.number().int().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).default(0),
    bankName: z.string().max(128).optional(),
    bankAccount: z.string().max(64).optional(),
    bankAccountName: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
    contactPerson: z.string().max(64).optional(),
    contactMobile: z.string().max(20).optional(),
    contactPhone: z.string().max(32).optional(),
  }).parse(req.body);

  const ctx = getServiceContext(req);
  const result = await supplierService.create(body, ctx);
  res.json(ok(result));
}));

supplierRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);

  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    shortName: z.string().max(64).optional(),
    supplyType: z.string().max(32).optional(),
    province: z.string().max(64).optional(),
    city: z.string().max(64).optional(),
    district: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    creditLevel: z.string().max(16).optional(),
    settlementType: z.enum(["CASH", "MONTHLY", "QUARTERLY"]).optional(),
    settlementDay: z.number().int().min(1).max(31).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    bankName: z.string().max(128).optional(),
    bankAccount: z.string().max(64).optional(),
    bankAccountName: z.string().max(64).optional(),
    status: z.number().int().min(0).max(1).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const success = await supplierService.update(Number(id), body, ctx);

  if (!success) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok({ id: Number(id) }));
}));

supplierRouter.post("/:id/contacts", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);

  const body = z.object({
    name: z.string().min(1).max(64),
    mobile: z.string().max(20).optional(),
    phone: z.string().max(32).optional(),
    email: z.string().email().max(128).optional(),
    wechat: z.string().max(64).optional(),
    isPrimary: z.boolean().default(false),
    position: z.string().max(64).optional(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await supplierService.addContact(Number(id), body, ctx);

  if (!result) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(result));
}));

supplierRouter.delete("/:id/contacts/:contactId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id, contactId } = req.params;
  const ctx = getServiceContext(req);

  const result = await supplierService.deleteContact(Number(id), Number(contactId), ctx);

  if (result === null) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  if (!result) {
    res.status(404).json({ code: "404", message: "联系人不存在" });
    return;
  }

  res.json(ok({ id: Number(contactId) }));
}));

supplierRouter.get("/:id/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20, status } = req.query;

  const result = await supplierService.getPurchaseOrders(
    Number(id),
    status as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );

  if (!result) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(result));
}));

supplierRouter.get("/:id/payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20 } = req.query;

  const result = await supplierService.getPayments(
    Number(id),
    Number(page),
    Number(pageSize),
    ctx
  );

  if (!result) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(result));
}));

supplierRouter.get("/:id/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);
  const { page = 1, pageSize = 20, keyword } = req.query;

  const result = await supplierService.getProducts(
    Number(id),
    keyword as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );

  if (!result) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(result));
}));

supplierRouter.get("/:id/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ctx = getServiceContext(req);

  const stats = await supplierService.getStats(Number(id), ctx);

  if (!stats) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  res.json(ok(stats));
}));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/suppliers",
  router: supplierRouter,
  auth: "requireAuthWithTenant",
};
