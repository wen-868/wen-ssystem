import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { query, queryOne } from "@shared/db";
import { ok } from "@shared/response";
import { getPlatformOverview, listPlatformTenants } from "@controllers/admin/platform.controller";

const mockReq = (overrides: any = {}) => ({
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("platform.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPlatformOverview - 应获取平台概览", async () => {
    const req = mockReq();
    const res = mockRes();
    await getPlatformOverview(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("listPlatformTenants - 应列出平台租户", async () => {
    const req = mockReq();
    const res = mockRes();
    await listPlatformTenants(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getPlatformOverview - queryOne返回null时使用默认值0", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await getPlatformOverview(req as any, res as any);
    expect(ok).toHaveBeenCalledWith({
      tenantCount: 0,
      userCount: 0,
      storeCount: 0,
      orderCount: 0,
    });
  });

  it("listPlatformTenants - query返回null时使用空数组兜底", async () => {
    (query as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await listPlatformTenants(req as any, res as any);
    expect(ok).toHaveBeenCalledWith([]);
  });
});

// ══ TOTAL-TENANT-NAME-SERVER-TRUTH-01 · 活路径 /api/platform/tenants 契约（服务端阶段）══
// 被测：controllers/platform/tenant.controller.ts（platform-tenant.routes 唯一挂载，
// saas-admin TenantList/TenantDetail 的真实数据源）。名称真源单点在
// services/platform/tenant-admin.service.ts 的 enrichTenantRecords（真实代码，不 mock），
// 这里 mock 的是 @shared/db（真值查询落点）与 @services/platform-tenant.service（上游读取）。

vi.mock("@services/platform-tenant.service", () => ({
  listTenants: vi.fn(),
  getTenantById: vi.fn(),
  checkTenantNameExists: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  toggleTenantStatus: vi.fn(),
}));

import * as platformTenantService from "@services/platform-tenant.service";
import {
  listPlatformTenants as liveListPlatformTenants,
  getPlatformTenantById as liveGetPlatformTenantById,
} from "@controllers/platform/tenant.controller";

describe("platform/tenant.controller - 租户名称真源契约（TOTAL-TENANT-NAME-SERVER-TRUTH-01）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (query as any).mockResolvedValue([]);
    (queryOne as any).mockResolvedValue(null);
  });

  it("列表真名：出口补齐 name/companyName/tenantDisplayName，真值查询走 IN 参数绑定", async () => {
    (platformTenantService.listTenants as any).mockResolvedValue({
      total: 1,
      page: 1,
      pageSize: 20,
      records: [
        { id: "t1", tenantName: "酒行A", tenantCode: "T001", contactMobile: "13800000000", status: "ACTIVE" },
      ],
    });
    (query as any).mockResolvedValue([
      { id: "t1", tenantName: "酒行A", name: "酒行A公司全称", companyName: "酒行A公司全称" },
    ]);
    const res = mockRes();
    await liveListPlatformTenants({ query: { page: 1, pageSize: 20 } } as any, res as any);
    // 真值查询：参数绑定（非拼接）
    const truthSql = String(query.mock.calls[0][0]);
    expect(truthSql).toContain("FROM t_tenant");
    expect(truthSql).toContain("IN (?)");
    expect(query.mock.calls[0][1]).toEqual(["t1"]);
    const payload = (ok as any).mock.calls[0][0];
    const row = payload.records[0];
    expect(row.name).toBe("酒行A公司全称");
    expect(row.companyName).toBe("酒行A公司全称");
    expect(row.tenantDisplayName).toBe("酒行A");
    expect(row.tenantCode).toBe("T001"); // 标识字段透传真值
  });

  it("详情真名：tenant_name 空时回退 name 列（第二级），与列表同一单点规则", async () => {
    (platformTenantService.getTenantById as any).mockResolvedValue({
      id: "t2", tenantName: null as unknown as string, tenantCode: "T002", contactMobile: "", status: "ACTIVE",
    });
    (query as any).mockResolvedValue([
      { id: "t2", tenantName: null, name: "存量真名", companyName: null },
    ]);
    const res = mockRes();
    await liveGetPlatformTenantById({ params: { id: "t2" } } as any, res as any);
    const payload = (ok as any).mock.calls[0][0];
    expect(payload.tenantDisplayName).toBe("存量真名");
    expect(payload.name).toBe("存量真名");
    expect(payload.contactMobile).toBe(""); // 联系字段空值透传，不冒充
  });

  it("全空名租户：回退链走完 → 「未命名租户」，整个出口 JSON 不出现「—」", async () => {
    (platformTenantService.listTenants as any).mockResolvedValue({
      total: 1, page: 1, pageSize: 20,
      records: [{ id: "t3", tenantName: null as unknown as string, tenantCode: null as unknown as string, contactMobile: "", status: "ACTIVE" }],
    });
    (query as any).mockResolvedValue([
      { id: "t3", tenantName: null, name: "", companyName: "—" }, // 历史占位「—」同样视为空
    ]);
    const res = mockRes();
    await liveListPlatformTenants({ query: {} } as any, res as any);
    const payload = (ok as any).mock.calls[0][0];
    expect(payload.records[0].tenantDisplayName).toBe("未命名租户");
    expect(payload.records[0].tenantCode).toBeNull(); // 标识字段空值透传
    expect(JSON.stringify(payload)).not.toContain("—");
  });

  it("真值查询无行（防越界）：按记录自身 tenantName 兜底解析，不抛错、不出「—」", async () => {
    (platformTenantService.listTenants as any).mockResolvedValue({
      total: 1, page: 1, pageSize: 20,
      records: [{ id: "t9", tenantName: "自身兜底名", tenantCode: "T009", contactMobile: "139", status: "ACTIVE" }],
    });
    (query as any).mockResolvedValue([]); // 真值查询未覆盖
    const res = mockRes();
    await liveListPlatformTenants({ query: {} } as any, res as any);
    const payload = (ok as any).mock.calls[0][0];
    expect(payload.records[0].tenantDisplayName).toBe("自身兜底名");
  });
});
