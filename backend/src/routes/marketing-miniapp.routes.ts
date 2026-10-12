import { Router } from "express";
import type { RequestHandler } from "express";
import * as couponController from "../controllers/admin/marketing-coupon.controller";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import * as pointsController from "../controllers/admin/marketing-points.controller";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller";
import * as calculationController from "../controllers/admin/marketing-calculation.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { fail } from "../shared/response";

export const miniappMarketingRouter = Router();

// ========== 登录态身份绑定（S3-178 #1） ==========
// 本文件同时承载「公开浏览面」（营销内容 GET）与「需登录态的自有端点」（我的券/我的积分/写操作），
// 故 routeConfig.auth 只能保持 "none"（auto-routes 不会附加认证与 CSRF）；
// 需登录态的端点因此在**同一行**显式挂 requireAuthWithTenant + csrfMiddleware，
// 顺序必须"认证在前"（csrfMiddleware 依赖 req.user）——与同族文件 miniapp.routes.ts（/api/miniapp）
// 的既有合规写法逐字一致，写法来源见该文件 L11-14 与 platform-auth.routes.ts:46。
//
// ★ 身份必须来自登录态，不得由客户端字段声明：
//   同批 controller 也挂在 /api/admin/marketing（管理员代客场景，body.userId 是被操作的会员，属合法入参），
//   所以**不能**在 controller 层删掉客户端字段；本文件（消费者侧）必须自行保证"只能操作自己"：
//   ① 客户端若自带 userId / query.userId 且与登录态不一致 ⇒ 直接 403（归属校验，S3-178 卡 §二.1）；
//   ② 把登录态 userId 写回请求字段，供既有 controller/zod 入参读取（不新增身份来源）。
const bindSelfIdentity: RequestHandler = (req, res, next) => {
  const loginUserId = Number(req.user?.id || 0);
  if (!loginUserId) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  const claimed = (req.body ?? {}).userId ?? req.query?.userId;
  if (claimed !== undefined && Number(claimed) !== loginUserId) {
    res.status(403).json(fail("禁止以客户端字段声明用户身份", "403"));
    return;
  }
  if (req.body && typeof req.body === "object") {
    (req.body as Record<string, unknown>).userId = loginUserId;
  }
  next();
};

// 小程序 - 优惠券
miniappMarketingRouter.get("/coupons/available", couponController.listAvailableCoupons);
miniappMarketingRouter.post("/coupons/claim", requireAuthWithTenant, csrfMiddleware, bindSelfIdentity, couponController.claimCoupon);
miniappMarketingRouter.get("/coupons/my", requireAuthWithTenant, bindSelfIdentity, couponController.listMyCoupons);

// 小程序 - 满减
miniappMarketingRouter.get("/full-reductions/active", fullReductionController.listFullReductions);
miniappMarketingRouter.get("/full-reductions/available", fullReductionController.listFullReductions);

// 小程序 - 积分
miniappMarketingRouter.get("/points/my", pointsController.getUserPoints);
miniappMarketingRouter.get("/points/my-records", requireAuthWithTenant, bindSelfIdentity, pointsController.listMyPointsRecords);

// 小程序 - 秒杀
miniappMarketingRouter.get("/flash-sales/active", flashSaleController.listActiveFlashSales);
miniappMarketingRouter.post("/flash-sales/grab", requireAuthWithTenant, csrfMiddleware, bindSelfIdentity, flashSaleController.buyFlashSale);

// 小程序 - 拼团
miniappMarketingRouter.get("/group-buys/active", groupBuyController.listActiveGroupBuys);
miniappMarketingRouter.get("/group-buys/teams/:teamId", groupBuyController.getGroupBuyTeam);
miniappMarketingRouter.post("/group-buys/teams/join", requireAuthWithTenant, csrfMiddleware, bindSelfIdentity, groupBuyController.joinGroupBuyTeam);

// 小程序 - 试算
// 试算不落库、也无需身份，但按 S3-178 卡 §二.1「每个写端点前补认证」补认证 + CSRF（同类既有写法：cart.routes.ts 的幂等只读型 POST）
miniappMarketingRouter.post("/calculate", requireAuthWithTenant, csrfMiddleware, calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/marketing",
  router: miniappMarketingRouter,
  auth: "none",
};