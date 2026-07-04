import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as ctrl from "../controllers/aftersale.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

// ========== 售后工单 - 小程序端路由 ==========
export const miniappAftersaleRouter = Router();

// ========== 售后工单 - 管理端路由 ==========
export const adminAftersaleRouter = Router();

// ==================== 小程序端 ====================

// POST /aftersales - 创建售后申请
miniappAftersaleRouter.post("/aftersales", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    orderNo: z.string().min(1),
    aftersaleType: z.enum(["REFUND_ONLY", "RETURN_REFUND", "EXCHANGE", "REPAIR"]),
    reason: z.string().min(1),
    reasonDetail: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      qty: z.number().int().positive(),
      unitPrice: z.number(),
      subtotal: z.number()
    })).min(1),
    refundAmount: z.number().min(0).default(0),
    exchangeSkuId: z.number().optional(),
    exchangeQty: z.number().int().positive().optional()
  }).parse(req.body);
  req.body = body;
  await ctrl.miniappCreateAftersale(req, res, _next);
}));

// GET /aftersales/mine - 我的售后列表
miniappAftersaleRouter.get("/aftersales/mine", requireAuthWithTenant, ctrl.miniappListMyAftersales);

// GET /aftersales/:aftersaleNo - 售后详情
miniappAftersaleRouter.get("/aftersales/:aftersaleNo", requireAuthWithTenant, ctrl.miniappGetAftersaleDetail);

// POST /aftersales/:aftersaleNo/cancel - 取消售后
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/cancel", requireAuthWithTenant, ctrl.miniappCancelAftersale);

// POST /aftersales/:aftersaleNo/return-logistics - 填写退货物流
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/return-logistics", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    returnLogisticsNo: z.string().min(1),
    returnLogisticsCompany: z.string().min(1)
  }).parse(req.body);
  req.body = body;
  await ctrl.miniappSubmitReturnLogistics(req, res, _next);
}));

// POST /aftersales/:aftersaleNo/rate - 评价售后处理
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/rate", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    satisfaction: z.number().int().min(1).max(5),
    customerComment: z.string().optional()
  }).parse(req.body);
  req.body = body;
  await ctrl.miniappRateAftersale(req, res, _next);
}));

// ==================== 管理端 ====================

// GET /aftersales - 售后列表（支持筛选+分页）
adminAftersaleRouter.get("/aftersales", requireAuthWithTenant, ctrl.adminListAftersales);

// GET /aftersales/:id - 售后详情（完整信息）
adminAftersaleRouter.get("/aftersales/:id", requireAuthWithTenant, ctrl.adminGetAftersaleDetail);

// POST /aftersales/:id/approve - 审核通过
adminAftersaleRouter.post("/aftersales/:id/approve", requireAuthWithTenant, ctrl.adminApproveAftersale);

// POST /aftersales/:id/reject - 审核拒绝
adminAftersaleRouter.post("/aftersales/:id/reject", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    processRemark: z.string().min(1, "请填写拒绝原因"),
    version: z.number().default(1)
  }).parse(req.body);
  req.body = body;
  await ctrl.adminRejectAftersale(req, res, _next);
}));

// POST /aftersales/:id/confirm-receipt - 确认收货
adminAftersaleRouter.post("/aftersales/:id/confirm-receipt", requireAuthWithTenant, ctrl.adminConfirmReceipt);

// POST /aftersales/:id/inspect - 验货
adminAftersaleRouter.post("/aftersales/:id/inspect", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    inspectResult: z.enum(["PASS", "PARTIAL_PASS", "FAIL"]),
    inspectImages: z.array(z.string()).optional(),
    processRemark: z.string().optional(),
    version: z.number().default(1)
  }).parse(req.body);
  req.body = body;
  await ctrl.adminInspectAftersale(req, res, _next);
}));

// POST /aftersales/:id/complete - 完成处理（退款/换货）
adminAftersaleRouter.post("/aftersales/:id/complete", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  const body = z.object({
    processRemark: z.string().optional(),
    version: z.number().default(1)
  }).parse(req.body);
  req.body = body;
  await ctrl.adminCompleteAftersale(req, res, _next);
}));

// GET /aftersales/statistics - 售后统计
adminAftersaleRouter.get("/aftersales/statistics", requireAuthWithTenant, ctrl.adminGetStatistics);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/miniapp/aftersales", router: miniappAftersaleRouter, auth: "none" },
  { prefix: "/api/admin/aftersales", router: adminAftersaleRouter, auth: "requireAuthWithTenant" },
];