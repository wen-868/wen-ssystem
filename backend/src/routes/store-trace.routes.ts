import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as traceController from "../controllers/store/trace.controller";

export const storeTraceRouter = Router();

// 收银台追溯码验证（扫追溯码自动带出商品）
storeTraceRouter.post("/verify", traceController.verifyStoreTraceCode);

// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ `app.use("/api/store", 认证+CSRF, router)` 会
//   把整段 `/api/store/**`（含本文件不拥有的路径、以及根本不存在的子路径）先套上认证 + CSRF。
//   现收窄为「只声明自己拥有的路径段」`/api/store/trace`：对外 URL 逐字不变（prefix + 本文件内路径）。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/trace", router: storeTraceRouter, auth: "requireAuthWithTenant" },
];
