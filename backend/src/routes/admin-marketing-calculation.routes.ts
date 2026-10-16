import { Router } from "express";

import * as calculationController from "../controllers/admin/marketing-calculation.controller";
import type { RouteConfig } from "../shared/auto-routes";

export const adminMarketingCalculationRouter = Router();

// 试算
// S3-226（第 43 项 B2 批 8 · 营销域接线）：本行**本批不接** —— 它是**查询型 POST**（Q 类），
// 依据：`services/admin/marketing-calculation.service.ts` 的 `calculatePromotion` **只读不写**
//（全函数仅 `queryOneWithTenant`/`queryWithTenant` 的 SELECT，`rg -in 'insert into|update |delete from' <service>` 零命中），
// 按派单卡 §二.3「查询型 POST 不按写端点接」与批 6 Q 类（`POST /admin/quote-push/preview`）同口径处理。
// 另：admin-web 唯一封装 `api/marketing.ts:256` 打的是 `/admin/marketing/promotions/calculate`（后端无此前缀，调用即 404）。
adminMarketingCalculationRouter.post("/calculate", calculationController.calculatePromotion);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing",
  router: adminMarketingCalculationRouter,
  auth: "requireAuthWithTenant",
};