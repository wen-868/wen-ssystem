import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { ok } from "../shared/response.js";
import { saleReturnService } from "../services/sale-return.service.js";
import type { ServiceContext } from "../types/index.js";

export const saleReturnRouter = Router();

function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

saleReturnRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { storeId, customerId, status, startDate, endDate, keyword, page = 1, pageSize = 20 } = req.query;
  const ctx = getServiceContext(req);

  const result = await saleReturnService.getPageList(
    keyword as string | undefined,
    storeId ? Number(storeId) : undefined,
    customerId ? Number(customerId) : undefined,
    status as string | undefined,
    startDate as string | undefined,
    endDate as string | undefined,
    Number(page),
    Number(pageSize),
    ctx
  );

  res.json(ok(result));
}));

saleReturnRouter.get("/:returnNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);

  const returnOrder = await saleReturnService.getDetail(returnNo, ctx);

  if (!returnOrder) {
    res.status(404).json({ code: "404", message: "退货单不存在" });
    return;
  }

  res.json(ok(returnOrder));
}));

saleReturnRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    sourceBillNo: z.string().max(64).optional(),
    storeId: z.number().int().positive(),
    customerId: z.number().int().positive().optional(),
    customerName: z.string().max(64).optional(),
    customerMobile: z.string().max(20).optional(),
    discountAmount: z.number().min(0).default(0),
    remark: z.string().max(255).optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1).max(128),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      reason: z.string().max(255).optional(),
    })).min(1),
  }).parse(req.body);

  const ctx = getServiceContext(req);
  const result = await saleReturnService.createReturn(body, ctx);
  res.json(ok(result));
}));

saleReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);

  try {
    const result = await saleReturnService.approve(returnNo, ctx);
    if (!result) {
      res.status(404).json({ code: "404", message: "退货单不存在" });
      return;
    }
    res.json(ok(result));
  } catch (e: unknown) {
    res.status(400).json({ code: "400", message: e.message });
  }
}));

saleReturnRouter.post("/:returnNo/refund", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { returnNo } = req.params;
  const ctx = getServiceContext(req);

  const body = z.object({
    refundMethod: z.enum(["CASH", "WECHAT", "BANK"]),
  }).parse(req.body);

  try {
    const result = await saleReturnService.refund(returnNo, body, ctx);
    if (!result) {
      res.status(404).json({ code: "404", message: "退货单不存在" });
      return;
    }
    res.json(ok(result));
  } catch (e: unknown) {
    res.status(400).json({ code: "400", message: e.message });
  }
}));

saleReturnRouter.get("/sale-bills/:billNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { billNo } = req.params;
  const ctx = getServiceContext(req);

  const bill = await saleReturnService.getSaleBill(billNo, ctx);

  if (!bill) {
    res.status(404).json({ code: "404", message: "销售单不存在" });
    return;
  }

  res.json(ok(bill));
}));
// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/admin/sale-returns", router: saleReturnRouter, auth: "requireAuthWithTenant" },
];
