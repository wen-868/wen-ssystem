import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createFullReduction: vi.fn(),
  listFullReductions: vi.fn(),
  getFullReduction: vi.fn(),
  updateFullReduction: vi.fn(),
  deleteFullReduction: vi.fn(),
  activateFullReduction: vi.fn(),
  pauseFullReduction: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-full-reduction.service.js", () => ({
  createFullReduction: mocks.createFullReduction,
  listFullReductions: mocks.listFullReductions,
  getFullReduction: mocks.getFullReduction,
  updateFullReduction: mocks.updateFullReduction,
  deleteFullReduction: mocks.deleteFullReduction,
  activateFullReduction: mocks.activateFullReduction,
  pauseFullReduction: mocks.pauseFullReduction,
}));

import {
  createFullReduction,
  listFullReductions,
  getFullReduction,
  updateFullReduction,
  deleteFullReduction,
  activateFullReduction,
  pauseFullReduction,
} from "../../../controllers/admin/marketing-full-reduction.controller.js";

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

describe("admin marketing-full-reduction.controller", () => {
  it("createFullReduction - 应创建满减活动", async () => {
    const body = {
      name: "满100减20",
      rules: [
        { minAmount: 100, reduceAmount: 20 },
        { minAmount: 200, reduceAmount: 50 },
      ],
      startTime: "2026-07-01",
      endTime: "2026-07-31",
    };
    mocks.createFullReduction.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createFullReduction(req, res);
    expect(mocks.createFullReduction).toHaveBeenCalledWith(
      expect.objectContaining({ name: "满100减20" }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createFullReduction - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "测试" } });
    const res = mockRes();
    await expect(createFullReduction(req, res)).rejects.toThrow();
    expect(mocks.createFullReduction).not.toHaveBeenCalled();
  });

  it("createFullReduction - rules 为空数组时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "测试", rules: [], startTime: "2026-01-01", endTime: "2026-12-31" } });
    const res = mockRes();
    await expect(createFullReduction(req, res)).rejects.toThrow();
  });

  it("listFullReductions - 应返回满减活动列表", async () => {
    mocks.listFullReductions.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { status: "ACTIVE", page: "1", pageSize: "10" } });
    const res = mockRes();
    await listFullReductions(req, res);
    expect(mocks.listFullReductions).toHaveBeenCalledWith(1, 10, "t1", "ACTIVE");
    expect(res.json).toHaveBeenCalled();
  });

  it("listFullReductions - 使用默认分页参数", async () => {
    mocks.listFullReductions.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listFullReductions(req, res);
    expect(mocks.listFullReductions).toHaveBeenCalledWith(1, 20, "t1", undefined);
  });

  it("getFullReduction - 应返回满减活动详情", async () => {
    mocks.getFullReduction.mockResolvedValue({ id: 1, name: "活动1" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getFullReduction(req, res);
    expect(mocks.getFullReduction).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updateFullReduction - 应更新满减活动", async () => {
    const body = { name: "新名称", stackable: true };
    mocks.updateFullReduction.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateFullReduction(req, res);
    expect(mocks.updateFullReduction).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "新名称", stackable: true }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteFullReduction - 应删除满减活动", async () => {
    mocks.deleteFullReduction.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteFullReduction(req, res);
    expect(mocks.deleteFullReduction).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("activateFullReduction - 应激活满减活动", async () => {
    mocks.activateFullReduction.mockResolvedValue({ id: 1, status: "ACTIVE" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await activateFullReduction(req, res);
    expect(mocks.activateFullReduction).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("pauseFullReduction - 应暂停满减活动", async () => {
    mocks.pauseFullReduction.mockResolvedValue({ id: 1, status: "PAUSED" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await pauseFullReduction(req, res);
    expect(mocks.pauseFullReduction).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
