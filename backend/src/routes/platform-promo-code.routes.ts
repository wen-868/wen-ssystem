import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-promo-code.controller";

/**
 * R101-C6-3-2a：平台渠道推广码域路由（**4 条端点**，前缀 /api/platform/promo-codes）
 *
 * 选型说明（与 C6-3-3 同口径）：**新建本文件，不并入 platform-config.routes.ts**。
 * 理由：① 卡内前缀是 `/api/platform/promo-codes`，而 `platform-config.routes.ts` 声明的前缀是
 * `/api/platform/config`，塞进去会让"文件声明前缀 = 实际前缀"这条既有约束失效；② 推广码域自带
 * 2 张表（188/189）+ 4 条端点，独立成文件与既有 `platform-agent.routes.ts` 同风格；
 * ③ auto-routes 自动扫描 routes/ 目录，新文件无需任何手工注册。
 *
 * 端点（路径由派单卡 §四 逐字钉死，不得自拟）：
 *   · GET  /api/platform/promo-codes                    —— 分页 + 关键词 + 状态
 *   · POST /api/platform/promo-codes                    —— 生成（PC + 8 位去易混；冲突重试 5 次后 409）
 *   · POST /api/platform/promo-codes/:id/disable        —— 停用（已停用 ⇒ 幂等 200 + 说明）
 *   · GET  /api/platform/promo-codes/:code/attributions —— 该码的归因列表（只读聚合）
 *
 * 注册顺序：`/:id/disable`（两段）与 `/:code/attributions`（两段）段数、方法均不同，且 `GET /` 无参；
 * 无 `GET /:id` 通配，故不存在"字面量被 :param 抢走"的问题（与 platform-agent 的 /levels 情形不同）。
 * 本文件不写任何业务逻辑（分层规则：route 只注册）。
 */

export const platformPromoCodeRouter = Router();

platformPromoCodeRouter.get("/", asyncHandler(controller.listPromoCodes));
platformPromoCodeRouter.post("/", asyncHandler(controller.createPromoCode));
platformPromoCodeRouter.post("/:id/disable", asyncHandler(controller.disablePromoCode));
platformPromoCodeRouter.get("/:code/attributions", asyncHandler(controller.listAttributionsByCode));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/promo-codes",
  router: platformPromoCodeRouter,
  auth: "requirePlatformAuth",
};

