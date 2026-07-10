import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn(), makeBizNo: vi.fn() }));
vi.mock("../../../shared/db.js", () => ({ query: mocks.query, queryOne: mocks.queryOne, transaction: mocks.transaction }));
vi.mock("../../../shared/id.js", () => ({ makeBizNo: mocks.makeBizNo }));
import { listSubscriptions, getSubscriptionDetail, createSubscription, renewSubscription, upgradeSubscription, cancelSubscription, getSubscriptionStatistics } from "../../../services/saas/subscription.service.js";

describe("saas subscription.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listSubscriptions", () => {
    it("无筛选条件返回分页", async () => {
      mocks.query.mockResolvedValue([]);
      mocks.queryOne.mockResolvedValue({ total: 0 });
      const res = await listSubscriptions({ page: 1, pageSize: 10 });
      expect(res.total).toBe(0);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(10);
      expect(res.records).toEqual([]);
    });

    it("带tenantId筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, tenantId: 10, planName: "基础套餐" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listSubscriptions({ page: 1, pageSize: 10, tenantId: 10 });
      expect(res.total).toBe(1);
      expect(res.records[0].tenantId).toBe(10);
    });

    it("带status筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, status: "ACTIVE", planName: "基础套餐" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listSubscriptions({ page: 1, pageSize: 10, status: "ACTIVE" });
      expect(res.total).toBe(1);
      expect(res.records[0].status).toBe("ACTIVE");
    });

    it("带keyword筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, subscriptionNo: "SUB20260101001", tenantName: "测试公司" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listSubscriptions({ page: 1, pageSize: 10, keyword: "SUB2026" });
      expect(res.total).toBe(1);
    });
  });

  describe("getSubscriptionDetail", () => {
    it("订阅不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await getSubscriptionDetail(999);
      expect(res).toBeNull();
    });

    it("订阅存在返回详情含租户信息", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1,
        subscriptionNo: "SUB20260101001",
        tenantId: 10,
        planId: 1,
        planName: "基础套餐",
        planType: "MONTHLY",
        status: "ACTIVE",
        tenantName: "测试公司",
        tenantCode: "T001",
      });
      const res = await getSubscriptionDetail(1);
      expect(res).not.toBeNull();
      expect(res!.subscriptionNo).toBe("SUB20260101001");
      expect(res!.tenantName).toBe("测试公司");
    });
  });

  describe("createSubscription", () => {
    it("创建订阅成功", async () => {
      mocks.makeBizNo.mockReturnValue("SUB20260101001");
      mocks.query.mockResolvedValue({ insertId: 1 });
      mocks.queryOne.mockResolvedValue({
        id: 1,
        subscriptionNo: "SUB20260101001",
        tenantId: 10,
        planName: "基础套餐",
        planType: "MONTHLY",
        status: "ACTIVE",
      });
      const res = await createSubscription({
        tenantId: 10,
        planId: 1,
        planName: "基础套餐",
        planType: "MONTHLY",
        durationDays: 30,
        price: 99,
      });
      expect(res.subscriptionNo).toBe("SUB20260101001");
      expect(res.status).toBe("ACTIVE");
    });
  });

  describe("renewSubscription", () => {
    it("订阅不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await renewSubscription(999, { durationDays: 30 });
      expect(res).toBeNull();
    });

    it("续费成功", async () => {
      const now = new Date();
      mocks.queryOne
        .mockResolvedValueOnce({
          id: 1,
          tenantId: 10,
          endDate: now,
          planId: 1,
          planName: "基础套餐",
          planType: "MONTHLY",
          price: 99,
        })
        .mockResolvedValueOnce({
          id: 1,
          subscriptionNo: "SUB20260101001",
          tenantId: 10,
          status: "ACTIVE",
          renewPrice: 99,
        });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await renewSubscription(1, { durationDays: 30 });
      expect(res).not.toBeNull();
      expect(res!.status).toBe("ACTIVE");
    });

    it("续费指定价格", async () => {
      const now = new Date();
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, tenantId: 10, endDate: now, price: 99 })
        .mockResolvedValueOnce({ id: 1, renewPrice: 88 });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await renewSubscription(1, { durationDays: 30, price: 88 });
      expect(res!.renewPrice).toBe(88);
    });
  });

  describe("upgradeSubscription", () => {
    it("订阅不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await upgradeSubscription(999, { newPlanId: 2 });
      expect(res).toBeNull();
    });

    it("新套餐不存在返回null", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, tenantId: 10 })
        .mockResolvedValueOnce(null);
      const res = await upgradeSubscription(1, { newPlanId: 999 });
      expect(res).toBeNull();
    });

    it("升级套餐成功", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, tenantId: 10, planId: 1 })
        .mockResolvedValueOnce({ id: 2, plan_name: "高级套餐", plan_type: "YEARLY", price: 999, duration_days: 365 })
        .mockResolvedValueOnce({ id: 1, planName: "高级套餐", planType: "YEARLY", price: 999 });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await upgradeSubscription(1, { newPlanId: 2 });
      expect(res).not.toBeNull();
      expect(res!.planName).toBe("高级套餐");
      expect(res!.price).toBe(999);
    });
  });

  describe("cancelSubscription", () => {
    it("订阅不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await cancelSubscription(999, { cancelReason: "不想用了" });
      expect(res).toBeNull();
    });

    it("取消订阅成功", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, tenantId: 10, status: "ACTIVE" })
        .mockResolvedValueOnce({ id: 1, status: "CANCELLED", cancelReason: "不想用了", cancelledAt: new Date() });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await cancelSubscription(1, { cancelReason: "不想用了" });
      expect(res!.status).toBe("CANCELLED");
      expect(res!.cancelReason).toBe("不想用了");
    });
  });

  describe("getSubscriptionStatistics", () => {
    it("返回统计数据", async () => {
      mocks.queryOne.mockResolvedValue({
        totalSubscriptions: 100,
        activeSubscriptions: 80,
        expiredSubscriptions: 10,
        cancelledSubscriptions: 5,
        totalRevenue: 99999,
        monthlyRevenue: 9999,
      });
      const res = await getSubscriptionStatistics();
      expect(res.totalSubscriptions).toBe(100);
      expect(res.activeSubscriptions).toBe(80);
      expect(res.expiredSubscriptions).toBe(10);
      expect(res.cancelledSubscriptions).toBe(5);
      expect(res.totalRevenue).toBe(99999);
      expect(res.monthlyRevenue).toBe(9999);
    });
  });
});
