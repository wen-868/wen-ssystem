/**
 * R101-C6-3-2a：渠道推广码域 4 条新端点的路由级测试
 * （路径 / 方法 / 鉴权 / 校验 400 / 业务码 404·409·400 / 无自拟宽松路由）
 *
 * 范式：src/__tests__/routes/platform-agent.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡 §四 —— 逐字钉死，本文件逐条断言，防后续被改名/挪前缀。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listPromoCodes: vi.fn(),
  createPromoCode: vi.fn(),
  disablePromoCode: vi.fn(),
  listAttributionsByCode: vi.fn(),
}));

// 只 mock 需要的导出（不用 importActual：避免把真实 service → shared/db → mysql 连接池拉进路由测试）
vi.mock("../../services/platform/platform-promo-code.service", () => ({
  listPromoCodes: mocks.listPromoCodes,
  createPromoCode: mocks.createPromoCode,
  disablePromoCode: mocks.disablePromoCode,
  listAttributionsByCode: mocks.listAttributionsByCode,
}));

import { AppError } from "../../shared/app-error";
import { routeConfig } from "../../routes/platform-promo-code.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: routeConfig.prefix, router: routeConfig.router });

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于 4 条新端点的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流（与 platform-agent.test.ts 同规）
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
guardedApp.use(routeConfig.prefix, requirePlatformAuth, routeConfig.router);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("C6-3-2a · 路由声明（前缀 + 全量 requirePlatformAuth）", () => {
  it("前缀与派单卡 §四 逐字一致，且 auth 为 requirePlatformAuth", () => {
    expect(routeConfig.prefix).toBe("/api/platform/promo-codes");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("无令牌访问 4 条新端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/promo-codes"),
      request(guardedApp)
        .post("/api/platform/promo-codes")
        .send({ channelType: "地推", channelName: "华东" }),
      request(guardedApp).post("/api/platform/promo-codes/1/disable"),
      request(guardedApp).get("/api/platform/promo-codes/PCAAAAAAAA/attributions"),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listPromoCodes).not.toHaveBeenCalled();
    expect(mocks.createPromoCode).not.toHaveBeenCalled();
    expect(mocks.disablePromoCode).not.toHaveBeenCalled();
    expect(mocks.listAttributionsByCode).not.toHaveBeenCalled();
  });
});

describe("C6-3-2a · GET /api/platform/promo-codes（列表）", () => {
  it("空表 ⇒ items: []、total 0（零预置，不由后端预置推广码）", async () => {
    mocks.listPromoCodes.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    const res = await request(app).get("/api/platform/promo-codes");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it("分页 + 关键词 + 状态原样进 service", async () => {
    mocks.listPromoCodes.mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 5 });
    const res = await request(app).get(
      "/api/platform/promo-codes?page=2&pageSize=5&keyword=%E5%8D%8E%E4%B8%9C&status=ACTIVE"
    );
    expect(res.status).toBe(200);
    expect(mocks.listPromoCodes.mock.calls[0][0]).toEqual({
      page: 2,
      pageSize: 5,
      keyword: "华东",
      status: "ACTIVE",
    });
  });

  it("pageSize 超 100 ⇒ 400（不静默夹取）；page=0 ⇒ 400；status 非法 ⇒ 400", async () => {
    for (const qs of ["pageSize=101", "page=0", "status=CLOSED"]) {
      const res = await request(app).get(`/api/platform/promo-codes?${qs}`);
      expect(res.status).toBe(400);
    }
    expect(mocks.listPromoCodes).not.toHaveBeenCalled();
  });
});

describe("C6-3-2a · POST /api/platform/promo-codes（生成）", () => {
  it("合法体 ⇒ 200 且回传 { id, promoCode }；body 字段原样进 service、不夹带自拟字段", async () => {
    mocks.createPromoCode.mockResolvedValueOnce({ id: 11, promoCode: "PCABCDEFGH" });
    const res = await request(app)
      .post("/api/platform/promo-codes")
      .send({ channelType: "地推", channelName: "华东地推", expireAt: "2026-12-31", remark: "备注" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 11, promoCode: "PCABCDEFGH" });
    expect(mocks.createPromoCode.mock.calls[0][0]).toEqual({
      channelType: "地推",
      channelName: "华东地推",
      expireAt: "2026-12-31",
      remark: "备注",
    });
  });

  it("缺 channelType / channelName ⇒ 400（zod，且不调用 service）", async () => {
    const res1 = await request(app).post("/api/platform/promo-codes").send({ channelName: "华东" });
    const res2 = await request(app).post("/api/platform/promo-codes").send({ channelType: "地推" });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocks.createPromoCode).not.toHaveBeenCalled();
  });

  it("给未知字段（自拟，如佣金比例）⇒ 400（strict 不认，金额类字段进不来）", async () => {
    const res = await request(app)
      .post("/api/platform/promo-codes")
      .send({ channelType: "地推", channelName: "华东", commissionRate: 0.2 });
    expect(res.status).toBe(400);
    expect(mocks.createPromoCode).not.toHaveBeenCalled();
  });

  it("5 次冲突后 ⇒ 409（service 抛 AppError，原样透出）", async () => {
    mocks.createPromoCode.mockRejectedValueOnce(
      new AppError("推广码生成冲突：连续 5 次候选码均与既有码重复，请重试", 409)
    );
    const res = await request(app)
      .post("/api/platform/promo-codes")
      .send({ channelType: "地推", channelName: "华东" });
    expect(res.status).toBe(409);
    expect(res.body.msg).toContain("连续 5 次");
  });
});

describe("C6-3-2a · POST /api/platform/promo-codes/:id/disable（停用）", () => {
  it("合法 id ⇒ 200；id 原样进 service", async () => {
    mocks.disablePromoCode.mockResolvedValueOnce({
      id: 3,
      status: "DISABLED",
      changed: true,
      alreadyDisabled: false,
      message: "推广码已停用",
    });
    const res = await request(app).post("/api/platform/promo-codes/3/disable");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 3, status: "DISABLED", alreadyDisabled: false });
    expect(mocks.disablePromoCode.mock.calls[0][0]).toBe(3);
  });

  it("已停用 ⇒ 幂等 200 + 说明（alreadyDisabled=true）", async () => {
    mocks.disablePromoCode.mockResolvedValueOnce({
      id: 3,
      status: "DISABLED",
      changed: false,
      alreadyDisabled: true,
      message: "该推广码已停用（幂等，无需重复停用）",
    });
    const res = await request(app).post("/api/platform/promo-codes/3/disable");
    expect(res.status).toBe(200);
    expect(res.body.data.alreadyDisabled).toBe(true);
    expect(res.body.data.message).toContain("幂等");
  });

  it("未知 id ⇒ 404", async () => {
    mocks.disablePromoCode.mockRejectedValueOnce(new AppError("推广码不存在：99", 404));
    const res = await request(app).post("/api/platform/promo-codes/99/disable");
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("推广码不存在：99");
  });

  it("id 非正整数 ⇒ 400（zod，且不调用 service）", async () => {
    const res = await request(app).post("/api/platform/promo-codes/0/disable");
    expect(res.status).toBe(400);
    expect(mocks.disablePromoCode).not.toHaveBeenCalled();
  });
});

describe("C6-3-2a · GET /api/platform/promo-codes/:code/attributions（归因只读）", () => {
  it("存在 ⇒ 200，码值原样进 service", async () => {
    mocks.listAttributionsByCode.mockResolvedValueOnce({
      promoCode: { id: 3, promoCode: "PCAAAAAAAA", channelType: "地推", channelName: "华东", status: "ACTIVE" },
      items: [],
      total: 0,
    });
    const res = await request(app).get("/api/platform/promo-codes/PCAAAAAAAA/attributions");
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(mocks.listAttributionsByCode.mock.calls[0][0]).toBe("PCAAAAAAAA");
  });

  it("未知码值 ⇒ 404", async () => {
    mocks.listAttributionsByCode.mockRejectedValueOnce(new AppError("推广码不存在：PCNOPE", 404));
    const res = await request(app).get("/api/platform/promo-codes/PCNOPE/attributions");
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe("推广码不存在：PCNOPE");
  });

  it("未定义的自拟路径 ⇒ 404（证明没有宽松路由）", async () => {
    const res1 = await request(app).get("/api/platform/promo-codes/1");
    const res2 = await request(app).delete("/api/platform/promo-codes/1");
    const res3 = await request(app).get("/api/platform/promo-code");
    expect(res1.status).toBe(404);
    expect(res2.status).toBe(404);
    expect(res3.status).toBe(404);
    expect(mocks.listAttributionsByCode).not.toHaveBeenCalled();
  });
});

