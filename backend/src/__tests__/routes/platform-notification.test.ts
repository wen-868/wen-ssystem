/**
 * C6-2-T1：平台通知 3 条端点的路由级测试（前缀 / 方法 / 路径钉死 / 鉴权 / zod 400 / 业务码）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md 交付物②③、验收标准③⑤
 * 范式：src/__tests__/routes/platform-ticket.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡交付物②——路径由卡钉死，本文件逐条断言（含"只准 3 条、不得自拟/增减"）。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，踩坑 [118]），用例只写好，执行由凌舟在本机跑；
 * 本单另有 B 级行为 harness（docs/evidence/C6-2-T1）用真实 express + supertest 等价实跑。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("../../services/platform/platform-notification.service", () => ({
  PLATFORM_NOTIFICATION_PERMISSIONS: {
    view: "notification:view",
    read: "notification:read",
  },
  PLATFORM_NOTIFICATION_LEVELS: ["INFO", "WARN", "URGENT"],
  listNotifications: mocks.listNotifications,
  markNotificationRead: mocks.markNotificationRead,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

import { AppError } from "../../shared/app-error";
import { routeConfigs, platformNotificationRouter } from "../../routes/platform-notification.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const notificationConfig = routeConfigs.find((c) => c.prefix === "/api/platform/notifications")!;
const app = createTestApp({ prefix: notificationConfig.prefix, router: notificationConfig.router });

/** 身份缺失（令牌无 id 的异常情形）：用于断言"不静默造管理员 ID" */
const noIdentityApp = createTestApp({
  prefix: notificationConfig.prefix,
  router: notificationConfig.router,
  mockUser: { id: 0, username: "broken-token" },
});

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于本前缀的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(notificationConfig.prefix, requirePlatformAuth, notificationConfig.router);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

/** 路由声明的「方法 + 路径」全集（用于"路径钉死、不得自拟/增减"的结构断言） */
function declaredRoutes(): string[] {
  const stack = ((platformNotificationRouter as any).stack ?? []) as any[];
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)
    );
}

const EMPTY_PAGE = { total: 0, page: 1, pageSize: 20, unreadCount: 0, records: [] };

describe("C6-2-T1 · 路由声明（路径钉死 + 全量 requirePlatformAuth + 字面量优先）", () => {
  it("前缀与派单卡交付物② 逐字一致，auth 为 requirePlatformAuth", () => {
    expect(routeConfigs.map((c) => c.prefix)).toEqual(["/api/platform/notifications"]);
    expect(routeConfigs.map((c) => c.auth)).toEqual(["requirePlatformAuth"]);
  });

  it("只声明卡内 3 条端点（方法 + 路径），无自拟、无增减", () => {
    expect(declaredRoutes().sort()).toEqual(
      ["GET /", "POST /read-all", "POST /:id/read"].sort()
    );
  });

  it("注册顺序（卡内要求「字面量先于参数」）：/read-all 排在 /:id/read 之前", () => {
    const order = declaredRoutes();
    const readAllIndex = order.indexOf("POST /read-all");
    const readIndex = order.indexOf("POST /:id/read");

    expect(readAllIndex).toBeGreaterThanOrEqual(0);
    expect(readIndex).toBeGreaterThanOrEqual(0);
    // 反测（与 T7 同形）：把 read-all 调到 :id/read 之后 ⇒ 本断言必红
    expect(readAllIndex).toBeLessThan(readIndex);
  });

  it("无令牌访问 3 条端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/notifications"),
      request(guardedApp).post("/api/platform/notifications/1/read"),
      request(guardedApp).post("/api/platform/notifications/read-all"),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listNotifications).not.toHaveBeenCalled();
    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
    expect(mocks.markAllNotificationsRead).not.toHaveBeenCalled();
  });
});

describe("C6-2-T1 · #1 GET /api/platform/notifications（列表）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态（records: [] / unreadCount: 0），默认分页 page=1/pageSize=20，adminId 取令牌", async () => {
    mocks.listNotifications.mockResolvedValue(EMPTY_PAGE);
    const res = await request(app).get("/api/platform/notifications");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual(EMPTY_PAGE);
    expect(mocks.listNotifications).toHaveBeenCalledWith({
      adminId: 1,
      unreadOnly: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it("unreadOnly=true 被解析为布尔 true；page/pageSize 透传", async () => {
    mocks.listNotifications.mockResolvedValue(EMPTY_PAGE);
    await request(app).get("/api/platform/notifications?unreadOnly=true&page=2&pageSize=50");

    expect(mocks.listNotifications).toHaveBeenCalledWith({
      adminId: 1,
      unreadOnly: true,
      page: 2,
      pageSize: 50,
    });
  });

  it("unreadOnly=false / 非布尔值 ⇒ 400，且不调用 service", async () => {
    const bad = await request(app).get("/api/platform/notifications?unreadOnly=maybe");

    expect(bad.status).toBe(400);
    expect(mocks.listNotifications).not.toHaveBeenCalled();
  });

  it("pageSize > 100 / page < 1 / 非数字 ⇒ 400（卡内钉死上限 100，不静默夹取）", async () => {
    const tooBig = await request(app).get("/api/platform/notifications?pageSize=101");
    const badPage = await request(app).get("/api/platform/notifications?page=0");
    const badPageSize = await request(app).get("/api/platform/notifications?pageSize=abc");

    expect(tooBig.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(badPageSize.status).toBe(400);
    expect(mocks.listNotifications).not.toHaveBeenCalled();
  });

  it("令牌无管理员身份 ⇒ 401（不静默造 ID）", async () => {
    const res = await request(noIdentityApp).get("/api/platform/notifications");

    expect(res.status).toBe(401);
    expect(mocks.listNotifications).not.toHaveBeenCalled();
  });
});

describe("C6-2-T1 · #2 POST /api/platform/notifications/:id/read（标记已读）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 标记成功（返回 marked），service 收到 (id, 当前管理员)", async () => {
    mocks.markNotificationRead.mockResolvedValue({ id: 5, read: true, marked: 1 });
    const res = await request(app).post("/api/platform/notifications/5/read");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, read: true, marked: 1 });
    expect(mocks.markNotificationRead).toHaveBeenCalledWith(5, 1);
  });

  it("幂等：重复调用仍 200，且第二次 marked=0（不报错、不新增行）", async () => {
    mocks.markNotificationRead
      .mockResolvedValueOnce({ id: 5, read: true, marked: 1 })
      .mockResolvedValueOnce({ id: 5, read: true, marked: 0 });

    const first = await request(app).post("/api/platform/notifications/5/read");
    const second = await request(app).post("/api/platform/notifications/5/read");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.marked).toBe(1);
    expect(second.body.data.marked).toBe(0);
  });

  it("通知不存在或不可见 ⇒ 404（业务码直通，不静默成功）", async () => {
    mocks.markNotificationRead.mockRejectedValue(new AppError("通知不存在或对当前管理员不可见：999", 404));
    const res = await request(app).post("/api/platform/notifications/999/read");

    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("不可见");
  });

  it("非数字 / 非正数 id ⇒ 400，且不调用 service", async () => {
    const text = await request(app).post("/api/platform/notifications/abc/read");
    const zero = await request(app).post("/api/platform/notifications/0/read");

    expect(text.status).toBe(400);
    expect(zero.status).toBe(400);
    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
  });
});

describe("C6-2-T1 · #3 POST /api/platform/notifications/read-all（全部标记已读）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + marked = 本次新增行数（不吞异常、不返回通知总数）", async () => {
    mocks.markAllNotificationsRead.mockResolvedValue({ marked: 3 });
    const res = await request(app).post("/api/platform/notifications/read-all");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ marked: 3 });
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith(1);
    // 字面量端点绝不能被 /:id/read 吞掉
    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
  });

  it("空表/全部已读 ⇒ marked: 0（诚实计数，不造数字）", async () => {
    mocks.markAllNotificationsRead.mockResolvedValue({ marked: 0 });
    const res = await request(app).post("/api/platform/notifications/read-all");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ marked: 0 });
  });

  it("令牌无管理员身份 ⇒ 401，且不调用 service", async () => {
    const res = await request(noIdentityApp).post("/api/platform/notifications/read-all");

    expect(res.status).toBe(401);
    expect(mocks.markAllNotificationsRead).not.toHaveBeenCalled();
  });
});
