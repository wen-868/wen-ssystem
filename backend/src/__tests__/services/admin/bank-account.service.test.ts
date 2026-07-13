/**
 * 管理端银行账户 service 单元测试
 * 被测文件：src/services/admin/bank-account.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  updateBankAccountBalance,
  freezeBankAccount,
  unfreezeBankAccount,
  closeBankAccount,
  getTotalBalance,
} from "../../../services/admin/bank-account.service";

describe("bank-account.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listBankAccounts", () => {
    it("返回账户列表含 total", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, accountName: "账户1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
      const res = await listBankAccounts({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(5);
      expect(res.records.length).toBe(1);
    });

    it("带 status 筛选", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listBankAccounts({ status: "ACTIVE", page: 1, pageSize: 20, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("total 为 null 时返回 0", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listBankAccounts({ page: 1, pageSize: 10, tenantId: "t1" });
      expect(res.total).toBe(0);
    });
  });

  describe("getBankAccount", () => {
    it("账户不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(getBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户不存在",
        statusCode: 404,
      });
    });

    it("返回账户信息", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, accountName: "账户1", bankName: "中国银行" });
      const res = await getBankAccount(1, "t1");
      expect(res.id).toBe(1);
      expect(res.accountName).toBe("账户1");
    });
  });

  describe("createBankAccount", () => {
    it("创建账户并回查返回", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, accountName: "账户1", bankName: "中国银行", accountNo: "123456" });
      const res = await createBankAccount({ accountName: "账户1", bankName: "中国银行", accountNo: "123456", tenantId: "t1" });
      expect(res.id).toBe(1);
      expect(res.accountName).toBe("账户1");
    });

    it("使用默认 accountType 和 balance", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      mocks.queryOneWithTenant.mockResolvedValue({ id: 2 });
      await createBankAccount({ accountName: "账户2", bankName: "工商银行", accountNo: "654321", tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("传入 accountType 和 balance", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      mocks.queryOneWithTenant.mockResolvedValue({ id: 3 });
      await createBankAccount({ accountName: "账户3", bankName: "建设银行", accountNo: "111111", accountType: "MAIN", balance: 1000, tenantId: "t1" });
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });

  describe("updateBankAccount", () => {
    it("无字段更新时抛 400", async () => {
      await expect(updateBankAccount(1, { tenantId: "t1" })).rejects.toMatchObject({
        message: "没有需要更新的字段",
        statusCode: 400,
      });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("更新字段时执行 UPDATE", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateBankAccount(1, { accountName: "新名称", bankName: "新银行", tenantId: "t1" });
      expect(res.id).toBe(1);
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("account_name = ?");
      expect(sql).toContain("bank_name = ?");
    });

    it("只更新 accountType", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      await updateBankAccount(1, { accountType: "MAIN", tenantId: "t1" });
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("account_type = ?");
    });
  });

  describe("updateBankAccountBalance", () => {
    it("账户不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(updateBankAccountBalance(1, 100, "t1")).rejects.toMatchObject({
        message: "银行账户不存在",
        statusCode: 404,
      });
    });

    it("正常更新余额（正数）", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ balance: 1000 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateBankAccountBalance(1, 500, "t1");
      expect(res.balance).toBe(1500);
    });

    it("正常更新余额（负数）", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ balance: 1000 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateBankAccountBalance(1, -300, "t1");
      expect(res.balance).toBe(700);
    });
  });

  describe("freezeBankAccount", () => {
    it("账户不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(freezeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户不存在",
        statusCode: 404,
      });
    });

    it("账户已冻结时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "FROZEN" });
      await expect(freezeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户状态异常",
        statusCode: 400,
      });
    });

    it("正常冻结账户", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "ACTIVE" });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await freezeBankAccount(1, "t1");
      expect(res.status).toBe("FROZEN");
    });
  });

  describe("unfreezeBankAccount", () => {
    it("账户不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(unfreezeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户不存在",
        statusCode: 404,
      });
    });

    it("账户未冻结时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "ACTIVE" });
      await expect(unfreezeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户未冻结",
        statusCode: 400,
      });
    });

    it("正常解冻账户", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "FROZEN" });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await unfreezeBankAccount(1, "t1");
      expect(res.status).toBe("ACTIVE");
    });
  });

  describe("closeBankAccount", () => {
    it("账户不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(closeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "银行账户不存在",
        statusCode: 404,
      });
    });

    it("账户余额不为零时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "ACTIVE", balance: 100 });
      await expect(closeBankAccount(1, "t1")).rejects.toMatchObject({
        message: "账户余额不为零，无法销户",
        statusCode: 400,
      });
    });

    it("正常销户", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ status: "ACTIVE", balance: 0 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await closeBankAccount(1, "t1");
      expect(res.status).toBe("CLOSED");
    });
  });

  describe("getTotalBalance", () => {
    it("返回总余额", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ totalBalance: 5000 });
      const res = await getTotalBalance("t1");
      expect(res.totalBalance).toBe(5000);
    });

    it("无账户时返回 0", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ totalBalance: 0 });
      const res = await getTotalBalance("t1");
      expect(res.totalBalance).toBe(0);
    });

    it("result 为 null 时返回 0", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await getTotalBalance("t1");
      expect(res.totalBalance).toBe(0);
    });
  });
});