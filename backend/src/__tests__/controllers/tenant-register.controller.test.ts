import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/tenant-register.service", () => ({
  applyTenantRegister: vi.fn(),
  approveTenantApplication: vi.fn(),
  rejectTenantApplication: vi.fn(),
  listTenantApplications: vi.fn(),
  getTenantApplication: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
}));

vi.mock("../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as tenantRegisterService from "../../services/tenant-register.service";
import { ok } from "../../shared/response";
import {
  handleApplyTenantRegister,
  handleListApplications,
  handleGetApplication,
  handleApproveApplication,
  handleRejectApplication,
} from "../../controllers/tenant-register.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("tenant-register.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("handleApplyTenantRegister", () => {
    it("租户注册申请提交成功", async () => {
      tenantRegisterService.applyTenantRegister.mockResolvedValue({ applicationId: 123 });

      const req = mockReq({ body: { companyName: "测试公司", adminUsername: "admin", adminPassword: "Pass@1234", contactPerson: "张三", contactMobile: "13800000000" } });
      const res = mockRes();

      await handleApplyTenantRegister(req, res);

      expect(tenantRegisterService.applyTenantRegister).toHaveBeenCalledWith(req.body);
      expect(res.json).toHaveBeenCalledWith(ok({ applicationId: 123, message: "申请已提交，等待平台管理员审核" }));
    });
  });

  describe("handleListApplications", () => {
    it("查询申请列表", async () => {
      tenantRegisterService.listTenantApplications.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 10 });

      const req = mockReq({ query: { status: "PENDING", page: "2", pageSize: "10" } });
      const res = mockRes();

      await handleListApplications(req, res);

      expect(tenantRegisterService.listTenantApplications).toHaveBeenCalledWith({ status: "PENDING", page: 2, pageSize: 10 });
      expect(res.json).toHaveBeenCalledWith(ok({ list: [], total: 0, page: 2, pageSize: 10 }));
    });
  });

  describe("handleGetApplication", () => {
    it("查询申请详情", async () => {
      tenantRegisterService.getTenantApplication.mockResolvedValue({ id: 1, companyName: "测试公司" });

      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();

      await handleGetApplication(req, res);

      expect(res.json).toHaveBeenCalledWith(ok({ id: 1, companyName: "测试公司" }));
    });

    it("申请不存在返回404", async () => {
      tenantRegisterService.getTenantApplication.mockResolvedValue(null);

      const req = mockReq({ params: { id: "999" } });
      const res = mockRes();

      await handleGetApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, code: "404", message: "申请不存在" });
    });
  });

  describe("handleApproveApplication", () => {
    it("审核通过申请", async () => {
      tenantRegisterService.approveTenantApplication.mockResolvedValue({ tenantId: "100", applicationId: 1 });

      const req = mockReq({ params: { id: "1" }, body: { reviewerId: 99 } });
      const res = mockRes();

      await handleApproveApplication(req, res);

      expect(tenantRegisterService.approveTenantApplication).toHaveBeenCalledWith(1, 99);
      expect(res.json).toHaveBeenCalledWith(ok({ tenantId: "100", applicationId: 1 }));
    });

    it("使用当前用户作为审核人", async () => {
      tenantRegisterService.approveTenantApplication.mockResolvedValue({ tenantId: "100", applicationId: 1 });

      const req = mockReq({ params: { id: "1" }, body: {} });
      const res = mockRes();

      await handleApproveApplication(req, res);

      expect(tenantRegisterService.approveTenantApplication).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("handleRejectApplication", () => {
    it("驳回申请", async () => {
      tenantRegisterService.rejectTenantApplication.mockResolvedValue({ applicationId: 1 });

      const req = mockReq({ params: { id: "1" }, body: { rejectReason: "资料不全", reviewerId: 99 } });
      const res = mockRes();

      await handleRejectApplication(req, res);

      expect(tenantRegisterService.rejectTenantApplication).toHaveBeenCalledWith(1, 99, "资料不全");
      expect(res.json).toHaveBeenCalledWith(ok({ applicationId: 1 }));
    });

    it("驳回原因为空返回400", async () => {
      const req = mockReq({ params: { id: "1" }, body: { rejectReason: "" } });
      const res = mockRes();

      await handleRejectApplication(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, code: "400", message: "驳回原因不能为空" });
    });
  });
});