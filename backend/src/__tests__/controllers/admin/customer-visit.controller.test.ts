import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { z } = require("zod");
  const createVisitSchema = z.object({
    customerId: z.number().int().positive(),
    visitType: z.string().min(1),
    plannedTime: z.string().min(1),
  });
  const updateVisitSchema = z.object({
    visitType: z.string().min(1).optional(),
    plannedTime: z.string().min(1).optional(),
  });
  const checkinSchema = z.object({
    checkinTime: z.string().min(1),
  });
  const checkoutSchema = z.object({
    checkoutTime: z.string().min(1),
  });
  return {
    ok: vi.fn((data?: any) => ({ code: "0", data })),
    fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
    listVisits: vi.fn(),
    getVisitDetail: vi.fn(),
    createVisit: vi.fn(),
    updateVisit: vi.fn(),
    checkin: vi.fn(),
    checkout: vi.fn(),
    cancelVisit: vi.fn(),
    listPendingFollowUps: vi.fn(),
    getVisitStatistics: vi.fn(),
    createVisitSchema,
    updateVisitSchema,
    checkinSchema,
    checkoutSchema,
  };
});

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-visit.service", () => ({
  listVisits: mocks.listVisits,
  getVisitDetail: mocks.getVisitDetail,
  createVisit: mocks.createVisit,
  updateVisit: mocks.updateVisit,
  checkin: mocks.checkin,
  checkout: mocks.checkout,
  cancelVisit: mocks.cancelVisit,
  listPendingFollowUps: mocks.listPendingFollowUps,
  getVisitStatistics: mocks.getVisitStatistics,
  createVisitSchema: mocks.createVisitSchema,
  updateVisitSchema: mocks.updateVisitSchema,
  checkinSchema: mocks.checkinSchema,
  checkoutSchema: mocks.checkoutSchema,
}));

import {
  listVisits,
  getVisitDetail,
  createVisit,
  updateVisit,
  checkin,
  checkout,
  cancelVisit,
  listPendingFollowUps,
  getVisitStatistics,
} from "../../../controllers/admin/customer-visit.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", realName: "管理员" },
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

describe("admin customer-visit.controller", () => {
  it("listVisits - 应返回拜访列表", async () => {
    mocks.listVisits.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "1", pageSize: "10" } });
    const res = mockRes();
    await listVisits(req, res, vi.fn());
    expect(mocks.listVisits).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(res.json).toHaveBeenCalled();
  });

  it("getVisitDetail - 应返回拜访详情", async () => {
    mocks.getVisitDetail.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ params: { visitNo: "V001" } });
    const res = mockRes();
    await getVisitDetail(req, res, vi.fn());
    expect(mocks.getVisitDetail).toHaveBeenCalledWith("t1", "V001");
    expect(res.json).toHaveBeenCalled();
  });

  it("createVisit - 应创建拜访", async () => {
    const body = { customerId: 1, visitType: "NEW_CUSTOMER", plannedTime: "2026-07-15 10:00:00" };
    mocks.createVisit.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ body });
    const res = mockRes();
    await createVisit(req, res, vi.fn());
    expect(mocks.createVisit).toHaveBeenCalledWith(
      "t1",
      1,
      "admin",
      "管理员",
      expect.objectContaining({ customerId: 1 })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createVisit - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createVisit(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.createVisit).not.toHaveBeenCalled();
  });

  it("updateVisit - 应更新拜访", async () => {
    const body = { visitType: "FOLLOW_UP" };
    mocks.updateVisit.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ params: { visitNo: "V001" }, body });
    const res = mockRes();
    await updateVisit(req, res, vi.fn());
    expect(mocks.updateVisit).toHaveBeenCalledWith(
      "t1",
      1,
      "admin",
      "V001",
      expect.objectContaining({ visitType: "FOLLOW_UP" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("checkin - 应签到", async () => {
    const body = { checkinTime: "2026-07-15 10:00:00" };
    mocks.checkin.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ params: { visitNo: "V001" }, body });
    const res = mockRes();
    await checkin(req, res, vi.fn());
    expect(mocks.checkin).toHaveBeenCalledWith(
      "t1",
      1,
      "admin",
      "V001",
      expect.objectContaining({ checkinTime: expect.any(String) })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("checkin - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ params: { visitNo: "V001" }, body: {} });
    const res = mockRes();
    await expect(checkin(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.checkin).not.toHaveBeenCalled();
  });

  it("checkout - 应签退", async () => {
    const body = { checkoutTime: "2026-07-15 11:00:00" };
    mocks.checkout.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ params: { visitNo: "V001" }, body });
    const res = mockRes();
    await checkout(req, res, vi.fn());
    expect(mocks.checkout).toHaveBeenCalledWith(
      "t1",
      1,
      "admin",
      "V001",
      expect.objectContaining({ checkoutTime: expect.any(String) })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("checkout - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ params: { visitNo: "V001" }, body: {} });
    const res = mockRes();
    await expect(checkout(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("cancelVisit - 应取消拜访", async () => {
    mocks.cancelVisit.mockResolvedValue({ visitNo: "V001" });
    const req = mockReq({ params: { visitNo: "V001" } });
    const res = mockRes();
    await cancelVisit(req, res, vi.fn());
    expect(mocks.cancelVisit).toHaveBeenCalledWith("t1", 1, "admin", "V001");
    expect(res.json).toHaveBeenCalled();
  });

  it("listPendingFollowUps - 应返回待跟进列表", async () => {
    mocks.listPendingFollowUps.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "1", pageSize: "10" } });
    const res = mockRes();
    await listPendingFollowUps(req, res, vi.fn());
    expect(mocks.listPendingFollowUps).toHaveBeenCalledWith("t1", 1, 1, 10);
    expect(res.json).toHaveBeenCalled();
  });

  it("listPendingFollowUps - 指定 visitor_id 时使用该值", async () => {
    mocks.listPendingFollowUps.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { visitor_id: "5" } });
    const res = mockRes();
    await listPendingFollowUps(req, res, vi.fn());
    expect(mocks.listPendingFollowUps).toHaveBeenCalledWith("t1", 5, 1, 20);
  });

  it("getVisitStatistics - 应返回拜访统计", async () => {
    mocks.getVisitStatistics.mockResolvedValue({ totalVisits: 10 });
    const req = mockReq({ query: { visitor_id: "1", start_date: "2026-07-01", end_date: "2026-07-31" } });
    const res = mockRes();
    await getVisitStatistics(req, res, vi.fn());
    expect(mocks.getVisitStatistics).toHaveBeenCalledWith("t1", 1, "2026-07-01", "2026-07-31");
    expect(res.json).toHaveBeenCalled();
  });

  it("getVisitStatistics - 不传日期时使用默认值", async () => {
    mocks.getVisitStatistics.mockResolvedValue({ totalVisits: 10 });
    const req = mockReq();
    const res = mockRes();
    await getVisitStatistics(req, res, vi.fn());
    expect(mocks.getVisitStatistics).toHaveBeenCalledWith(
      "t1",
      null,
      expect.any(String),
      expect.any(String)
    );
    expect(res.json).toHaveBeenCalled();
  });
});
