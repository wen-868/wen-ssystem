/**
 * S3-178 #2 回归测试 · /api/store/instant-retail 写端点的 CSRF
 *
 * 防的是什么：instant-retail-store.routes.ts 的 4 个写端点只经 L9 的 requireStoreAuth
 * （= [...requireAuthWithTenant, 门店校验]）鉴权，**没有 csrfMiddleware** ⇒ 有认证无 CSRF。
 *
 * 为什么必须**单独挂这个 router** 做判据（重要）：
 *   整机装配下，凡以根前缀 `{ prefix: "/api/store", auth: "requireAuthWithTenant" }` 注册的文件
 *   （如 store.routes.ts 等 store-*.routes.ts）其声明式挂载的 requireAuthWithTenant + csrfMiddleware
 *   会先跑，把 /api/store/** 的 POST 拦成"没带 x-csrf-token ⇒ 403"——**运行期看起来"有 CSRF"，
 *   实为该前缀被同前缀的另一个文件顺手覆盖**。若只用整机 HTTP 取证，改前/改后都是 403，
 *   根本分不出本文件是否挂了 CSRF。（S3-187 B 已把 commerce-fix.routes.ts 从根前缀收窄到
 *   /api/store/coupons；同前缀的 store-*.routes.ts 仍属该形态，本判据继续单独挂载。）
 *   故本用例按"本文件单独挂载"取证，直接锁定文件自身的挂载链。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { signToken } from "../../middleware/auth";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfig } from "../../routes/instant-retail-store.routes";

const orderReceivingController = vi.hoisted(() => ({
  listOrders: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: { total: 0, records: [] } })),
  getOrderDetail: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: {} })),
  confirmOrder: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: { handler: "confirmOrder" } })),
  cancelOrder: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: { handler: "cancelOrder" } })),
}));
const fulfillmentController = vi.hoisted(() => ({
  startDelivery: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: { handler: "startDelivery" } })),
  completeDelivery: vi.fn((_req: unknown, res: any) => res.json({ code: "0", msg: "成功", data: { handler: "completeDelivery" } })),
}));

vi.mock("../../controllers/instant-retail/order-receiving.controller", () => orderReceivingController);
vi.mock("../../controllers/instant-retail/fulfillment.controller", () => fulfillmentController);

const STORE_USER = { id: 2, username: "store_manager", roles: ["SUPER_ADMIN"], storeId: 1, tenantId: "t1" };

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);

const authOnly = () => ({ Authorization: `Bearer ${signToken(STORE_USER as never)}` });
const authAndCsrf = () => ({ Authorization: `Bearer ${signToken(STORE_USER as never)}`, "x-csrf-token": generateCsrfToken(STORE_USER.id) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("S3-178 #2 · /api/store/instant-retail 写端点 CSRF 两侧", () => {
  it("无凭证 ⇒ 401（认证仍在前）", async () => {
    const res = await request(app).post("/api/store/instant-retail/orders/PLAT-1/confirm").send({});
    expect(res.status).toBe(401);
    expect(orderReceivingController.confirmOrder).not.toHaveBeenCalled();
  });

  it("有凭证、无 x-csrf-token ⇒ 403（CSRF token 无效或缺失），业务层未被调用", async () => {
    const res = await request(app).post("/api/store/instant-retail/orders/PLAT-1/confirm").set(authOnly()).send({});
    expect(res.status).toBe(403);
    expect(res.body.msg).toContain("CSRF");
    expect(orderReceivingController.confirmOrder).not.toHaveBeenCalled();
  });

  it("有凭证 + x-csrf-token ⇒ 非 403（走到业务层），4 个写端点逐条验证", async () => {
    const cases: Array<[string, any]> = [
      ["/api/store/instant-retail/orders/PLAT-1/confirm", orderReceivingController.confirmOrder],
      ["/api/store/instant-retail/orders/PLAT-1/cancel", orderReceivingController.cancelOrder],
      ["/api/store/instant-retail/orders/PLAT-1/start-delivery", fulfillmentController.startDelivery],
      ["/api/store/instant-retail/orders/PLAT-1/complete-delivery", fulfillmentController.completeDelivery],
    ];
    for (const [path, handler] of cases) {
      const res = await request(app).post(path).set(authAndCsrf()).send({});
      expect(res.status, `${path} 带 CSRF 应放行到业务层`).toBe(200);
      expect(handler, `${path} 应调用到 controller`).toHaveBeenCalledTimes(1);
    }
  });

  it("安全方法（GET）不受 CSRF 影响", async () => {
    const list = await request(app).get("/api/store/instant-retail/orders").set(authOnly());
    expect(list.status).toBe(200);
    expect(orderReceivingController.listOrders).toHaveBeenCalledTimes(1);

    const detail = await request(app).get("/api/store/instant-retail/orders/PLAT-1").set(authOnly());
    expect(detail.status).toBe(200);
    expect(orderReceivingController.getOrderDetail).toHaveBeenCalledTimes(1);
  });

  it("无凭证时即便带上 CSRF 头也仍 401（CSRF 不替代认证）", async () => {
    const res = await request(app)
      .post("/api/store/instant-retail/orders/PLAT-1/confirm")
      .set({ "x-csrf-token": generateCsrfToken(STORE_USER.id) })
      .send({});
    expect(res.status).toBe(401);
    expect(orderReceivingController.confirmOrder).not.toHaveBeenCalled();
  });
});
