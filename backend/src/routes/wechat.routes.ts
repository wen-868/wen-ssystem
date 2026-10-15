import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RouteConfig } from "../shared/auto-routes";
import { createWechatController } from "../controllers/admin/wechat.controller";
import { requireWxAuth, code2Session, aesDecrypt, signWxToken } from "../middleware/wechat-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { AUTHED_ROUTE_LIMIT } from "../config/rate-limit";

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
//
// S3-208（总清单第 57 项）：下面 5 条 `requireWxAuth` 路由是 CodeQL `js/missing-rate-limiting`
// 在 PR #297 上报的 11 条 high 中的 6 条（check-run 115404340298 注解：本文件 26/27/28/29/30 行，
// 其中 26 行 2 条）。按 S3-112 的结论，`rateLimit(...)` 必须**内联在注册点**（参数取自
// `config/rate-limit.ts`）；包成 helper 会让 CodeQL 识别不到限流。限流在最前，未鉴权的洪水请求
// 也计入 IP 计数。`/auth/login`（第 22 行）**故意不加**：属登录路由，按业主口径不限流（见回执 §五）。
wechatRouter.post("/auth/decrypt-phone", rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, csrfMiddleware, ctrl.decryptPhone);
wechatRouter.put("/auth/profile", rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, csrfMiddleware, ctrl.updateProfile);
wechatRouter.get("/auth/profile", rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, ctrl.getProfile);
wechatRouter.post("/auth/bind", rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, csrfMiddleware, ctrl.bind);
wechatRouter.post("/auth/unbind", rateLimit(AUTHED_ROUTE_LIMIT), requireWxAuth, csrfMiddleware, ctrl.unbind);

export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp/wechat",
  router: wechatRouter,
  auth: "none",
};
