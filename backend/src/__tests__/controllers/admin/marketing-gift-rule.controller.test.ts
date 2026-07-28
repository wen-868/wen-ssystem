import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createGiftRule: vi.fn(),
  listGiftRules: vi.fn(),
  getGiftRuleDetail: vi.fn(),
  updateGiftRule: vi.fn(),
  deleteGiftRule: vi.fn(),
  activateGiftRule: vi.fn(),
  pauseGiftRule: vi.fn(),
  addGiftRuleLevel: vi.fn(),
  updateGiftRuleLevel: vi.fn(),
  deleteGiftRuleLevel: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-gift-rule.service", () => ({
  createGiftRule: mocks.createGiftRule,
  listGiftRules: mocks.listGiftRules,
  getGiftRuleDetail: mocks.getGiftRuleDetail,
  updateGiftRule: mocks.updateGiftRule,
  deleteGiftRule: mocks.deleteGiftRule,
  activateGiftRule: mocks.activateGiftRule,
  pauseGiftRule: mocks.pauseGiftRule,
  addGiftRuleLevel: mocks.addGiftRuleLevel,
  updateGiftRuleLevel: mocks.updateGiftRuleLevel,
  deleteGiftRuleLevel: mocks.deleteGiftRuleLevel,
}));

import {
  createGiftRule,
  listGiftRules,
  getGiftRuleDetail,
  updateGiftRule,
  deleteGiftRule,
  activateGiftRule,
  pauseGiftRule,
  addGiftRuleLevel,
  updateGiftRuleLevel,
  deleteGiftRuleLevel,
} from "../../../controllers/admin/marketing-gift-rule.controller";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin marketing-gift-rule.controller", () => {
  describe("满赠规则", () => {
    it("createGiftRule - 应创建满赠规则", async () => {
      const body = {
        rule_name: "满100送礼品",
        threshold_type: "AMOUNT",
        threshold_amount: 100,
        start_time: "2026-07-01",
        end_time: "2026-07-31",
        levels: [
          { gift_product_id: 1, gift_sku_id: 100, gift_quantity: 1, sort_order: 0 },
        ],
      };
      mocks.createGiftRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createGiftRule(req, res, vi.fn());
      expect(mocks.createGiftRule).toHaveBeenCalledWith(
        expect.objectContaining({ rule_name: "满100送礼品" }),
        "t1",
        1
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createGiftRule - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { rule_name: "测试" } });
      const res = mockRes();
      await expect(createGiftRule(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.createGiftRule).not.toHaveBeenCalled();
    });

    it("listGiftRules - 应返回满赠规则列表", async () => {
      mocks.listGiftRules.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { status: "ACTIVE", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listGiftRules(req, res, vi.fn());
      expect(mocks.listGiftRules).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "t1", status: "ACTIVE", page: 1, pageSize: 10 })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("listGiftRules - 使用默认分页参数", async () => {
      mocks.listGiftRules.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listGiftRules(req, res, vi.fn());
      expect(mocks.listGiftRules).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("getGiftRuleDetail - 应返回满赠规则详情", async () => {
      mocks.getGiftRuleDetail.mockResolvedValue({ id: 1, name: "规则1" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getGiftRuleDetail(req, res, vi.fn());
      expect(mocks.getGiftRuleDetail).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("updateGiftRule - 应更新满赠规则", async () => {
      const body = { rule_name: "新规则名", status: "ACTIVE" };
      mocks.updateGiftRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateGiftRule(req, res, vi.fn());
      expect(mocks.updateGiftRule).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ rule_name: "新规则名" }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("deleteGiftRule - 应删除满赠规则", async () => {
      mocks.deleteGiftRule.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteGiftRule(req, res, vi.fn());
      expect(mocks.deleteGiftRule).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("activateGiftRule - 应激活满赠规则", async () => {
      mocks.activateGiftRule.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await activateGiftRule(req, res, vi.fn());
      expect(mocks.activateGiftRule).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("pauseGiftRule - 应暂停满赠规则", async () => {
      mocks.pauseGiftRule.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await pauseGiftRule(req, res, vi.fn());
      expect(mocks.pauseGiftRule).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });
  });

  describe("满赠档位", () => {
    it("addGiftRuleLevel - 应添加满赠档位", async () => {
      const body = { gift_product_id: 1, gift_sku_id: 200, gift_quantity: 2, sort_order: 0 };
      mocks.addGiftRuleLevel.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await addGiftRuleLevel(req, res, vi.fn());
      expect(mocks.addGiftRuleLevel).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ gift_product_id: 1 }),
        "t1"
      );
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("addGiftRuleLevel - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { id: "1" }, body: { name: "测试" } });
      const res = mockRes();
      await expect(addGiftRuleLevel(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.addGiftRuleLevel).not.toHaveBeenCalled();
    });

    it("updateGiftRuleLevel - 应更新满赠档位", async () => {
      const body = { gift_product_id: 1, gift_quantity: 3 };
      mocks.updateGiftRuleLevel.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1", levelId: "10" }, body });
      const res = mockRes();
      await updateGiftRuleLevel(req, res, vi.fn());
      expect(mocks.updateGiftRuleLevel).toHaveBeenCalledWith(
        1,
        10,
        expect.objectContaining({ gift_quantity: 3 }),
        "t1"
      );
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("deleteGiftRuleLevel - 应删除满赠档位", async () => {
      mocks.deleteGiftRuleLevel.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1", levelId: "10" } });
      const res = mockRes();
      await deleteGiftRuleLevel(req, res, vi.fn());
      expect(mocks.deleteGiftRuleLevel).toHaveBeenCalledWith(1, 10, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });
  });
});
