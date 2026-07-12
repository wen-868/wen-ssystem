import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { sendSmsCode, registerMember } from "../controllers/admin/member-register.controller";

export const memberRegisterRouter = Router();

memberRegisterRouter.post("/sms-code", asyncHandler(sendSmsCode));
memberRegisterRouter.post("/register", asyncHandler(registerMember));

export const routeConfig: RouteConfig = {
  prefix: "/api/store/members",
  router: memberRegisterRouter,
  auth: "none"
};
