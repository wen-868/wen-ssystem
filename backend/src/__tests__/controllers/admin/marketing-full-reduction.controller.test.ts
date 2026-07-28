import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-full-reduction.service", () => ({
  createFullReduction: vi.fn(),
  listFullReductions: vi.fn(),
  getFullReduction: vi.fn(),
  updateFullReduction: vi.fn(),
  deleteFullReduction: vi.fn(),
  activateFullReduction: vi.fn(),
  pauseFullReduction: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as fullReductionService from "../../../services/admin/marketing-full-reduction.service";
import { ok } from "../../../shared/response";
import {
  createFullReduction,
  listFullReductions,
  getFullReduction,
  updateFullReduction,
  deleteFullReduction,
  activateFullReduction,
  pauseFullReduction,
} from "../../../controllers/admin/marketing-full-reduction.controller";

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

describe("marketing-full-reduction.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createFullReduction - 应创建满减活动", async () => {
    (fullReductionService.createFullReduction as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        name: "满100减20",
        rules: [{ minAmount: 100, reduceAmount: 20 }],
        startTime: "2024-01-01",
        endTime: "2024-12-31",
      },
    });
    const res = mockRes();
    await createFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.createFullReduction).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createFullReduction - 缺少必填字段应抛出错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createFullReduction(req as any, res as any, vi.fn())).rejects.toThrow();
  });

  it("createFullReduction - rules数组为空应抛出错误", async () => {
    const req = mockReq({
      body: {
        name: "满减活动",
        rules: [],
        startTime: "2024-01-01",
        endTime: "2024-12-31",
      },
    });
    const res = mockRes();
    await expect(createFullReduction(req as any, res as any, vi.fn())).rejects.toThrow();
  });

  it("listFullReductions - 应返回满减活动列表", async () => {
    (fullReductionService.listFullReductions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listFullReductions(req as any, res as any, vi.fn());
    expect(fullReductionService.listFullReductions).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listFullReductions - 不传page和pageSize时使用默认值", async () => {
    (fullReductionService.listFullReductions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listFullReductions(req as any, res as any, vi.fn());
    expect(fullReductionService.listFullReductions).toHaveBeenCalledWith(1, 20, "t1", undefined);
  });

  it("getFullReduction - 应返回单个满减活动", async () => {
    (fullReductionService.getFullReduction as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.getFullReduction).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateFullReduction - 应更新满减活动", async () => {
    (fullReductionService.updateFullReduction as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { name: "更新名称" },
    });
    const res = mockRes();
    await updateFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.updateFullReduction).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteFullReduction - 应删除满减活动", async () => {
    (fullReductionService.deleteFullReduction as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.deleteFullReduction).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("activateFullReduction - 应激活满减活动", async () => {
    (fullReductionService.activateFullReduction as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await activateFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.activateFullReduction).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("pauseFullReduction - 应暂停满减活动", async () => {
    (fullReductionService.pauseFullReduction as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await pauseFullReduction(req as any, res as any, vi.fn());
    expect(fullReductionService.pauseFullReduction).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});