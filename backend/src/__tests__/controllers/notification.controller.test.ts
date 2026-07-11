import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/notification.service.js", () => ({
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

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as notificationService from "../../services/admin/notification.service.js";
import { ok, fail } from "../../shared/response.js";
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
  getUnreadCount as getUnreadCountAlias,
  markAsRead,
  markAllAsRead,
  listMiniappNotifications,
  getMiniappUnreadCount,
  markMiniappAsRead,
  markMiniappAllAsRead,
} from "../../controllers/notification.controller.js";

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

describe("notification.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("管理后台通知", () => {
    it("list - 应返回通知列表", async () => {
      (notificationService.listNotifications as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await list(req as any, res as any);
      expect(notificationService.listNotifications).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("unreadCount - 应返回未读数量", async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(5);
      const req = mockReq();
      const res = mockRes();
      await unreadCount(req as any, res as any);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("markRead - 应标记已读", async () => {
      (notificationService.markAsRead as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
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
          recipientId: 2,
          recipientType: "ADMIN",
          title: "测试通知",
          content: "通知内容",
          type: "SYSTEM",
        },
      });
      const res = mockRes();
      await send(req as any, res as any);
      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("小程序通知", () => {
    it("myList - 未登录应返回401", async () => {
      const req = mockReq({ user: { id: null as any, username: "admin" } });
      const res = mockRes();
      await myList(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("未登录", "401");
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("myList - 应返回我的通知列表", async () => {
      (notificationService.listMyNotifications as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await myList(req as any, res as any);
      expect(notificationService.listMyNotifications).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("myUnreadCount - 未登录应返回401", async () => {
      const req = mockReq({ user: { id: null as any, username: "admin" } });
      const res = mockRes();
      await myUnreadCount(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("未登录", "401");
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("myUnreadCount - 应返回我的未读数量", async () => {
      (notificationService.getMyUnreadCount as any).mockResolvedValue(3);
      const req = mockReq();
      const res = mockRes();
      await myUnreadCount(req as any, res as any);
      expect(notificationService.getMyUnreadCount).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("myMarkRead - 应标记我的通知已读", async () => {
      (notificationService.markMyRead as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await myMarkRead(req as any, res as any);
      expect(notificationService.markMyRead).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("myMarkAllRead - 未登录应返回401", async () => {
      const req = mockReq({ user: { id: null as any, username: "admin" } });
      const res = mockRes();
      await myMarkAllRead(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("未登录", "401");
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("myMarkAllRead - 应标记我的全部通知已读", async () => {
      (notificationService.markMyAllRead as any).mockResolvedValue({ success: true });
      const req = mockReq();
      const res = mockRes();
      await myMarkAllRead(req as any, res as any);
      expect(notificationService.markMyAllRead).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("别名导出", () => {
    it("listNotifications - 别名应与list一致", () => {
      expect(listNotifications).toBe(list);
    });

    it("getUnreadCount - 别名应与unreadCount一致", () => {
      expect(getUnreadCountAlias).toBe(unreadCount);
    });

    it("markAsRead - 别名应与markRead一致", () => {
      expect(markAsRead).toBe(markRead);
    });

    it("markAllAsRead - 别名应与markAllRead一致", () => {
      expect(markAllAsRead).toBe(markAllRead);
    });

    it("listMiniappNotifications - 别名应与myList一致", () => {
      expect(listMiniappNotifications).toBe(myList);
    });

    it("getMiniappUnreadCount - 别名应与myUnreadCount一致", () => {
      expect(getMiniappUnreadCount).toBe(myUnreadCount);
    });

    it("markMiniappAsRead - 别名应与myMarkRead一致", () => {
      expect(markMiniappAsRead).toBe(myMarkRead);
    });

    it("markMiniappAllAsRead - 别名应与myMarkAllRead一致", () => {
      expect(markMiniappAllAsRead).toBe(myMarkAllRead);
    });
  });
});
