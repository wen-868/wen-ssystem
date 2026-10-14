import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as hardwareController from "../controllers/store/hardware.controller";

export const storeHardwareRouter = Router();
export const storeCloudSpeakerRouter = Router();
export const storeBoxPayRouter = Router();
export const storeBoxConfigRouter = Router();
export const storeUnionpayRouter = Router();

storeHardwareRouter.get("/", hardwareController.listHardwareConfigs);
storeHardwareRouter.put("/:category", hardwareController.saveHardwareConfig);
storeHardwareRouter.post("/:category/test", hardwareController.testHardwareConfig);
storeCloudSpeakerRouter.post("/announce", hardwareController.announceCloudSpeaker);
storeBoxPayRouter.post("/pay", hardwareController.createBoxPay);
storeBoxConfigRouter.get("/", hardwareController.getBoxConfig);
storeBoxConfigRouter.put("/", hardwareController.saveBoxConfig);
storeBoxConfigRouter.post("/test", hardwareController.testBoxConfig);
storeUnionpayRouter.post("/test", hardwareController.testUnionpay);

// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF（其中就包括
//   别的文件拥有的 `/api/store/hardware/callbacks/*` 两条「不鉴权声明」的服务商回调）。现按「只声明自己
//   拥有的路径段」收窄：`/api/store/hardware` 这条**刻意不占用**（它被 hardware-callback 的公开回调占用），
//   本文件改挂到更深的自有段上，对外 URL 逐字不变。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/hardware/configs", router: storeHardwareRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hardware/cloud-speaker", router: storeCloudSpeakerRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hardware/box", router: storeBoxPayRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hardware/box-config", router: storeBoxConfigRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/hardware/unionpay", router: storeUnionpayRouter, auth: "requireAuthWithTenant" },
];
