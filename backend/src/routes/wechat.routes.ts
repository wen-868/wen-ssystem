import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { createWechatController } from "../controllers/wechat.controller";
import { requireWxAuth, code2Session, aesDecrypt, signWxToken } from "../middleware/wechat-auth";

export const wechatRouter = Router();

declare global {
  namespace Express {
    interface Request {
      wxUser?: {
        id: number;
        openid: string;
      };
    }
  }
}

const ctrl = createWechatController(code2Session, aesDecrypt, signWxToken);

wechatRouter.post("/auth/login", ctrl.login);
wechatRouter.post("/auth/decrypt-phone", requireWxAuth, ctrl.decryptPhone);
wechatRouter.put("/auth/profile", requireWxAuth, ctrl.updateProfile);
wechatRouter.get("/auth/profile", requireWxAuth, ctrl.getProfile);
wechatRouter.post("/auth/bind", requireWxAuth, ctrl.bind);
wechatRouter.post("/auth/unbind", requireWxAuth, ctrl.unbind);

export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/wechat",
  router: wechatRouter,
  auth: "none",
};
