import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  listPublicPlans,
  submitSubscription,
  listMySubscriptions,
  listSubscriptionApplies,
  getSubscriptionApply,
  auditSubscriptionApply,
} from "../../services/platform-miniapp.service";

const planRow = {
  id: 1,
  planCode: "MONTHLY_BASIC",
  planName: "基础版",
  planType: "MONTHLY",
  price: 299,
  description: "适合单店",
  features: '["批零一体","即时零售"]',
  status: "ACTIVE",
};

const applyRow = {
  id: 5,
  planId: 1,
  planName: "基础版",
  company: "测试酒业",
  contact: "张三",
  mobile: "13800000000",
  remark: "想先体验",
  status: "PENDING",
  auditRemark: "",
  auditedAt: null,
  createdAt: "2026-08-08T00:00:00.000Z",
};

describe("platform-miniapp.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPublicPlans", () => {
    it("仅返回 ACTIVE 套餐且字段脱敏（周期映射中文 + features 解析）", async () => {
      mocks.query.mockResolvedValue([
        planRow,
        { ...planRow, id: 2, planName: "下架版", status: "INACTIVE", planType: "YEARLY" },
      ]);

      const plans = await listPublicPlans();

      expect(plans).toHaveLength(2);
      expect(plans[0]).toEqual({
        id: 1,
        name: "基础版",
        price: 299,
        cycle: "月",
        description: "适合单店",
        features: ["批零一体", "即时零售"],
      });
      expect(plans[1].cycle).toBe("年");
      // SQL 必须过滤仅 ACTIVE 套餐
      expect(mocks.query.mock.calls[0][0]).toContain("status = 'ACTIVE'");
    });

    it("features 为非 JSON 字符串时原样返回", async () => {
      mocks.query.mockResolvedValue([{ ...planRow, features: "批零一体,即时零售" }]);
      const plans = await listPublicPlans();
      expect(plans[0].features).toBe("批零一体,即时零售");
    });
  });

  describe("submitSubscription", () => {
    const validInput = {
      planId: 1,
      company: "测试酒业",
      contact: "张三",
      mobile: "13800000000",
      remark: "想先体验",
    };

    it("套餐不存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      await expect(submitSubscription(validInput)).rejects.toThrow("套餐不存在或已下架");
    });

    it("套餐已下架应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce({ ...planRow, status: "INACTIVE" });
      await expect(submitSubscription(validInput)).rejects.toThrow("套餐不存在或已下架");
    });

    it("同一手机号已有待审核申请应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(planRow);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(submitSubscription(validInput)).rejects.toThrow("该手机号已有待审核的订阅申请");
    });

    it("同一公司已有待审核申请应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(planRow);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(submitSubscription(validInput)).rejects.toThrow("该公司已有待审核的订阅申请");
    });

    it("提交成功：落库并返回申请记录", async () => {
      mocks.queryOne.mockResolvedValueOnce(planRow); // 套餐校验
      mocks.queryOne.mockResolvedValueOnce(null); // 手机号防重
      mocks.queryOne.mockResolvedValueOnce(null); // 公司防重
      mocks.query.mockResolvedValueOnce({ insertId: 5 }); // INSERT
      mocks.queryOne.mockResolvedValueOnce(applyRow); // 回查记录

      const record = await submitSubscription({ ...validInput, openid: "dev-device-001" });

      expect(record.id).toBe(5);
      expect(record.planName).toBe("基础版");
      expect(mocks.query.mock.calls[0][1]).toEqual([
        "dev-device-001",
        1,
        "基础版",
        "测试酒业",
        "张三",
        "13800000000",
        "想先体验",
      ]);
    });

    it("提交成功：openid/remark 为空时落默认值", async () => {
      mocks.queryOne.mockResolvedValueOnce(planRow);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.query.mockResolvedValueOnce({ insertId: 6 });
      mocks.queryOne.mockResolvedValueOnce(applyRow);

      await submitSubscription({ ...validInput, remark: "" });

      expect(mocks.query.mock.calls[0][1]).toEqual(["", 1, "基础版", "测试酒业", "张三", "13800000000", ""]);
    });
  });

  describe("listMySubscriptions", () => {
    it("缺少 openid/mobile 应拒绝", async () => {
      await expect(listMySubscriptions({})).rejects.toThrow("缺少 openid 或 mobile 参数");
    });

    it("openid 优先：按 openid 查询", async () => {
      mocks.query.mockResolvedValue([applyRow]);
      const list = await listMySubscriptions({ openid: "dev-device-001", mobile: "13800000000" });
      expect(list).toHaveLength(1);
      expect(list[0].company).toBe("测试酒业");
      expect(mocks.query.mock.calls[0][0]).toContain("openid = ?");
      expect(mocks.query.mock.calls[0][1]).toEqual(["dev-device-001"]);
    });

    it("无 openid 时按 mobile 兜底", async () => {
      mocks.query.mockResolvedValue([]);
      await listMySubscriptions({ mobile: "13800000000" });
      expect(mocks.query.mock.calls[0][0]).toContain("mobile = ?");
      expect(mocks.query.mock.calls[0][1]).toEqual(["13800000000"]);
    });
  });

  describe("listSubscriptionApplies", () => {
    it("返回分页列表且 PENDING 优先排序", async () => {
      mocks.queryOne.mockResolvedValue({ total: 1 });
      mocks.query.mockResolvedValue([applyRow]);

      const result = await listSubscriptionApplies({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.list).toHaveLength(1);
      expect(mocks.query.mock.calls[0][0]).toContain("FIELD(status, 'PENDING') DESC");
    });

    it("支持状态筛选", async () => {
      mocks.queryOne.mockResolvedValue({ total: 0 });
      mocks.query.mockResolvedValue([]);

      await listSubscriptionApplies({ status: "PENDING", page: 2, pageSize: 10 });

      expect(mocks.queryOne.mock.calls[0][0]).toContain("status = ?");
      expect(mocks.queryOne.mock.calls[0][1]).toEqual(["PENDING"]);
    });
  });

  describe("getSubscriptionApply", () => {
    it("记录不存在返回 null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      expect(await getSubscriptionApply(999)).toBeNull();
    });

    it("返回驼峰化记录", async () => {
      mocks.queryOne.mockResolvedValue(applyRow);
      const record = await getSubscriptionApply(5);
      expect(record?.planName).toBe("基础版");
      expect(record?.auditRemark).toBe("");
    });
  });

  describe("auditSubscriptionApply", () => {
    it("申请不存在或已处理应拒绝", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(auditSubscriptionApply(999, "APPROVED", "")).rejects.toThrow("申请不存在或已处理");
    });

    it("审核通过：更新状态与审核人", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 5 }); // PENDING 检查
      mocks.query.mockResolvedValueOnce({}); // UPDATE
      mocks.queryOne.mockResolvedValueOnce({ ...applyRow, status: "APPROVED", auditRemark: "资料齐全", auditedAt: "2026-08-08T00:10:00.000Z" });

      const record = await auditSubscriptionApply(5, "APPROVED", "资料齐全", 99);

      expect(record.status).toBe("APPROVED");
      expect(mocks.query.mock.calls[0][1]).toEqual(["APPROVED", "资料齐全", 99, 5]);
    });

    it("驳回时写入驳回备注与审核人", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 5 });
      mocks.query.mockResolvedValueOnce({});
      mocks.queryOne.mockResolvedValueOnce({ ...applyRow, status: "REJECTED", auditRemark: "信息不全" });

      await auditSubscriptionApply(5, "REJECTED", "信息不全", 7);

      expect(mocks.query.mock.calls[0][1]).toEqual(["REJECTED", "信息不全", 7, 5]);
    });
  });
});
