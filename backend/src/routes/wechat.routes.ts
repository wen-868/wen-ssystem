import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { createWechatController } from "../controllers/admin/wechat.controller";
import { requireWxAuth, code2Session, aesDecrypt, signWxToken } from "../middleware/wechat-auth";
import { csrfMiddleware } from "../middleware/csrf";

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
// S3-187 E：4 个写端点补 csrfMiddleware（**认证在前**——requireWxAuth 已按方案 A 设 req.user，
// csrfMiddleware 才真正参与校验；此前只设 req.wxUser ⇒ CSRF 直接放行，等于没挂）。
// GET /auth/profile 是安全方法，csrfMiddleware 本身会放行，故无需挂载。
wechatRouter.post("/auth/decrypt-phone", requireWxAuth, csrfMiddleware, ctrl.decryptPhone);
wechatRouter.put("/auth/profile", requireWxAuth, csrfMiddleware, ctrl.updateProfile);
wechatRouter.get("/auth/profile", requireWxAuth, ctrl.getProfile);
wechatRouter.post("/auth/bind", requireWxAuth, csrfMiddleware, ctrl.bind);
wechatRouter.post("/auth/unbind", requireWxAuth, csrfMiddleware, ctrl.unbind);

export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/wechat",
  router: wechatRouter,
  auth: "none",
};
