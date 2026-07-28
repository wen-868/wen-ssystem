import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/payment-config.service", () => ({
  PaymentConfigService: {
    getChannelConfig: vi.fn(),
    saveChannelConfig: vi.fn(),
    testConnection: vi.fn(),
    getStatus: vi.fn(),
    listBankAccounts: vi.fn(),
    createBankAccount: vi.fn(),
    updateBankAccount: vi.fn(),
    deleteBankAccount: vi.fn(),
    setDefaultBankAccount: vi.fn(),
    isProviderReady: vi.fn(),
  },
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { PaymentConfigService } from "../../../services/admin/payment-config.service";
import { ok } from "../../../shared/response";
import {
  getChannelConfig,
  saveChannelConfig,
  testConnection,
  getStatus,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
} from "../../../controllers/admin/payment-config.controller";

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
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("payment-config.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getChannelConfig - 应返回支付渠道配置", async () => {
    (PaymentConfigService.getChannelConfig as any).mockResolvedValue({});
    const req = mockReq({ params: { provider: "wechat" } });
    const res = mockRes();
    await getChannelConfig(req as any, res as any, vi.fn());
    expect(PaymentConfigService.getChannelConfig).toHaveBeenCalledWith("t1", "wechat");
    expect(ok).toHaveBeenCalled();
  });

  it("saveChannelConfig - 应保存支付渠道配置", async () => {
    (PaymentConfigService.saveChannelConfig as any).mockResolvedValue({});
    const req = mockReq({ params: { provider: "wechat" }, body: { appId: "app123", appSecret: "secret" } });
    const res = mockRes();
    await saveChannelConfig(req as any, res as any, vi.fn());
    expect(PaymentConfigService.saveChannelConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("testConnection - 应测试连接", async () => {
    (PaymentConfigService.testConnection as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { provider: "wechat" } });
    const res = mockRes();
    await testConnection(req as any, res as any, vi.fn());
    expect(PaymentConfigService.testConnection).toHaveBeenCalledWith("t1", "wechat");
    expect(ok).toHaveBeenCalled();
  });

  it("getStatus - 应返回支付状态", async () => {
    (PaymentConfigService.getStatus as any).mockResolvedValue({ wechat: true });
    const req = mockReq();
    const res = mockRes();
    await getStatus(req as any, res as any, vi.fn());
    expect(PaymentConfigService.getStatus).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listBankAccounts - 应返回银行账户列表", async () => {
    (PaymentConfigService.listBankAccounts as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listBankAccounts(req as any, res as any, vi.fn());
    expect(PaymentConfigService.listBankAccounts).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createBankAccount - 应创建银行账户", async () => {
    (PaymentConfigService.createBankAccount as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { bankName: "工商银行", accountName: "测试公司", accountNumber: "123456" } });
    const res = mockRes();
    await createBankAccount(req as any, res as any, vi.fn());
    expect(PaymentConfigService.createBankAccount).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateBankAccount - 应更新银行账户", async () => {
    (PaymentConfigService.updateBankAccount as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { bankName: "新银行" } });
    const res = mockRes();
    await updateBankAccount(req as any, res as any, vi.fn());
    expect(PaymentConfigService.updateBankAccount).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteBankAccount - 应删除银行账户", async () => {
    (PaymentConfigService.deleteBankAccount as any).mockResolvedValue({});
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteBankAccount(req as any, res as any, vi.fn());
    expect(PaymentConfigService.deleteBankAccount).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("setDefaultBankAccount - 应设置默认银行账户", async () => {
    (PaymentConfigService.setDefaultBankAccount as any).mockResolvedValue({});
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await setDefaultBankAccount(req as any, res as any, vi.fn());
    expect(PaymentConfigService.setDefaultBankAccount).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });
});
