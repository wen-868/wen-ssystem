import { Router } from "express";
import * as couponController from "../controllers/admin/marketing-coupon.controller";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import * as pointsController from "../controllers/admin/marketing-points.controller";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller";
import * as calculationController from "../controllers/admin/marketing-calculation.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const miniappMarketingRouter = Router();

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
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/marketing",
  router: miniappMarketingRouter,
  auth: "none",
};