import { Router } from "express";
import type { RequestHandler } from "express";
import * as couponController from "../controllers/admin/marketing-coupon.controller";
import * as fullReductionController from "../controllers/admin/marketing-full-reduction.controller";
import * as pointsController from "../controllers/admin/marketing-points.controller";
import * as flashSaleController from "../controllers/admin/marketing-flash-sale.controller";
import * as groupBuyController from "../controllers/admin/marketing-group-buy.controller";
import * as calculationController from "../controllers/admin/marketing-calculation.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { fail } from "../shared/response";

export const miniappMarketingRouter = Router();

// ========== 登录态身份绑定（S3-178 #1） ==========
// 本文件同时承载「公开浏览面」（营销内容 GET）与「需登录态的自有端点」（我的券/我的积分/写操作），
// 故 routeConfig.auth 只能保持 "none"（auto-routes 不会附加认证与 CSRF）；
// 需登录态的端点因此在**同一行**显式挂 requireConsumerAuthWithTenant + csrfMiddleware，
// 顺序必须"认证在前"（csrfMiddleware 依赖 req.user）——与同族文件 miniapp.routes.ts（/api/miniapp）
// 的既有合规写法逐字一致，写法来源见该文件 L11-14 与 platform-auth.routes.ts:46。
//
// ★ S3-196（总清单第 52 项）身份载体：认证中间件改用 requireConsumerAuthWithTenant ——
//   老 miniapp 只有微信令牌（payload = wxUserId/openid），此前逐一被商家端 JWT 校验打成 401；
//   该中间件把微信令牌解析成**绑定的会员身份**（t_member.id）并注入 req.user，roles 恒空。
//   商家端 JWT 仍原样透传（既有调用方与测试不受影响）。
//   `userId` 仍一律取登录态（bindSelfIdentity），客户端不得自行声明。
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
// S3-187 A：路径参数必须与 controller 读取的参数名一致（此前三条写端点都没有路径参数，
//   controller 读到 undefined ⇒ Number(undefined)=NaN ⇒ 业务层恒 404）。路径按契约
//   docs/API接口文档.md:2839/2852/2868 的带参形态注册（契约是权威口径，只照着改代码）：
//   POST /coupons/:templateId/claim、POST /flash-sale/:id/buy、POST /group-buy/:teamId/join。
//   「被操作对象」（templateId / id / teamId）的归属与存在性校验在服务层按
//   `tenant_id = ?` + 命中不到即 404 实现（marketing-coupon.service.ts:459/466、
//   marketing-flash-sale.service.ts:351/358、marketing-group-buy.service.ts:414-423），
//   控制器侧补「参数本身是否合法」（非整数/非正数 ⇒ 400，不让 NaN 落到 SQL）。
miniappMarketingRouter.post("/coupons/:templateId/claim", requireConsumerAuthWithTenant, csrfMiddleware, bindSelfIdentity, couponController.claimCoupon);
miniappMarketingRouter.get("/coupons/my", requireConsumerAuthWithTenant, bindSelfIdentity, couponController.listMyCoupons);

// 小程序 - 满减
miniappMarketingRouter.get("/full-reductions/active", fullReductionController.listFullReductions);
miniappMarketingRouter.get("/full-reductions/available", fullReductionController.listFullReductions);

// 小程序 - 积分
// S3-187 C：身份改取登录态（此前路由无 :userId 而 controller 读 req.params.userId ⇒ 恒 NaN）。
//   与管理员代查端点 /api/admin/marketing/points/user/:userId 共用同一 controller 函数，
//   故函数内做显式分支：有 param ⇒ 用 param（管理员代查，租户隔离在服务层）；
//   无 param ⇒ 用登录态身份。本路由属「我的」数据，故补 requireConsumerAuthWithTenant + bindSelfIdentity。
miniappMarketingRouter.get("/points/my", requireConsumerAuthWithTenant, bindSelfIdentity, pointsController.getUserPoints);
miniappMarketingRouter.get("/points/my-records", requireConsumerAuthWithTenant, bindSelfIdentity, pointsController.listMyPointsRecords);

// 小程序 - 秒杀
miniappMarketingRouter.get("/flash-sales/active", flashSaleController.listActiveFlashSales);
miniappMarketingRouter.post("/flash-sale/:id/buy", requireConsumerAuthWithTenant, csrfMiddleware, bindSelfIdentity, flashSaleController.buyFlashSale);

// 小程序 - 拼团
miniappMarketingRouter.get("/group-buys/active", groupBuyController.listActiveGroupBuys);
miniappMarketingRouter.get("/group-buys/teams/:teamId", groupBuyController.getGroupBuyTeam);
// 参数名用 :teamId（而不是契约占位符 :id）——被操作对象是「团」：服务函数
// joinGroupBuyTeam(teamId,…) 按组 id 查 t_group_buy_team；契约 L2864 对同一资源也明写 :teamId，
// 管理员侧同族端点为 /api/admin/marketing/group-buys/teams/:teamId/join（参数名逐字一致）。
miniappMarketingRouter.post("/group-buy/:teamId/join", requireConsumerAuthWithTenant, csrfMiddleware, bindSelfIdentity, groupBuyController.joinGroupBuyTeam);

// 小程序 - 试算
// 试算不落库、也无需身份，但按 S3-178 卡 §二.1「每个写端点前补认证」补认证 + CSRF（同类既有写法：cart.routes.ts 的幂等只读型 POST）
miniappMarketingRouter.post("/calculate", requireConsumerAuthWithTenant, csrfMiddleware, calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/marketing",
  router: miniappMarketingRouter,
  auth: "none",
};
