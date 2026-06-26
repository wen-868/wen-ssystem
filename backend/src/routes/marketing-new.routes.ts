import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as marketingNewController from "../controllers/admin/marketing-new.controller.js";

export const marketingNewRouter = Router();

// ========== 优惠券 ==========
marketingNewRouter.get("/coupons", requireAuthWithTenant, marketingNewController.listCouponTemplates);
marketingNewRouter.get("/coupons/:templateId", requireAuthWithTenant, marketingNewController.getCouponTemplate);
marketingNewRouter.post("/coupons", requireAuthWithTenant, marketingNewController.createCouponTemplate);
marketingNewRouter.put("/coupons/:templateId", requireAuthWithTenant, marketingNewController.updateCouponTemplate);
marketingNewRouter.post("/coupons/:templateId/issue", requireAuthWithTenant, marketingNewController.issueCoupons);

// ========== 用户优惠券 ==========
marketingNewRouter.get("/user-coupons", requireAuthWithTenant, marketingNewController.listUserCoupons);

// ========== 促销 ==========
marketingNewRouter.get("/promotions", requireAuthWithTenant, marketingNewController.listPromotions);
marketingNewRouter.post("/promotions", requireAuthWithTenant, marketingNewController.createPromotion);
marketingNewRouter.put("/promotions/:activityId", requireAuthWithTenant, marketingNewController.updatePromotion);

// ========== 试算 ==========
marketingNewRouter.post("/calculate-discount", requireAuthWithTenant, marketingNewController.calculateDiscount);