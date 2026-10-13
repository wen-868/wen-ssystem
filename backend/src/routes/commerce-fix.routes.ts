import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as ctrl from "../controllers/admin/commerce-fix.controller";

export const adminCommerceFixRouter = Router();
export const storeCommerceFixRouter = Router();

// 资金流水 / 提成统计 / 收货地址 / 票据（管理端）
adminCommerceFixRouter.get("/fund-transactions", asyncHandler(ctrl.listFundTransactions));
adminCommerceFixRouter.get("/fund-statistics", asyncHandler(ctrl.getFundStatistics));
adminCommerceFixRouter.get("/commission/stats", asyncHandler(ctrl.getCommissionStats));
adminCommerceFixRouter.get("/consumer-addresses", asyncHandler(ctrl.listConsumerAddresses));
adminCommerceFixRouter.delete("/consumer-addresses/:id", asyncHandler(ctrl.deleteConsumerAddress));
adminCommerceFixRouter.get("/bills", asyncHandler(ctrl.listBills));
adminCommerceFixRouter.post("/bills", requirePermission("sale:create"), asyncHandler(ctrl.createBill));
adminCommerceFixRouter.put("/bills/:id", asyncHandler(ctrl.updateBill));
adminCommerceFixRouter.delete("/bills/:id", asyncHandler(ctrl.deleteBill));
adminCommerceFixRouter.post("/bills/:id/verify", requirePermission("sale:create"), asyncHandler(ctrl.verifyBill));
adminCommerceFixRouter.post("/bills/:id/void", asyncHandler(ctrl.voidBill));

// 优惠券核销记录（门店端）
// S3-187 B：本文件只拥有 /api/store/coupons 这一条路径段，故**显式声明**该子前缀，
// 不再以根前缀 "/api/store" 注册 —— 原写法会被 auto-routes 编译成
// `app.use("/api/store", 认证, 租户, CSRF, router)`，把**整个** /api/store/**（含本文件不拥有、
// 甚至不存在的子路径）都先套上认证 + CSRF。实测受害者见回传卡 §三（/api/store/members/register
// 与 /api/store/hardware/callbacks/* 这两个声明为不鉴权的公开/回调端点在整机下被拦成 401）。
// 改后 URL 不变：/api/store/coupons/verify-records。
storeCommerceFixRouter.get("/verify-records", asyncHandler(ctrl.listCouponVerifyRecords));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin", router: adminCommerceFixRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/coupons", router: storeCommerceFixRouter, auth: "requireAuthWithTenant" },
];
