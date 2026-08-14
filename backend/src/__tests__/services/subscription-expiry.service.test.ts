import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
}));
vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { checkSubscriptionExpiry, startSubscriptionExpiryScanner, stopSubscriptionExpiryScanner } from "../../services/subscription-expiry.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  stopSubscriptionExpiryScanner();
});

describe("subscription-expiry.service - 订阅到期检查", () => {
  it("7 天内到期订阅标记通知并处理自动续费", async () => {
    mocks.query
      .mockResolvedValueOnce([{ id: 1, subscription_no: "SUB1", tenant_id: "t1", end_date: "2026-08-18", expire_notify_sent: 0, auto_renew: 1, company_name: "酒行A", contact_mobile: "138", contact_person: "张三", days_remaining: 3 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // 标记通知
      .mockResolvedValueOnce([]); // 已过期列表为空
    await checkSubscriptionExpiry();
    const updateCall = mocks.query.mock.calls.find((c: any) => String(c[0]).includes("expire_notify_sent = 1"));
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toEqual([1, "t1"]);
  });

  it("已过期订阅自动停用租户并更新订阅状态", async () => {
    mocks.query
      .mockResolvedValueOnce([]) // 无即将到期
      .mockResolvedValueOnce([{ id: 2, subscription_no: "SUB2", tenant_id: "t2", end_date: "2026-07-01", company_name: "酒行B", tenant_status: "ACTIVE", overdue_days: 45 }]);
    await checkSubscriptionExpiry();
    const tenantCall = mocks.query.mock.calls.find((c: any) => String(c[0]).includes("UPDATE t_tenant SET status = 'EXPIRED'"));
    const subCall = mocks.query.mock.calls.find((c: any) => String(c[0]).includes("UPDATE t_subscription SET status = 'EXPIRED'"));
    expect(tenantCall).toBeTruthy();
    expect(tenantCall[1]).toEqual(["t2"]);
    expect(subCall).toBeTruthy();
    expect(subCall[1]).toEqual([2, "t2"]);
  });

  it("无到期订阅时正常返回", async () => {
    mocks.query.mockResolvedValue([]);
    await expect(checkSubscriptionExpiry()).resolves.toBeUndefined();
  });

  it("start/stopSubscriptionExpiryScanner 生命周期正常", () => {
    mocks.query.mockResolvedValue([]);
    startSubscriptionExpiryScanner();
    stopSubscriptionExpiryScanner();
    expect(mocks.query).toHaveBeenCalled();
  });
});
