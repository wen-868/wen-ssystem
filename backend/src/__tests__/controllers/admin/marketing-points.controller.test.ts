import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-points.service.js", () => ({
  getPointsRule: vi.fn(),
  updatePointsRule: vi.fn(),
  listPointsRecords: vi.fn(),
  getUserPoints: vi.fn(),
  listMyPointsRecords: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as pointsService from "../../../services/admin/marketing-points.service.js";
import { ok, fail } from "../../../shared/response.js";
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

describe("marketing-points.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPointsRule - 应返回积分规则", async () => {
    (pointsService.getPointsRule as any).mockResolvedValue({ earnRatio: 1 });
    const req = mockReq();
    const res = mockRes();
    await getPointsRule(req as any, res as any);
    expect(pointsService.getPointsRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updatePointsRule - 应更新积分规则", async () => {
    (pointsService.updatePointsRule as any).mockResolvedValue({ earnRatio: 2 });
    const req = mockReq({
      body: { earnRatio: 2 },
    });
    const res = mockRes();
    await updatePointsRule(req as any, res as any);
    expect(pointsService.updatePointsRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updatePointsRule - 空body应正常更新", async () => {
    (pointsService.updatePointsRule as any).mockResolvedValue({ earnRatio: 1 });
    const req = mockReq({ body: {} });
    const res = mockRes();
    await updatePointsRule(req as any, res as any);
    expect(pointsService.updatePointsRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listPointsRecords - 应返回积分记录列表", async () => {
    (pointsService.listPointsRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPointsRecords(req as any, res as any);
    expect(pointsService.listPointsRecords).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getUserPoints - 应返回用户积分", async () => {
    (pointsService.getUserPoints as any).mockResolvedValue({ userId: 1, points: 100 });
    const req = mockReq({ params: { userId: 1 } });
    const res = mockRes();
    await getUserPoints(req as any, res as any);
    expect(pointsService.getUserPoints).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listMyPointsRecords - 应返回我的积分记录", async () => {
    (pointsService.listMyPointsRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      user: { id: 1 },
      query: { page: 1, pageSize: 20 },
    });
    const res = mockRes();
    await listMyPointsRecords(req as any, res as any);
    expect(pointsService.listMyPointsRecords).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listMyPointsRecords - 缺少用户ID应返回错误", async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await listMyPointsRecords(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("缺少用户ID", "400");
  });
});