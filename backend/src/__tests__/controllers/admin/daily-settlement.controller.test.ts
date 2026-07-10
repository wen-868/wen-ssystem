/**
 * 管理端日结 controller 单元测试
 * 被测文件：src/controllers/admin/daily-settlement.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  createDailySettlement: vi.fn(),
  listDailySettlements: vi.fn(),
  getDailySettlementDetail: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/daily-settlement.service.js", () => ({
  createDailySettlement: mocks.createDailySettlement,
  listDailySettlements: mocks.listDailySettlements,
  getDailySettlementDetail: mocks.getDailySettlementDetail,
}));

import {
  createDailySettlement,
  listDailySettlements,
  getDailySettlementDetail,
} from "../../../controllers/admin/daily-settlement.controller.js";

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

describe("admin daily-settlement.controller", () => {
  it("createDailySettlement 成功创建并传递参数", async () => {
    mocks.createDailySettlement.mockResolvedValue({ id: 1, settleDate: "2026-01-01" });
    const req = mockReq({ body: { settleDate: "2026-01-01" } });
    const res = mockRes();
    await createDailySettlement(req, res);
    expect(mocks.createDailySettlement).toHaveBeenCalledWith({
      settleDate: "2026-01-01", tenantId: "t1", operatorId: 1,
    });
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, settleDate: "2026-01-01" });
  });

  it("createDailySettlement user 无 id 时 operatorId 为 0", async () => {
    mocks.createDailySettlement.mockResolvedValue({ id: 2 });
    const req = mockReq({ user: {}, body: { settleDate: "2026-01-02" } });
    const res = mockRes();
    await createDailySettlement(req, res);
    expect(mocks.createDailySettlement).toHaveBeenCalledWith(expect.objectContaining({
      operatorId: 0,
      tenantId: "t1",
    }));
  });

  it("createDailySettlement 调用 res.json 返回 ok 包装结果", async () => {
    mocks.createDailySettlement.mockResolvedValue({ id: 3 });
    const req = mockReq({ body: { settleDate: "2026-01-03" } });
    const res = mockRes();
    await createDailySettlement(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 3 } });
  });

  it("listDailySettlements 默认分页参数", async () => {
    mocks.listDailySettlements.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listDailySettlements(req, res);
    expect(mocks.listDailySettlements).toHaveBeenCalledWith({
      page: 1, pageSize: 20, tenantId: "t1", dateStart: undefined, dateEnd: undefined,
    });
  });

  it("listDailySettlements 传入日期范围", async () => {
    mocks.listDailySettlements.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { dateStart: "2026-01-01", dateEnd: "2026-01-31", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listDailySettlements(req, res);
    expect(mocks.listDailySettlements).toHaveBeenCalledWith(expect.objectContaining({
      dateStart: "2026-01-01", dateEnd: "2026-01-31", page: 2, pageSize: 10,
    }));
  });

  it("getDailySettlementDetail 传入 id 转换为数字", async () => {
    mocks.getDailySettlementDetail.mockResolvedValue({ id: 5 });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await getDailySettlementDetail(req, res);
    expect(mocks.getDailySettlementDetail).toHaveBeenCalledWith(5, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 5 });
  });

  it("getDailySettlementDetail 调用 res.json 返回 ok 包装结果", async () => {
    mocks.getDailySettlementDetail.mockResolvedValue({ id: 6, total: 1000 });
    const req = mockReq({ params: { id: "6" } });
    const res = mockRes();
    await getDailySettlementDetail(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 6, total: 1000 } });
  });
});
