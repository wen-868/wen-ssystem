import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
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
adminCommerceFixRouter.post("/bills", asyncHandler(ctrl.createBill));
adminCommerceFixRouter.put("/bills/:id", asyncHandler(ctrl.updateBill));
adminCommerceFixRouter.delete("/bills/:id", asyncHandler(ctrl.deleteBill));
adminCommerceFixRouter.post("/bills/:id/verify", asyncHandler(ctrl.verifyBill));
adminCommerceFixRouter.post("/bills/:id/void", asyncHandler(ctrl.voidBill));

// 优惠券核销记录（门店端）
storeCommerceFixRouter.get("/coupons/verify-records", asyncHandler(ctrl.listCouponVerifyRecords));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin", router: adminCommerceFixRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store", router: storeCommerceFixRouter, auth: "requireAuthWithTenant" },
];
