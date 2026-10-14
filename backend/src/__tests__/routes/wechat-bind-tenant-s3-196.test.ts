/**
 * S3-196 · 微信 bind 的租户口径（凌舟裁定④：令牌 → X-Tenant-Id → 不伪造）
 *
 * 硬要求：两个租户来源都缺时**显式失败且不落库**。此前会带着空租户一路走到 service
 * （把"缺租户"误报成"账号不存在或已禁用"）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfig } from "../../routes/wechat.routes";
import { env } from "../../shared/env";

const wxService = vi.hoisted(() => ({
  login: vi.fn(),
  getSessionKey: vi.fn(),
  decryptPhone: vi.fn(),
  updateProfile: vi.fn(),
  getProfile: vi.fn(),
  bindUser: vi.fn(async () => ({ success: true, data: { bindingType: "CONSUMER" } })),
  unbindUser: vi.fn(),
}));
vi.mock("../../services/wechat.service", () => wxService);
vi.mock("../../shared/http-with-retry", () => ({ fetchWithRetry: vi.fn() }));

const WX_USER_ID = 9001;

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);

const wxHeaders = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${jwt.sign({ wxUserId: WX_USER_ID, openid: "openid-s196" }, env.JWT_SECRET, {
    expiresIn: "7d",
  })}`,
  "x-csrf-token": generateCsrfToken(WX_USER_ID),
  ...extra,
});

const bindBody = { username: "member01", password: "P@ssw0rd", bindingType: "CONSUMER" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S3-196 · POST /api/miniapp/wechat/auth/bind 的租户口径", () => {
  it("令牌与 X-Tenant-Id 都缺 ⇒ 400 显式失败，且 service 一次都没被调用（不落库，反测③）", async () => {
    const res = await request(app).post("/api/miniapp/wechat/auth/bind").set(wxHeaders()).send(bindBody);
    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("缺少租户信息");
    expect(wxService.bindUser).not.toHaveBeenCalled();
  });

  it("带 X-Tenant-Id ⇒ 按该租户绑定（service 收到租户）", async () => {
    const res = await request(app)
      .post("/api/miniapp/wechat/auth/bind")
      .set(wxHeaders({ "X-Tenant-Id": "t-abc" }))
      .send(bindBody);
    expect(res.status).toBe(200);
    expect(wxService.bindUser).toHaveBeenCalledWith(WX_USER_ID, bindBody, "t-abc");
  });

  it("租户写在令牌里 ⇒ 优先用令牌租户", async () => {
    const token = jwt.sign(
      { wxUserId: WX_USER_ID, openid: "openid-s196", tenantId: "t-token" },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const res = await request(app)
      .post("/api/miniapp/wechat/auth/bind")
      .set({
        Authorization: `Bearer ${token}`,
        "x-csrf-token": generateCsrfToken(WX_USER_ID),
        "X-Tenant-Id": "t-header",
      })
      .send(bindBody);
    expect(res.status).toBe(200);
    expect(wxService.bindUser).toHaveBeenCalledWith(WX_USER_ID, bindBody, "t-token");
  });
});
