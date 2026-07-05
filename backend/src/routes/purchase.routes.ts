import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import { purchaseService } from "../services/purchase.service.js";
import type { ServiceContext } from "../types/index.js";

export const purchaseRouter = Router();

function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

purchaseRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplierId, status, startDate, endDate, keyword, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);

  const result = await purchaseService.getPageList(
    keyword as string | undefined,
    supplierId ? Number(supplierId) : undefined,
    status as string | undefined,
    startDate as string | undefined,
    endDate as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );

  res.json(ok(result));
}));

purchaseRouter.get("/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  const order = await purchaseService.getDetail(orderNo, ctx);

  if (!order) {
    res.status(404).json(fail("采购订单不存在", "404"));
    return;
  }

  res.json(ok(order));
}));

purchaseRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    supplierId: z.number().int().positive(),
    supplierName: z.string().min(1).max(128),
    storeId: z.number().int().positive(),
    expectedDate: z.string().optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const ctx = getServiceContext(req);
  const result = await purchaseService.createOrder(body, ctx);
  res.json(ok(result));
}));

purchaseRouter.post("/:orderNo/submit", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  try {
    const result = await purchaseService.submit(orderNo, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));

purchaseRouter.post("/:orderNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  try {
    const result = await purchaseService.approve(orderNo, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));

purchaseRouter.post("/:orderNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  try {
    const result = await purchaseService.cancel(orderNo, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));

purchaseRouter.put("/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  const body = z.object({
    supplierId: z.number().int().positive().optional(),
    supplierName: z.string().min(1).max(128).optional(),
    expectedDate: z.string().optional(),
    discountAmount: z.number().min(0).optional(),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      barcode: z.string().max(128).optional(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().max(255).optional(),
    })).optional(),
  }).parse(req.body);

  try {
    const result = await purchaseService.updateOrder(orderNo, body, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));

purchaseRouter.delete("/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  try {
    const result = await purchaseService.delete(orderNo, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));

purchaseRouter.post("/:orderNo/in-stock", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const ctx = getServiceContext(req);

  const body = z.object({
    warehouseId: z.number().int().positive().optional(),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
    })).min(1),
  }).parse(req.body);

  try {
    const result = await purchaseService.inStock(orderNo, body, ctx);
    if (!result) {
      res.status(404).json(fail("采购订单不存在", "404"));
      return;
    }
    res.json(ok(result));
  } catch (e: any) {
    res.status(400).json(fail(e.message, "400"));
  }
}));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-orders",
  router: purchaseRouter,
  auth: "requireAuthWithTenant",
};
