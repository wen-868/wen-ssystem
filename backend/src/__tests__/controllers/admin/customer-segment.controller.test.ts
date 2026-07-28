import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createSegment: vi.fn(),
  listSegments: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  refreshSegmentMembers: vi.fn(),
  listSegmentMembers: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-segment.service", () => ({
  createSegment: mocks.createSegment,
  listSegments: mocks.listSegments,
  updateSegment: mocks.updateSegment,
  deleteSegment: mocks.deleteSegment,
  refreshSegmentMembers: mocks.refreshSegmentMembers,
  listSegmentMembers: mocks.listSegmentMembers,
}));

import {
  createSegment,
  listSegments,
  updateSegment,
  deleteSegment,
  refreshSegmentMembers,
  listSegmentMembers,
} from "../../../controllers/admin/customer-segment.controller";

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

describe("admin customer-segment.controller", () => {
  it("createSegment - 应创建客群", async () => {
    const body = { segmentName: "高价值客户", conditions: { totalSpent: { gte: 10000 } }, autoRefresh: true };
    mocks.createSegment.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createSegment(req, res, vi.fn());
    expect(mocks.createSegment).toHaveBeenCalledWith(
      expect.objectContaining({ segmentName: "高价值客户", tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createSegment - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createSegment(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });

  it("listSegments - 应返回客群列表", async () => {
    mocks.listSegments.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listSegments(req, res, vi.fn());
    expect(mocks.listSegments).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updateSegment - 应更新客群", async () => {
    const body = { segmentName: "新名称", autoRefresh: false };
    mocks.updateSegment.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateSegment(req, res, vi.fn());
    expect(mocks.updateSegment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ segmentName: "新名称", tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateSegment - 空 body 也可以（所有字段可选）", async () => {
    mocks.updateSegment.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateSegment(req, res, vi.fn());
    expect(mocks.updateSegment).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteSegment - 应删除客群", async () => {
    mocks.deleteSegment.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteSegment(req, res, vi.fn());
    expect(mocks.deleteSegment).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("refreshSegmentMembers - 应刷新客群成员", async () => {
    mocks.refreshSegmentMembers.mockResolvedValue({ refreshed: 100 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await refreshSegmentMembers(req, res, vi.fn());
    expect(mocks.refreshSegmentMembers).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("listSegmentMembers - 应返回客群成员列表", async () => {
    mocks.listSegmentMembers.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ params: { id: "1" }, query: { page: "1", pageSize: "10" } });
    const res = mockRes();
    await listSegmentMembers(req, res, vi.fn());
    expect(mocks.listSegmentMembers).toHaveBeenCalledWith(
      expect.objectContaining({ segmentId: 1, page: 1, pageSize: 10, tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("listSegmentMembers - 使用默认分页参数", async () => {
    mocks.listSegmentMembers.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await listSegmentMembers(req, res, vi.fn());
    expect(mocks.listSegmentMembers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });
});
