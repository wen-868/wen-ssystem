/**
 * S3-187 E 回归测试 · /api/miniapp/wechat 4 个写端点的 CSRF（已裁定方案 A）
 *
 * 防的是什么（假安全）：wechat.routes.ts 的 4 个写端点只经 requireWxAuth，而该中间件
 * 原先**只设 req.wxUser、不设 req.user**；csrfMiddleware 在 `!req.user` 时直接放行
 * （middleware/csrf.ts:39-42）⇒ 直接挂 CSRF 也拦不住任何请求。
 * 现按方案 A：requireWxAuth 校验通过后补 req.user（最小可用形状，id = 微信用户 id）
 * 与 req.tenantId，再给 4 个写端点挂 csrfMiddleware（认证在前）。
 *
 * 反测（执行会话内实测，见回传卡 §三）：把 requireWxAuth 里 `req.user = {...}` 那几行
 * 临时去掉 ⇒ 本文件的"缺 CSRF ⇒ 403"用例变红（缺 CSRF 的请求直接 200 打到业务层），
 * 复原后全绿 —— 证明这条判据真的有分辨力，而不是恒绿。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";

// wechat-auth 依赖 http-with-retry → logger，测试环境 mock 避免 pino 初始化依赖真实 env
vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ctrl = vi.hoisted(() => {
  const seen: any[] = [];
  const reply = (handler: string) => vi.fn((req: unknown, res: any) => {
    seen.push({ handler, req });
    res.json({ code: "0", msg: "成功", data: { handler } });
  });
  return {
    seen,
    login: reply("login"),
    decryptPhone: reply("decryptPhone"),
    updateProfile: reply("updateProfile"),
    getProfile: reply("getProfile"),
    bind: reply("bind"),
    unbind: reply("unbind"),
  };
});

vi.mock("../../controllers/admin/wechat.controller", () => ({
  createWechatController: () => ctrl,
}));

import { wechatRouter, routeConfig } from "../../routes/wechat.routes";
import { signWxToken } from "../../middleware/wechat-auth";

const WX_USER_ID = 33;
const wxAuth = () => ({ Authorization: `Bearer ${signWxToken(WX_USER_ID, "openid-x")}` });
const wxAuthAndCsrf = () => ({ ...wxAuth(), "x-csrf-token": generateCsrfToken(WX_USER_ID) });

// 与生产逐字一致：auth:"none" ⇒ getAuthMiddlewares 返回空数组，认证与 CSRF 全在端点行内挂
expect(getAuthMiddlewares(routeConfig.auth)).toEqual([]);

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), wechatRouter);

beforeEach(() => {
  vi.clearAllMocks();
  ctrl.seen.length = 0;
});

describe("S3-187 E · wechat 写端点：认证 → CSRF 两侧", () => {
  it("无凭证 ⇒ 401（认证仍在前），controller 未被调用", async () => {
    const res = await request(app).post("/api/miniapp/wechat/auth/decrypt-phone").send({ encryptedData: "x", iv: "y" });
    expect(res.status).toBe(401);
    expect(ctrl.decryptPhone).not.toHaveBeenCalled();
  });

  it("令牌无效 ⇒ 401", async () => {
    const res = await request(app)
      .post("/api/miniapp/wechat/auth/bind")
      .set({ Authorization: "Bearer not-a-token" })
      .send({ username: "u", password: "p", bindingType: "CONSUMER" });
    expect(res.status).toBe(401);
    expect(ctrl.bind).not.toHaveBeenCalled();
  });

  it("4 个写端点：有微信令牌、缺 x-csrf-token ⇒ 403，controller 未被调用（这就是原先「假安全」漏掉的一侧）", async () => {
    const cases: Array<[string, string, any, any]> = [
      ["post", "/api/miniapp/wechat/auth/decrypt-phone", { encryptedData: "x", iv: "y" }, ctrl.decryptPhone],
      ["put", "/api/miniapp/wechat/auth/profile", { nickname: "n" }, ctrl.updateProfile],
      ["post", "/api/miniapp/wechat/auth/bind", { username: "u", password: "p", bindingType: "CONSUMER" }, ctrl.bind],
      ["post", "/api/miniapp/wechat/auth/unbind", { systemUserId: 1 }, ctrl.unbind],
    ];
    for (const [method, path, body, handler] of cases) {
      const req = method === "put" ? request(app).put(path) : request(app).post(path);
      const res = await req.set(wxAuth()).send(body);
      expect(res.status, `${method.toUpperCase()} ${path} 缺 CSRF 应 403`).toBe(403);
      expect(res.body.msg).toContain("CSRF");
      expect(handler, `${path} 不应打到业务层`).not.toHaveBeenCalled();
    }
  });

  it("4 个写端点：有令牌 + 正确 x-csrf-token ⇒ 200 落到业务层", async () => {
    const cases: Array<[string, string, any, any]> = [
      ["post", "/api/miniapp/wechat/auth/decrypt-phone", { encryptedData: "x", iv: "y" }, ctrl.decryptPhone],
      ["put", "/api/miniapp/wechat/auth/profile", { nickname: "n" }, ctrl.updateProfile],
      ["post", "/api/miniapp/wechat/auth/bind", { username: "u", password: "p", bindingType: "CONSUMER" }, ctrl.bind],
      ["post", "/api/miniapp/wechat/auth/unbind", { systemUserId: 1 }, ctrl.unbind],
    ];
    for (const [method, path, body, handler] of cases) {
      const req = method === "put" ? request(app).put(path) : request(app).post(path);
      const res = await req.set(wxAuthAndCsrf()).send(body);
      expect(res.status, `${method.toUpperCase()} ${path} 带 CSRF 应放行`).toBe(200);
      expect(handler, `${path} 应调用到 controller`).toHaveBeenCalledTimes(1);
    }
  });

  it("安全方法（GET /auth/profile）不受 CSRF 影响", async () => {
    const res = await request(app).get("/api/miniapp/wechat/auth/profile").set(wxAuth());
    expect(res.status).toBe(200);
    expect(ctrl.getProfile).toHaveBeenCalledTimes(1);
  });

  it("req.user 的 CSRF 绑定对象是微信用户 id（令牌口径 = HMAC(wxUserId)）", async () => {
    // 用别的 id 生成的 CSRF 令牌必须被拒 ⇒ 证明校验用的是 req.user.id，而不是"有头就放行"
    const res = await request(app)
      .post("/api/miniapp/wechat/auth/unbind")
      .set({ ...wxAuth(), "x-csrf-token": generateCsrfToken(WX_USER_ID + 1) })
      .send({ systemUserId: 1 });
    expect(res.status).toBe(403);
    expect(ctrl.unbind).not.toHaveBeenCalled();
  });

  it("方案 A 的登录态补全：req.user 最小形状 + req.tenantId（来源 X-Tenant-Id，缺省不伪造）", async () => {
    const withHeader = await request(app)
      .post("/api/miniapp/wechat/auth/unbind")
      .set({ ...wxAuthAndCsrf(), "x-tenant-id": "t1" })
      .send({ systemUserId: 1 });
    expect(withHeader.status).toBe(200);
    const seen = ctrl.seen[ctrl.seen.length - 1].req as any;
    expect(seen.wxUser).toEqual({ id: WX_USER_ID, openid: "openid-x" });
    expect(seen.user.id).toBe(WX_USER_ID);
    expect(seen.user.roles).toEqual([]);
    expect(seen.user.tenantId).toBe("t1");
    expect(seen.tenantId).toBe("t1");

    // 既无令牌内 tenantId、也无 X-Tenant-Id ⇒ 保持未设置（不伪造租户），需要租户的操作按既有口径失败
    ctrl.seen.length = 0;
    const withoutHeader = await request(app)
      .post("/api/miniapp/wechat/auth/unbind")
      .set(wxAuthAndCsrf())
      .send({ systemUserId: 1 });
    expect(withoutHeader.status).toBe(200);
    const seen2 = ctrl.seen[ctrl.seen.length - 1].req as any;
    expect(seen2.tenantId).toBeUndefined();
    expect(seen2.user.tenantId).toBe("");
    expect(seen2.user.id).toBe(WX_USER_ID);
  });
});
