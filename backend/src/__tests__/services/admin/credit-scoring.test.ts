/**
 * 管理端信用评分 service 单元测试
 * 被测文件：src/services/admin/credit-scoring.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/logger", () => ({
  default: mocks.logger,
}));

import {
  evaluateCreditScore,
  autoInitCredit,
  interceptCredit,
  autoGenerateCollections,
  getCollectionStrategyConfig,
  getCreditTiers,
} from "../../../services/admin/credit-scoring.service";

const ctx = { tenantId: "t1", userId: 1, username: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ evaluateCreditScore ============
describe("admin credit-scoring.service - evaluateCreditScore", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(evaluateCreditScore(99, ctx)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });

  it("无授信（INIT）+ 高分 + tier.limit > 0（嵌套三元左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "13800000001" })  // customer
      .mockResolvedValueOnce({  // tradeStats
        totalOrders: 20, totalAmount: 200000, paidAmount: 200000, overdueCount: 0,
        lastTradeDate: "2026-07-08",
      })
      .mockResolvedValueOnce(null);  // credit = null → INIT
    const res = await evaluateCreditScore(1, ctx);
    expect(res.recommendation.action).toBe("INIT");
    expect(res.recommendation.suggestedLimit).toBe(500000);
    expect(res.collectionStrategy).toBeNull();
  });

  it("无授信（INIT）+ 低分 + tier.limit = 0（嵌套三元右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 2, name: "李四", mobile: "13800000002" })  // customer
      .mockResolvedValueOnce({  // tradeStats：overdueCount=10 → score=35
        totalOrders: 0, totalAmount: 0, paidAmount: 0, overdueCount: 10,
        lastTradeDate: null,
      })
      .mockResolvedValueOnce(null);  // credit = null
    const res = await evaluateCreditScore(2, ctx);
    expect(res.recommendation.action).toBe("INIT");
    expect(res.recommendation.suggestedLimit).toBe(5000);  // DEFAULT_NEW_CUSTOMER_LIMIT
  });

  it("UPGRADE + credit_used = 0（overdueDays && 第一段 false）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 3, name: "王五", mobile: "13800000003" })
      .mockResolvedValueOnce({
        totalOrders: 20, totalAmount: 200000, paidAmount: 200000, overdueCount: 0,
        lastTradeDate: "2026-07-08",
      })
      .mockResolvedValueOnce({ credit_limit: 50000, credit_used: 0, credit_available: 50000, payment_term: "NET_15", status: "ACTIVE" });
    const res = await evaluateCreditScore(3, ctx);
    expect(res.recommendation.action).toBe("UPGRADE");
    expect(res.collectionStrategy).toBeNull();
  });

  it("DOWNGRADE + credit_used > 0 + overdueDays > 0 + strategy 存在（collectionStrategy 非空）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 4, name: "赵六", mobile: "13800000004" })
      .mockResolvedValueOnce({  // tradeStats: score=35 → DOWNGRADE
        totalOrders: 0, totalAmount: 0, paidAmount: 0, overdueCount: 10,
        lastTradeDate: "2026-06-01",  // ~38天前 → overdueDays=38 → strategy HEAVY
      })
      .mockResolvedValueOnce({ credit_limit: 200000, credit_used: 100000, credit_available: 100000, payment_term: "NET_60", status: "ACTIVE" });
    const res = await evaluateCreditScore(4, ctx);
    expect(res.recommendation.action).toBe("DOWNGRADE");
    expect(res.collectionStrategy).not.toBeNull();
    expect(res.collectionStrategy!.level).toBe("HEAVY");
  });

  it("MAINTAIN + credit_used > 0 + payment_term = COD（overdueDays && 第二段 false）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 5, name: "孙七", mobile: "13800000005" })
      .mockResolvedValueOnce({
        totalOrders: 20, totalAmount: 200000, paidAmount: 200000, overdueCount: 0,
        lastTradeDate: "2026-07-08",
      })
      .mockResolvedValueOnce({ credit_limit: 500000, credit_used: 100000, credit_available: 400000, payment_term: "COD", status: "ACTIVE" });
    const res = await evaluateCreditScore(5, ctx);
    expect(res.recommendation.action).toBe("MAINTAIN");
    expect(res.collectionStrategy).toBeNull();
  });

  it("MAINTAIN（else 分支）+ tier.limit < currentLimit + score >= 50", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 6, name: "周八", mobile: "13800000006" })
      .mockResolvedValueOnce({
        totalOrders: 0, totalAmount: 0, paidAmount: 0, overdueCount: 0,
        lastTradeDate: "2026-07-08",  // score=65 → tier 60-69 limit=50000 < currentLimit=100000
      })
      .mockResolvedValueOnce({ credit_limit: 100000, credit_used: 0, credit_available: 100000, payment_term: "NET_30", status: "ACTIVE" });
    const res = await evaluateCreditScore(6, ctx);
    expect(res.recommendation.action).toBe("MAINTAIN");
  });

  it("tradeStats 为 null（?? 全右分支 + lastTradeDate ?? Date.now 右分支）+ overdueDays = 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 7, name: "吴九", mobile: "13800000007" })
      .mockResolvedValueOnce(null)  // tradeStats null → all ?? 0 right branches
      .mockResolvedValueOnce({ credit_limit: 100000, credit_used: 50000, credit_available: 50000, payment_term: "NET_30", status: "ACTIVE" });
    const res = await evaluateCreditScore(7, ctx);
    expect(res.scores.total).toBe(65);  // 100*0.35 + 100*0.30 = 65
    expect(res.stats.lastTradeDate).toBeNull();
    expect(res.collectionStrategy).toBeNull();  // overdueDays=0 (lastTradeDate ?? Date.now → Date.now)
  });

  it("credit_used > 0 + overdueDays > 999 + strategy 不存在（&& 第三段 falsy）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 8, name: "郑十", mobile: "13800000008" })
      .mockResolvedValueOnce({
        totalOrders: 0, totalAmount: 0, paidAmount: 0, overdueCount: 0,
        lastTradeDate: "2020-01-01",  // ~2372天前 → overdueDays > 999 → strategy undefined
      })
      .mockResolvedValueOnce({ credit_limit: 100000, credit_used: 50000, credit_available: 50000, payment_term: "NET_30", status: "ACTIVE" });
    const res = await evaluateCreditScore(8, ctx);
    expect(res.collectionStrategy).toBeNull();
  });

  it("score > 100 → find 返回 undefined → ?? 兜底最后一个 tier（覆盖 ?? 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 9, name: "超额", mobile: "13800000009" })
      .mockResolvedValueOnce({
        // paidAmount > totalAmount → paymentRate = 2 → paymentRateScore = 200 → totalScore = 135
        totalOrders: 20, totalAmount: 100000, paidAmount: 200000, overdueCount: 0,
        lastTradeDate: "2026-07-08",
      })
      .mockResolvedValueOnce({ credit_limit: 50000, credit_used: 0, credit_available: 50000, payment_term: "NET_15", status: "ACTIVE" });
    const res = await evaluateCreditScore(9, ctx);
    expect(res.recommendation.suggestedTerm).toBe("COD");  // 最后一个 tier
    expect(res.recommendation.suggestedLimit).toBe(0);
  });
});

// ============ autoInitCredit ============
describe("admin credit-scoring.service - autoInitCredit", () => {
  it("已有授信记录时直接返回", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, credit_limit: 5000, payment_term: "NET_7" });
    const res = await autoInitCredit(1, ctx);
    expect(res).toEqual({ creditLimit: 5000, paymentTerm: "NET_7" });
  });

  it("无授信记录时自动初始化", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue({});
    const res = await autoInitCredit(2, ctx);
    expect(res).toEqual({ creditLimit: 5000, paymentTerm: "NET_7" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);  // INSERT credit + INSERT log
    expect(mocks.logger.info).toHaveBeenCalledOnce();
  });
});

// ============ interceptCredit ============
describe("admin credit-scoring.service - interceptCredit", () => {
  it("无授信记录时允许现金交易", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await interceptCredit(1, 5000, ctx);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("客户无授信记录，允许现金交易");
  });

  it("授信冻结 + freeze_reason 有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
      status: "FROZEN", warning_threshold: 0.8, payment_term: "NET_30", freeze_reason: "逾期严重",
    });
    const res = await interceptCredit(1, 5000, ctx);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("逾期严重");
  });

  it("授信冻结 + freeze_reason 为 undefined（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 50000, credit_frozen: 0, credit_available: 50000,
      status: "FROZEN", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await interceptCredit(1, 5000, ctx);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("未知原因");
  });

  it("授信已关闭时不允许", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 0, credit_frozen: 0, credit_available: 100000,
      status: "CLOSED", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await interceptCredit(1, 5000, ctx);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("授信已关闭");
  });

  it("可用额度不足时不允许", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 90000, credit_frozen: 0, credit_available: 10000,
      status: "ACTIVE", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await interceptCredit(1, 50000, ctx);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("可用额度不足");
  });

  it("使用率达到预警线时允许但警告", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 85000, credit_frozen: 0, credit_available: 15000,
      status: "ACTIVE", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await interceptCredit(1, 10000, ctx);
    expect(res.allowed).toBe(true);
    expect(res.reason).toContain("接近预警线");
  });

  it("额度充足时正常允许", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      credit_limit: 100000, credit_used: 10000, credit_frozen: 0, credit_available: 90000,
      status: "ACTIVE", warning_threshold: 0.8, payment_term: "NET_30",
    });
    const res = await interceptCredit(1, 5000, ctx);
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe("额度充足");
  });
});

// ============ autoGenerateCollections ============
describe("admin credit-scoring.service - autoGenerateCollections", () => {
  it("无逾期客户时返回空", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await autoGenerateCollections(ctx);
    expect(res.generated).toBe(0);
    expect(res.details).toEqual([]);
  });

  it("有 lastTradeDate + overdueDays > 0 + 无已有记录 → 生成催收", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{  // overdue customers
        customerId: 1, customerName: "张三", customerMobile: "13800000001",
        creditUsed: 50000, paymentTerm: "NET_30", creditLimit: 100000,
        lastTradeDate: "2026-06-01",  // ~38天前
      }])
      .mockResolvedValueOnce({});  // INSERT collection record
    mocks.queryOneWithTenant.mockResolvedValue(null);  // no existing record
    const res = await autoGenerateCollections(ctx);
    expect(res.generated).toBe(1);
    expect(res.details[0].level).toBe("HEAVY");
    expect(mocks.logger.info).toHaveBeenCalledOnce();
  });

  it("无 lastTradeDate → overdueDays = 0 → continue", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{  // customer without lastTradeDate
        customerId: 2, customerName: "李四", customerMobile: "13800000002",
        creditUsed: 30000, paymentTerm: "NET_15", creditLimit: 80000,
        // lastTradeDate 不存在 → ?? Date.now() → overdueDays = 0
      }]);
    const res = await autoGenerateCollections(ctx);
    expect(res.generated).toBe(0);  // overdueDays = 0 → continue
  });

  it("已有当天催收记录 → continue", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{
        customerId: 3, customerName: "王五", customerMobile: "13800000003",
        creditUsed: 20000, paymentTerm: "NET_7", creditLimit: 50000,
        lastTradeDate: "2026-06-01",
      }]);
    mocks.queryOneWithTenant.mockResolvedValue({ id: 99 });  // existing record found
    const res = await autoGenerateCollections(ctx);
    expect(res.generated).toBe(0);  // existing → continue
  });
});

// ============ getCollectionStrategyConfig / getCreditTiers ============
describe("admin credit-scoring.service - 配置函数", () => {
  it("getCollectionStrategyConfig 返回催收策略配置", () => {
    const config = getCollectionStrategyConfig();
    expect(config).toHaveLength(5);
    expect(config[0].level).toBe("REMIND");
    expect(config[4].level).toBe("SEVERE");
  });

  it("getCreditTiers 返回授信阶梯配置", () => {
    const tiers = getCreditTiers();
    expect(tiers).toHaveLength(6);
    expect(tiers[0].limit).toBe(500000);
    expect(tiers[5].limit).toBe(0);
  });
});
