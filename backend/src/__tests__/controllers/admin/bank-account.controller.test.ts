/**
 * 管理端银行账户 controller 单元测试
 * 被测文件：src/controllers/admin/bank-account.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  listBankAccounts: vi.fn(),
  getBankAccount: vi.fn(),
  createBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
  freezeBankAccount: vi.fn(),
  unfreezeBankAccount: vi.fn(),
  closeBankAccount: vi.fn(),
  getTotalBalance: vi.fn(),
}));

vi.mock("../../../services/admin/bank-account.service", () => ({
  ...vi.importActual("../../../services/admin/bank-account.service"),
  listBankAccounts: mocks.listBankAccounts,
  getBankAccount: mocks.getBankAccount,
  createBankAccount: mocks.createBankAccount,
  updateBankAccount: mocks.updateBankAccount,
  freezeBankAccount: mocks.freezeBankAccount,
  unfreezeBankAccount: mocks.unfreezeBankAccount,
  closeBankAccount: mocks.closeBankAccount,
  getTotalBalance: mocks.getTotalBalance,
}));

import {
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  freezeBankAccount,
  unfreezeBankAccount,
  closeBankAccount,
  getTotalBalance,
} from "../../../controllers/admin/bank-account.controller";

const mockReq = (overrides: any = {}) => ({
  query: {},
  params: {},
  body: {},
  tenantId: "t1",
  ...overrides,
});

const mockRes = () => ({
  json: vi.fn(),
});

describe("bank-account.controller", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listBankAccounts", () => {
    it("默认参数", async () => {
      mocks.listBankAccounts.mockResolvedValue({ total: 0, records: [] });
      await listBankAccounts(mockReq(), mockRes());
      expect(mocks.listBankAccounts).toHaveBeenCalledWith({
        status: undefined,
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      });
    });

    it("带 status 参数", async () => {
      mocks.listBankAccounts.mockResolvedValue({ total: 1, records: [] });
      await listBankAccounts(mockReq({ query: { status: "ACTIVE", page: 2, pageSize: 10 } }), mockRes());
      expect(mocks.listBankAccounts).toHaveBeenCalledWith({
        status: "ACTIVE",
        page: 2,
        pageSize: 10,
        tenantId: "t1",
      });
    });
  });

  describe("getBankAccount", () => {
    it("获取账户详情", async () => {
      mocks.getBankAccount.mockResolvedValue({ id: 1, accountName: "账户1" });
      await getBankAccount(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.getBankAccount).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("createBankAccount", () => {
    it("创建账户", async () => {
      mocks.createBankAccount.mockResolvedValue({ id: 1 });
      await createBankAccount(mockReq({ body: { accountName: "账户1", bankName: "中国银行", accountNo: "123456" } }), mockRes());
      expect(mocks.createBankAccount).toHaveBeenCalled();
    });
  });

  describe("updateBankAccount", () => {
    it("更新账户", async () => {
      mocks.updateBankAccount.mockResolvedValue({ id: 1 });
      await updateBankAccount(mockReq({ params: { id: "1" }, body: { accountName: "新名称" } }), mockRes());
      expect(mocks.updateBankAccount).toHaveBeenCalledWith(1, { accountName: "新名称", bankName: undefined, accountType: undefined, tenantId: "t1" });
    });
  });

  describe("freezeBankAccount", () => {
    it("冻结账户", async () => {
      mocks.freezeBankAccount.mockResolvedValue({ id: 1, status: "FROZEN" });
      await freezeBankAccount(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.freezeBankAccount).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("unfreezeBankAccount", () => {
    it("解冻账户", async () => {
      mocks.unfreezeBankAccount.mockResolvedValue({ id: 1, status: "ACTIVE" });
      await unfreezeBankAccount(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.unfreezeBankAccount).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("closeBankAccount", () => {
    it("销户", async () => {
      mocks.closeBankAccount.mockResolvedValue({ id: 1, status: "CLOSED" });
      await closeBankAccount(mockReq({ params: { id: "1" } }), mockRes());
      expect(mocks.closeBankAccount).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("getTotalBalance", () => {
    it("获取总余额", async () => {
      mocks.getTotalBalance.mockResolvedValue({ totalBalance: 5000 });
      await getTotalBalance(mockReq(), mockRes());
      expect(mocks.getTotalBalance).toHaveBeenCalledWith("t1");
    });
  });
});