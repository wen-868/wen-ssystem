/**
 * C1-2（批次 B · 套餐域）路由级测试
 * 范式：src/__tests__/routes/platform-r97.test.ts + fixtures/create-test-app.ts
 */
import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/platform/plan-upgrade-flow.service", () => ({
  getUpgradeFlowReport: vi.fn(),
  normalizeRange: vi.fn(),
  UPGRADE_FLOW_RANGES: ["month", "3m", "12m"],
}));

vi.mock("../../services/platform/plan-copy.service", () => ({
  copyPlan: vi.fn(),
}));

vi.mock("../../services/admin/subscription-plan.service", () => ({
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  updatePlanFeatures: vi.fn(),
}));

vi.mock("../../services/platform/plan-policy.service", () => ({
  getPlanPolicy: vi.fn(),
  updatePlanPolicy: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAuthWithTenant: [],
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: any, _res: any, next: any) => next(),
  generateCsrfToken: vi.fn(() => "test-csrf"),
}));

import * as flowService from "../../services/platform/plan-upgrade-flow.service";
import * as copyService from "../../services/platform/plan-copy.service";
import { AppError } from "../../shared/app-error";
import { platformPlansRouter } from "../../routes/platform-plans.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: "/api/platform/plans", router: platformPlansRouter });

describe("C1-2 B1 GET /api/platform/plans/upgrade-flow-report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 流向记录（空数据为空数组，不编造）", async () => {
    (flowService.getUpgradeFlowReport as any).mockResolvedValue({
      range: "month",
      rangeStart: "2026-09-01 00:00:00",
      dataSource: "t_subscription_operation_log(operation_type IN ('UPGRADE','DOWNGRADE'))",
      summary: { events: 0, tenants: 0 },
      records: [],
    });
    const res = await request(app).get("/api/platform/plans/upgrade-flow-report");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records).toEqual([]);
    expect(res.body.data.summary.events).toBe(0);
  });

  it("range 透传给 service（?range=3m）", async () => {
    (flowService.getUpgradeFlowReport as any).mockResolvedValue({
      range: "3m",
      rangeStart: "2026-07-01 00:00:00",
      dataSource: "x",
      summary: { events: 1, tenants: 1 },
      records: [
        {
          direction: "UPGRADE",
          dir: "UP",
          fromPlanId: 1,
          fromPlanName: "基础版",
          toPlanId: 2,
          toPlanName: "标准版",
          eventCount: 1,
          tenantCount: 1,
          lastAt: "2026-09-10 10:00:00",
        },
      ],
    });
    const res = await request(app).get("/api/platform/plans/upgrade-flow-report?range=3m");
    expect(res.status).toBe(200);
    expect(res.body.data.records[0].dir).toBe("UP");
    expect(flowService.getUpgradeFlowReport).toHaveBeenCalledWith("3m");
  });

  it("range 非法 → 400（service 抛 AppError）", async () => {
    (flowService.getUpgradeFlowReport as any).mockRejectedValue(
      new AppError("range 非法（可选：month / 3m / 12m）", 400)
    );
    const res = await request(app).get("/api/platform/plans/upgrade-flow-report?range=99y");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
  });

  it("路由注册顺序：/upgrade-flow-report 在 /:planId 之前", () => {
    const paths = (platformPlansRouter as any).stack
      .map((l: any) => l.route?.path)
      .filter(Boolean);
    expect(paths.indexOf("/upgrade-flow-report")).toBeGreaterThan(-1);
    expect(paths.indexOf("/upgrade-flow-report")).toBeLessThan(paths.indexOf("/:planId"));
  });
});

describe("C1-2 B2 POST /api/platform/plans/:planId/copy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 复制结果（操作人取平台令牌 username）", async () => {
    (copyService.copyPlan as any).mockResolvedValue({
      id: 9,
      planCode: "STANDARD-COPY",
      planName: "标准版（副本）",
      status: "INACTIVE",
      sourcePlanId: 2,
      copied: { features: true, moduleAccess: true, policy: false },
      warnings: [],
      readBack: { id: 9, planCode: "STANDARD-COPY", planName: "标准版（副本）", status: "INACTIVE" },
    });
    const res = await request(app)
      .post("/api/platform/plans/2/copy")
      .send({ planCode: "STANDARD-COPY" });

    expect(res.status).toBe(200);
    expect(res.body.data.readBack.id).toBe(9);
    expect(copyService.copyPlan).toHaveBeenCalledWith(
      2,
      { planCode: "STANDARD-COPY", planName: undefined, status: undefined },
      "testadmin"
    );
  });

  it("planId 非法 → 400 且不调 service", async () => {
    const res = await request(app).post("/api/platform/plans/abc/copy").send({});
    expect(res.status).toBe(400);
    expect(copyService.copyPlan).not.toHaveBeenCalled();
  });

  it("编码冲突 → 409（service 抛 AppError）", async () => {
    (copyService.copyPlan as any).mockRejectedValue(
      new AppError("套餐编码已存在：BASIC", 409)
    );
    const res = await request(app).post("/api/platform/plans/2/copy").send({ planCode: "BASIC" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("409");
  });

  it("源套餐不存在 → 404（service 抛 AppError）", async () => {
    (copyService.copyPlan as any).mockRejectedValue(new AppError("源套餐不存在", 404));
    const res = await request(app).post("/api/platform/plans/999/copy").send({});
    expect(res.status).toBe(404);
  });
});

describe("C1-2 鉴权守卫（套餐域）", () => {
  it("router 级挂载 requirePlatformAuth", () => {
    const guardLayer = (platformPlansRouter as any).stack.find(
      (l: any) => l.handle === (requirePlatformAuth as any)
    );
    expect(guardLayer).toBeTruthy();
  });
});
