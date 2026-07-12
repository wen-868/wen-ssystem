import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/tenant.service", () => ({
  listTenants: vi.fn(),
  getTenantDetail: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  changeTenantStatus: vi.fn(),
  getTenantModules: vi.fn(),
  setTenantModules: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as tenantService from "@services/admin/tenant.service";
import { ok } from "@shared/response";
import { listTenants, getTenantDetail, createTenant, updateTenant, changeTenantStatus, getTenantModules, setTenantModules } from "@controllers/tenant.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("tenant.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listTenants - 应返回租户列表", async () => {
    (tenantService.listTenants as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listTenants(req as any, res as any);
    expect(tenantService.listTenants).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTenantDetail - 应返回租户详情", async () => {
    (tenantService.getTenantDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { tenantId: 1 } });
    const res = mockRes();
    await getTenantDetail(req as any, res as any);
    expect(tenantService.getTenantDetail).toHaveBeenCalledWith(1);
    expect(ok).toHaveBeenCalled();
  });

  it("createTenant - 应创建租户", async () => {
    (tenantService.createTenant as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        companyName: "测试公司",
        contactPerson: "张三",
        contactMobile: "13800138000",
      },
    });
    const res = mockRes();
    await createTenant(req as any, res as any);
    expect(tenantService.createTenant).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createTenant - zod验证失败", async () => {
    const req = mockReq({ body: { companyName: "", contactPerson: "", contactMobile: "" } });
    const res = mockRes();
    await expect(createTenant(req as any, res as any)).rejects.toThrow();
  });

  it("updateTenant - 应更新租户", async () => {
    (tenantService.updateTenant as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { tenantId: 1 }, body: { companyName: "新名称" } });
    const res = mockRes();
    await updateTenant(req as any, res as any);
    expect(tenantService.updateTenant).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("changeTenantStatus - 应变更租户状态", async () => {
    (tenantService.changeTenantStatus as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { tenantId: 1 }, body: { status: "ACTIVE" } });
    const res = mockRes();
    await changeTenantStatus(req as any, res as any);
    expect(tenantService.changeTenantStatus).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTenantModules - 应获取租户模块", async () => {
    (tenantService.getTenantModules as any).mockResolvedValue([]);
    const req = mockReq({ params: { tenantId: 1 } });
    const res = mockRes();
    await getTenantModules(req as any, res as any);
    expect(tenantService.getTenantModules).toHaveBeenCalledWith(1);
    expect(ok).toHaveBeenCalled();
  });

  it("setTenantModules - 应设置租户模块", async () => {
    (tenantService.setTenantModules as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { tenantId: 1 },
      body: { modules: [{ moduleCode: "ORDER", moduleName: "订单", enabled: 1 }] },
    });
    const res = mockRes();
    await setTenantModules(req as any, res as any);
    expect(tenantService.setTenantModules).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("setTenantModules - zod验证失败", async () => {
    const req = mockReq({ params: { tenantId: 1 }, body: { modules: [{ moduleCode: "", enabled: 2 }] } });
    const res = mockRes();
    await expect(setTenantModules(req as any, res as any)).rejects.toThrow();
  });
});