import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import { AUTHED_ROUTE_LIMIT } from "../config/rate-limit";
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
// S3-208（总清单第 57 项）：本文件被 CodeQL `js/missing-rate-limiting` 报 high 的注册点共 3 处——
// PR #297 check-run 115404340298 注解第 30 行（＝门店端 `GET /verify-records`，见下）＋ main 上同文件
// 同族存量 `POST /bills`、`POST /bills/:id/verify`。`rateLimit(...)` 必须内联在注册点
// （S3-112 结论，参数取自 `config/rate-limit.ts`）。
adminCommerceFixRouter.post("/bills", rateLimit(AUTHED_ROUTE_LIMIT), requirePermission("sale:create"), asyncHandler(ctrl.createBill));
adminCommerceFixRouter.put("/bills/:id", asyncHandler(ctrl.updateBill));
adminCommerceFixRouter.delete("/bills/:id", asyncHandler(ctrl.deleteBill));
adminCommerceFixRouter.post("/bills/:id/verify", rateLimit(AUTHED_ROUTE_LIMIT), requirePermission("sale:create"), asyncHandler(ctrl.verifyBill));
adminCommerceFixRouter.post("/bills/:id/void", asyncHandler(ctrl.voidBill));

// 优惠券核销记录（门店端）
// S3-187 B：本文件只拥有 /api/store/coupons 这一条路径段，故**显式声明**该子前缀，
// 不再以根前缀 "/api/store" 注册 —— 原写法会被 auto-routes 编译成
// `app.use("/api/store", 认证, 租户, CSRF, router)`，把**整个** /api/store/**（含本文件不拥有、
// 甚至不存在的子路径）都先套上认证 + CSRF。实测受害者见回传卡 §三（/api/store/members/register
// 与 /api/store/hardware/callbacks/* 这两个声明为不鉴权的公开/回调端点在整机下被拦成 401）。
// 改后 URL 不变：/api/store/coupons/verify-records。
// S3-208：本文件是被 PR #297 注解命中的**另一个**注册点——注解行（30 行）落在**这一条**门店端路由上
// （见证据 `docs/evidence/S3-208/README.md` §二：PR 时点 67f178e1 与 main 2fe8f109 的第 30 行内容都
// 是 `storeCommerceFixRouter.get("/verify-records", …)`）。它的鉴权不在注册行上，而由本文件末尾的
// `routeConfigs`（`auth: "requireAuthWithTenant"`）按前缀级前置 ⇒ 同样按"已鉴权路由"接线。
storeCommerceFixRouter.get("/verify-records", rateLimit(AUTHED_ROUTE_LIMIT), asyncHandler(ctrl.listCouponVerifyRecords));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin", router: adminCommerceFixRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/coupons", router: storeCommerceFixRouter, auth: "requireAuthWithTenant" },
];
