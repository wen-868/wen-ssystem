import { Router } from "express";

import * as couponController from "../controllers/admin/marketing-coupon.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingCouponRouter = Router();

// 优惠券模板管理
adminMarketingCouponRouter.post("/coupons/templates", couponController.createCouponTemplate);
adminMarketingCouponRouter.get("/coupons/templates", couponController.listCouponTemplates);
adminMarketingCouponRouter.get("/coupons/templates/:id", couponController.getCouponTemplate);
adminMarketingCouponRouter.put("/coupons/templates/:id", couponController.updateCouponTemplate);
adminMarketingCouponRouter.delete("/coupons/templates/:id", couponController.deleteCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/activate", couponController.activateCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/pause", couponController.pauseCouponTemplate);
adminMarketingCouponRouter.get("/coupons/user-coupons", couponController.listUserCoupons);
adminMarketingCouponRouter.get("/coupons/statistics", couponController.getCouponStatistics);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCouponRouter,
  auth: "requireAuthWithTenant",
};