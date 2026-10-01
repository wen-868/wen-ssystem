import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-channel-report.controller";

/**
 * R101-C6-3-2b：渠道效果报表域路由（**1 条只读端点**，前缀 /api/platform/channel-reports）
 *
 * 选型说明（同 C6-3-2a 口径）：**新建本文件**，理由与老带新台账同——卡内前缀
 * `/api/platform/channel-reports` 与既有平台域文件（config / plans / promo-codes 等）都不同，
 * 独立成文件才能保持"文件声明前缀 = 实际前缀"。auto-routes 自动扫描 routes/ 目录，无需手工注册。
 *
 * 端点（路径由派单卡 §四 逐字钉死，不得自拟）：
 *   · GET /api/platform/channel-reports/effect —— 按归因维度聚合的渠道效果
 * 报表页归属：**不新增独立页面/路由/菜单**（裁定 R7），前端并入 ChannelPromotion.vue 的「渠道效果」子 Tab。
 * 本文件不写任何业务逻辑（分层规则：route 只注册）。
 */

export const platformChannelReportRouter = Router();

platformChannelReportRouter.get("/effect", asyncHandler(controller.getChannelEffect));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/channel-reports",
  router: platformChannelReportRouter,
  auth: "requirePlatformAuth",
};
