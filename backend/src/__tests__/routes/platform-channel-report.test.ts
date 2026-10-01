/**
 * R101-C6-3-2b：渠道效果报表端点（GET /api/platform/channel-reports/effect）路由级测试
 * （前缀 / 方法 / 鉴权 / 校验 400 / 无自拟宽松路由）
 *
 * 范式：src/__tests__/routes/platform-promo-code.test.ts（create-test-app 夹具 + service mock）。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  getChannelEffectReport: vi.fn(),
}));

vi.mock("../../services/platform/platform-channel-report.service", () => ({
  getChannelEffectReport: mocks.getChannelEffectReport,
}));

import { routeConfig } from "../../routes/platform-channel-report.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: routeConfig.prefix, router: routeConfig.router });

const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
guardedApp.use(routeConfig.prefix, requirePlatformAuth, routeConfig.router);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("C6-3-2b · 路由声明（前缀 + 全量 requirePlatformAuth）", () => {
  it("前缀与派单卡 §四 逐字一致，且 auth 为 requirePlatformAuth", () => {
    expect(routeConfig.prefix).toBe("/api/platform/channel-reports");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("无令牌访问 ⇒ 401（不落到业务层）", async () => {
    const res = await request(guardedApp).get("/api/platform/channel-reports/effect");
    expect(res.status).toBe(401);
    expect(mocks.getChannelEffectReport).not.toHaveBeenCalled();
  });
});

describe("C6-3-2b · GET /api/platform/channel-reports/effect（渠道效果聚合）", () => {
  it("无归因数据 ⇒ 200 且 items: []（空态诚实，不造数）", async () => {
    mocks.getChannelEffectReport.mockResolvedValueOnce({
      items: [],
      basis: { emptyState: "无归因数据 ⇒ items: []（不造数、不展示推算值）" },
      filters: { attributionType: null, channelType: null },
      totals: { tenantCount: 0, referralCount: 0, rewardPoints: 0 },
    });
    const res = await request(app).get("/api/platform/channel-reports/effect");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.totals).toEqual({ tenantCount: 0, referralCount: 0, rewardPoints: 0 });
    expect(mocks.getChannelEffectReport.mock.calls[0][0]).toEqual({});
  });

  it("过滤条件原样进 service（过滤条件随响应回显由 service 负责）", async () => {
    mocks.getChannelEffectReport.mockResolvedValueOnce({
      items: [],
      basis: {},
      filters: { attributionType: "PROMO", channelType: "地推" },
      totals: { tenantCount: 0, referralCount: 0, rewardPoints: 0 },
    });
    const res = await request(app).get(
      "/api/platform/channel-reports/effect?attributionType=PROMO&channelType=%E5%9C%B0%E6%8E%A8"
    );
    expect(res.status).toBe(200);
    expect(mocks.getChannelEffectReport.mock.calls[0][0]).toEqual({
      attributionType: "PROMO",
      channelType: "地推",
    });
  });

  it("非法 attributionType ⇒ 400（zod 枚举，且不调用 service）", async () => {
    const res = await request(app).get("/api/platform/channel-reports/effect?attributionType=FOO");
    expect(res.status).toBe(400);
    expect(mocks.getChannelEffectReport).not.toHaveBeenCalled();
  });

  it("channelType 空串 ⇒ 400（min(1)，避免「空过滤」被当成合法过滤）", async () => {
    const res = await request(app).get("/api/platform/channel-reports/effect?channelType=");
    expect(res.status).toBe(400);
    expect(mocks.getChannelEffectReport).not.toHaveBeenCalled();
  });

  it("未定义的自拟路径 ⇒ 404（证明确实只有 /effect 一条）", async () => {
    const results = await Promise.all([
      request(app).get("/api/platform/channel-reports"),
      request(app).get("/api/platform/channel-reports/effects"),
      request(app).get("/api/platform/channel-reports/effect/1"),
      request(app).post("/api/platform/channel-reports/effect"),
    ]);
    for (const res of results) {
      expect(res.status).toBe(404);
    }
  });
});
