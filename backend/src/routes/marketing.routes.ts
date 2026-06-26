import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as couponController from "../controllers/admin/marketing-coupon.controller.js";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller.js";
import * as pointsController from "../controllers/admin/marketing-points.controller.js";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller.js";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller.js";
import * as stackRuleController from "../controllers/admin/marketing-stack-rule.controller.js";
import * as calculationController from "../controllers/admin/marketing-calculation.controller.js";

export const adminMarketingRouter = Router();
export const miniappMarketingRouter = Router();

// ========== 优惠券模板管理 (Admin) ==========
adminMarketingRouter.post("/coupons/templates", requireAuthWithTenant, couponController.createCouponTemplate);
adminMarketingRouter.get("/coupons/templates", requireAuthWithTenant, couponController.listCouponTemplates);
adminMarketingRouter.get("/coupons/templates/:id", requireAuthWithTenant, couponController.getCouponTemplate);
adminMarketingRouter.put("/coupons/templates/:id", requireAuthWithTenant, couponController.updateCouponTemplate);
adminMarketingRouter.delete("/coupons/templates/:id", requireAuthWithTenant, couponController.deleteCouponTemplate);
adminMarketingRouter.post("/coupons/templates/:id/activate", requireAuthWithTenant, couponController.activateCouponTemplate);
adminMarketingRouter.post("/coupons/templates/:id/pause", requireAuthWithTenant, couponController.pauseCouponTemplate);
adminMarketingRouter.get("/coupons/users", requireAuthWithTenant, couponController.listUserCoupons);
adminMarketingRouter.get("/coupons/statistics", requireAuthWithTenant, couponController.getCouponStatistics);

// ========== 满减活动管理 (Admin) ==========
adminMarketingRouter.post("/promotions/full-reduction", requireAuthWithTenant, fullReductionController.createFullReduction);
adminMarketingRouter.get("/promotions/full-reduction", requireAuthWithTenant, fullReductionController.listFullReductions);
adminMarketingRouter.get("/promotions/full-reduction/:id", requireAuthWithTenant, fullReductionController.getFullReduction);
adminMarketingRouter.put("/promotions/full-reduction/:id", requireAuthWithTenant, fullReductionController.updateFullReduction);
adminMarketingRouter.delete("/promotions/full-reduction/:id", requireAuthWithTenant, fullReductionController.deleteFullReduction);
adminMarketingRouter.post("/promotions/full-reduction/:id/activate", requireAuthWithTenant, fullReductionController.activateFullReduction);
adminMarketingRouter.post("/promotions/full-reduction/:id/pause", requireAuthWithTenant, fullReductionController.pauseFullReduction);

// ========== 积分管理 (Admin) ==========
adminMarketingRouter.get("/points/rule", requireAuthWithTenant, pointsController.getPointsRule);
adminMarketingRouter.put("/points/rule", requireAuthWithTenant, pointsController.updatePointsRule);
adminMarketingRouter.get("/points/records", requireAuthWithTenant, pointsController.listPointsRecords);
adminMarketingRouter.get("/points/users/:userId", requireAuthWithTenant, pointsController.getUserPoints);

// ========== 秒杀活动管理 (Admin) ==========
adminMarketingRouter.post("/promotions/flash-sale", requireAuthWithTenant, flashSaleController.createFlashSale);
adminMarketingRouter.get("/promotions/flash-sale", requireAuthWithTenant, flashSaleController.listFlashSales);
adminMarketingRouter.get("/promotions/flash-sale/statistics", requireAuthWithTenant, flashSaleController.getFlashSaleStatistics);
adminMarketingRouter.get("/promotions/flash-sale/:id", requireAuthWithTenant, flashSaleController.getFlashSale);
adminMarketingRouter.put("/promotions/flash-sale/:id", requireAuthWithTenant, flashSaleController.updateFlashSale);
adminMarketingRouter.delete("/promotions/flash-sale/:id", requireAuthWithTenant, flashSaleController.deleteFlashSale);
adminMarketingRouter.post("/promotions/flash-sale/:id/activate", requireAuthWithTenant, flashSaleController.activateFlashSale);
adminMarketingRouter.post("/promotions/flash-sale/:id/pause", requireAuthWithTenant, flashSaleController.pauseFlashSale);

// ========== 拼团活动管理 (Admin) ==========
adminMarketingRouter.post("/promotions/group-buy", requireAuthWithTenant, groupBuyController.createGroupBuy);
adminMarketingRouter.get("/promotions/group-buy", requireAuthWithTenant, groupBuyController.listGroupBuys);
adminMarketingRouter.get("/promotions/group-buy/teams", requireAuthWithTenant, groupBuyController.listGroupBuyTeams);
adminMarketingRouter.get("/promotions/group-buy/:id", requireAuthWithTenant, groupBuyController.getGroupBuy);
adminMarketingRouter.put("/promotions/group-buy/:id", requireAuthWithTenant, groupBuyController.updateGroupBuy);
adminMarketingRouter.delete("/promotions/group-buy/:id", requireAuthWithTenant, groupBuyController.deleteGroupBuy);
adminMarketingRouter.post("/promotions/group-buy/:id/activate", requireAuthWithTenant, groupBuyController.activateGroupBuy);

// ========== 叠加规则管理 (Admin) ==========
adminMarketingRouter.post("/promotions/stack-rules", requireAuthWithTenant, stackRuleController.createStackRule);
adminMarketingRouter.get("/promotions/stack-rules", requireAuthWithTenant, stackRuleController.listStackRules);
adminMarketingRouter.put("/promotions/stack-rules/:id", requireAuthWithTenant, stackRuleController.updateStackRule);
adminMarketingRouter.delete("/promotions/stack-rules/:id", requireAuthWithTenant, stackRuleController.deleteStackRule);

// ========== 试算接口 (Admin) ==========
adminMarketingRouter.post("/promotions/calculate", requireAuthWithTenant, calculationController.calculatePromotion);

// ========== 小程序 - 优惠券 (Miniapp) ==========
miniappMarketingRouter.get("/coupons/available", requireAuthWithTenant, couponController.listAvailableCoupons);
miniappMarketingRouter.post("/coupons/:templateId/claim", requireAuthWithTenant, couponController.claimCoupon);
miniappMarketingRouter.get("/coupons/mine", requireAuthWithTenant, couponController.listMyCoupons);

// ========== 小程序 - 积分 (Miniapp) ==========
miniappMarketingRouter.get("/points/mine", requireAuthWithTenant, pointsController.listMyPointsRecords);

// ========== 小程序 - 秒杀 (Miniapp) ==========
miniappMarketingRouter.get("/promotions/flash-sale/active", requireAuthWithTenant, flashSaleController.listActiveFlashSales);
miniappMarketingRouter.post("/promotions/flash-sale/:id/buy", requireAuthWithTenant, flashSaleController.buyFlashSale);

// ========== 小程序 - 拼团 (Miniapp) ==========
miniappMarketingRouter.get("/promotions/group-buy/active", requireAuthWithTenant, groupBuyController.listActiveGroupBuys);
miniappMarketingRouter.post("/promotions/group-buy/:id/create-team", requireAuthWithTenant, groupBuyController.createGroupBuyTeam);
miniappMarketingRouter.get("/promotions/group-buy/team/:teamId", requireAuthWithTenant, groupBuyController.getGroupBuyTeam);
miniappMarketingRouter.post("/promotions/group-buy/team/:teamId/join", requireAuthWithTenant, groupBuyController.joinGroupBuyTeam);
