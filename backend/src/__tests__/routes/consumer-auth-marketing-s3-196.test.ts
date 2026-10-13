/**
 * S3-196 · 消费者端身份/CSRF 端到端接线（老 miniapp 三处调用口径）
 *
 * 接线方式与生产逐字一致：`app.use(prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router)`
 * （auto-routes.ts），端点自带 requireConsumerAuthWithTenant + csrfMiddleware + bindSelfIdentity。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfig } from "../../routes/marketing-miniapp.routes";
import { env } from "../../shared/env";

const db = vi.hoisted(() => ({ queryOne: vi.fn(), query: vi.fn() }));
vi.mock("../../shared/db", () => ({ queryOne: db.queryOne, query: db.query }));

const couponService = vi.hoisted(() => ({
  claimCoupon: vi.fn(async () => ({ couponId: 1 })),
  listMyCoupons: vi.fn(async () => ({ total: 0, records: [] })),
  listAvailableCoupons: vi.fn(async () => ({ total: 0, records: [] })),
}));
vi.mock("../../services/admin/marketing-coupon.service", () => couponService);

const WX_USER_ID = 9001;
const MEMBER_ID = 4242;
const TENANT = "t-s196";

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);

const wxToken = () =>
  jwt.sign({ wxUserId: WX_USER_ID, openid: "openid-s196" }, env.JWT_SECRET, { expiresIn: "7d" });
/** 老端 app.request() 的真实头形：Bearer 微信令牌 + 登录响应下发的 x-csrf-token */
const clientHeaders = (csrf = generateCsrfToken(WX_USER_ID)) => ({
  Authorization: `Bearer ${wxToken()}`,
  "X-Tenant-Id": TENANT,
  "x-csrf-token": csrf,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.queryOne.mockResolvedValue({ id: MEMBER_ID, name: "张三", tenant_id: TENANT });
  db.query.mockResolvedValue([{ id: MEMBER_ID, name: "张三", tenant_id: TENANT }]);
});

describe("S3-196 · 老 miniapp 三处调用（微信令牌）", () => {
  it("GET /coupons/available（公开浏览面）⇒ 200，不需要身份", async () => {
    const res = await request(app).get("/api/miniapp/marketing/coupons/available");
    expect(res.status).toBe(200);
  });

  it("GET /coupons/my + 微信令牌 + CSRF ⇒ 200（身份取登录态=会员 id）", async () => {
    const res = await request(app).get("/api/miniapp/marketing/coupons/my").set(clientHeaders());
    expect(res.status).toBe(200);
    expect(couponService.listMyCoupons).toHaveBeenCalledWith(MEMBER_ID, 1, 20, TENANT, undefined);
  });

  it("POST /coupons/:templateId/claim + 微信令牌 + CSRF ⇒ 200（身份取登录态）", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set(clientHeaders())
      .send({});
    expect(res.status).toBe(200);
    expect(couponService.claimCoupon).toHaveBeenCalledWith(77, MEMBER_ID, TENANT);
  });

  it("客户端声明 userId（与登录态不一致）⇒ 403，服务层未被调用", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set(clientHeaders())
      .send({ userId: 999999 });
    expect(res.status).toBe(403);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("摘掉 x-csrf-token ⇒ 403，服务层未被调用（反测①）", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set({ Authorization: `Bearer ${wxToken()}`, "X-Tenant-Id": TENANT })
      .send({});
    expect(res.status).toBe(403);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("两源都缺但该微信唯一绑定一个租户会员 ⇒ 用绑定行的租户（老端无租户来源的既有现实）", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set({ Authorization: `Bearer ${wxToken()}`, "x-csrf-token": generateCsrfToken(WX_USER_ID) })
      .send({});
    expect(res.status).toBe(200);
    expect(couponService.claimCoupon).toHaveBeenCalledWith(77, MEMBER_ID, TENANT);
  });

  it("两源都缺且跨租户歧义（多命中）⇒ 401，服务层未被调用（不取第一条）", async () => {
    db.query.mockResolvedValue([
      { id: MEMBER_ID, name: "张三", tenant_id: "t-a" },
      { id: MEMBER_ID + 1, name: "李四", tenant_id: "t-b" },
    ]);
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set({ Authorization: `Bearer ${wxToken()}`, "x-csrf-token": generateCsrfToken(WX_USER_ID) })
      .send({});
    expect(res.status).toBe(401);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("微信未绑定会员 ⇒ 401，服务层未被调用（不伪造身份）", async () => {
    db.queryOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/77/claim")
      .set(clientHeaders())
      .send({});
    expect(res.status).toBe(401);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });
});
