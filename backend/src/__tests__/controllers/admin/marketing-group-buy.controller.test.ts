import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-group-buy.service", () => ({
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

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as groupBuyService from "../../../services/admin/marketing-group-buy.service";
import { ok } from "../../../shared/response";
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
} from "../../../controllers/admin/marketing-group-buy.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("marketing-group-buy.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createGroupBuy - 应创建拼团活动", async () => {
    (groupBuyService.createGroupBuy as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        name: "三人拼团",
        productId: 1,
        skuId: 1,
        groupPrice: 99,
        originalPrice: 199,
        minGroupSize: 3,
        maxGroupSize: 5,
        totalStock: 100,
        startTime: "2024-01-01",
        endTime: "2024-12-31",
      },
    });
    const res = mockRes();
    await createGroupBuy(req as any, res as any);
    expect(groupBuyService.createGroupBuy).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createGroupBuy - 缺少必填字段应抛出错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createGroupBuy(req as any, res as any)).rejects.toThrow();
  });

  it("listGroupBuys - 应返回拼团活动列表", async () => {
    (groupBuyService.listGroupBuys as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listGroupBuys(req as any, res as any);
    expect(groupBuyService.listGroupBuys).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getGroupBuy - 应返回单个拼团活动", async () => {
    (groupBuyService.getGroupBuy as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getGroupBuy(req as any, res as any);
    expect(groupBuyService.getGroupBuy).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateGroupBuy - 应更新拼团活动", async () => {
    (groupBuyService.updateGroupBuy as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { name: "更新名称" },
    });
    const res = mockRes();
    await updateGroupBuy(req as any, res as any);
    expect(groupBuyService.updateGroupBuy).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteGroupBuy - 应删除拼团活动", async () => {
    (groupBuyService.deleteGroupBuy as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteGroupBuy(req as any, res as any);
    expect(groupBuyService.deleteGroupBuy).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("activateGroupBuy - 应激活拼团活动", async () => {
    (groupBuyService.activateGroupBuy as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await activateGroupBuy(req as any, res as any);
    expect(groupBuyService.activateGroupBuy).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listGroupBuyTeams - 应返回拼团队伍列表", async () => {
    (groupBuyService.listGroupBuyTeams as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listGroupBuyTeams(req as any, res as any);
    expect(groupBuyService.listGroupBuyTeams).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listActiveGroupBuys - 应返回进行中的拼团活动", async () => {
    (groupBuyService.listActiveGroupBuys as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listActiveGroupBuys(req as any, res as any);
    expect(groupBuyService.listActiveGroupBuys).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createGroupBuyTeam - 应创建拼团队伍", async () => {
    (groupBuyService.createGroupBuyTeam as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { userId: 1, quantity: 1 },
    });
    const res = mockRes();
    await createGroupBuyTeam(req as any, res as any);
    expect(groupBuyService.createGroupBuyTeam).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createGroupBuyTeam - 参数验证失败应抛出错误", async () => {
    const req = mockReq({
      params: { id: 1 },
      body: {},
    });
    const res = mockRes();
    await expect(createGroupBuyTeam(req as any, res as any)).rejects.toThrow();
  });

  it("getGroupBuyTeam - 应返回拼团队伍详情", async () => {
    (groupBuyService.getGroupBuyTeam as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { teamId: 1 } });
    const res = mockRes();
    await getGroupBuyTeam(req as any, res as any);
    expect(groupBuyService.getGroupBuyTeam).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("joinGroupBuyTeam - 应加入拼团队伍", async () => {
    (groupBuyService.joinGroupBuyTeam as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { teamId: 1 },
      body: { userId: 2, quantity: 1 },
    });
    const res = mockRes();
    await joinGroupBuyTeam(req as any, res as any);
    expect(groupBuyService.joinGroupBuyTeam).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("joinGroupBuyTeam - 参数验证失败应抛出错误", async () => {
    const req = mockReq({
      params: { teamId: 1 },
      body: {},
    });
    const res = mockRes();
    await expect(joinGroupBuyTeam(req as any, res as any)).rejects.toThrow();
  });
});