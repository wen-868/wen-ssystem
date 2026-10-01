import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-referral-ledger.controller";

/**
 * R101-C6-3-2b：老带新台账域路由（**1 条只读端点**，前缀 /api/platform/referral-ledger）
 *
 * 选型说明（同 C6-3-2a 口径）：**新建本文件，不并入 platform-promo-code.routes.ts**。
 * 理由：① 卡内前缀是 `/api/platform/referral-ledger`，与推广码域前缀不同，塞进去会让
 * "文件声明前缀 = 实际前缀"这条既有约束失效；② 台账域自带 1 张表（195）+ 1 条端点，
 * 独立成文件与既有 `platform-promo-code.routes.ts` / `platform-agent.routes.ts` 同风格；
 * ③ auto-routes 自动扫描 routes/ 目录，新文件无需任何手工注册。
 *
 * 端点（路径由派单卡 §四 逐字钉死，不得自拟）：
 *   · GET /api/platform/referral-ledger —— 分页 + 关键词 + 状态
 * **不提供任何"写台账"端点**（卡 §四）：台账由归因事件驱动，写入口只在服务层内部。
 * 本文件不写任何业务逻辑（分层规则：route 只注册）。
 */

export const platformReferralLedgerRouter = Router();

platformReferralLedgerRouter.get("/", asyncHandler(controller.listReferralLedger));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/referral-ledger",
  router: platformReferralLedgerRouter,
  auth: "requirePlatformAuth",
};
