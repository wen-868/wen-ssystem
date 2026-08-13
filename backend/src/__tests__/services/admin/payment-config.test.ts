/**
 * 管理端支付配置 service 单元测试
 * 被测文件：src/services/admin/payment-config.service.ts
 * 覆盖 PaymentConfigService 全部 10 个静态方法 + 1 个独立函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
  transaction: vi.fn(),
}));

import { PaymentConfigService, isProviderReady } from "../../../services/admin/payment-config.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
  mocks.executeWithTenant.mockReset();
});

// ============ isProviderReady（独立函数） ============
describe("admin payment-config.service - isProviderReady", () => {
  it("调用静态方法返回 true", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, app_id: "wx123", mch_id: "mch123" });
    const res = await isProviderReady("t1", "WECHAT");
    expect(res).toBe(true);
  });
});

// ============ getChannelConfig ============
describe("admin payment-config.service - getChannelConfig", () => {
  it("row 不存在时返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await PaymentConfigService.getChannelConfig("t1", "WECHAT");
    expect(res).toBeNull();
  });

  it("row 存在 + 敏感字段有值（ternary 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      api_v3_key: "secret123", private_key: "key123", app_secret: "secret456"
    });
    const res = await PaymentConfigService.getChannelConfig("t1", "WECHAT");
    expect(res.api_v3_key).toBe("***");
    expect(res.private_key).toBe("***");
    expect(res.app_secret).toBe("***");
  });

  it("row 存在 + 敏感字段为空（ternary 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      api_v3_key: "", private_key: "", app_secret: ""
    });
    const res = await PaymentConfigService.getChannelConfig("t1", "ALIPAY");
    expect(res.api_v3_key).toBe("");
    expect(res.private_key).toBe("");
    expect(res.app_secret).toBe("");
  });

  it("provider=box 时返回 box_config 解析结果", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"provider":"银盛","activationCode":"ACT123"}',
    });
    const res = await PaymentConfigService.getChannelConfig("t1", "box");
    expect(res.provider).toBe("box");
    expect(res.enabled).toBe(true);
    expect(res.boxConfig.activationCode).toBe("ACT123");
  });
});

// ============ saveChannelConfig ============
describe("admin payment-config.service - saveChannelConfig", () => {
  it("existing 存在时执行 UPDATE + 全部字段有值 + enabled true（||/? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.saveChannelConfig("t1", "WECHAT", {
      appId: "wx123", mchId: "mch123", apiV3Key: "key", privateKey: "pk",
      serialNo: "sn", notifyUrl: "url", alipayPublicKey: "apk", enabled: true
    });
    expect(res.success).toBe(true);
    expect(mocks.executeWithTenant).toHaveBeenCalledOnce();
  });

  it("existing 不存在时执行 INSERT + 字段为空 + enabled false（||/? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.saveChannelConfig("t1", "WECHAT", {
      appId: "", mchId: "", apiV3Key: "", privateKey: "",
      serialNo: "", notifyUrl: "", alipayPublicKey: "", enabled: false
    });
    expect(res.success).toBe(true);
    expect(mocks.executeWithTenant).toHaveBeenCalledOnce();
  });

  it("existing 存在 + 字段为空 + enabled false（UPDATE line 31 ||/? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.saveChannelConfig("t1", "WECHAT", {
      appId: "", mchId: "", apiV3Key: "", privateKey: "",
      serialNo: "", notifyUrl: "", alipayPublicKey: "", enabled: false
    });
    expect(res.success).toBe(true);
  });

  it("existing 不存在 + 全部字段有值 + enabled true（INSERT line 37 ||/? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.saveChannelConfig("t1", "WECHAT", {
      appId: "wx123", mchId: "mch123", apiV3Key: "key", privateKey: "pk",
      serialNo: "sn", notifyUrl: "url", alipayPublicKey: "apk", enabled: true
    });
    expect(res.success).toBe(true);
  });

  it("provider=box 时更新微信配置行的 box_config 与 enabled", async () => {
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.saveChannelConfig("t1", "box", {
      boxConfig: '{"provider":"银盛","activationCode":"ACT123"}',
      enabled: "1",
    });
    expect(res.success).toBe(true);
    expect(mocks.executeWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("SET box_config"),
      ['{"provider":"银盛","activationCode":"ACT123"}', 1],
      "t1"
    );
  });

  it("enabled 字符串 0 归一化为 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.executeWithTenant.mockResolvedValue({});
    await PaymentConfigService.saveChannelConfig("t1", "WECHAT", { appId: "wx", enabled: "0" });
    expect(mocks.executeWithTenant).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([0]),
      "t1"
    );
  });
});

// ============ isProviderReady（静态方法） ============
describe("admin payment-config.service - PaymentConfigService.isProviderReady", () => {
  it("全部条件满足时返回 true", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, app_id: "wx123", mch_id: "mch123" });
    const res = await PaymentConfigService.isProviderReady("t1", "WECHAT");
    expect(res).toBe(true);
  });

  it("row 不存在时返回 false（&& 第 1 段 falsy）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await PaymentConfigService.isProviderReady("t1", "WECHAT");
    expect(res).toBe(false);
  });

  it("enabled !== 1 时返回 false（&& 第 2 段 falsy）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 0, app_id: "wx123", mch_id: "mch123" });
    const res = await PaymentConfigService.isProviderReady("t1", "WECHAT");
    expect(res).toBe(false);
  });

  it("app_id 为空时返回 false（&& 第 3 段 falsy）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, app_id: "", mch_id: "mch123" });
    const res = await PaymentConfigService.isProviderReady("t1", "WECHAT");
    expect(res).toBe(false);
  });

  it("mch_id 为空时返回 false（&& 第 4 段 falsy）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, app_id: "wx123", mch_id: "" });
    const res = await PaymentConfigService.isProviderReady("t1", "WECHAT");
    expect(res).toBe(false);
  });
});

// ============ testConnection ============
describe("admin payment-config.service - testConnection", () => {
  it("config 完整且启用时返回成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      provider: "WECHAT", enabled: 1, app_id: "wx123", mch_id: "mch123",
      api_v3_key: "v3key", api_key: "v2key", private_key: "pk",
    });
    const res = await PaymentConfigService.testConnection("t1", "WECHAT");
    expect(res.success).toBe(true);
  });

  it("config 不完整时返回失败并提示缺少项", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ provider: "WECHAT", app_id: "wx123" });
    const res = await PaymentConfigService.testConnection("t1", "WECHAT");
    expect(res.success).toBe(false);
    expect(res.message).toContain("商户号");
  });

  it("config 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(PaymentConfigService.testConnection("t1", "WECHAT")).rejects.toThrow("配置不存在");
  });

  it("provider=box 完整配置返回成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      enabled: 1,
      box_config: '{"provider":"银盛","activationCode":"ACT123"}',
    });
    const res = await PaymentConfigService.testConnection("t1", "box");
    expect(res.success).toBe(true);
  });

  it("provider=box 缺少激活码/串口时返回失败", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ enabled: 1, box_config: '{"provider":"银盛"}' });
    const res = await PaymentConfigService.testConnection("t1", "box");
    expect(res.success).toBe(false);
    expect(res.message).toContain("激活码或串口参数");
  });
});

// ============ getStatus ============
describe("admin payment-config.service - getStatus", () => {
  it("返回渠道状态列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ provider: "WECHAT", enabled: 1, app_id: "wx123" }]);
    const res = await PaymentConfigService.getStatus("t1");
    expect(res).toEqual([{ provider: "WECHAT", enabled: 1, app_id: "wx123" }]);
  });
});

// ============ listBankAccounts ============
describe("admin payment-config.service - listBankAccounts", () => {
  it("返回银行账号列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, bankName: "工商银行" }]);
    const res = await PaymentConfigService.listBankAccounts("t1");
    expect(res).toEqual([{ id: 1, bankName: "工商银行" }]);
  });
});

// ============ createBankAccount ============
describe("admin payment-config.service - createBankAccount", () => {
  it("成功创建 + 有 bankBranch + isDefault true（||/? 左分支）", async () => {
    mocks.executeWithTenant.mockResolvedValue({ insertId: 1 });
    const res = await PaymentConfigService.createBankAccount("t1", {
      bankName: "工商银行", accountNo: "123", accountName: "张三", bankBranch: "分行", isDefault: true
    });
    expect(res.id).toBe(1);
  });

  it("成功创建 + 无 bankBranch + isDefault false（||/? 右分支）", async () => {
    mocks.executeWithTenant.mockResolvedValue({ insertId: 2 });
    const res = await PaymentConfigService.createBankAccount("t1", {
      bankName: "建设银行", accountNo: "456", accountName: "李四", isDefault: false
    });
    expect(res.id).toBe(2);
  });
});

// ============ updateBankAccount ============
describe("admin payment-config.service - updateBankAccount", () => {
  it("成功更新 + 有 bankBranch + isDefault true", async () => {
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.updateBankAccount("t1", 1, {
      bankName: "工商银行", accountNo: "123", accountName: "张三", bankBranch: "分行", isDefault: true
    });
    expect(res.success).toBe(true);
  });

  it("成功更新 + 无 bankBranch + isDefault false", async () => {
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.updateBankAccount("t1", 2, {
      bankName: "建设银行", accountNo: "456", accountName: "李四", isDefault: false
    });
    expect(res.success).toBe(true);
  });
});

// ============ deleteBankAccount ============
describe("admin payment-config.service - deleteBankAccount", () => {
  it("成功删除银行账号", async () => {
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.deleteBankAccount("t1", 1);
    expect(res.success).toBe(true);
    expect(mocks.executeWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ setDefaultBankAccount ============
describe("admin payment-config.service - setDefaultBankAccount", () => {
  it("成功设为默认银行账号（2 次 executeWithTenant）", async () => {
    mocks.executeWithTenant.mockResolvedValue({});
    const res = await PaymentConfigService.setDefaultBankAccount("t1", 1);
    expect(res.success).toBe(true);
    expect(mocks.executeWithTenant).toHaveBeenCalledTimes(2);
  });
});
