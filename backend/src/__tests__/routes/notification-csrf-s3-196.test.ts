/**
 * S3-196 · miniapp 通知端点的 CSRF 真覆盖（收口总清单第 58 项）
 *
 * 背景：这两个写端点此前是 `R2_EXEMPT` 里唯一的豁免（"客户端拿不到 CSRF 令牌"）。
 * 现在客户端统一走 app.request 携带 x-csrf-token ⇒ 豁免删除、端点补 csrfMiddleware。
 * 判据：无 CSRF ⇒ 403 且服务层未被调用；带 CSRF ⇒ 200 且身份取登录态（会员 id）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateCsrfToken } from "../../middleware/csrf";
import { getAuthMiddlewares } from "../../shared/auto-routes";
import { routeConfigs } from "../../routes/notification.routes";
import { env } from "../../shared/env";

const db = vi.hoisted(() => ({ queryOne: vi.fn(), query: vi.fn() }));
vi.mock("../../shared/db", () => ({ queryOne: db.queryOne, query: db.query }));

const notifService = vi.hoisted(() => ({
  listMyNotifications: vi.fn(async () => ({ total: 0, records: [] })),
  getMyUnreadCount: vi.fn(async () => ({ count: 0 })),
  markMyRead: vi.fn(async () => true),
  markMyAllRead: vi.fn(async () => 1),
}));
vi.mock("../../services/admin/notification.service", () => ({
  sendNotification: vi.fn(),
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
  getNotificationById: vi.fn(),
  deleteNotification: vi.fn(),
  batchDeleteNotifications: vi.fn(),
  ...notifService,
}));

const WX_USER_ID = 9001;
const MEMBER_ID = 4242;
const TENANT = "t-s196";

const miniappConfig = routeConfigs.find((c) => c.prefix === "/api/miniapp/notifications")!;
const app = express();
app.use(express.json());
app.use(miniappConfig.prefix, ...getAuthMiddlewares(miniappConfig.auth), miniappConfig.router);

const clientHeaders = (csrf: string | null = generateCsrfToken(WX_USER_ID)) => ({
  Authorization: `Bearer ${jwt.sign({ wxUserId: WX_USER_ID, openid: "openid-s196" }, env.JWT_SECRET, {
    expiresIn: "7d",
  })}`,
  "X-Tenant-Id": TENANT,
  ...(csrf ? { "x-csrf-token": csrf } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.queryOne.mockResolvedValue({ id: MEMBER_ID, name: "张三", tenant_id: TENANT });
  db.query.mockResolvedValue([{ id: MEMBER_ID, name: "张三", tenant_id: TENANT }]);
});

describe("S3-196 · miniapp 通知写端点（豁免已删，靠真覆盖）", () => {
  it("PUT /:id/read + 微信令牌 + CSRF ⇒ 200，身份取登录态", async () => {
    const res = await request(app).put("/api/miniapp/notifications/11/read").set(clientHeaders());
    expect(res.status).toBe(200);
    expect(notifService.markMyRead).toHaveBeenCalledWith(TENANT, 11);
  });

  it("PUT /:id/read 摘掉 x-csrf-token ⇒ 403，服务层未被调用（反测①：老端裸 wx.request 的现场）", async () => {
    const res = await request(app).put("/api/miniapp/notifications/11/read").set(clientHeaders(null));
    expect(res.status).toBe(403);
    expect(notifService.markMyRead).not.toHaveBeenCalled();
  });

  it("POST /read-all + 微信令牌 + CSRF ⇒ 200", async () => {
    const res = await request(app).post("/api/miniapp/notifications/read-all").set(clientHeaders());
    expect(res.status).toBe(200);
    expect(notifService.markMyAllRead).toHaveBeenCalledWith(TENANT, MEMBER_ID);
  });

  it("POST /read-all 摘掉 x-csrf-token ⇒ 403，服务层未被调用", async () => {
    const res = await request(app).post("/api/miniapp/notifications/read-all").set(clientHeaders(null));
    expect(res.status).toBe(403);
    expect(notifService.markMyAllRead).not.toHaveBeenCalled();
  });

  it("读端点 GET / ⇒ 不受 CSRF 影响（安全方法），身份取登录态", async () => {
    const res = await request(app).get("/api/miniapp/notifications").set(clientHeaders(null));
    expect(res.status).toBe(200);
    expect(notifService.listMyNotifications).toHaveBeenCalledWith(TENANT, MEMBER_ID, 1, 20);
  });
});
