import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getActiveAnnouncements: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/instant-retail/retail-announcement.service.js", () => ({
  listAnnouncements: mocks.listAnnouncements,
  createAnnouncement: mocks.createAnnouncement,
  updateAnnouncement: mocks.updateAnnouncement,
  deleteAnnouncement: mocks.deleteAnnouncement,
  getActiveAnnouncements: mocks.getActiveAnnouncements,
}));

import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
} from "../../../controllers/admin/retail-announcement.controller.js";

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

describe("admin retail-announcement.controller", () => {
  it("listAnnouncements - 有 storeId 时返回公告列表", async () => {
    mocks.listAnnouncements.mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "1" } });
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(mocks.listAnnouncements).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalled();
  });

  it("listAnnouncements - 缺少 storeId 时返回 400", async () => {
    const req = mockReq();
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("storeId is required");
    expect(mocks.listAnnouncements).not.toHaveBeenCalled();
  });

  it("createAnnouncement - 应创建公告", async () => {
    const body = {
      store_id: 1,
      title: "新店开业",
      content: "欢迎光临！",
      is_top: 1,
      start_time: "2026-07-01",
      end_time: "2026-07-31",
    };
    mocks.createAnnouncement.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createAnnouncement(req, res);
    expect(mocks.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ store_id: 1, title: "新店开业", content: "欢迎光临！" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createAnnouncement - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createAnnouncement(req, res)).rejects.toThrow();
    expect(mocks.createAnnouncement).not.toHaveBeenCalled();
  });

  it("updateAnnouncement - 应更新公告", async () => {
    const body = { title: "新标题", content: "新内容" };
    mocks.updateAnnouncement.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateAnnouncement(req, res);
    expect(mocks.updateAnnouncement).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: "新标题", content: "新内容" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateAnnouncement - 空 body 时（所有字段可选）", async () => {
    mocks.updateAnnouncement.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateAnnouncement(req, res);
    expect(mocks.updateAnnouncement).toHaveBeenCalled();
  });

  it("deleteAnnouncement - 应删除公告", async () => {
    mocks.deleteAnnouncement.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteAnnouncement(req, res);
    expect(mocks.deleteAnnouncement).toHaveBeenCalledWith(1);
    expect(mocks.ok).toHaveBeenCalledWith({ deleted: true });
  });

  it("getActiveAnnouncements - 有 storeId 时返回活跃公告", async () => {
    mocks.getActiveAnnouncements.mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "1" } });
    const res = mockRes();
    await getActiveAnnouncements(req, res);
    expect(mocks.getActiveAnnouncements).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalled();
  });

  it("getActiveAnnouncements - 缺少 storeId 时返回 400", async () => {
    const req = mockReq();
    const res = mockRes();
    await getActiveAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("storeId is required");
    expect(mocks.getActiveAnnouncements).not.toHaveBeenCalled();
  });
});
