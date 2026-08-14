/**
 * 管理端通知中心 controller 单元测试
 * 被测文件：src/controllers/admin/notification-center.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  getTypeStats: vi.fn(),
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/notification-center.service", () => ({
  listNotifications: mocks.listNotifications,
  getUnreadCount: mocks.getUnreadCount,
  getTypeStats: mocks.getTypeStats,
  markAsRead: mocks.markAsRead,
  markAllRead: mocks.markAllRead,
  deleteNotification: mocks.deleteNotification,
}));

import {
  listNotifications,
  getUnreadCount,
  getTypeStats,
  markAsRead,
  markAllRead,
  deleteNotification,
} from "../../../controllers/admin/notification-center.controller";

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

describe("admin notification-center.controller", () => {
  it("listNotifications 默认分页参数", async () => {
    mocks.listNotifications.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listNotifications(req, res, vi.fn());
    expect(mocks.listNotifications).toHaveBeenCalledWith("t1", 1, 20, undefined, undefined);
  });

  it("listNotifications 传入 type 和 isRead", async () => {
    mocks.listNotifications.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { type: "ORDER", isRead: "0", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listNotifications(req, res, vi.fn());
    expect(mocks.listNotifications).toHaveBeenCalledWith("t1", 2, 10, "ORDER", 0);
  });

  it("listNotifications isRead 为空字符串时为 undefined", async () => {
    mocks.listNotifications.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { isRead: "" } });
    const res = mockRes();
    await listNotifications(req, res, vi.fn());
    expect(mocks.listNotifications).toHaveBeenCalledWith("t1", 1, 20, undefined, undefined);
  });

  it("getUnreadCount 调用 service 并返回数量", async () => {
    mocks.getUnreadCount.mockResolvedValue({ count: 5 });
    const req = mockReq();
    const res = mockRes();
    await getUnreadCount(req, res, vi.fn());
    expect(mocks.getUnreadCount).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith({ count: 5 });
  });

  it("getTypeStats 调用 service 并返回统计", async () => {
    mocks.getTypeStats.mockResolvedValue([{ type: "ORDER", count: 3 }]);
    const req = mockReq();
    const res = mockRes();
    await getTypeStats(req, res, vi.fn());
    expect(mocks.getTypeStats).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ type: "ORDER", count: 3 }] });
  });

  it("markAsRead 传入 id 转换为数字", async () => {
    mocks.markAsRead.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await markAsRead(req, res, vi.fn());
    expect(mocks.markAsRead).toHaveBeenCalledWith("t1", 5);
    expect(mocks.ok).toHaveBeenCalledWith({ success: true });
  });

  it("markAllRead 调用 service 标记全部已读", async () => {
    mocks.markAllRead.mockResolvedValue({ updated: 10 });
    const req = mockReq();
    const res = mockRes();
    await markAllRead(req, res, vi.fn());
    expect(mocks.markAllRead).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { updated: 10 } });
  });

  it("deleteNotification 传入 id 转换为数字", async () => {
    mocks.deleteNotification.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "8" } });
    const res = mockRes();
    await deleteNotification(req, res, vi.fn());
    expect(mocks.deleteNotification).toHaveBeenCalledWith("t1", 8);
  });

  it("listNotifications 调用 res.json 返回 ok 包装结果", async () => {
    mocks.listNotifications.mockResolvedValue({ list: [{ id: 1 }], total: 1 });
    const req = mockReq();
    const res = mockRes();
    await listNotifications(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { list: [{ id: 1 }], total: 1 } });
  });
});
