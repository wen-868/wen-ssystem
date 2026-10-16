import { Router } from "express";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/marketing/community-marketing.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// ==================== 拼团 ====================
export const groupBuyRouter = Router();

// S3-226（批 8）曾按旧口径把本文件 10 条写端点登记为「不接（B 类）」；S3-229（批 9）按**授权模型提案 D2** 判定**接线**
// （挂 `marketing:create`，台账 §三.4 域内建议码），依据（生产底稿，逐条可核对）：
//   ① 页面：真实写调用点全在 app-mobile（`api/modules/community-marketing.ts`），页面为
//      `pages-sub/marketing/marketing/{group-buy-detail,bargain-detail,seckill-detail,community-activities}.vue`，
//      入口由「功能中心」按菜单码 `marketing:group-buy|bargain|seckill|community` 过滤（`config/function-menu.ts`）；
//   ② **生产授予该前缀菜单的角色 = `OPERATION_ADMIN` / `READONLY` / `STORE_ADMIN`**
//      （`docs/evidence/_shared/prod-menu-matrix-20261016.txt` §一，权威口径：生产 `t_sys_role_menu`）；
//   ③ **在用角色判定**（`docs/evidence/_shared/prod-role-usage-20261016.sql` 读数）：`OPERATION_ADMIN` 0 账号、
//      `STORE_ADMIN` 0 账号（旧词表遗留角色）；`READONLY` 是**只读观察员**（权限串 `["*:view"]`，写 403 属期望行为）。
//      ⇒ **没有任何"在用写角色"被授予该菜单**，接线**无在用账号回归**（不变量 I1 只约束在用角色）。
//   ④ 菜单错配留痕：`STORE_ADMIN` 本不应看到营销菜单（0 账号、旧词表）⇒ 登记为「菜单治理待办」，不阻塞接线（D2）。
// 另：这 10 条是**商家端**语义（`routeConfig.auth = "requireAuthWithTenant"`），不是消费者端认证形态，故不按 consumerEnd 记账。
groupBuyRouter.get("/", asyncHandler(controller.listGroupBuys));
groupBuyRouter.get("/:id", asyncHandler(controller.getGroupBuy));
groupBuyRouter.post("/:id/join", requirePermission("marketing:create"), asyncHandler(controller.joinGroupBuy));
groupBuyRouter.post("/:id/start", requirePermission("marketing:create"), asyncHandler(controller.startGroupBuy));
groupBuyRouter.post("/:id/end", requirePermission("marketing:create"), asyncHandler(controller.endGroupBuy));
groupBuyRouter.get("/:id/records", asyncHandler(controller.listGroupBuyRecords));

// ==================== 砍价 ====================
export const bargainRouter = Router();

bargainRouter.get("/", asyncHandler(controller.listBargains));
bargainRouter.get("/:id", asyncHandler(controller.getBargain));
bargainRouter.post("/:id/start", requirePermission("marketing:create"), asyncHandler(controller.startBargain));
bargainRouter.post("/:id/help", requirePermission("marketing:create"), asyncHandler(controller.helpBargain));
bargainRouter.post("/:id/end", requirePermission("marketing:create"), asyncHandler(controller.endBargain));
bargainRouter.get("/:id/records", asyncHandler(controller.listBargainRecords));

// ==================== 秒杀 ====================
export const seckillRouter = Router();

seckillRouter.get("/", asyncHandler(controller.listSeckills));
seckillRouter.get("/:id", asyncHandler(controller.getSeckill));
seckillRouter.post("/:id/buy", requirePermission("marketing:create"), asyncHandler(controller.buySeckill));
seckillRouter.post("/:orderNo/pay", requirePermission("marketing:create"), asyncHandler(controller.paySeckillOrder));
seckillRouter.post("/:orderNo/cancel", requirePermission("marketing:create"), asyncHandler(controller.cancelSeckillOrder));
seckillRouter.post("/:id/end", requirePermission("marketing:create"), asyncHandler(controller.endSeckill));
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
