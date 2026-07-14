import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/marketing/community-marketing.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 拼团 ====================
export const groupBuyRouter = Router();

groupBuyRouter.get("/", asyncHandler(controller.listGroupBuys));
groupBuyRouter.get("/:id", asyncHandler(controller.getGroupBuy));
groupBuyRouter.post("/:id/join", requireAuthWithTenant, asyncHandler(controller.joinGroupBuy));
groupBuyRouter.post("/:id/start", requireAuthWithTenant, asyncHandler(controller.startGroupBuy));

// ==================== 砍价 ====================
export const bargainRouter = Router();

bargainRouter.get("/", asyncHandler(controller.listBargains));
bargainRouter.get("/:id", asyncHandler(controller.getBargain));
bargainRouter.post("/:id/start", requireAuthWithTenant, asyncHandler(controller.startBargain));
bargainRouter.post("/:id/help", requireAuthWithTenant, asyncHandler(controller.helpBargain));

// ==================== 秒杀 ====================
export const seckillRouter = Router();

seckillRouter.get("/", asyncHandler(controller.listSeckills));
seckillRouter.get("/:id", asyncHandler(controller.getSeckill));
seckillRouter.post("/:id/buy", requireAuthWithTenant, asyncHandler(controller.buySeckill));

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/marketing/group-buy",
    router: groupBuyRouter,
    auth: "none",
  },
  {
    prefix: "/api/marketing/bargain",
    router: bargainRouter,
    auth: "none",
  },
  {
    prefix: "/api/marketing/seckill",
    router: seckillRouter,
    auth: "none",
  },
];
