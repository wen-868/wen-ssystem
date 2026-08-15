import { Router } from "express";

// 统一切到 marketing-new.controller（新服务列名与真实表 total_quantity/issued_quantity/used_quantity 一致；
// 旧 marketing-coupon.controller 查询不存在的 total_count/claimed_count/used_count 列，真实库会 500——整合方案步骤 2）
import * as couponController from "../controllers/admin/marketing-new.controller";
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
