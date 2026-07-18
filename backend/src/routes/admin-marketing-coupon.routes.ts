import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as couponController from "../controllers/admin/marketing-coupon.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingCouponRouter = Router();

// 优惠券模板管理
adminMarketingCouponRouter.post("/coupons/templates", requireAuthWithTenant, couponController.createCouponTemplate);
adminMarketingCouponRouter.get("/coupons/templates", requireAuthWithTenant, couponController.listCouponTemplates);
adminMarketingCouponRouter.get("/coupons/templates/:id", requireAuthWithTenant, couponController.getCouponTemplate);
adminMarketingCouponRouter.put("/coupons/templates/:id", requireAuthWithTenant, couponController.updateCouponTemplate);
adminMarketingCouponRouter.delete("/coupons/templates/:id", requireAuthWithTenant, couponController.deleteCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/activate", requireAuthWithTenant, couponController.activateCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/pause", requireAuthWithTenant, couponController.pauseCouponTemplate);
adminMarketingCouponRouter.get("/coupons/user-coupons", requireAuthWithTenant, couponController.listUserCoupons);
adminMarketingCouponRouter.get("/coupons/statistics", requireAuthWithTenant, couponController.getCouponStatistics);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCouponRouter,
  auth: "requireAuthWithTenant",
};