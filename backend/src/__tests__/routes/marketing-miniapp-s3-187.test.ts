/**
 * S3-187 回归测试 · miniapp 营销「带参路径 + 身份/归属」（issue #289 的 A / C 两条）
 *
 * 防的是什么：
 *   ① 三条写端点此前**没有路径参数**（POST /coupons/claim、/flash-sales/grab、/group-buys/teams/join），
 *      而 controller 读 req.params.templateId / .id / .teamId ⇒ Number(undefined)=NaN ⇒ 业务层恒 404；
 *      契约 docs/API接口文档.md:2839/2852/2868 写的是**带参路径**，故本用例把
 *      「路径参数真的到得了服务层」锁死，并把已下线的老路径锁成 404（不许留"看起来能用"的入口）。
 *   ② GET /points/my 此前读不存在的 req.params.userId ⇒ 身份恒 NaN；改后身份取登录态。
 *   ③ 参数本身非法（非整数/非正数）必须在控制器被拦成 400，不允许 NaN 落到 SQL。
 *
 * 装配方式与生产一致（不另起一套夹具）：
 *   app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router)
 * 与 auto-routes.ts 的注册行逐字一致。被操作对象的**存在性/租户归属**由服务层判（`tenant_id = ?`
 * 且命中不到即 404），本用例用服务层抛 statusCode:404 的方式验证该 404 会原样透传到 HTTP。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { signToken } from "../../middleware/auth";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfig } from "../../routes/marketing-miniapp.routes";

const couponService = vi.hoisted(() => ({ claimCoupon: vi.fn() }));
const pointsService = vi.hoisted(() => ({ getUserPoints: vi.fn() }));
const flashSaleService = vi.hoisted(() => ({ buyFlashSale: vi.fn() }));
const groupBuyService = vi.hoisted(() => ({ joinGroupBuyTeam: vi.fn() }));

vi.mock("../../services/admin/marketing-coupon.service", () => couponService);
vi.mock("../../services/admin/marketing-points.service", () => pointsService);
vi.mock("../../services/admin/marketing-flash-sale.service", () => flashSaleService);
vi.mock("../../services/admin/marketing-group-buy.service", () => groupBuyService);

const USER_A = { id: 1, username: "A", roles: ["SUPER_ADMIN"], storeId: null, tenantId: "t1" };
const USER_B_ID = 4242;

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);

const authAndCsrf = () => ({
  Authorization: `Bearer ${signToken(USER_A as never)}`,
  "x-csrf-token": generateCsrfToken(USER_A.id),
});

beforeEach(() => {
  vi.clearAllMocks();
  couponService.claimCoupon.mockResolvedValue({ couponId: 1 });
  pointsService.getUserPoints.mockResolvedValue({ userId: USER_A.id, totalPoints: 0 });
  flashSaleService.buyFlashSale.mockResolvedValue({ orderNo: "FS1" });
  groupBuyService.joinGroupBuyTeam.mockResolvedValue({ teamId: 1 });
});

describe("S3-187 A · 契约带参路径：被操作对象真的到得了服务层", () => {
  it("POST /coupons/:templateId/claim ⇒ 服务层收到 templateId=7", async () => {
    const res = await request(app).post("/api/miniapp/marketing/coupons/7/claim").set(authAndCsrf()).send({});
    expect(res.status).toBe(200);
    expect(couponService.claimCoupon.mock.calls[0][0]).toBe(7);
    expect(couponService.claimCoupon.mock.calls[0][1]).toBe(USER_A.id);
    expect(couponService.claimCoupon.mock.calls[0][2]).toBe("t1");
  });

  it("POST /flash-sale/:id/buy ⇒ 服务层收到 id=9", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/flash-sale/9/buy")
      .set(authAndCsrf())
      .send({ quantity: 2 });
    expect(res.status).toBe(200);
    expect(flashSaleService.buyFlashSale.mock.calls[0][0]).toBe(9);
    expect(flashSaleService.buyFlashSale.mock.calls[0][1]).toBe(USER_A.id);
    expect(flashSaleService.buyFlashSale.mock.calls[0][2]).toBe(2);
  });

  it("POST /group-buy/:teamId/join ⇒ 服务层收到 teamId=11", async () => {
    const res = await request(app)
      .post("/api/miniapp/marketing/group-buy/11/join")
      .set(authAndCsrf())
      .send({ quantity: 1 });
    expect(res.status).toBe(200);
    expect(groupBuyService.joinGroupBuyTeam.mock.calls[0][0]).toBe(11);
    expect(groupBuyService.joinGroupBuyTeam.mock.calls[0][1]).toBe(USER_A.id);
  });

  it("老路径已下线 ⇒ 三条都是 404（不留「看起来能用、实际打不通」的入口）", async () => {
    const stale: Array<[string, string]> = [
      ["post", "/api/miniapp/marketing/coupons/claim"],
      ["post", "/api/miniapp/marketing/flash-sales/grab"],
      ["post", "/api/miniapp/marketing/group-buys/teams/join"],
    ];
    for (const [method, path] of stale) {
      const res = await (method === "post" ? request(app).post(path) : request(app).get(path))
        .set(authAndCsrf())
        .send({ quantity: 1 });
      expect(res.status, `${method.toUpperCase()} ${path} 应为 404（路由已下线）`).toBe(404);
    }
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
    expect(flashSaleService.buyFlashSale).not.toHaveBeenCalled();
    expect(groupBuyService.joinGroupBuyTeam).not.toHaveBeenCalled();
  });

  it("参数非法（非整数/非正数）⇒ 400，服务层未被调用（不让 NaN 落到 SQL）", async () => {
    const bad: Array<[string, string]> = [
      ["post", "/api/miniapp/marketing/coupons/abc/claim"],
      ["post", "/api/miniapp/marketing/flash-sale/0/buy"],
      ["post", "/api/miniapp/marketing/group-buy/-3/join"],
    ];
    for (const [method, path] of bad) {
      const res = await request(app).post(path).set(authAndCsrf()).send({ quantity: 1 });
      expect(res.status, `${path} 应判 400`).toBe(400);
    }
    expect(couponService.claimCoupon).not.toHaveBeenCalled();
    expect(flashSaleService.buyFlashSale).not.toHaveBeenCalled();
    expect(groupBuyService.joinGroupBuyTeam).not.toHaveBeenCalled();
  });

  it("被操作对象不属于本租户/不存在（服务层 404）⇒ HTTP 也是 404，且不是 500", async () => {
    couponService.claimCoupon.mockRejectedValueOnce(
      Object.assign(new Error("优惠券不存在或已过期"), { statusCode: 404 })
    );
    flashSaleService.buyFlashSale.mockRejectedValueOnce(
      Object.assign(new Error("秒杀活动不存在或已结束"), { statusCode: 404 })
    );
    groupBuyService.joinGroupBuyTeam.mockRejectedValueOnce(
      Object.assign(new Error("拼团组不存在或已结束"), { statusCode: 404 })
    );

    const claim = await request(app).post("/api/miniapp/marketing/coupons/77/claim").set(authAndCsrf()).send({});
    expect(claim.status).toBe(404);
    expect(couponService.claimCoupon.mock.calls[0][0]).toBe(77); // 传的是"别人的对象 id"，由服务层按租户判掉

    const buy = await request(app).post("/api/miniapp/marketing/flash-sale/77/buy").set(authAndCsrf()).send({ quantity: 1 });
    expect(buy.status).toBe(404);

    const join = await request(app).post("/api/miniapp/marketing/group-buy/77/join").set(authAndCsrf()).send({ quantity: 1 });
    expect(join.status).toBe(404);
  });
});

describe("S3-187 C · GET /points/my 的身份来自登录态", () => {
  it("无凭证 ⇒ 401，服务层未被调用", async () => {
    const res = await request(app).get("/api/miniapp/marketing/points/my");
    expect(res.status).toBe(401);
    expect(pointsService.getUserPoints).not.toHaveBeenCalled();
  });

  it("带登录态 ⇒ 服务层收到的 userId 是登录人（非 NaN），租户取自登录态", async () => {
    const res = await request(app).get("/api/miniapp/marketing/points/my").set("Authorization", `Bearer ${signToken(USER_A as never)}`);
    expect(res.status).toBe(200);
    expect(pointsService.getUserPoints).toHaveBeenCalledTimes(1);
    expect(pointsService.getUserPoints.mock.calls[0][0]).toBe(USER_A.id);
    expect(pointsService.getUserPoints.mock.calls[0][1]).toBe("t1");
  });

  it("query 声明他人 userId ⇒ 403，服务层未被调用", async () => {
    const res = await request(app)
      .get(`/api/miniapp/marketing/points/my?userId=${USER_B_ID}`)
      .set("Authorization", `Bearer ${signToken(USER_A as never)}`);
    expect(res.status).toBe(403);
    expect(pointsService.getUserPoints).not.toHaveBeenCalled();
  });
});
