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

  // S3-192（收口总清单第 59 项）护栏：到期停用必须写**库值**（t_tenant.status 是 TINYINT，1 启用 / 0 停用），
  // 且停用原因/时间同写；原实现写字符串 'EXPIRED' ⇒ 严格模式 1366，语句自上线起从未成功。
  it("已过期订阅自动停用租户：status 落 DISABLED 库值 0 + suspend_reason/suspended_at 同写", async () => {
    mocks.query
      .mockResolvedValueOnce([]) // 无即将到期
      .mockResolvedValueOnce([{ id: 2, subscription_no: "SUB2", tenant_id: "t2", end_date: "2026-07-01", company_name: "酒行B", tenant_status: "ACTIVE", overdue_days: 45 }]);
    await checkSubscriptionExpiry();
    const tenantCall = mocks.query.mock.calls.find((c: any) => String(c[0]).includes("UPDATE t_tenant SET status = ?"));
    expect(tenantCall).toBeTruthy();
    const sql = String(tenantCall![0]);
    // ① 不得再写字符串状态（EXPIRED / DISABLED 都不行：数值列写字符串必 1366）
    expect(sql).not.toContain("'EXPIRED'");
    expect(sql).not.toContain("'DISABLED'");
    // ② 落 toTenantStatusValue("DISABLED") 的库值 0
    expect(tenantCall![1]).toEqual([0, "t2"]);
    // ③ 停用原因与时间必须写
    expect(sql).toContain("suspend_reason = '订阅已到期'");
    expect(sql).toContain("suspended_at = NOW()");
    // ④ WHERE 是类型无关判据：TINYINT 列命中 '1'、VARCHAR 列命中 'ACTIVE'
    //    （原写法 status = 'ACTIVE' 在 TINYINT 列上被隐式转成 status = 0 ⇒ 命中"停用"行，语义反了）
    expect(sql).toContain("CAST(status AS CHAR) IN ('1', 'ACTIVE')");
    // ⑤ 订阅侧（另一张表，VARCHAR 值域）保持原样
    const subCall = mocks.query.mock.calls.find((c: any) => String(c[0]).includes("UPDATE t_subscription SET status = 'EXPIRED'"));
    expect(subCall).toBeTruthy();
    expect(subCall![1]).toEqual([2, "t2"]);
  });

  it("候选到期订阅的筛选同样只认「当前启用」的租户（类型无关判据）", async () => {
    mocks.query.mockResolvedValue([]);
    await checkSubscriptionExpiry();
    const expiredSelect = mocks.query.mock.calls.find((c: any) =>
      String(c[0]).includes("DATEDIFF(CURDATE(), s.end_date)")
    );
    expect(expiredSelect).toBeTruthy();
    expect(String(expiredSelect![0])).toContain("CAST(t.status AS CHAR) IN ('1', 'ACTIVE')");
    expect(String(expiredSelect![0])).not.toContain("t.status = 'ACTIVE'");
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
