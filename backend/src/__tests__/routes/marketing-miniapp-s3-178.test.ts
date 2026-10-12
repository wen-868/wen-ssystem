/**
 * S3-178 #1 回归测试 · /api/miniapp/marketing 的登录态身份绑定
 *
 * 防的是什么：本文件此前 routeConfig.auth="none" 且 4 个写端点零鉴权，
 * 身份由客户端字段（req.body.userId / req.query.userId）决定 ⇒ 可冒充任意用户越权写/读。
 *
 * 判据（与派单卡 §二.1 / §四.1 同口径）：
 *  ① 无凭证 ⇒ 401，且服务层链路上一次都没被调用；
 *  ② 凭证只属于 A，body/query 却声明 userId=B ⇒ 403，服务层未被调用（B 的数据无变化）；
 *  ③ 身份一律取登录态 ⇒ 服务层收到的 userId 恒为 A（无论客户端是否声明 userId）；
 *  ④ 公开浏览面（营销内容 GET）不受影响，仍 200。
 *
 * 实现口径：直接按生产接线装配 ——
 *   app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router)
 * 与 auto-routes.ts:171-172 逐字一致，避免"测试夹具另起一套接线"造成的失真。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { signToken } from "../../middleware/auth";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfig } from "../../routes/marketing-miniapp.routes";

const couponService = vi.hoisted(() => ({
  claimCoupon: vi.fn(async () => ({ couponId: 1 })),
  listMyCoupons: vi.fn(async () => ({ total: 0, records: [] })),
  listAvailableCoupons: vi.fn(async () => ({ total: 0, records: [] })),
}));
const pointsService = vi.hoisted(() => ({
  listMyPointsRecords: vi.fn(async () => ({ total: 0, records: [] })),
  getUserPoints: vi.fn(async () => ({ totalPoints: 0 })),
}));
const flashSaleService = vi.hoisted(() => ({
  buyFlashSale: vi.fn(async () => ({ orderNo: "FS1" })),
  listActiveFlashSales: vi.fn(async () => []),
}));
const groupBuyService = vi.hoisted(() => ({
  joinGroupBuyTeam: vi.fn(async () => ({ teamId: 1 })),
  listActiveGroupBuys: vi.fn(async () => []),
  getGroupBuyTeam: vi.fn(async () => ({ teamId: 1 })),
}));
const fullReductionService = vi.hoisted(() => ({ listFullReductions: vi.fn(async () => []) }));
const calculationService = vi.hoisted(() => ({ calculatePromotion: vi.fn(async () => ({ payable: 0 })) }));

vi.mock("../../services/admin/marketing-coupon.service", () => couponService);
vi.mock("../../services/admin/marketing-points.service", () => pointsService);
vi.mock("../../services/admin/marketing-flash-sale.service", () => flashSaleService);
vi.mock("../../services/admin/marketing-group-buy.service", () => groupBuyService);
vi.mock("../../services/admin/marketing-full-reduction.service", () => fullReductionService);
vi.mock("../../services/admin/marketing-calculation.service", () => calculationService);

const USER_A = { id: 1, username: "A", roles: ["SUPER_ADMIN"], storeId: null, tenantId: "t1" };
const USER_B_ID = 4242;

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);

const tokenA = () => signToken(USER_A as never);
const csrfA = () => generateCsrfToken(USER_A.id);
const authOnly = () => ({ Authorization: `Bearer ${tokenA()}` });
const authAndCsrf = () => ({ Authorization: `Bearer ${tokenA()}`, "x-csrf-token": csrfA() });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S3-178 #1 · POST /coupons/claim 的身份来自登录态", () => {
  it("无凭证 ⇒ 401，且服务层未被调用", async () => {
    const res = await request(app).post("/api/miniapp/marketing/coupons/claim").send({ templateId: 1, userId: USER_B_ID });
    expect(res.status).toBe(401);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("A 的凭证 + 无 CSRF 头 ⇒ 403（CSRF 门禁生效），服务层未被调用", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/claim")
      .set(authOnly())
      .send({ templateId: 1, userId: USER_A.id });
    expect(res.status).toBe(403);
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("A 的凭证 + body 声明 userId=B ⇒ 403，服务层未被调用（B 的数据无变化）", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/claim")
      .set(authAndCsrf())
      .send({ templateId: 1, userId: USER_B_ID });
    expect(res.status).toBe(403);
    expect(res.body.msg).toContain("身份");
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
  });

  it("A 的凭证 + body 声明 userId=A ⇒ 200，服务层收到的 userId 是 A", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/claim")
      .set(authAndCsrf())
      .send({ templateId: 1, userId: USER_A.id });
    expect(res.status).toBe(200);
    expect(couponService.claimCoupon).toHaveBeenCalledTimes(1);
    const call = couponService.claimCoupon.mock.calls[0];
    expect(call[1]).toBe(USER_A.id);
    expect(call[2]).toBe("t1");
  });

  it("A 的凭证 + 完全不传 userId ⇒ 200，身份仍取自登录态", async () => {
    const res = await request(app).post("/api/miniapp/marketing/coupons/claim").set(authAndCsrf()).send({ templateId: 1 });
    expect(res.status).toBe(200);
    expect(couponService.claimCoupon.mock.calls[0][1]).toBe(USER_A.id);
  });

  it("（越权反例·红证据口径）服务层永远收不到客户端声明的 userId=B", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/coupons/claim")
      .set(authAndCsrf())
      .send({ templateId: 1, userId: USER_B_ID });
    const seenUserIds = couponService.claimCoupon.mock.calls.map((c) => c[1]);
    // 先断言身份流向（越权反例的红点就落在这里：出现 4242 即为写进 B）
    expect(seenUserIds, "服务层收到的 userId 列表（出现 4242 即为越权写进 B）").toEqual([]);
    expect(res.status).toBe(403);
  });
});

describe("S3-178 #1 · GET /coupons/my 的身份来自登录态", () => {
  it("无凭证 ⇒ 401", async () => {
    const res = await request(app).get("/api/miniapp/marketing/coupons/my?userId=4242");
    expect(res.status).toBe(401);
    expect(couponService.listMyCoupons).not.toHaveBeenCalled();
  });

  it("A 的凭证 + query.userId=B ⇒ 403", async () => {
    const res = await request(app).get(`/api/miniapp/marketing/coupons/my?userId=${USER_B_ID}`).set(authOnly());
    expect(res.status).toBe(403);
    expect(couponService.listMyCoupons).not.toHaveBeenCalled();
  });

  it("query.userId 与登录态一致（或省略）时才放行，且服务层收到 A", async () => {
    const okRes = await request(app).get(`/api/miniapp/marketing/coupons/my?userId=${USER_A.id}`).set(authOnly());
    expect(okRes.status).toBe(200);
    expect(couponService.listMyCoupons.mock.calls[0][0]).toBe(USER_A.id);

    vi.clearAllMocks();
    const noQueryRes = await request(app).get("/api/miniapp/marketing/coupons/my").set(authOnly());
    expect(noQueryRes.status).toBe(200);
    expect(couponService.listMyCoupons.mock.calls[0][0]).toBe(USER_A.id);
  });
});

describe("S3-178 #1 · GET /points/my-records 的身份来自登录态", () => {
  it("无凭证 ⇒ 401", async () => {
    const res = await request(app).get("/api/miniapp/marketing/points/my-records?userId=4242");
    expect(res.status).toBe(401);
    expect(pointsService.listMyPointsRecords).not.toHaveBeenCalled();
  });

  it("A 的凭证 + query.userId=B ⇒ 403；query.userId=A 或省略 ⇒ 服务层收到 A", async () => {
    const bad = await request(app).get(`/api/miniapp/marketing/points/my-records?userId=${USER_B_ID}`).set(authOnly());
    expect(bad.status).toBe(403);
    expect(pointsService.listMyPointsRecords).not.toHaveBeenCalled();

    const good = await request(app).get("/api/miniapp/marketing/points/my-records").set(authOnly());
    expect(good.status).toBe(200);
    expect(pointsService.listMyPointsRecords.mock.calls[0][0]).toBe(USER_A.id);
  });
});

describe("S3-178 #1 · POST /flash-sales/grab 与 /group-buys/teams/join", () => {
  it("无凭证 ⇒ 401，服务层未被调用", async () => {
    const grab = await request(app).post("/api/miniapp/marketing/flash-sales/grab").send({ userId: USER_B_ID, quantity: 1 });
    expect(grab.status).toBe(401);
    expect(flashSaleService.buyFlashSale).not.toHaveBeenCalled();

    const join = await request(app).post("/api/miniapp/marketing/group-buys/teams/join").send({ userId: USER_B_ID, quantity: 1 });
    expect(join.status).toBe(401);
    expect(groupBuyService.joinGroupBuyTeam).not.toHaveBeenCalled();
  });

  it("A 的凭证 + body 声明 userId=B ⇒ 403（两侧都不落库）", async () => {
    const grab = await request(app).post("/api/miniapp/marketing/flash-sales/grab").set(authAndCsrf()).send({ userId: USER_B_ID, quantity: 1 });
    expect(grab.status).toBe(403);
    expect(flashSaleService.buyFlashSale).not.toHaveBeenCalled();

    const join = await request(app).post("/api/miniapp/marketing/group-buys/teams/join").set(authAndCsrf()).send({ userId: USER_B_ID, quantity: 1 });
    expect(join.status).toBe(403);
    expect(groupBuyService.joinGroupBuyTeam).not.toHaveBeenCalled();
  });

  it("body.userId 与登录态一致时放行，服务层收到 A", async () => {
    const grab = await request(app).post("/api/miniapp/marketing/flash-sales/grab").set(authAndCsrf()).send({ userId: USER_A.id, quantity: 2 });
    expect(grab.status).toBe(200);
    expect(flashSaleService.buyFlashSale.mock.calls[0][1]).toBe(USER_A.id);

    const join = await request(app).post("/api/miniapp/marketing/group-buys/teams/join").set(authAndCsrf()).send({ userId: USER_A.id, quantity: 1 });
    expect(join.status).toBe(200);
    expect(groupBuyService.joinGroupBuyTeam.mock.calls[0][1]).toBe(USER_A.id);
  });
});

describe("S3-178 #1 · POST /calculate（纯试算，无身份）也要认证 + CSRF", () => {
  it("无凭证 ⇒ 401；A 的凭证 + CSRF ⇒ 非 401（走到业务层）", async () => {
    const anon = await request(app).post("/api/miniapp/marketing/calculate").send({ items: [] });
    expect(anon.status).toBe(401);
    expect(calculationService.calculatePromotion).not.toHaveBeenCalled();

    const authed = await request(app)
      .post("/api/miniapp/marketing/calculate")
      .set(authAndCsrf())
      .send({ items: [{ skuId: 1, productId: 1, quantity: 1, unitPrice: 10 }] });
    expect(authed.status).not.toBe(401);
    expect(authed.status).not.toBe(403);
  });
});

describe("S3-178 #1 · 公开浏览面未被误伤", () => {
  it("营销内容 GET 无凭证仍 200", async () => {
    for (const path of [
      "/api/miniapp/marketing/coupons/available",
      "/api/miniapp/marketing/full-reductions/active",
      "/api/miniapp/marketing/full-reductions/available",
      "/api/miniapp/marketing/flash-sales/active",
      "/api/miniapp/marketing/group-buys/active",
      "/api/miniapp/marketing/group-buys/teams/1",
    ]) {
      const res = await request(app).get(path);
      expect(res.status, `${path} 应保持公开`).toBe(200);
    }
  });
});
