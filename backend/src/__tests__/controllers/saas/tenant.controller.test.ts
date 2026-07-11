import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/saas/tenant.service.js", () => ({
  listTenants: vi.fn(),
  getTenantDetail: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  auditTenant: vi.fn(),
  toggleTenantStatus: vi.fn(),
  getTenantStatistics: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as tenantService from "../../../services/saas/tenant.service.js";
import { ok, fail } from "../../../shared/response.js";
import { listTenants, getTenantDetail, createTenant, updateTenant, auditTenant, toggleTenantStatus, getTenantStatistics } from "../../../controllers/saas/tenant.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("saas/tenant.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listTenants - 应返回租户列表", async () => {
    (tenantService.listTenants as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { keyword: "测试", status: "ACTIVE", page: "1", pageSize: "20" } });
    const res = mockRes();
    await listTenants(req as any, res as any);
    expect(tenantService.listTenants).toHaveBeenCalledWith({
      keyword: "测试",
      status: "ACTIVE",
      page: 1,
      pageSize: 20,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listTenants - 无参数时使用默认值", async () => {
    (tenantService.listTenants as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listTenants(req as any, res as any);
    expect(tenantService.listTenants).toHaveBeenCalledWith({
      keyword: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getTenantDetail - 租户不存在应返回404", async () => {
    (tenantService.getTenantDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getTenantDetail(req as any, res as any);
    expect(tenantService.getTenantDetail).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("租户不存在", "404");
  });

  it("getTenantDetail - 应返回租户详情", async () => {
    (tenantService.getTenantDetail as any).mockResolvedValue({ id: 1, companyName: "测试公司" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getTenantDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createTenant - 应创建租户", async () => {
    (tenantService.createTenant as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { companyName: "新公司", contactPerson: "张三", contactMobile: "13800138000" } });
    const res = mockRes();
    await createTenant(req as any, res as any);
    expect(tenantService.createTenant).toHaveBeenCalledWith(expect.objectContaining({
      companyName: "新公司",
      contactPerson: "张三",
      contactMobile: "13800138000",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("updateTenant - 租户不存在应返回404", async () => {
    (tenantService.updateTenant as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { companyName: "更新公司" } });
    const res = mockRes();
    await updateTenant(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("租户不存在", "404");
  });

  it("updateTenant - 应更新租户", async () => {
    (tenantService.updateTenant as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { companyName: "更新公司" } });
    const res = mockRes();
    await updateTenant(req as any, res as any);
    expect(tenantService.updateTenant).toHaveBeenCalledWith(1, expect.objectContaining({
      companyName: "更新公司",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("auditTenant - 租户不存在应返回404", async () => {
    (tenantService.auditTenant as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { status: "ACTIVE" } });
    const res = mockRes();
    await auditTenant(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("租户不存在", "404");
  });

  it("auditTenant - 应审核租户", async () => {
    (tenantService.auditTenant as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { status: "ACTIVE", remark: "通过" } });
    const res = mockRes();
    await auditTenant(req as any, res as any);
    expect(tenantService.auditTenant).toHaveBeenCalledWith(1, { status: "ACTIVE", remark: "通过" });
    expect(ok).toHaveBeenCalled();
  });

  it("toggleTenantStatus - 租户不存在应返回404", async () => {
    (tenantService.toggleTenantStatus as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { status: "SUSPENDED" } });
    const res = mockRes();
    await toggleTenantStatus(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("租户不存在", "404");
  });

  it("toggleTenantStatus - 应切换租户状态", async () => {
    (tenantService.toggleTenantStatus as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { status: "SUSPENDED" } });
    const res = mockRes();
    await toggleTenantStatus(req as any, res as any);
    expect(tenantService.toggleTenantStatus).toHaveBeenCalledWith(1, "SUSPENDED");
    expect(ok).toHaveBeenCalled();
  });

  it("getTenantStatistics - 应返回租户统计", async () => {
    (tenantService.getTenantStatistics as any).mockResolvedValue({ total: 100 });
    const req = mockReq();
    const res = mockRes();
    await getTenantStatistics(req as any, res as any);
    expect(tenantService.getTenantStatistics).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
