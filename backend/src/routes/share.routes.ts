import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { getCollectionLink, getCollectionPage, payCollection, wxNotifyCollection } from "../controllers/share.controller";

export const shareRouter = Router();

shareRouter.get("/collections/:token", asyncHandler(getCollectionLink));
shareRouter.get("/collections/:token/page", asyncHandler(getCollectionPage));
shareRouter.post("/collections/:token/pay", asyncHandler(payCollection));
shareRouter.post("/collections/:token/wx-notify", asyncHandler(wxNotifyCollection));

export const routeConfig: RouteConfig = {
  prefix: "/api/share",
  router: shareRouter,
  auth: "none",
};
