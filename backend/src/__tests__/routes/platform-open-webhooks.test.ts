/**
 * R101-C3-1 开放平台 · Webhook 7 端点 + `GET /events` 路由级测试
 *
 * 范式：`src/__tests__/routes/platform-templates.test.ts`（create-test-app 夹具 + service mock +
 * guardedApp 挂真实 requirePlatformAuth 做「无令牌 401」反向用例）。
 * 说明：本文件 mock service（专注路由/契约/校验与鉴权反向）；service 自身的语义（SSRF 防护、
 * 投递结果落库、自动暂停、bcrypt 存签名密钥）在 `services/platform/open-webhook.service.test.ts`。
 *
 * 沙箱 vitest 无法启动（spawn EPERM），用例只写好，首次真跑由凌舟在本机执行。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createTestApp } from "../fixtures/create-test-app";

const svc = vi.hoisted(() => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  testWebhook: vi.fn(),
  listDeliveries: vi.fn(),
  redeliver: vi.fn(),
  resumeWebhook: vi.fn(),
  listFailures: vi.fn(),
}));

vi.mock("../../services/platform/open-webhook.service", () => ({
  listWebhooks: svc.listWebhooks,
  createWebhook: svc.createWebhook,
  testWebhook: svc.testWebhook,
  listDeliveries: svc.listDeliveries,
  redeliver: svc.redeliver,
  resumeWebhook: svc.resumeWebhook,
  listFailures: svc.listFailures,
}));

import { AppError } from "../../shared/app-error";
import { platformOpenRouter, routeConfig } from "../../routes/platform-open.routes";
import { requirePlatformAuth } from "../../middleware/auth";
import { OPEN_PLATFORM_EVENT_CODES } from "../../config/open-platform";

const PREFIX = "/api/platform/open";
const app = createTestApp({ prefix: PREFIX, router: platformOpenRouter });

const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(PREFIX, requirePlatformAuth, platformOpenRouter);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

describe("C3-1 Webhook · GET /api/platform/open/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 事件目录（常量枚举，4 条，含 order.created）", async () => {
    const res = await request(app).get(`${PREFIX}/events`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.records.map((r: any) => r.code)).toEqual([
      "order.created",
      "order.approved",
      "inventory.below_threshold",
      "tenant.status_changed",
    ]);
    expect(OPEN_PLATFORM_EVENT_CODES).toContain("order.created");
    // 事件目录来自真实 config（不是被 mock 的 service）
    expect(svc.listWebhooks).not.toHaveBeenCalled();
  });
});

describe("C3-1 Webhook · GET /api/platform/open/webhooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 订阅列表（含近 7 日推送数/成功率派生字段）", async () => {
    svc.listWebhooks.mockResolvedValue({
      records: [
        {
          id: 3,
          tenantId: "t1",
          eventType: "order.created",
          callbackUrl: "https://erp.example.com/hook",
          retryPolicy: "1m/5m/30m x3",
          pauseThreshold: 10,
          paused: false,
          lastTriggerAt: "2026-09-23 10:00:00",
          lastStatus: "OK",
          lastError: null,
          recentPushCount: 20,
          recentSuccessRate: 95,
          createdAt: "2026-09-20 10:00:00",
          updatedAt: "2026-09-23 10:00:00",
        },
      ],
      total: 1,
    });

    const res = await request(app).get(`${PREFIX}/webhooks`);

    expect(res.status).toBe(200);
    expect(res.body.data.records[0].recentSuccessRate).toBe(95);
    expect(res.body.data.records[0].paused).toBe(false);
    // 无筛选参数时两个键都存在且为 undefined（不用 toHaveBeenCalledWith 的对象字面量，
    // 避免不同断言库对「undefined 值的键」是否算差异产生口径分歧）
    const params = svc.listWebhooks.mock.calls[0][0] as Record<string, unknown>;
    expect("tenantId" in params).toBe(true);
    expect(params.tenantId).toBeUndefined();
    expect(params.paused).toBeUndefined();
  });

  it("200 + 空态 records: []（不造数据）", async () => {
    svc.listWebhooks.mockResolvedValue({ records: [], total: 0 });
    const res = await request(app).get(`${PREFIX}/webhooks`);
    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
  });

  it("?tenantId=t1&paused=1 透传 service", async () => {
    svc.listWebhooks.mockResolvedValue({ records: [], total: 0 });
    const res = await request(app).get(`${PREFIX}/webhooks?tenantId=t1&paused=1`);
    expect(res.status).toBe(200);
    expect(svc.listWebhooks).toHaveBeenCalledWith({ tenantId: "t1", paused: 1 });
  });

  it("?paused=9 ⇒ 400 且不调 service", async () => {
    const res = await request(app).get(`${PREFIX}/webhooks?paused=9`);
    expect(res.status).toBe(400);
    expect(svc.listWebhooks).not.toHaveBeenCalled();
  });
});

describe("C3-1 Webhook · POST /api/platform/open/webhooks（签名密钥一次性）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 + 返回一次性 signSecret，操作人取平台令牌", async () => {
    svc.createWebhook.mockResolvedValue({
      id: 7,
      tenantId: "t1",
      eventType: "order.approved",
      callbackUrl: "https://erp.example.com/hook",
      signSecret: "a".repeat(48),
      retryPolicy: "1m/5m/30m x3",
      pauseThreshold: 10,
      paused: false,
    });

    const res = await request(app)
      .post(`${PREFIX}/webhooks`)
      .send({ eventType: "order.approved", callbackUrl: "https://erp.example.com/hook", tenantId: "t1" });

    expect(res.status).toBe(201);
    expect(res.body.data.signSecret).toBe("a".repeat(48));
    expect(svc.createWebhook).toHaveBeenCalledWith(
      { eventType: "order.approved", callbackUrl: "https://erp.example.com/hook", tenantId: "t1" },
      expect.objectContaining({ adminId: 1, adminName: "testadmin" })
    );
  });

  it("缺 callbackUrl ⇒ 400 且不调 service", async () => {
    const res = await request(app).post(`${PREFIX}/webhooks`).send({ eventType: "order.created" });
    expect(res.status).toBe(400);
    expect(svc.createWebhook).not.toHaveBeenCalled();
  });

  it("事件码不在目录内 ⇒ 400 且不调 service", async () => {
    const res = await request(app)
      .post(`${PREFIX}/webhooks`)
      .send({ eventType: "made.up", callbackUrl: "https://erp.example.com/hook" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
    expect(svc.createWebhook).not.toHaveBeenCalled();
  });

  it("service 抛 SSRF 校验 AppError ⇒ 400 与中文原因", async () => {
    svc.createWebhook.mockRejectedValue(new AppError("回调地址禁止使用本机/内网/保留地址（SSRF 防护）", 400));
    const res = await request(app)
      .post(`${PREFIX}/webhooks`)
      .send({ eventType: "order.created", callbackUrl: "https://127.0.0.1/hook" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toContain("SSRF 防护");
  });
});

describe("C3-1 Webhook · POST /api/platform/open/webhooks/:id/test", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 投递结果（OK）", async () => {
    svc.testWebhook.mockResolvedValue({
      subscriptionId: 3,
      eventType: "order.created",
      delivery: {
        id: 11,
        subscriptionId: 3,
        eventType: "order.created",
        payload: { event: "order.created", test: true },
        attempt: 1,
        status: "OK",
        httpStatus: 200,
        error: null,
        triggeredBy: "TEST",
        durationMs: 12,
        createdAt: "2026-09-23 10:05:00",
      },
    });

    const res = await request(app).post(`${PREFIX}/webhooks/3/test`);

    expect(res.status).toBe(200);
    expect(res.body.data.delivery.status).toBe("OK");
    expect(res.body.data.delivery.httpStatus).toBe(200);
    expect(svc.testWebhook).toHaveBeenCalledWith(3, expect.objectContaining({ adminId: 1 }));
  });

  it("订阅不存在 ⇒ 404（service 抛 AppError）", async () => {
    svc.testWebhook.mockRejectedValue(new AppError("Webhook 订阅不存在：88", 404));
    const res = await request(app).post(`${PREFIX}/webhooks/88/test`);
    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("Webhook 订阅不存在");
  });

  it(":id 非正整数 ⇒ 400 且不调 service", async () => {
    const res = await request(app).post(`${PREFIX}/webhooks/abc/test`);
    expect(res.status).toBe(400);
    expect(svc.testWebhook).not.toHaveBeenCalled();
  });
});

describe("C3-1 Webhook · 日志 / 重推 / 恢复 / 失败原因", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET :id/logs 200 + 分页参数透传（默认 page=1 pageSize=20）", async () => {
    svc.listDeliveries.mockResolvedValue({ subscriptionId: 3, records: [], total: 0, page: 1, pageSize: 20 });
    const res = await request(app).get(`${PREFIX}/webhooks/3/logs`);
    expect(res.status).toBe(200);
    expect(res.body.data.records).toEqual([]);
    expect(svc.listDeliveries).toHaveBeenCalledWith(3, { page: 1, pageSize: 20 });
  });

  it("GET :id/logs?page=2&pageSize=50 透传", async () => {
    svc.listDeliveries.mockResolvedValue({ subscriptionId: 3, records: [], total: 0, page: 2, pageSize: 50 });
    const res = await request(app).get(`${PREFIX}/webhooks/3/logs?page=2&pageSize=50`);
    expect(res.status).toBe(200);
    expect(svc.listDeliveries).toHaveBeenCalledWith(3, { page: 2, pageSize: 50 });
  });

  it("GET :id/logs?pageSize=999 ⇒ 400（上限 200）", async () => {
    const res = await request(app).get(`${PREFIX}/webhooks/3/logs?pageSize=999`);
    expect(res.status).toBe(400);
    expect(svc.listDeliveries).not.toHaveBeenCalled();
  });

  it("POST :id/redeliver 200 + 默认重推最近一条（deliveryId 为空）", async () => {
    svc.redeliver.mockResolvedValue({
      subscriptionId: 3,
      redeliverOf: 11,
      attempt: 2,
      delivery: { id: 12, status: "OK", triggeredBy: "MANUAL", attempt: 2 },
    });

    const res = await request(app).post(`${PREFIX}/webhooks/3/redeliver`);

    expect(res.status).toBe(200);
    expect(res.body.data.redeliverOf).toBe(11);
    expect(res.body.data.attempt).toBe(2);
    expect(svc.redeliver).toHaveBeenCalledWith(3, undefined, expect.objectContaining({ adminId: 1 }));
  });

  it("POST :id/redeliver 指定 deliveryId 透传", async () => {
    svc.redeliver.mockResolvedValue({ subscriptionId: 3, redeliverOf: 9, attempt: 3, delivery: {} });
    const res = await request(app).post(`${PREFIX}/webhooks/3/redeliver`).send({ deliveryId: 9 });
    expect(res.status).toBe(200);
    expect(svc.redeliver).toHaveBeenCalledWith(3, 9, expect.objectContaining({ adminId: 1 }));
  });

  it("POST :id/redeliver 无投递记录 ⇒ 404", async () => {
    svc.redeliver.mockRejectedValue(new AppError("该订阅暂无投递记录，无法重推（请先执行测试推送）", 404));
    const res = await request(app).post(`${PREFIX}/webhooks/3/redeliver`);
    expect(res.status).toBe(404);
    expect(res.body.msg).toContain("暂无投递记录");
  });

  it("POST :id/resume 200 + paused=false", async () => {
    svc.resumeWebhook.mockResolvedValue({ id: 3, paused: false, resumed: true });
    const res = await request(app).post(`${PREFIX}/webhooks/3/resume`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 3, paused: false, resumed: true });
  });

  it("GET :id/failures 200 + limit 透传（默认 20）", async () => {
    svc.listFailures.mockResolvedValue({
      subscriptionId: 3,
      records: [
        {
          id: 12,
          eventType: "order.created",
          attempt: 2,
          status: "FAIL",
          httpStatus: 500,
          error: "对端返回非 2xx：500",
          createdAt: "2026-09-23 10:06:00",
        },
      ],
      total: 1,
    });

    const res = await request(app).get(`${PREFIX}/webhooks/3/failures`);

    expect(res.status).toBe(200);
    expect(res.body.data.records[0].error).toContain("500");
    expect(svc.listFailures).toHaveBeenCalledWith(3, 20);
  });

  it("GET :id/failures?limit=5 透传", async () => {
    svc.listFailures.mockResolvedValue({ subscriptionId: 3, records: [], total: 0 });
    const res = await request(app).get(`${PREFIX}/webhooks/3/failures?limit=5`);
    expect(res.status).toBe(200);
    expect(svc.listFailures).toHaveBeenCalledWith(3, 5);
  });
});

describe("C3-1 反测：Webhook 7 端点 + events 无令牌 ⇒ 401 且不调 service", () => {
  const cases: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: "get", path: `${PREFIX}/events` },
    { method: "get", path: `${PREFIX}/webhooks` },
    {
      method: "post",
      path: `${PREFIX}/webhooks`,
      body: { eventType: "order.created", callbackUrl: "https://erp.example.com/hook" },
    },
    { method: "post", path: `${PREFIX}/webhooks/1/test` },
    { method: "get", path: `${PREFIX}/webhooks/1/logs` },
    { method: "post", path: `${PREFIX}/webhooks/1/redeliver` },
    { method: "post", path: `${PREFIX}/webhooks/1/resume` },
    { method: "get", path: `${PREFIX}/webhooks/1/failures` },
  ];

  it("覆盖 8 条端点", () => {
    expect(cases).toHaveLength(8);
  });

  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path} 无令牌 ⇒ 401`, async () => {
      vi.clearAllMocks();
      let req = (request(guardedApp) as any)[c.method](c.path);
      if (c.body) req = req.send(c.body);
      const res = await req;

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("401");
      expect(svc.listWebhooks).not.toHaveBeenCalled();
      expect(svc.createWebhook).not.toHaveBeenCalled();
      expect(svc.testWebhook).not.toHaveBeenCalled();
      expect(svc.listDeliveries).not.toHaveBeenCalled();
      expect(svc.redeliver).not.toHaveBeenCalled();
      expect(svc.resumeWebhook).not.toHaveBeenCalled();
      expect(svc.listFailures).not.toHaveBeenCalled();
    });
  }

  it("open 域 router 内不重复挂鉴权中间件（鉴权只由 routeConfig.auth 生效）", () => {
    const nonRouteLayers = (platformOpenRouter as any).stack.filter((l: any) => !l.route);
    expect(nonRouteLayers).toHaveLength(0);
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });
});
