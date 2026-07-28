import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  getCreditList: vi.fn(),
  getCreditDetail: vi.fn(),
  initCredit: vi.fn(),
  checkCredit: vi.fn(),
  occupyCredit: vi.fn(),
  releaseCredit: vi.fn(),
  freezeCredit: vi.fn(),
  unfreezeCredit: vi.fn(),
  getCollectionList: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  getOverdueCustomers: vi.fn(),
  batchRemind: vi.fn(),
  getCollectionStatistics: vi.fn(),
  getRiskCustomers: vi.fn(),
  evaluateCreditScore: vi.fn(),
  interceptCredit: vi.fn(),
  autoInitCredit: vi.fn(),
  autoGenerateCollections: vi.fn(),
  getCollectionStrategyConfig: vi.fn(),
  getCreditTiers: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/credit-limit.service", () => ({
  getCreditList: mocks.getCreditList,
  getCreditDetail: mocks.getCreditDetail,
  initCredit: mocks.initCredit,
  checkCredit: mocks.checkCredit,
  occupyCredit: mocks.occupyCredit,
  releaseCredit: mocks.releaseCredit,
  freezeCredit: mocks.freezeCredit,
  unfreezeCredit: mocks.unfreezeCredit,
}));

vi.mock("../../../services/admin/credit-collection.service", () => ({
  getCollectionList: mocks.getCollectionList,
  createCollection: mocks.createCollection,
  updateCollection: mocks.updateCollection,
  getOverdueCustomers: mocks.getOverdueCustomers,
  batchRemind: mocks.batchRemind,
  getCollectionStatistics: mocks.getCollectionStatistics,
}));

vi.mock("../../../services/admin/credit-risk.service", () => ({
  getRiskCustomers: mocks.getRiskCustomers,
}));

vi.mock("../../../services/admin/credit-scoring.service", () => ({
  evaluateCreditScore: mocks.evaluateCreditScore,
  interceptCredit: mocks.interceptCredit,
  autoInitCredit: mocks.autoInitCredit,
  autoGenerateCollections: mocks.autoGenerateCollections,
  getCollectionStrategyConfig: mocks.getCollectionStrategyConfig,
  getCreditTiers: mocks.getCreditTiers,
}));

import {
  getCreditList,
  getCreditDetail,
  initCredit,
  checkCredit,
  occupyCredit,
  releaseCredit,
  freezeCredit,
  unfreezeCredit,
  getCollectionList,
  createCollection,
  updateCollection,
  getOverdueCustomers,
  batchRemind,
  getCollectionStatistics,
  getRiskCustomers,
  evaluateCredit,
  checkCreditIntercept,
  autoInitCredit,
  autoGenerateCollections,
  getCollectionStrategyConfig,
  getCreditTiers,
} from "../../../controllers/admin/credit.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1 },
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin credit.controller", () => {
  describe("授信额度", () => {
    it("getCreditList - 应返回授信列表", async () => {
      mocks.getCreditList.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { status: "NORMAL", keyword: "测试", page: "1", pageSize: "10" } });
      const res = mockRes();
      await getCreditList(req, res, vi.fn());
      expect(mocks.getCreditList).toHaveBeenCalledWith(
        "NORMAL",
        "测试",
        1,
        10,
        expect.objectContaining({ tenantId: "t1", userId: 1, username: "admin", storeId: 1 })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("getCreditList - 使用默认分页参数", async () => {
      mocks.getCreditList.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await getCreditList(req, res, vi.fn());
      expect(mocks.getCreditList).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        20,
        expect.any(Object)
      );
    });

    it("getCreditDetail - 客户已授信应返回详情", async () => {
      mocks.getCreditDetail.mockResolvedValue({ customerId: 1, creditLimit: 10000 });
      const req = mockReq({ params: { customerId: "1" } });
      const res = mockRes();
      await getCreditDetail(req, res, vi.fn());
      expect(mocks.getCreditDetail).toHaveBeenCalledWith(1, expect.any(Object));
      expect(mocks.ok).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it("getCreditDetail - 客户未授信应返回 404", async () => {
      mocks.getCreditDetail.mockResolvedValue(null);
      const req = mockReq({ params: { customerId: "999" } });
      const res = mockRes();
      await getCreditDetail(req, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mocks.fail).toHaveBeenCalledWith("该客户尚未开通授信", "404");
    });

    it("initCredit - 应初始化授信", async () => {
      const body = { creditLimit: 10000, paymentTerm: "NET_30" };
      mocks.initCredit.mockResolvedValue({ customerId: 1 });
      const req = mockReq({ params: { customerId: "1" }, body });
      const res = mockRes();
      await initCredit(req, res, vi.fn());
      expect(mocks.initCredit).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ creditLimit: 10000, paymentTerm: "NET_30" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("initCredit - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { customerId: "1" }, body: {} });
      const res = mockRes();
      await expect(initCredit(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.initCredit).not.toHaveBeenCalled();
    });

    it("checkCredit - 应检查授信", async () => {
      mocks.checkCredit.mockResolvedValue({ available: true });
      const req = mockReq({ params: { customerId: "1" }, query: { amount: "5000" } });
      const res = mockRes();
      await checkCredit(req, res, vi.fn());
      expect(mocks.checkCredit).toHaveBeenCalledWith(1, 5000, expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("checkCredit - 默认 amount=0", async () => {
      mocks.checkCredit.mockResolvedValue({ available: true });
      const req = mockReq({ params: { customerId: "1" } });
      const res = mockRes();
      await checkCredit(req, res, vi.fn());
      expect(mocks.checkCredit).toHaveBeenCalledWith(1, 0, expect.any(Object));
    });

    it("occupyCredit - 应占用授信", async () => {
      const body = { amount: 1000, orderNo: "ORD001" };
      mocks.occupyCredit.mockResolvedValue({ success: true });
      const req = mockReq({ params: { customerId: "1" }, body });
      const res = mockRes();
      await occupyCredit(req, res, vi.fn());
      expect(mocks.occupyCredit).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ amount: 1000, orderNo: "ORD001" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("occupyCredit - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { customerId: "1" }, body: {} });
      const res = mockRes();
      await expect(occupyCredit(req, res, vi.fn())).rejects.toThrow();
    });

    it("releaseCredit - 应释放授信", async () => {
      const body = { amount: 1000, orderNo: "ORD001" };
      mocks.releaseCredit.mockResolvedValue({ success: true });
      const req = mockReq({ params: { customerId: "1" }, body });
      const res = mockRes();
      await releaseCredit(req, res, vi.fn());
      expect(mocks.releaseCredit).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ amount: 1000, orderNo: "ORD001" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("releaseCredit - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { customerId: "1" }, body: {} });
      const res = mockRes();
      await expect(releaseCredit(req, res, vi.fn())).rejects.toThrow();
    });

    it("freezeCredit - 应冻结授信", async () => {
      const body = { freezeAmount: 5000, reason: "风险冻结" };
      mocks.freezeCredit.mockResolvedValue({ success: true });
      const req = mockReq({ params: { customerId: "1" }, body });
      const res = mockRes();
      await freezeCredit(req, res, vi.fn());
      expect(mocks.freezeCredit).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ freezeAmount: 5000, reason: "风险冻结" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("unfreezeCredit - 应解冻授信", async () => {
      const body = { unfreezeAmount: 5000, reason: "风险解除" };
      mocks.unfreezeCredit.mockResolvedValue({ success: true });
      const req = mockReq({ params: { customerId: "1" }, body });
      const res = mockRes();
      await unfreezeCredit(req, res, vi.fn());
      expect(mocks.unfreezeCredit).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ unfreezeAmount: 5000, reason: "风险解除" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("催收管理", () => {
    it("getCollectionList - 应返回催收列表", async () => {
      mocks.getCollectionList.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({
        query: {
          collectionLevel: "LIGHT",
          customerId: "1",
          contactResult: "PROMISED",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          page: "1",
          pageSize: "10",
        },
      });
      const res = mockRes();
      await getCollectionList(req, res, vi.fn());
      expect(mocks.getCollectionList).toHaveBeenCalledWith(
        "LIGHT",
        "1",
        "PROMISED",
        "2026-07-01",
        "2026-07-31",
        1,
        10,
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createCollection - 应创建催收记录", async () => {
      const body = {
        customerId: 1,
        collectionLevel: "REMIND",
        collectionMethod: "SMS",
      };
      mocks.createCollection.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createCollection(req, res, vi.fn());
      expect(mocks.createCollection).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 1, collectionLevel: "REMIND" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createCollection - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(createCollection(req, res, vi.fn())).rejects.toThrow();
    });

    it("updateCollection - 应更新催收记录", async () => {
      const body = { contactResult: "PROMISED", promisedAmount: 5000 };
      mocks.updateCollection.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateCollection(req, res, vi.fn());
      expect(mocks.updateCollection).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ contactResult: "PROMISED" }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("getOverdueCustomers - 应返回逾期客户列表", async () => {
      mocks.getOverdueCustomers.mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await getOverdueCustomers(req, res, vi.fn());
      expect(mocks.getOverdueCustomers).toHaveBeenCalledWith(expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("batchRemind - 应批量提醒", async () => {
      const body = { customerIds: [1, 2, 3], method: "SMS", content: "还款提醒" };
      mocks.batchRemind.mockResolvedValue({ success: 3 });
      const req = mockReq({ body });
      const res = mockRes();
      await batchRemind(req, res, vi.fn());
      expect(mocks.batchRemind).toHaveBeenCalledWith(
        expect.objectContaining({ customerIds: [1, 2, 3] }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("batchRemind - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(batchRemind(req, res, vi.fn())).rejects.toThrow();
    });

    it("getCollectionStatistics - 应返回催收统计", async () => {
      mocks.getCollectionStatistics.mockResolvedValue({ total: 100 });
      const req = mockReq();
      const res = mockRes();
      await getCollectionStatistics(req, res, vi.fn());
      expect(mocks.getCollectionStatistics).toHaveBeenCalledWith(expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("风险客户", () => {
    it("getRiskCustomers - 应返回风险客户列表", async () => {
      mocks.getRiskCustomers.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { page: "1", pageSize: "10" } });
      const res = mockRes();
      await getRiskCustomers(req, res, vi.fn());
      expect(mocks.getRiskCustomers).toHaveBeenCalledWith(1, 10, expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("getRiskCustomers - 使用默认分页参数", async () => {
      mocks.getRiskCustomers.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await getRiskCustomers(req, res, vi.fn());
      expect(mocks.getRiskCustomers).toHaveBeenCalledWith(1, 20, expect.any(Object));
    });
  });

  describe("信用评分与风控", () => {
    it("evaluateCredit - 应评估客户信用评分", async () => {
      mocks.evaluateCreditScore.mockResolvedValue({ score: 750 });
      const req = mockReq({ params: { customerId: "1" } });
      const res = mockRes();
      await evaluateCredit(req, res, vi.fn());
      expect(mocks.evaluateCreditScore).toHaveBeenCalledWith(1, expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("checkCreditIntercept - 应检查赊销拦截", async () => {
      mocks.interceptCredit.mockResolvedValue({ intercepted: false });
      const req = mockReq({ params: { customerId: "1" }, query: { amount: "5000" } });
      const res = mockRes();
      await checkCreditIntercept(req, res, vi.fn());
      expect(mocks.interceptCredit).toHaveBeenCalledWith(1, 5000, expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("checkCreditIntercept - 默认 amount=0", async () => {
      mocks.interceptCredit.mockResolvedValue({ intercepted: false });
      const req = mockReq({ params: { customerId: "1" } });
      const res = mockRes();
      await checkCreditIntercept(req, res, vi.fn());
      expect(mocks.interceptCredit).toHaveBeenCalledWith(1, 0, expect.any(Object));
    });

    it("autoInitCredit - 应自动授信初始化", async () => {
      mocks.autoInitCredit.mockResolvedValue({ success: true });
      const req = mockReq({ params: { customerId: "1" } });
      const res = mockRes();
      await autoInitCredit(req, res, vi.fn());
      expect(mocks.autoInitCredit).toHaveBeenCalledWith(1, expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("autoGenerateCollections - 应自动生成催收任务", async () => {
      mocks.autoGenerateCollections.mockResolvedValue({ generated: 10 });
      const req = mockReq();
      const res = mockRes();
      await autoGenerateCollections(req, res, vi.fn());
      expect(mocks.autoGenerateCollections).toHaveBeenCalledWith(expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it("getCollectionStrategyConfig - 应获取催收策略配置", async () => {
      mocks.getCollectionStrategyConfig.mockReturnValue({ levels: [] });
      const req = mockReq();
      const res = mockRes();
      await getCollectionStrategyConfig(req, res, vi.fn());
      expect(mocks.getCollectionStrategyConfig).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("getCreditTiers - 应获取授信阶梯配置", async () => {
      mocks.getCreditTiers.mockReturnValue([]);
      const req = mockReq();
      const res = mockRes();
      await getCreditTiers(req, res, vi.fn());
      expect(mocks.getCreditTiers).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });
});
