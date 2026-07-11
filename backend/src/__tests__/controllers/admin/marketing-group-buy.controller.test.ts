import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createGroupBuy: vi.fn(),
  listGroupBuys: vi.fn(),
  getGroupBuy: vi.fn(),
  updateGroupBuy: vi.fn(),
  deleteGroupBuy: vi.fn(),
  activateGroupBuy: vi.fn(),
  listGroupBuyTeams: vi.fn(),
  listActiveGroupBuys: vi.fn(),
  createGroupBuyTeam: vi.fn(),
  getGroupBuyTeam: vi.fn(),
  joinGroupBuyTeam: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-group-buy.service.js", () => ({
  createGroupBuy: mocks.createGroupBuy,
  listGroupBuys: mocks.listGroupBuys,
  getGroupBuy: mocks.getGroupBuy,
  updateGroupBuy: mocks.updateGroupBuy,
  deleteGroupBuy: mocks.deleteGroupBuy,
  activateGroupBuy: mocks.activateGroupBuy,
  listGroupBuyTeams: mocks.listGroupBuyTeams,
  listActiveGroupBuys: mocks.listActiveGroupBuys,
  createGroupBuyTeam: mocks.createGroupBuyTeam,
  getGroupBuyTeam: mocks.getGroupBuyTeam,
  joinGroupBuyTeam: mocks.joinGroupBuyTeam,
}));

import {
  createGroupBuy,
  listGroupBuys,
  getGroupBuy,
  updateGroupBuy,
  deleteGroupBuy,
  activateGroupBuy,
  listGroupBuyTeams,
  listActiveGroupBuys,
  createGroupBuyTeam,
  getGroupBuyTeam,
  joinGroupBuyTeam,
} from "../../../controllers/admin/marketing-group-buy.controller.js";

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

describe("admin marketing-group-buy.controller", () => {
  describe("团购活动", () => {
    it("createGroupBuy - 应创建团购活动", async () => {
      const body = {
        name: "2人拼团9.9",
        productId: 1,
        skuId: 10,
        groupPrice: 9.9,
        originalPrice: 19.9,
        minGroupSize: 2,
        maxGroupSize: 5,
        totalStock: 100,
        startTime: "2026-07-01",
        endTime: "2026-07-31",
      };
      mocks.createGroupBuy.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createGroupBuy(req, res);
      expect(mocks.createGroupBuy).toHaveBeenCalledWith(
        expect.objectContaining({ name: "2人拼团9.9" }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createGroupBuy - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { name: "测试" } });
      const res = mockRes();
      await expect(createGroupBuy(req, res)).rejects.toThrow();
      expect(mocks.createGroupBuy).not.toHaveBeenCalled();
    });

    it("listGroupBuys - 应返回团购活动列表", async () => {
      mocks.listGroupBuys.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { status: "ACTIVE", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listGroupBuys(req, res);
      expect(mocks.listGroupBuys).toHaveBeenCalledWith(1, 10, "t1", "ACTIVE");
      expect(res.json).toHaveBeenCalled();
    });

    it("listGroupBuys - 使用默认分页参数", async () => {
      mocks.listGroupBuys.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listGroupBuys(req, res);
      expect(mocks.listGroupBuys).toHaveBeenCalledWith(1, 20, "t1", undefined);
    });

    it("getGroupBuy - 应返回团购活动详情", async () => {
      mocks.getGroupBuy.mockResolvedValue({ id: 1, name: "活动1" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getGroupBuy(req, res);
      expect(mocks.getGroupBuy).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("updateGroupBuy - 应更新团购活动", async () => {
      const body = { name: "新名称", groupPrice: 8.8 };
      mocks.updateGroupBuy.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateGroupBuy(req, res);
      expect(mocks.updateGroupBuy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "新名称" }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("deleteGroupBuy - 应删除团购活动", async () => {
      mocks.deleteGroupBuy.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteGroupBuy(req, res);
      expect(mocks.deleteGroupBuy).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("activateGroupBuy - 应激活团购活动", async () => {
      mocks.activateGroupBuy.mockResolvedValue({ id: 1, status: "ACTIVE" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await activateGroupBuy(req, res);
      expect(mocks.activateGroupBuy).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("listActiveGroupBuys - 应返回进行中的团购活动", async () => {
      mocks.listActiveGroupBuys.mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await listActiveGroupBuys(req, res);
      expect(mocks.listActiveGroupBuys).toHaveBeenCalledWith("t1");
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("拼团团队", () => {
    it("listGroupBuyTeams - 应返回拼团团队列表", async () => {
      mocks.listGroupBuyTeams.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { activityId: "1", status: "ONGOING", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listGroupBuyTeams(req, res);
      expect(mocks.listGroupBuyTeams).toHaveBeenCalledWith(1, 10, "t1", 1, "ONGOING");
      expect(res.json).toHaveBeenCalled();
    });

    it("listGroupBuyTeams - 使用默认分页参数", async () => {
      mocks.listGroupBuyTeams.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listGroupBuyTeams(req, res);
      expect(mocks.listGroupBuyTeams).toHaveBeenCalledWith(1, 20, "t1", undefined, undefined);
    });

    it("createGroupBuyTeam - 应创建拼团团队", async () => {
      const body = { userId: 1, quantity: 2 };
      mocks.createGroupBuyTeam.mockResolvedValue({ teamId: 100 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await createGroupBuyTeam(req, res);
      expect(mocks.createGroupBuyTeam).toHaveBeenCalledWith(1, 1, 2, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("createGroupBuyTeam - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { id: "1" }, body: {} });
      const res = mockRes();
      await expect(createGroupBuyTeam(req, res)).rejects.toThrow();
      expect(mocks.createGroupBuyTeam).not.toHaveBeenCalled();
    });

    it("getGroupBuyTeam - 应返回拼团团队详情", async () => {
      mocks.getGroupBuyTeam.mockResolvedValue({ teamId: 100 });
      const req = mockReq({ params: { teamId: "100" } });
      const res = mockRes();
      await getGroupBuyTeam(req, res);
      expect(mocks.getGroupBuyTeam).toHaveBeenCalledWith(100, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("joinGroupBuyTeam - 应加入拼团团队", async () => {
      const body = { userId: 2, quantity: 1 };
      mocks.joinGroupBuyTeam.mockResolvedValue({ teamId: 100 });
      const req = mockReq({ params: { teamId: "100" }, body });
      const res = mockRes();
      await joinGroupBuyTeam(req, res);
      expect(mocks.joinGroupBuyTeam).toHaveBeenCalledWith(100, 2, 1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("joinGroupBuyTeam - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ params: { teamId: "100" }, body: {} });
      const res = mockRes();
      await expect(joinGroupBuyTeam(req, res)).rejects.toThrow();
      expect(mocks.joinGroupBuyTeam).not.toHaveBeenCalled();
    });
  });
});
