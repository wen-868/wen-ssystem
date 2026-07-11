import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  getPointsRule: vi.fn(),
  updatePointsRule: vi.fn(),
  listPointsRecords: vi.fn(),
  getUserPoints: vi.fn(),
  listMyPointsRecords: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-points.service.js", () => ({
  getPointsRule: mocks.getPointsRule,
  updatePointsRule: mocks.updatePointsRule,
  listPointsRecords: mocks.listPointsRecords,
  getUserPoints: mocks.getUserPoints,
  listMyPointsRecords: mocks.listMyPointsRecords,
}));

import {
  getPointsRule,
  updatePointsRule,
  listPointsRecords,
  getUserPoints,
  listMyPointsRecords,
} from "../../../controllers/admin/marketing-points.controller.js";

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

describe("admin marketing-points.controller", () => {
  it("getPointsRule - 应返回积分规则", async () => {
    mocks.getPointsRule.mockResolvedValue({ earnRatio: 1, redeemRatio: 100 });
    const req = mockReq();
    const res = mockRes();
    await getPointsRule(req, res);
    expect(mocks.getPointsRule).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updatePointsRule - 应更新积分规则", async () => {
    const body = { earnRatio: 2, expireDays: 365, enabled: true };
    mocks.updatePointsRule.mockResolvedValue({ earnRatio: 2 });
    const req = mockReq({ body });
    const res = mockRes();
    await updatePointsRule(req, res);
    expect(mocks.updatePointsRule).toHaveBeenCalledWith(
      expect.objectContaining({ earnRatio: 2, expireDays: 365, enabled: true }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updatePointsRule - 空 body 也可以（所有字段可选）", async () => {
    const body = {};
    mocks.updatePointsRule.mockResolvedValue({});
    const req = mockReq({ body });
    const res = mockRes();
    await updatePointsRule(req, res);
    expect(mocks.updatePointsRule).toHaveBeenCalled();
  });

  it("listPointsRecords - 应返回积分记录列表", async () => {
    mocks.listPointsRecords.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { userId: "1", type: "EARN", page: "1", pageSize: "10" } });
    const res = mockRes();
    await listPointsRecords(req, res);
    expect(mocks.listPointsRecords).toHaveBeenCalledWith(1, 10, "t1", 1, "EARN");
    expect(res.json).toHaveBeenCalled();
  });

  it("listPointsRecords - 使用默认分页参数，userId 可选", async () => {
    mocks.listPointsRecords.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listPointsRecords(req, res);
    expect(mocks.listPointsRecords).toHaveBeenCalledWith(1, 20, "t1", undefined, undefined);
  });

  it("getUserPoints - 应返回用户积分", async () => {
    mocks.getUserPoints.mockResolvedValue({ userId: 1, points: 1000 });
    const req = mockReq({ params: { userId: "1" } });
    const res = mockRes();
    await getUserPoints(req, res);
    expect(mocks.getUserPoints).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  describe("listMyPointsRecords", () => {
    it("成功 - 从 req.user.id 获取 userId", async () => {
      mocks.listMyPointsRecords.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { type: "EARN", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listMyPointsRecords(req, res);
      expect(mocks.listMyPointsRecords).toHaveBeenCalledWith(1, 1, 10, "t1", "EARN");
      expect(res.json).toHaveBeenCalled();
    });

    it("成功 - 从 query.userId 获取 userId（user 无 id 时）", async () => {
      mocks.listMyPointsRecords.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ user: {}, query: { userId: "5" } });
      const res = mockRes();
      await listMyPointsRecords(req, res);
      expect(mocks.listMyPointsRecords).toHaveBeenCalledWith(5, 1, 20, "t1", undefined);
      expect(res.json).toHaveBeenCalled();
    });

    it("失败 - 缺少用户ID时返回 400", async () => {
      const req = mockReq({ user: {}, query: {} });
      const res = mockRes();
      await listMyPointsRecords(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocks.fail).toHaveBeenCalledWith("缺少用户ID", "400");
      expect(mocks.listMyPointsRecords).not.toHaveBeenCalled();
    });

    it("使用默认分页参数", async () => {
      mocks.listMyPointsRecords.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listMyPointsRecords(req, res);
      expect(mocks.listMyPointsRecords).toHaveBeenCalledWith(1, 1, 20, "t1", undefined);
    });
  });
});
