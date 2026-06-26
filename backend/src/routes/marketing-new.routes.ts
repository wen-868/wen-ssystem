import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as marketingNewController from "../controllers/admin/marketing-new.controller.js";

export const marketingNewRouter = Router();

marketingNewRouter.get("/coupons", requireAuthWithTenant, marketingNewController.listCouponTemplates);
marketingNewRouter.get("/coupons/:templateId", requireAuthWithTenant, marketingNewController.getCouponTemplate);
marketingNewRouter.post("/coupons", requireAuthWithTenant, marketingNewController.createCouponTemplate);
marketingNewRouter.put("/coupons/:templateId", requireAuthWithTenant, marketingNewController.updateCouponTemplate);
marketingNewRouter.post("/coupons/:templateId/issue", requireAuthWithTenant, marketingNewController.issueCoupons);

marketingNewRouter.get("/user-coupons", requireAuthWithTenant, marketingNewController.listUserCoupons);

marketingNewRouter.get("/promotions", requireAuthWithTenant, marketingNewController.listPromotions);
marketingNewRouter.post("/promotions", requireAuthWithTenant, marketingNewController.createPromotion);
marketingNewRouter.put("/promotions/:activityId", requireAuthWithTenant, marketingNewController.updatePromotion);

marketingNewRouter.post("/calculate-discount", requireAuthWithTenant, marketingNewController.calculateDiscount);
