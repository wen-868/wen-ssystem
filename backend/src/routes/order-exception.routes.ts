import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as orderExceptionController from "../controllers/admin/order-exception.controller";

export const orderExceptionRouter = Router();

// ============ 订单异常管理 ============
orderExceptionRouter.get("/order-exceptions", orderExceptionController.listOrderExceptions);
// 注意：:id 用数字正则限定，避免吞掉 /order-exceptions/xxx 之外的静态路径（静态路径均注册在本文件）
orderExceptionRouter.get("/order-exceptions/:id(\\d+)", orderExceptionController.getOrderExceptionDetail);
orderExceptionRouter.post("/order-exceptions", orderExceptionController.createOrderException);
orderExceptionRouter.put("/order-exceptions/:id(\\d+)/status", orderExceptionController.updateOrderExceptionStatus);
orderExceptionRouter.put("/order-exceptions/:id(\\d+)", orderExceptionController.updateOrderException);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: orderExceptionRouter,
  auth: "requireAuthWithTenant",
};
