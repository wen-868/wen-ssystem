import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as hardwareController from "../controllers/store/hardware.controller";

/**
 * 收银硬件外部回调（云喇叭/收款盒子服务商调用，无需登录）
 * 租户以路径参数传入，服务商按配置的 notify_url 回调。
 */
export const hardwareCallbackRouter = Router();

hardwareCallbackRouter.post("/callbacks/cloud-speaker/:tenantId", hardwareController.cloudSpeakerCallback);
hardwareCallbackRouter.post("/callbacks/box/:tenantId", hardwareController.boxCallback);

export const routeConfig: RouteConfig = {
  prefix: "/api/store/hardware",
  router: hardwareCallbackRouter,
  auth: "none",
};
