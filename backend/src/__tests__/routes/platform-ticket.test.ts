/**
 * C6-2-T7：平台工单系统 10 条端点的路由级测试（路径 / 方法 / 鉴权 / 校验 400 / 业务码 / 注册顺序）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md 交付物②（含"路由注册顺序（硬）"）、验收标准②⑤c
 * 范式：src/__tests__/routes/platform-role.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡交付物②——路径由卡钉死，本文件逐条断言（含"只准 10 条、不得自拟/增减"）。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，踩坑 [118]），用例只写好，执行由凌舟在本机跑。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listTicketBoard: vi.fn(),
  getTicketDetail: vi.fn(),
  listTimeline: vi.fn(),
  replyToTicket: vi.fn(),
  addInternalNote: vi.fn(),
  transferTicket: vi.fn(),
  resolveTicket: vi.fn(),
  closeTicket: vi.fn(),
  getServiceReport: vi.fn(),
  listTicketCategories: vi.fn(),
}));

vi.mock("../../services/platform/platform-ticket.service", () => ({
  TICKET_PERMISSIONS: {
    reply: "ticket:reply",
    note: "ticket:note",
    transfer: "ticket:transfer",
    resolve: "ticket:resolve",
    close: "ticket:close",
    report: "ticket:report",
    categoryConfig: "ticket:category:config",
  },
  TICKET_STATUSES: ["PENDING", "PROCESSING", "RESOLVED", "CLOSED"],
  INTERNAL_BUBBLE: "INTERNAL",
  listTicketBoard: mocks.listTicketBoard,
  getTicketDetail: mocks.getTicketDetail,
  listTimeline: mocks.listTimeline,
  replyToTicket: mocks.replyToTicket,
  addInternalNote: mocks.addInternalNote,
  transferTicket: mocks.transferTicket,
  resolveTicket: mocks.resolveTicket,
  closeTicket: mocks.closeTicket,
  getServiceReport: mocks.getServiceReport,
  listTicketCategories: mocks.listTicketCategories,
}));

import { AppError } from "../../shared/app-error";
import { routeConfigs, platformSupportRouter } from "../../routes/platform-ticket.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const supportConfig = routeConfigs.find((c) => c.prefix === "/api/platform/support")!;
const app = createTestApp({ prefix: supportConfig.prefix, router: supportConfig.router });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于本前缀的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
guardedApp.use(supportConfig.prefix, requirePlatformAuth, supportConfig.router);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

/** 路由声明的「方法 + 路径」全集（用于"路径钉死、不得自拟/增减"的结构断言） */
function declaredRoutes(): string[] {
  const stack = ((platformSupportRouter as any).stack ?? []) as any[];
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)
    );
}

describe("C6-2-T7 · 路由声明（路径钉死 + 全量 requirePlatformAuth + 注册顺序）", () => {
  it("前缀与派单卡交付物② 逐字一致，auth 为 requirePlatformAuth", () => {
    expect(routeConfigs.map((c) => c.prefix)).toEqual(["/api/platform/support"]);
    expect(routeConfigs.map((c) => c.auth)).toEqual(["requirePlatformAuth"]);
  });

  it("只声明卡内 10 条端点（方法 + 路径），无自拟、无增减、无 impersonation/kb-suggestions", () => {
    expect(declaredRoutes().sort()).toEqual(
      [
        "GET /tickets",
        "GET /tickets/:id",
        "GET /tickets/:id/timeline",
        "GET /tickets/report",
        "GET /ticket-categories",
        "POST /tickets/:id/reply",
        "POST /tickets/:id/note",
        "POST /tickets/:id/transfer",
        "POST /tickets/:id/resolve",
        "POST /tickets/:id/close",
      ].sort()
    );
    const paths = declaredRoutes().join("\n");
    expect(paths).not.toContain("impersonation");
    expect(paths).not.toContain("kb-suggestions");
  });

  it("注册顺序（硬）：字面量 /tickets/report 必须排在 /tickets/:id 之前", () => {
    const order = declaredRoutes();
    const reportIndex = order.indexOf("GET /tickets/report");
    const detailIndex = order.indexOf("GET /tickets/:id");

    expect(reportIndex).toBeGreaterThanOrEqual(0);
    expect(detailIndex).toBeGreaterThanOrEqual(0);
    // 反测 c：把 report 调到 :id 之后 ⇒ 本断言必红
    expect(reportIndex).toBeLessThan(detailIndex);
  });

  it("无令牌访问代表端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/support/tickets"),
      request(guardedApp).get("/api/platform/support/tickets/report"),
      request(guardedApp).get("/api/platform/support/tickets/1"),
      request(guardedApp).get("/api/platform/support/tickets/1/timeline"),
      request(guardedApp).get("/api/platform/support/ticket-categories"),
      request(guardedApp).post("/api/platform/support/tickets/1/reply").send({ content: "x" }),
      request(guardedApp).post("/api/platform/support/tickets/1/note").send({ content: "x" }),
      request(guardedApp).post("/api/platform/support/tickets/1/transfer").send({ assigneeId: 2 }),
      request(guardedApp).post("/api/platform/support/tickets/1/resolve"),
      request(guardedApp).post("/api/platform/support/tickets/1/close"),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listTicketBoard).not.toHaveBeenCalled();
    expect(mocks.getTicketDetail).not.toHaveBeenCalled();
    expect(mocks.replyToTicket).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #1 GET /api/platform/support/tickets（看板）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态（三组空数组 + 四态 0），并按默认分页参数调用 service", async () => {
    mocks.listTicketBoard.mockResolvedValue({
      groups: { pending: [], processing: [], resolved: [] },
      summary: { pending: 0, processing: 0, resolved: 0, closed: 0 },
    });
    const res = await request(app).get("/api/platform/support/tickets");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({
      groups: { pending: [], processing: [], resolved: [] },
      summary: { pending: 0, processing: 0, resolved: 0, closed: 0 },
    });
    const arg = mocks.listTicketBoard.mock.calls[0][0] as any;
    expect(arg.adminId).toBe(1);
    expect(arg.page).toBe(1);
    expect(arg.pageSize).toBe(20);
    expect(arg.onlyMine).toBeUndefined();
    expect(arg.status).toBeUndefined();
  });

  it("onlyMine=true ⇒ 传 true + 当前管理员 ID（前端 :315-318 的真实参数形态）", async () => {
    mocks.listTicketBoard.mockResolvedValue({
      groups: { pending: [], processing: [], resolved: [] },
      summary: { pending: 0, processing: 0, resolved: 0, closed: 0 },
    });
    await request(app).get("/api/platform/support/tickets?onlyMine=true&page=2&pageSize=50");

    const arg = mocks.listTicketBoard.mock.calls[0][0] as any;
    expect(arg.onlyMine).toBe(true);
    expect(arg.adminId).toBe(1);
    expect(arg.page).toBe(2);
    expect(arg.pageSize).toBe(50);
  });

  it("status 四态逐个可用；非法状态 ⇒ 400 且不调用 service", async () => {
    mocks.listTicketBoard.mockResolvedValue({
      groups: { pending: [], processing: [], resolved: [] },
      summary: { pending: 0, processing: 0, resolved: 0, closed: 0 },
    });
    for (const status of ["PENDING", "PROCESSING", "RESOLVED", "CLOSED"]) {
      const res = await request(app).get(`/api/platform/support/tickets?status=${status}`);
      expect(res.status).toBe(200);
      const calls = mocks.listTicketBoard.mock.calls;
      expect((calls[calls.length - 1][0] as any).status).toBe(status);
    }

    const bad = await request(app).get("/api/platform/support/tickets?status=FOO");
    expect(bad.status).toBe(400);
    expect(mocks.listTicketBoard).toHaveBeenCalledTimes(4);
  });

  it("pageSize > 100 / page < 1 / 非数字 ⇒ 400（卡内钉死上限 100）", async () => {
    const tooBig = await request(app).get("/api/platform/support/tickets?pageSize=101");
    const badPage = await request(app).get("/api/platform/support/tickets?page=0");
    const badPageSize = await request(app).get("/api/platform/support/tickets?pageSize=abc");

    expect(tooBig.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(badPageSize.status).toBe(400);
    expect(mocks.listTicketBoard).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #9 GET /api/platform/support/tickets/report（不被 :id 吞）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { items: [], definitionPending: true }（反测 c：注册顺序调回 :id 之后 ⇒ 本用例变红为 400）", async () => {
    mocks.getServiceReport.mockReturnValue({ items: [], definitionPending: true });
    const res = await request(app).get("/api/platform/support/tickets/report");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], definitionPending: true });
    expect(mocks.getServiceReport).toHaveBeenCalledTimes(1);
    // report 是字面量端点，绝不能被 :id 参数校验吞掉（吞掉会是 400 且这里不会有 service 调用）
    expect(mocks.getTicketDetail).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #2 GET /api/platform/support/tickets/:id（详情）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 详情字段（含 description/resolvedAt/closedAt）", async () => {
    mocks.getTicketDetail.mockResolvedValue({
      id: 5,
      ticketNo: "TK202609260001",
      tenantId: "3f1c0d1e-0000-4000-8000-000000000001",
      categoryId: 9,
      title: "登录异常",
      priority: "HIGH",
      status: "PENDING",
      assigneeId: null,
      createdAt: "2026-09-26 10:00:00",
      updatedAt: "2026-09-26 10:00:00",
      description: "无法登录工作台",
      resolvedAt: null,
      closedAt: null,
    });
    const res = await request(app).get("/api/platform/support/tickets/5");

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("无法登录工作台");
    expect(mocks.getTicketDetail).toHaveBeenCalledWith(5);
  });

  it("不存在 ⇒ 404（业务码直通）", async () => {
    mocks.getTicketDetail.mockRejectedValue(new AppError("工单不存在：999", 404));
    const res = await request(app).get("/api/platform/support/tickets/999");

    expect(res.status).toBe(404);
  });

  it("非数字 id ⇒ 400，且不调用 service", async () => {
    const res = await request(app).get("/api/platform/support/tickets/abc");

    expect(res.status).toBe(400);
    expect(mocks.getTicketDetail).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #3 GET /api/platform/support/tickets/:id/timeline（平台视角）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 三类气泡；且**显式**以 'platform' 视角调用（缺省视角才排除 INTERNAL）", async () => {
    mocks.listTimeline.mockResolvedValue({
      items: [
        { id: 1, senderType: "TENANT", senderName: "租户张三", bubbleType: "PUBLIC", content: "提问", createdAt: "2026-09-26 09:00:00" },
        { id: 2, senderType: "PLATFORM", senderName: "测试管理员", bubbleType: "INTERNAL", content: "内部备注", createdAt: "2026-09-26 09:05:00" },
      ],
    });
    const res = await request(app).get("/api/platform/support/tickets/5/timeline");

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(mocks.listTimeline).toHaveBeenCalledWith(5, "platform");
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.listTimeline.mockRejectedValue(new AppError("工单不存在：999", 404));
    const res = await request(app).get("/api/platform/support/tickets/999/timeline");

    expect(res.status).toBe(404);
  });
});

describe("C6-2-T7 · #4 POST /:id/reply（公开回复）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 落 PLATFORM 身份（id 取令牌里的管理员，name 取 realName）", async () => {
    mocks.replyToTicket.mockResolvedValue({ id: 5, messageId: 77, status: "PROCESSING" });
    const res = await request(app)
      .post("/api/platform/support/tickets/5/reply")
      .send({ content: "您好，请提供报错截图" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, messageId: 77, status: "PROCESSING" });
    expect(mocks.replyToTicket).toHaveBeenCalledWith(5, "您好，请提供报错截图", {
      adminId: 1,
      adminName: "测试管理员",
    });
  });

  it("content 缺失 / 空白 ⇒ 400，且不调用 service", async () => {
    const missing = await request(app).post("/api/platform/support/tickets/5/reply").send({});
    const blank = await request(app)
      .post("/api/platform/support/tickets/5/reply")
      .send({ content: "   " });

    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(mocks.replyToTicket).not.toHaveBeenCalled();
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.replyToTicket.mockRejectedValue(new AppError("工单不存在：999", 404));
    const res = await request(app)
      .post("/api/platform/support/tickets/999/reply")
      .send({ content: "x" });

    expect(res.status).toBe(404);
  });
});

describe("C6-2-T7 · #5 POST /:id/note（内部备注）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 内部备注落库（返回当前状态，未改状态）", async () => {
    mocks.addInternalNote.mockResolvedValue({ id: 5, messageId: 88, status: "PROCESSING" });
    const res = await request(app)
      .post("/api/platform/support/tickets/5/note")
      .send({ content: "内部备注：疑似租户库表缺失" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, messageId: 88, status: "PROCESSING" });
    expect(mocks.addInternalNote).toHaveBeenCalledWith(5, "内部备注：疑似租户库表缺失", {
      adminId: 1,
      adminName: "测试管理员",
    });
  });

  it("content 缺失 ⇒ 400，且不调用 service", async () => {
    const res = await request(app).post("/api/platform/support/tickets/5/note").send({});

    expect(res.status).toBe(400);
    expect(mocks.addInternalNote).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #6 POST /:id/transfer（转交）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 换受理人（状态不变）", async () => {
    mocks.transferTicket.mockResolvedValue({ id: 8, assigneeId: 12, status: "PROCESSING" });
    const res = await request(app)
      .post("/api/platform/support/tickets/8/transfer")
      .send({ assigneeId: 12 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 8, assigneeId: 12, status: "PROCESSING" });
    expect(mocks.transferTicket).toHaveBeenCalledWith(8, 12, {
      adminId: 1,
      adminName: "测试管理员",
    });
  });

  it("assigneeId 缺失 / 非正数 / 非数字 ⇒ 400，且不调用 service", async () => {
    const missing = await request(app).post("/api/platform/support/tickets/8/transfer").send({});
    const zero = await request(app)
      .post("/api/platform/support/tickets/8/transfer")
      .send({ assigneeId: 0 });
    const text = await request(app)
      .post("/api/platform/support/tickets/8/transfer")
      .send({ assigneeId: "abc" });

    expect(missing.status).toBe(400);
    expect(zero.status).toBe(400);
    expect(text.status).toBe(400);
    expect(mocks.transferTicket).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · #7/#8 POST /:id/resolve 与 /:id/close（非法状态转移必须 400）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolve 成功 ⇒ 200 + RESOLVED", async () => {
    mocks.resolveTicket.mockResolvedValue({ id: 5, status: "RESOLVED" });
    const res = await request(app).post("/api/platform/support/tickets/5/resolve");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, status: "RESOLVED" });
  });

  it("CLOSED → resolve ⇒ 400（不是静默成功），错误信息可见", async () => {
    mocks.resolveTicket.mockRejectedValue(new AppError("当前状态不允许标记已解决：CLOSED", 400));
    const res = await request(app).post("/api/platform/support/tickets/5/resolve");

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("CLOSED");
  });

  it("resolve 工单不存在 ⇒ 404", async () => {
    mocks.resolveTicket.mockRejectedValue(new AppError("工单不存在：999", 404));
    const res = await request(app).post("/api/platform/support/tickets/999/resolve");

    expect(res.status).toBe(404);
  });

  it("重复 close ⇒ 400", async () => {
    mocks.closeTicket.mockRejectedValue(new AppError("当前状态不允许关闭工单：CLOSED", 400));
    const res = await request(app).post("/api/platform/support/tickets/5/close");

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("CLOSED");
  });

  it("close 成功 ⇒ 200 + CLOSED", async () => {
    mocks.closeTicket.mockResolvedValue({ id: 5, status: "CLOSED" });
    const res = await request(app).post("/api/platform/support/tickets/5/close");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, status: "CLOSED" });
  });
});

describe("C6-2-T7 · #10 GET /api/platform/support/ticket-categories（类型配置）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 categories: []（零预置，不造内置类型）", async () => {
    mocks.listTicketCategories.mockResolvedValue({ categories: [] });
    const res = await request(app).get("/api/platform/support/ticket-categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ categories: [] });
  });

  it("200 + 配置行字段（id/name/slug/slaHours/sortNo/enabled）", async () => {
    mocks.listTicketCategories.mockResolvedValue({
      categories: [{ id: 3, name: "功能异常", slug: "bug", slaHours: 24, sortNo: 1, enabled: true }],
    });
    const res = await request(app).get("/api/platform/support/ticket-categories");

    expect(res.status).toBe(200);
    expect(res.body.data.categories[0]).toEqual({
      id: 3,
      name: "功能异常",
      slug: "bug",
      slaHours: 24,
      sortNo: 1,
      enabled: true,
    });
  });
});
