import { Router } from "express";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { trackRequest, getMonitorStats } from "../controllers/platform/platform-monitor.controller";

export const platformMonitorRouter = Router();

platformMonitorRouter.use((_req, _res, next) => {
  trackRequest();
  next();
});

platformMonitorRouter.get("/", requirePlatformAuth, asyncHandler(getMonitorStats));
