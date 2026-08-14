import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import * as couponController from "../controllers/store/coupon.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const storeCouponRouter = Router();

// 门店侧优惠券：列表 / 详情（R100-02）
storeCouponRouter.get("/", asyncHandler(couponController.listStoreCoupons));
storeCouponRouter.get("/:id", asyncHandler(couponController.getStoreCoupon));

// 门店侧优惠券核销（扫码核销 / 手动核销）
storeCouponRouter.post("/verify", asyncHandler(couponController.verifyCoupon));
storeCouponRouter.post("/manual-verify", asyncHandler(couponController.manualVerifyCoupon));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/coupons",
  router: storeCouponRouter,
  auth: "requireAuthWithTenant",
};
