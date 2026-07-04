import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as couponController from "../controllers/admin/marketing-coupon.controller.js";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller.js";
import * as pointsController from "../controllers/admin/marketing-points.controller.js";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller.js";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller.js";
import * as stackRuleController from "../controllers/admin/marketing-stack-rule.controller.js";
import * as calculationController from "../controllers/admin/marketing-calculation.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

export const adminMarketingRouter = Router();
export const miniappMarketingRouter = Router();

// 优惠券模板管理
adminMarketingRouter.post("/coupons/templates", requireAuthWithTenant, couponController.createCouponTemplate);
adminMarketingRouter.get("/coupons/templates", requireAuthWithTenant, couponController.listCouponTemplates);
adminMarketingRouter.get("/coupons/templates/:id", requireAuthWithTenant, couponController.getCouponTemplate);
adminMarketingRouter.put("/coupons/templates/:id", requireAuthWithTenant, couponController.updateCouponTemplate);
adminMarketingRouter.delete("/coupons/templates/:id", requireAuthWithTenant, couponController.deleteCouponTemplate);
adminMarketingRouter.post("/coupons/templates/:id/activate", requireAuthWithTenant, couponController.activateCouponTemplate);
adminMarketingRouter.post("/coupons/templates/:id/pause", requireAuthWithTenant, couponController.pauseCouponTemplate);
adminMarketingRouter.get("/coupons/user-coupons", requireAuthWithTenant, couponController.listUserCoupons);
adminMarketingRouter.get("/coupons/statistics", requireAuthWithTenant, couponController.getCouponStatistics);

// 满减活动管理
adminMarketingRouter.post("/full-reductions", requireAuthWithTenant, fullReductionController.createFullReduction);
adminMarketingRouter.get("/full-reductions", requireAuthWithTenant, fullReductionController.listFullReductions);
adminMarketingRouter.get("/full-reductions/:id", requireAuthWithTenant, fullReductionController.getFullReduction);
adminMarketingRouter.put("/full-reductions/:id", requireAuthWithTenant, fullReductionController.updateFullReduction);
adminMarketingRouter.delete("/full-reductions/:id", requireAuthWithTenant, fullReductionController.deleteFullReduction);
adminMarketingRouter.post("/full-reductions/:id/activate", requireAuthWithTenant, fullReductionController.activateFullReduction);
adminMarketingRouter.post("/full-reductions/:id/pause", requireAuthWithTenant, fullReductionController.pauseFullReduction);

// 积分管理
adminMarketingRouter.get("/points/rule", requireAuthWithTenant, pointsController.getPointsRule);
adminMarketingRouter.put("/points/rule", requireAuthWithTenant, pointsController.updatePointsRule);
adminMarketingRouter.get("/points/records", requireAuthWithTenant, pointsController.listPointsRecords);
adminMarketingRouter.get("/points/user/:userId", requireAuthWithTenant, pointsController.getUserPoints);
adminMarketingRouter.get("/points/my-records", requireAuthWithTenant, pointsController.listMyPointsRecords);

// 秒杀活动管理
adminMarketingRouter.post("/flash-sales", requireAuthWithTenant, flashSaleController.createFlashSale);
adminMarketingRouter.get("/flash-sales", requireAuthWithTenant, flashSaleController.listFlashSales);
adminMarketingRouter.get("/flash-sales/:id", requireAuthWithTenant, flashSaleController.getFlashSale);
adminMarketingRouter.put("/flash-sales/:id", requireAuthWithTenant, flashSaleController.updateFlashSale);
adminMarketingRouter.delete("/flash-sales/:id", requireAuthWithTenant, flashSaleController.deleteFlashSale);
adminMarketingRouter.post("/flash-sales/:id/activate", requireAuthWithTenant, flashSaleController.activateFlashSale);
adminMarketingRouter.post("/flash-sales/:id/pause", requireAuthWithTenant, flashSaleController.pauseFlashSale);
adminMarketingRouter.get("/flash-sales/statistics", requireAuthWithTenant, flashSaleController.getFlashSaleStatistics);
adminMarketingRouter.post("/flash-sales/:id/grab", requireAuthWithTenant, flashSaleController.buyFlashSale);

// 拼团活动管理
adminMarketingRouter.post("/group-buys", requireAuthWithTenant, groupBuyController.createGroupBuy);
adminMarketingRouter.get("/group-buys", requireAuthWithTenant, groupBuyController.listGroupBuys);
adminMarketingRouter.get("/group-buys/:id", requireAuthWithTenant, groupBuyController.getGroupBuy);
adminMarketingRouter.put("/group-buys/:id", requireAuthWithTenant, groupBuyController.updateGroupBuy);
adminMarketingRouter.delete("/group-buys/:id", requireAuthWithTenant, groupBuyController.deleteGroupBuy);
adminMarketingRouter.post("/group-buys/:id/activate", requireAuthWithTenant, groupBuyController.activateGroupBuy);
adminMarketingRouter.get("/group-buys/teams", requireAuthWithTenant, groupBuyController.listGroupBuyTeams);
adminMarketingRouter.get("/group-buys/active/:activityId", requireAuthWithTenant, groupBuyController.listActiveGroupBuys);
adminMarketingRouter.post("/group-buys/teams", requireAuthWithTenant, groupBuyController.createGroupBuyTeam);
adminMarketingRouter.get("/group-buys/teams/:teamId", requireAuthWithTenant, groupBuyController.getGroupBuyTeam);
adminMarketingRouter.post("/group-buys/teams/:teamId/join", requireAuthWithTenant, groupBuyController.joinGroupBuyTeam);

// 叠加规则管理
adminMarketingRouter.post("/stack-rules", requireAuthWithTenant, stackRuleController.createStackRule);
adminMarketingRouter.get("/stack-rules", requireAuthWithTenant, stackRuleController.listStackRules);
adminMarketingRouter.put("/stack-rules/:id", requireAuthWithTenant, stackRuleController.updateStackRule);
adminMarketingRouter.delete("/stack-rules/:id", requireAuthWithTenant, stackRuleController.deleteStackRule);

// 试算
adminMarketingRouter.post("/calculate", requireAuthWithTenant, calculationController.calculatePromotion);

// 小程序 - 优惠券
miniappMarketingRouter.get("/coupons/available", couponController.listAvailableCoupons);
miniappMarketingRouter.post("/coupons/claim", couponController.claimCoupon);
miniappMarketingRouter.get("/coupons/my", couponController.listMyCoupons);

// 小程序 - 满减
miniappMarketingRouter.get("/full-reductions/active", fullReductionController.listFullReductions);
miniappMarketingRouter.get("/full-reductions/available", fullReductionController.listFullReductions);

// 小程序 - 积分
miniappMarketingRouter.get("/points/my", pointsController.getUserPoints);
miniappMarketingRouter.get("/points/my-records", pointsController.listMyPointsRecords);

// 小程序 - 秒杀
miniappMarketingRouter.get("/flash-sales/active", flashSaleController.listActiveFlashSales);
miniappMarketingRouter.post("/flash-sales/grab", flashSaleController.buyFlashSale);

// 小程序 - 拼团
miniappMarketingRouter.get("/group-buys/active", groupBuyController.listActiveGroupBuys);
miniappMarketingRouter.get("/group-buys/teams/:teamId", groupBuyController.getGroupBuyTeam);
miniappMarketingRouter.post("/group-buys/teams/join", groupBuyController.joinGroupBuyTeam);

// 小程序 - 试算
miniappMarketingRouter.post("/calculate", calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/marketing", router: adminMarketingRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/marketing", router: miniappMarketingRouter, auth: "none" },
];