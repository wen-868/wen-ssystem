import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/platform/tenant-admin.service", () => ({
  listPlatformTenants: vi.fn(),
  getPlatformTenantDetail: vi.fn(),
  createPlatformTenant: vi.fn(),
  updatePlatformTenant: vi.fn(),
}));

vi.mock("../../../services/platform/admin-account.service", () => ({
  listPlatformAdmins: vi.fn(),
  createPlatformAdmin: vi.fn(),
  updatePlatformAdminStatus: vi.fn(),
}));

vi.mock("../../../services/platform/platform-overview.service", () => ({
  getPlatformOverview: vi.fn(),
}));

vi.mock("../../../services/platform/subscription-admin.service", () => ({
  listPlatformSubscriptions: vi.fn(),
  createPlatformSubscription: vi.fn(),
}));

vi.mock("../../../services/platform/platform-config.service", () => ({
  listPlatformConfigs: vi.fn(),
  updatePlatformConfig: vi.fn(),
  listPlatformAuditLogs: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as tenantAdminService from "../../../services/platform/tenant-admin.service";
import * as adminAccountService from "../../../services/platform/admin-account.service";
import * as overviewService from "../../../services/platform/platform-overview.service";
import * as subscriptionAdminService from "../../../services/platform/subscription-admin.service";
import * as configService from "../../../services/platform/platform-config.service";
import { ok, fail } from "../../../shared/response";
import {
  listTenants, getTenantDetail, createTenant, updateTenant,
  listAdmins, createAdmin, updateAdminStatus,
  getOverview,
  listSubscriptions, createSubscription,
  listConfigs, updateConfig,
  listAuditLogs,
} from "../../../controllers/platform/platform.controller";

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

describe("platform/platform.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("租户管理", () => {
    it("listTenants - 应返回租户列表", async () => {
      (tenantAdminService.listPlatformTenants as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "20", status: "ACTIVE", keyword: "测试", planCode: "basic" } });
      const res = mockRes();
      await listTenants(req as any, res as any, vi.fn());
      expect(tenantAdminService.listPlatformTenants).toHaveBeenCalledWith(1, 20, { status: "ACTIVE", keyword: "测试", planCode: "basic" });
      expect(ok).toHaveBeenCalled();
    });

    it("getTenantDetail - 租户不存在应返回404", async () => {
      (tenantAdminService.getPlatformTenantDetail as any).mockResolvedValue(null);
      const req = mockReq({ params: { tenantId: "t999" } });
      const res = mockRes();
      await getTenantDetail(req as any, res as any, vi.fn());
      expect(tenantAdminService.getPlatformTenantDetail).toHaveBeenCalledWith("t999");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(fail).toHaveBeenCalledWith("租户不存在", "404");
    });

    it("getTenantDetail - 应返回租户详情", async () => {
      (tenantAdminService.getPlatformTenantDetail as any).mockResolvedValue({ tenantId: "t1" });
      const req = mockReq({ params: { tenantId: "t1" } });
      const res = mockRes();
      await getTenantDetail(req as any, res as any, vi.fn());
      expect(ok).toHaveBeenCalled();
    });

    it("createTenant - 应创建租户", async () => {
      (tenantAdminService.createPlatformTenant as any).mockResolvedValue({ tenantId: "t1" });
      const req = mockReq({ body: { tenantName: "新租户", tenantCode: "new_tenant", contactName: "张三", contactPhone: "13800138000", durationDays: 30 } });
      const res = mockRes();
      await createTenant(req as any, res as any, vi.fn());
      expect(tenantAdminService.createPlatformTenant).toHaveBeenCalledWith(expect.objectContaining({
        tenantName: "新租户",
        tenantCode: "new_tenant",
        contactName: "张三",
        contactPhone: "13800138000",
        durationDays: 30,
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("updateTenant - 应更新租户", async () => {
      (tenantAdminService.updatePlatformTenant as any).mockResolvedValue({ tenantId: "t1" });
      const req = mockReq({ params: { tenantId: "t1" }, body: { tenantName: "更新租户" } });
      const res = mockRes();
      await updateTenant(req as any, res as any, vi.fn());
      expect(tenantAdminService.updatePlatformTenant).toHaveBeenCalledWith("t1", expect.objectContaining({
        tenantName: "更新租户",
      }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("平台管理员", () => {
    it("listAdmins - 应返回管理员列表", async () => {
      (adminAccountService.listPlatformAdmins as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "20", role: "ADMIN", status: "ACTIVE", keyword: "测试" } });
      const res = mockRes();
      await listAdmins(req as any, res as any, vi.fn());
      expect(adminAccountService.listPlatformAdmins).toHaveBeenCalledWith(1, 20, { role: "ADMIN", status: "ACTIVE", keyword: "测试" });
      expect(ok).toHaveBeenCalled();
    });

    it("createAdmin - 应创建管理员", async () => {
      (adminAccountService.createPlatformAdmin as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { username: "admin", password: "123456", realName: "管理员", phone: "13800138000", role: "ADMIN" } });
      const res = mockRes();
      await createAdmin(req as any, res as any, vi.fn());
      expect(adminAccountService.createPlatformAdmin).toHaveBeenCalledWith(expect.objectContaining({
        username: "admin",
        password: "123456",
        realName: "管理员",
        phone: "13800138000",
        role: "ADMIN",
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("updateAdminStatus - 应更新管理员状态", async () => {
      (adminAccountService.updatePlatformAdminStatus as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body: { status: "DISABLED" } });
      const res = mockRes();
      await updateAdminStatus(req as any, res as any, vi.fn());
      expect(adminAccountService.updatePlatformAdminStatus).toHaveBeenCalledWith(1, "DISABLED");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("数据统计", () => {
    it("getOverview - 应返回平台概览", async () => {
      (overviewService.getPlatformOverview as any).mockResolvedValue({ totalTenants: 100 });
      const req = mockReq();
      const res = mockRes();
      await getOverview(req as any, res as any, vi.fn());
      expect(overviewService.getPlatformOverview).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("订阅管理", () => {
    it("listSubscriptions - 应返回订阅列表", async () => {
      (subscriptionAdminService.listPlatformSubscriptions as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "20", tenantId: "t1", status: "ACTIVE", planCode: "basic", keyword: "测试" } });
      const res = mockRes();
      await listSubscriptions(req as any, res as any, vi.fn());
      expect(subscriptionAdminService.listPlatformSubscriptions).toHaveBeenCalledWith(1, 20, { tenantId: "t1", status: "ACTIVE", planCode: "basic", keyword: "测试" });
      expect(ok).toHaveBeenCalled();
    });

    it("createSubscription - 应创建订阅", async () => {
      (subscriptionAdminService.createPlatformSubscription as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { tenantId: "t1", planCode: "basic", planName: "基础版", durationDays: 30, amount: 99, operator: "platform" } });
      const res = mockRes();
      await createSubscription(req as any, res as any, vi.fn());
      expect(subscriptionAdminService.createPlatformSubscription).toHaveBeenCalledWith("t1", "basic", "基础版", 30, 99, "platform");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("系统配置", () => {
    it("listConfigs - 应返回配置列表", async () => {
      (configService.listPlatformConfigs as any).mockResolvedValue([]);
      const req = mockReq({ query: { category: "system" } });
      const res = mockRes();
      await listConfigs(req as any, res as any, vi.fn());
      expect(configService.listPlatformConfigs).toHaveBeenCalledWith("system");
      expect(ok).toHaveBeenCalled();
    });

    it("listConfigs - 无 category 时为 undefined", async () => {
      (configService.listPlatformConfigs as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listConfigs(req as any, res as any, vi.fn());
      expect(configService.listPlatformConfigs).toHaveBeenCalledWith(undefined);
      expect(ok).toHaveBeenCalled();
    });

    it("updateConfig - 应更新配置", async () => {
      (configService.updatePlatformConfig as any).mockResolvedValue({ configKey: "key1" });
      const req = mockReq({ params: { key: "key1" }, body: { configValue: "value1", operator: "admin" } });
      const res = mockRes();
      await updateConfig(req as any, res as any, vi.fn());
      expect(configService.updatePlatformConfig).toHaveBeenCalledWith("key1", "value1", "admin");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("操作日志", () => {
    it("listAuditLogs - 应返回审计日志列表", async () => {
      (configService.listPlatformAuditLogs as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "20", adminId: "1", action: "create", module: "tenant", keyword: "测试", startDate: "2026-01-01", endDate: "2026-01-31" } });
      const res = mockRes();
      await listAuditLogs(req as any, res as any, vi.fn());
      expect(configService.listPlatformAuditLogs).toHaveBeenCalledWith(1, 20, {
        adminId: 1,
        action: "create",
        module: "tenant",
        keyword: "测试",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });
      expect(ok).toHaveBeenCalled();
    });

    it("listAuditLogs - 无可选参数时为 undefined", async () => {
      (configService.listPlatformAuditLogs as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listAuditLogs(req as any, res as any, vi.fn());
      expect(configService.listPlatformAuditLogs).toHaveBeenCalledWith(1, 20, {
        adminId: undefined,
        action: undefined,
        module: undefined,
        keyword: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(ok).toHaveBeenCalled();
    });
  });
});
