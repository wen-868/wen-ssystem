import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/notification.service.js", () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
  sendNotification: vi.fn(),
  listMyNotifications: vi.fn(),
  getMyUnreadCount: vi.fn(),
  markMyRead: vi.fn(),
  markMyAllRead: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as notificationService from "../../../services/admin/notification.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  list,
  unreadCount,
  markRead,
  markAllRead,
  send,
  myList,
  myUnreadCount,
  myMarkRead,
  myMarkAllRead,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  listMiniappNotifications,
  getMiniappUnreadCount,
  markMiniappAsRead,
  markMiniappAllAsRead,
} from "../../../controllers/notification.controller.js";

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

describe("notification.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("admin endpoints", () => {
    it("list - 应返回通知列表", async () => {
      (notificationService.listNotifications as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(notificationService.listNotifications).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("unreadCount - 应返回未读数量", async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue({ count: 0 });
      const req = mockReq();
      const res = mockRes();
      await unreadCount(req as any, res as any);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("markRead - 应标记为已读", async () => {
      (notificationService.markAsRead as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await markRead(req as any, res as any);
      expect(notificationService.markAsRead).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("markAllRead - 应标记全部已读", async () => {
      (notificationService.markAllRead as any).mockResolvedValue({ success: true });
      const req = mockReq();
      const res = mockRes();
      await markAllRead(req as any, res as any);
      expect(notificationService.markAllRead).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("send - 应发送通知", async () => {
      (notificationService.sendNotification as any).mockResolvedValue(1);
      const req = mockReq({
        body: {
          recipientId: 1,
          title: "测试通知",
          content: "测试内容",
        },
      });
      const res = mockRes();
      await send(req as any, res as any);
      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("send - zod验证失败", async () => {
      const req = mockReq({ body: { recipientId: "invalid", title: "" } });
      const res = mockRes();
      await expect(send(req as any, res as any)).rejects.toThrow();
    });
  });

  describe("miniapp endpoints", () => {
    it("myList - 应返回我的通知列表", async () => {
      (notificationService.listMyNotifications as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq();
      const res = mockRes();
      await myList(req as any, res as any);
      expect(notificationService.listMyNotifications).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("myList - 未登录应返回401", async () => {
      const req = mockReq({ user: {} });
      const res = mockRes();
      await myList(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(fail).toHaveBeenCalled();
    });

    it("myUnreadCount - 应返回我的未读数量", async () => {
      (notificationService.getMyUnreadCount as any).mockResolvedValue({ count: 0 });
      const req = mockReq();
      const res = mockRes();
      await myUnreadCount(req as any, res as any);
      expect(notificationService.getMyUnreadCount).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("myMarkRead - 应标记我的通知已读", async () => {
      (notificationService.markMyRead as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();
      await myMarkRead(req as any, res as any);
      expect(notificationService.markMyRead).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("myMarkAllRead - 应标记我的全部通知已读", async () => {
      (notificationService.markMyAllRead as any).mockResolvedValue({ success: true });
      const req = mockReq();
      const res = mockRes();
      await myMarkAllRead(req as any, res as any);
      expect(notificationService.markMyAllRead).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("aliases", () => {
    it("listNotifications should equal list", () => expect(listNotifications).toBe(list));
    it("getUnreadCount should equal unreadCount", () => expect(getUnreadCount).toBe(unreadCount));
    it("markAsRead should equal markRead", () => expect(markAsRead).toBe(markRead));
    it("markAllAsRead should equal markAllRead", () => expect(markAllAsRead).toBe(markAllRead));
    it("listMiniappNotifications should equal myList", () => expect(listMiniappNotifications).toBe(myList));
    it("getMiniappUnreadCount should equal myUnreadCount", () => expect(getMiniappUnreadCount).toBe(myUnreadCount));
    it("markMiniappAsRead should equal myMarkRead", () => expect(markMiniappAsRead).toBe(myMarkRead));
    it("markMiniappAllAsRead should equal myMarkAllRead", () => expect(markMiniappAllAsRead).toBe(myMarkAllRead));
  });
});