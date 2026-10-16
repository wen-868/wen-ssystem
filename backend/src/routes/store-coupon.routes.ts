import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import * as couponController from "../controllers/store/coupon.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const storeCouponRouter = Router();

// 门店侧优惠券：列表 / 详情（R100-02）
storeCouponRouter.get("/", asyncHandler(couponController.listStoreCoupons));
storeCouponRouter.get("/:id", asyncHandler(couponController.getStoreCoupon));

// 门店侧优惠券核销（扫码核销 / 手动核销）
// S3-226（第 43 项 B2 批 8 · 营销域接线）：这 2 条**本批不接**（B 类，逐条证据见台账 §十五.5）——
// 桌面页 `pos/CouponVerifyView.vue:243/218`（页面 `router/index.ts:267` 角色 = SUPER_ADMIN / STORE_MANAGER / **STORE_OPERATOR**）
// 本身满足「页面角色 ⊆ `sale:create` 持有人」；阻断项是 **app-mobile 核销页**
// `pages-sub/marketing/marketing/coupon-verify.vue:160/163`，它经「优惠券」页
// （`coupons.vue:132`）进入，而该页有一条**无条件推送深链**（`native/push.ts:107`）
// ⇒ 使用者集合不可枚举 ⇒ 按「无法证明不误伤则不动」处理。码位方案已备好（`sale:create`）。
storeCouponRouter.post("/verify", asyncHandler(couponController.verifyCoupon));
storeCouponRouter.post("/manual-verify", asyncHandler(couponController.manualVerifyCoupon));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/coupons",
  router: storeCouponRouter,
  auth: "requireAuthWithTenant",
};
