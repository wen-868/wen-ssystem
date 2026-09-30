import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as agentController from "../controllers/platform/platform-agent.controller";
import * as levelController from "../controllers/platform/platform-agent-level.controller";

/**
 * R101-C6-3-3：平台代理商域路由（**8 条端点**，前缀 /api/platform/agents）
 *
 * 选型说明（卡 §五③ 要求"由你选并说明"）：**新建 `platform-agent.routes.ts`，不并入
 * `platform-config.routes.ts`**。理由：① 卡内路径前缀是 `/api/platform/agents`，而
 * `platform-config.routes.ts` 声明的前缀是 `/api/platform/config`，把一个不同前缀的路由塞进去
 * 要么再导出一个 routeConfigs 数组（该文件当前是单 routeConfig），要么写与声明前缀不符的路径，
 * 两者都会让"文件声明前缀 = 实际前缀"这条既有约束失效；② 代理商域自带两张表、5+3 条端点，
 * 独立成文件与既有 `platform-role.routes.ts`（多前缀多路由）同风格；③ auto-routes 自动扫描
 * routes/ 目录，新文件无需任何手工注册，`git` 也可单独回退。
 *
 * 端点（路径由派单卡 §四 逐字钉死，不得自拟）：
 *   · GET  /api/platform/agents             —— 分页 + 关键词
 *   · POST /api/platform/agents             —— 新建档案
 *   · GET  /api/platform/agents/:id         —— 详情（卡 §二"详情"字面要求）
 *   · PUT  /api/platform/agents/:id         —— 部分更新
 *   · POST /api/platform/agents/:id/status  —— 状态流转
 *   · GET  /api/platform/agents/levels      —— 层级列表
 *   · POST /api/platform/agents/levels      —— 新建层级
 *   · PUT  /api/platform/agents/levels/:id  —— 层级更新
 *
 * 注册顺序：先注册 `/levels*` 再注册 `/:id` —— 否则 `GET /levels` 会被 `GET /:id` 抢先命中
 * （Express 按注册顺序匹配，`:id` 会吃掉字面量 "levels"）。`/:id/status` 与 `/:id` 方法不同但同样
 * 按"具体→通配"排列，便于阅读。本文件不写任何业务逻辑（分层规则：route 只注册）。
 */

export const platformAgentRouter = Router();

// ─── 层级权益配置（3 条；表 t_agent_level / 迁移 187）─────────────────────────
platformAgentRouter.get("/levels", asyncHandler(levelController.listAgentLevels));
platformAgentRouter.post("/levels", asyncHandler(levelController.createAgentLevel));
platformAgentRouter.put("/levels/:id", asyncHandler(levelController.updateAgentLevel));

// ─── 代理商档案（5 条；表 t_agent  / 迁移 186）──────────────────────────────
platformAgentRouter.get("/", asyncHandler(agentController.listAgents));
platformAgentRouter.post("/", asyncHandler(agentController.createAgent));
platformAgentRouter.get("/:id", asyncHandler(agentController.getAgent));
platformAgentRouter.put("/:id", asyncHandler(agentController.updateAgent));
platformAgentRouter.post("/:id/status", asyncHandler(agentController.changeAgentStatus));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/agents",
  router: platformAgentRouter,
  auth: "requirePlatformAuth",
};
