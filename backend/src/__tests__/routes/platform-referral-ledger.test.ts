/**
 * R101-C6-3-2b：老带新台账端点（GET /api/platform/referral-ledger）路由级测试
 * （前缀 / 方法 / 鉴权 / 校验 400 / 无自拟宽松路由 / **无任何写台账端点**）
 *
 * 范式：src/__tests__/routes/platform-promo-code.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listReferralLedger: vi.fn(),
}));

vi.mock("../../services/platform/platform-referral-ledger.service", () => ({
  listReferralLedger: mocks.listReferralLedger,
}));

import { AppError } from "../../shared/app-error";
import { routeConfig } from "../../routes/platform-referral-ledger.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: routeConfig.prefix, router: routeConfig.router });

/** 真实鉴权守卫（无 Authorization ⇒ 401） */
const guardedApp = express();
guardedApp.use(express.json());
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 }));
guardedApp.use(routeConfig.prefix, requirePlatformAuth, routeConfig.router);
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("C6-3-2b · 路由声明（前缀 + 全量 requirePlatformAuth）", () => {
  it("前缀与派单卡 §四 逐字一致，且 auth 为 requirePlatformAuth", () => {
    expect(routeConfig.prefix).toBe("/api/platform/referral-ledger");
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("无令牌访问 ⇒ 401（不落到业务层）", async () => {
    const res = await request(guardedApp).get("/api/platform/referral-ledger");
    expect(res.status).toBe(401);
    expect(mocks.listReferralLedger).not.toHaveBeenCalled();
  });
});

describe("C6-3-2b · GET /api/platform/referral-ledger（分页 + 关键词 + 状态）", () => {
  it("空表 ⇒ items: []、total 0（零预置，不由后端造台账行）", async () => {
    mocks.listReferralLedger.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    const res = await request(app).get("/api/platform/referral-ledger");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(mocks.listReferralLedger.mock.calls[0][0]).toEqual({ page: 1, pageSize: 20 });
  });

  it("分页 + 关键词 + 状态原样进 service", async () => {
    mocks.listReferralLedger.mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 5 });
    const res = await request(app).get(
      "/api/platform/referral-ledger?page=2&pageSize=5&keyword=%E5%8D%8E%E4%B8%9C&status=GRANTED"
    );
    expect(res.status).toBe(200);
    expect(mocks.listReferralLedger.mock.calls[0][0]).toEqual({
      page: 2,
      pageSize: 5,
      keyword: "华东",
      status: "GRANTED",
    });
  });

  it("pageSize 超 100 / page=0 / status 非法 / 关键词超长 ⇒ 400（不静默夹取、不调用 service）", async () => {
    for (const qs of [
      "pageSize=101",
      "page=0",
      "status=CLOSED",
      `keyword=${"a".repeat(65)}`,
    ]) {
      const res = await request(app).get(`/api/platform/referral-ledger?${qs}`);
      expect(res.status).toBe(400);
    }
    expect(mocks.listReferralLedger).not.toHaveBeenCalled();
  });

  it("service 抛业务错（如 500）⇒ 原样透出，不被控制器吞掉", async () => {
    mocks.listReferralLedger.mockRejectedValueOnce(new AppError("台账查询失败", 500));
    const res = await request(app).get("/api/platform/referral-ledger");
    expect(res.status).toBe(500);
    expect(res.body.msg).toBe("台账查询失败");
  });

  it("未定义的自拟路径 ⇒ 404；**没有任何写台账端点**", async () => {
    const results = await Promise.all([
      request(app).post("/api/platform/referral-ledger").send({ inviterTenantId: "a" }),
      request(app).put("/api/platform/referral-ledger/1").send({ rewardPoints: 1 }),
      request(app).get("/api/platform/referral-ledger/1"),
      request(app).get("/api/platform/referral-ledgers"),
      request(app).post("/api/platform/referral-ledger/1/grant"),
    ]);
    for (const res of results) {
      expect(res.status).toBe(404);
    }
    expect(mocks.listReferralLedger).not.toHaveBeenCalled();
  });
});
