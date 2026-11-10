import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderProgressController from "../controllers/shared/order-progress.controller";

export const orderProgressRouter = Router();

// ============ 订单进度事件只读查询（TOTAL-ORDER-PROGRESS-02） ============
// GET /api/admin/order-progress/:family/:orderNo?since_seq=&cursor=&limit=&channel=
// - 租户/门店/角色/字段过滤全部在查询服务强制（契约 §4.3/§五/§六）
// - 只读：不写任何业务状态
orderProgressRouter.get(
  "/order-progress/:family/:orderNo",
  orderProgressController.getOrderProgress,
);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: orderProgressRouter,
  auth: "requireAuthWithTenant",
};
