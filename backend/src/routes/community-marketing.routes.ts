import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/marketing/community-marketing.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 拼团 ====================
export const groupBuyRouter = Router();

// S3-226（第 43 项 B2 批 8 · 营销域接线）：本文件 10 条写端点（拼团 join/start/end、砍价 start/help/end、
// 秒杀 buy/pay/cancel/end）**本批一律不接**，理由是「使用者集合不可枚举」（B 类，逐条证据见台账 §十五.5）：
//   ① 真实写调用点全部在 app-mobile（`api/modules/community-marketing.ts:190-260`），页面为
//      `pages-sub/marketing/marketing/{group-buy-detail,bargain-detail,seckill-detail,community-activities}.vue`；
//   ② 这些页面由「功能中心」按菜单码 `marketing:group-buy|bargain|seckill|community` 过滤后进入
//      （`config/function-menu.ts:81-84`），而**该前缀菜单在生产授给了 `READONLY`（只读观察员）与 `STORE_ADMIN`（旧词表）**
//      （`docs/tasks/R101-总进度与推进计划.md:1610`、`R101-S3-136-F1-阿澈-可见性对照表.md:113-122`），二者均**不持** `marketing:*`；
//   ③ 挂 `marketing:create` 会把"看得到该按钮的角色"打成 403（与 S3-222 §12.6 W 类同款形态）。
// 另：这 10 条是**商家端**语义（`routeConfig.auth = "requireAuthWithTenant"`），不是消费者端认证形态，故也不按 consumerEnd 记账。
groupBuyRouter.get("/", asyncHandler(controller.listGroupBuys));
groupBuyRouter.get("/:id", asyncHandler(controller.getGroupBuy));
groupBuyRouter.post("/:id/join", asyncHandler(controller.joinGroupBuy));
groupBuyRouter.post("/:id/start", asyncHandler(controller.startGroupBuy));
groupBuyRouter.post("/:id/end", asyncHandler(controller.endGroupBuy));
groupBuyRouter.get("/:id/records", asyncHandler(controller.listGroupBuyRecords));

// ==================== 砍价 ====================
export const bargainRouter = Router();

bargainRouter.get("/", asyncHandler(controller.listBargains));
bargainRouter.get("/:id", asyncHandler(controller.getBargain));
bargainRouter.post("/:id/start", asyncHandler(controller.startBargain));
bargainRouter.post("/:id/help", asyncHandler(controller.helpBargain));
bargainRouter.post("/:id/end", asyncHandler(controller.endBargain));
bargainRouter.get("/:id/records", asyncHandler(controller.listBargainRecords));

// ==================== 秒杀 ====================
export const seckillRouter = Router();

seckillRouter.get("/", asyncHandler(controller.listSeckills));
seckillRouter.get("/:id", asyncHandler(controller.getSeckill));
seckillRouter.post("/:id/buy", asyncHandler(controller.buySeckill));
seckillRouter.post("/:orderNo/pay", asyncHandler(controller.paySeckillOrder));
seckillRouter.post("/:orderNo/cancel", asyncHandler(controller.cancelSeckillOrder));
seckillRouter.post("/:id/end", asyncHandler(controller.endSeckill));
seckillRouter.get("/:id/records", asyncHandler(controller.listSeckillRecords));

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/marketing/group-buy",
    router: groupBuyRouter,
    auth: "requireAuthWithTenant",
  },
  {
    prefix: "/api/marketing/bargain",
    router: bargainRouter,
    auth: "requireAuthWithTenant",
  },
  {
    prefix: "/api/marketing/seckill",
    router: seckillRouter,
    auth: "requireAuthWithTenant",
  },
];
