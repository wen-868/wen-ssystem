import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as hardwareController from "../controllers/store/hardware.controller";

export const storeHardwareRouter = Router();

storeHardwareRouter.get("/hardware/configs", hardwareController.listHardwareConfigs);
storeHardwareRouter.put("/hardware/configs/:category", hardwareController.saveHardwareConfig);
storeHardwareRouter.post("/hardware/configs/:category/test", hardwareController.testHardwareConfig);
storeHardwareRouter.post("/hardware/cloud-speaker/announce", hardwareController.announceCloudSpeaker);
storeHardwareRouter.post("/hardware/box/pay", hardwareController.createBoxPay);
storeHardwareRouter.get("/hardware/box-config", hardwareController.getBoxConfig);
storeHardwareRouter.put("/hardware/box-config", hardwareController.saveBoxConfig);
storeHardwareRouter.post("/hardware/box-config/test", hardwareController.testBoxConfig);
storeHardwareRouter.post("/hardware/unionpay/test", hardwareController.testUnionpay);

export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeHardwareRouter,
  auth: "requireAuthWithTenant",
};
