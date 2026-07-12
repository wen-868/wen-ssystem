import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

vi.mock("../../shared/password.js", () => ({
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

vi.mock("../../shared/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  applyTenantRegister,
  approveTenantApplication,
  rejectTenantApplication,
  listTenantApplications,
  getTenantApplication,
} from "../../services/tenant-register.service.js";

describe("tenant-register.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue("hashed_password");
    mocks.query.mockResolvedValue({ insertId: 1 });
  });

  describe("applyTenantRegister", () => {
    const validInput = {
      companyName: "测试公司",
      contactPerson: "张三",
      contactMobile: "13800000000",
      adminUsername: "admin",
      adminPassword: "Pass@1234",
      adminRealName: "张三",
    };

    it("密码强度不足应拒绝", async () => {
      mocks.validatePassword.mockReturnValue({ valid: false, errors: ["密码长度不足"] });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("密码不符合要求");
    });

    it("公司名称已存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该公司名称已提交过注册申请");
    });

    it("手机号已存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该手机号已提交过注册申请");
    });

    it("管理员账号已被使用（申请表）应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该管理员账号已被使用");
    });

    it("管理员账号已被使用（用户表）应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该管理员账号已被使用");
    });

    it("注册申请提交成功", async () => {
      mocks.queryOne.mockResolvedValue(null);
      mocks.query.mockResolvedValue({ insertId: 123 });

      const result = await applyTenantRegister(validInput);

      expect(result).toEqual({ applicationId: 123 });
      expect(mocks.hashPassword).toHaveBeenCalledWith("Pass@1234");
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("approveTenantApplication", () => {
    it("申请不存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(approveTenantApplication(999, 1)).rejects.toThrow("申请不存在或已处理");
    });

    it("申请审核通过", async () => {
      mocks.queryOne.mockResolvedValue({
        company_name: "测试公司",
        contact_person: "张三",
        contact_mobile: "13800000000",
        contact_email: "test@test.com",
        admin_username: "admin",
        admin_password_hash: "hashed",
        admin_real_name: "张三",
      });
      let tenantInsertId: any;
      mocks.transaction.mockImplementation(async (cb: any) => {
        const mockConn = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("INSERT INTO tenant")) {
              tenantInsertId = { insertId: 100 };
              return tenantInsertId;
            }
            return { insertId: 1 };
          }),
        };
        await cb(mockConn);
      });

      const result = await approveTenantApplication(1, 99);

      expect(result).toEqual({ tenantId: "100", applicationId: 1 });
      expect(mocks.transaction).toHaveBeenCalled();
    });
  });

  describe("rejectTenantApplication", () => {
    it("申请不存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(rejectTenantApplication(999, 1, "理由")).rejects.toThrow("申请不存在或已处理");
    });

    it("申请驳回成功", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1 });
      mocks.query.mockResolvedValue({ affectedRows: 1 });

      const result = await rejectTenantApplication(1, 99, "资料不全");

      expect(result).toEqual({ applicationId: 1 });
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("listTenantApplications", () => {
    it("查询申请列表", async () => {
      mocks.queryOne.mockResolvedValue({ total: 5 });
      mocks.query.mockResolvedValue([
        { id: 1, companyName: "公司A", contactPerson: "张三", contactMobile: "13800000001", adminUsername: "admin1", status: "PENDING", createdAt: "2026-07-12" },
      ]);

      const result = await listTenantApplications({});

      expect(result.total).toBe(5);
      expect(result.list.length).toBe(1);
      expect(result.list[0].companyName).toBe("公司A");
    });

    it("按状态筛选申请列表", async () => {
      mocks.queryOne.mockResolvedValue({ total: 2 });
      mocks.query.mockResolvedValue([]);

      const result = await listTenantApplications({ status: "APPROVED", page: 2, pageSize: 10 });

      expect(result.total).toBe(2);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe("getTenantApplication", () => {
    it("查询申请详情", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1,
        companyName: "公司A",
        companyShortName: "A公司",
        contactPerson: "张三",
        contactMobile: "13800000001",
        adminUsername: "admin1",
        status: "PENDING",
        createdAt: "2026-07-12",
      });

      const result = await getTenantApplication(1);

      expect(result).not.toBeNull();
      expect(result?.companyName).toBe("公司A");
    });

    it("申请不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);

      const result = await getTenantApplication(999);

      expect(result).toBeNull();
    });
  });
});