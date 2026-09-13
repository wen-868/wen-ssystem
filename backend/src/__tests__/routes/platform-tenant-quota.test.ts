/**
 * 路由级测试：GET /api/platform/tenants/:id/quota（R101-S2-01 批 4）
 * 范式：src/__tests__/routes/platform-tenant.test.ts + fixtures/create-test-app.ts
 */
import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/platform/tenant-quota.service", () => ({
  getTenantQuota: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

import * as quotaService from "../../services/platform/tenant-quota.service";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";
import { getTenantQuotaCtrl } from "../../controllers/platform/tenant-quota.controller";

const app = createTestApp({ prefix: "/api/platform/tenants", router: platformTenantRouter });

const SAMPLE = {
  tenantId: "1",
  planName: "旗舰版",
  quota: {
    accounts: { used: 13, limit: 30, unit: "个" },
    products: { used: 26540, limit: 100000, unit: "个" },
    stores: { used: 8, limit: 20, unit: "个" },
    storage: { used: 31, limit: 100, unit: "GB" },
    apiDaily: null,
    aiMonthly: { used: 7420, limit: 10000, unit: "次·月" },
  },
  unavailable: [{ key: "apiDaily", reason: "后端无 API 调用计数数据源（无调用计数表）" }],
};

describe("routes/platform-tenant · GET /:id/quota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("鉴权通过 → 200 + 信封 code '0'，data 含 6 键且 apiDaily 为 null", async () => {
    (quotaService.getTenantQuota as any).mockResolvedValue(SAMPLE);
    const res = await request(app).get("/api/platform/tenants/1/quota");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.tenantId).toBe("1");
    expect(Object.keys(res.body.data.quota).sort()).toEqual(
      ["accounts", "aiMonthly", "apiDaily", "products", "stores", "storage"].sort()
    );
    expect(res.body.data.quota.apiDaily).toBeNull();
    expect(res.body.data.unavailable).toContainEqual({
      key: "apiDaily",
      reason: "后端无 API 调用计数数据源（无调用计数表）",
    });
  });

  it("缺 id → 400（AppError 校验）", async () => {
    let caught: any = null;
    const fakeNext = (err: any) => {
      caught = err;
    };
    await getTenantQuotaCtrl(
      { params: { id: "" } } as any,
      { json: () => {} } as any,
      fakeNext as any
    );

    expect(caught).not.toBeNull();
    expect(caught.statusCode).toBe(400);
    expect(caught.message).toContain("租户 ID");
  });

  it("service 抛错 → 500", async () => {
    (quotaService.getTenantQuota as any).mockRejectedValue(new Error("db error"));
    const res = await request(app).get("/api/platform/tenants/1/quota");
    expect(res.status).toBe(500);
  });
});
