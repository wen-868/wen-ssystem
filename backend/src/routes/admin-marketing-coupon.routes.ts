import { Router } from "express";

// 统一切到 marketing-new.controller（新服务列名与真实表 total_quantity/issued_quantity/used_quantity 一致；
// 旧 marketing-coupon.controller 查询不存在的 total_count/claimed_count/used_count 列，真实库会 500——整合方案步骤 2）
import * as couponController from "../controllers/admin/marketing-new.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

export const adminMarketingCouponRouter = Router();

// 优惠券模板管理
adminMarketingCouponRouter.post("/coupons/templates", couponController.createCouponTemplate);
adminMarketingCouponRouter.get("/coupons/templates", couponController.listCouponTemplates);
adminMarketingCouponRouter.get("/coupons/templates/:id", couponController.getCouponTemplate);
// S3-226（第 43 项 B2 批 8 · 营销域接线）：改 / 删 / 启停券模板挂 `marketing:create`（台账 §三.4 域内建议码）。
// 依据：admin-web `marketing/CouponManage.vue:317/347/349`（页面 `router/index.ts:227` 角色 = SUPER_ADMIN）；
// 生产持有 `marketing:create` = SUPER_ADMIN / OPERATION_ADMIN ⊇ {SUPER_ADMIN} ⇒ 零回归。
// ⚠️ 同文件的 `POST /coupons/templates`（新建）与 `POST .../:id/pause` 本批**不接** ——
//    app-mobile 有真实页面调用点（`create-coupon.vue:279`、`coupons.vue:147`），而该页经**推送深链**无条件可达
//    （`native/push.ts:107` `marketing → /pages-sub/marketing/marketing/coupons`）⇒ 使用者集合不可枚举（B 类，见台账 §十五.5）。
adminMarketingCouponRouter.put("/coupons/templates/:id", requirePermission("marketing:create"), couponController.updateCouponTemplate);
adminMarketingCouponRouter.delete("/coupons/templates/:id", requirePermission("marketing:create"), couponController.deleteCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/activate", requirePermission("marketing:create"), couponController.activateCouponTemplate);
adminMarketingCouponRouter.post("/coupons/templates/:id/pause", couponController.pauseCouponTemplate);
adminMarketingCouponRouter.get("/coupons/user-coupons", couponController.listUserCoupons);
adminMarketingCouponRouter.get("/coupons/statistics", couponController.getCouponStatistics);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCouponRouter,
  auth: "requireAuthWithTenant",
};
