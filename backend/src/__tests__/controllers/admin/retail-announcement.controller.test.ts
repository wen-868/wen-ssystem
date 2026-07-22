/**
 * 即时零售公告控制器测试
 * 被测文件：src/controllers/admin/retail-announcement.controller.ts
 *
 * R55-01 修复后控制器签名变更：
 * - storeId 从 req.user.storeId 获取（不信任用户输入）
 * - tenantId 从 req.tenantId 获取
 * - SUPER_ADMIN/OPERATION_ADMIN 无 storeId 时允许从 query 获取
 * - service 调用全部增加 tenantId 参数
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getActiveAnnouncements: vi.fn(),
  hasAnyRole: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../middleware/auth", () => ({
  // 真实 hasAnyRole 在 user.roles 为 undefined 时会抛 TypeError，
  // 因此 mock 为可控函数，默认返回 false（普通用户场景）。
  // 超级管理员场景的测试用 beforeEach 或 it 内部 mockReturnValue(true) 覆盖。
  hasAnyRole: mocks.hasAnyRole,
}));

vi.mock("../../../services/instant-retail/retail-announcement.service", () => ({
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
} from "../../../controllers/admin/retail-announcement.controller";

/**
 * 构造 mock 请求
 * 默认构造一个"普通门店用户"请求：user 带 storeId、roles 为普通角色
 */
const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1, roles: ["STORE_MANAGER"] },
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
  // 默认 hasAnyRole 返回 false（非超级管理员）
  mocks.hasAnyRole.mockReturnValue(false);
});

describe("admin retail-announcement.controller", () => {
  // ============ listAnnouncements ============

  it("listAnnouncements - 普通用户从 user.storeId 获取门店，返回公告列表", async () => {
    mocks.listAnnouncements.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(mocks.listAnnouncements).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("listAnnouncements - 超级管理员从 query.storeId 获取门店", async () => {
    mocks.hasAnyRole.mockReturnValue(true);
    mocks.listAnnouncements.mockResolvedValue([]);
    const req = mockReq({
      user: { id: 1, username: "boss", storeId: null, roles: ["SUPER_ADMIN"] },
      query: { storeId: "5" },
    });
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(mocks.listAnnouncements).toHaveBeenCalledWith(5, "t1");
  });

  it("listAnnouncements - 普通用户无 storeId 时返回 403", async () => {
    const req = mockReq({ user: { id: 1, username: "u", storeId: null, roles: ["CASHIER"] } });
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.fail).toHaveBeenCalledWith("缺少门店权限", "403");
    expect(mocks.listAnnouncements).not.toHaveBeenCalled();
  });

  it("listAnnouncements - 超级管理员但 query.storeId 缺失时返回 403", async () => {
    mocks.hasAnyRole.mockReturnValue(true);
    const req = mockReq({
      user: { id: 1, username: "boss", storeId: null, roles: ["SUPER_ADMIN"] },
    });
    const res = mockRes();
    await listAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.listAnnouncements).not.toHaveBeenCalled();
  });

  // ============ createAnnouncement ============

  it("createAnnouncement - 应创建公告（store_id 从 user.storeId 获取，不信任 body）", async () => {
    const body = {
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
      expect.objectContaining({
        store_id: 1,
        title: "新店开业",
        content: "欢迎光临！",
        is_top: 1,
      }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createAnnouncement - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createAnnouncement(req, res)).rejects.toThrow();
    expect(mocks.createAnnouncement).not.toHaveBeenCalled();
  });

  it("createAnnouncement - 普通用户无 storeId 时返回 403", async () => {
    const body = { title: "x", content: "y" };
    const req = mockReq({ user: { id: 1, username: "u", storeId: null, roles: ["CASHIER"] }, body });
    const res = mockRes();
    await createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.createAnnouncement).not.toHaveBeenCalled();
  });

  // ============ updateAnnouncement ============

  it("updateAnnouncement - 应更新公告（带 storeId + tenantId 双重校验）", async () => {
    const body = { title: "新标题", content: "新内容" };
    mocks.updateAnnouncement.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateAnnouncement(req, res);
    expect(mocks.updateAnnouncement).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: "新标题", content: "新内容" }),
      1,
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateAnnouncement - 空 body 时（所有字段可选）应通过", async () => {
    mocks.updateAnnouncement.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateAnnouncement(req, res);
    expect(mocks.updateAnnouncement).toHaveBeenCalledWith(
      1,
      expect.objectContaining({}),
      1,
      "t1"
    );
  });

  it("updateAnnouncement - 普通用户无 storeId 时返回 403", async () => {
    const body = { title: "x" };
    const req = mockReq({
      user: { id: 1, username: "u", storeId: null, roles: ["CASHIER"] },
      params: { id: "1" },
      body,
    });
    const res = mockRes();
    await updateAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.updateAnnouncement).not.toHaveBeenCalled();
  });

  // ============ deleteAnnouncement ============

  it("deleteAnnouncement - 应删除公告（带 storeId + tenantId 双重校验）", async () => {
    mocks.deleteAnnouncement.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteAnnouncement(req, res);
    expect(mocks.deleteAnnouncement).toHaveBeenCalledWith(1, 1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ deleted: true });
  });

  it("deleteAnnouncement - 普通用户无 storeId 时返回 403", async () => {
    const req = mockReq({
      user: { id: 1, username: "u", storeId: null, roles: ["CASHIER"] },
      params: { id: "1" },
    });
    const res = mockRes();
    await deleteAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.deleteAnnouncement).not.toHaveBeenCalled();
  });

  // ============ getActiveAnnouncements（公开接口，不校验租户） ============

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
