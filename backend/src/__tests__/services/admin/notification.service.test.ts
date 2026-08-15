/**
 * 后台通知 service 单元测试
 * 被测文件：src/services/admin/notification.service.ts
 *
 * 覆盖范围：
 *  - sendNotification：完整字段插入 / relatedId·relatedType 缺省写 null
 *  - listNotifications：无筛选 / type+isRead 筛选（SQL 条件拼接）
 *  - getUnreadCount：有值 / 兜底 0
 *  - markAsRead / markAllRead：UPDATE 调用
 *  - getNotificationById：存在 / 不存在返回 null
 *  - deleteNotification：删除成功 / 无影响
 *  - batchDeleteNotifications：空 ids 直接返回 / 批量删除 IN 占位符
 *  - listMyNotifications / getMyUnreadCount / markMyRead / markMyAllRead（小程序端）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  pool: { query: vi.fn() },
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  pool: mocks.pool,
}));

import {
  sendNotification,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  getNotificationById,
  deleteNotification,
  batchDeleteNotifications,
  listMyNotifications,
  getMyUnreadCount,
  markMyRead,
  markMyAllRead,
} from "../../../services/admin/notification.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pool.query.mockResolvedValue([{ insertId: 99 }]);
});

describe("admin/notification.service - sendNotification", () => {
  it("插入通知并返回 insertId", async () => {
    const id = await sendNotification({
      recipientId: 9,
      recipientType: "ADMIN",
      title: "标题",
      content: "内容",
      type: "SYSTEM",
      relatedId: 1,
      relatedType: "order",
      tenantId: "t1",
    });
    expect(id).toBe(99);
    const [sql, params] = mocks.pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_notification");
    expect(params).toEqual([9, "ADMIN", "标题", "内容", "SYSTEM", 1, "order", "t1"]);
  });

  it("relatedId / relatedType 缺省时写入 null", async () => {
    await sendNotification({
      recipientId: 1,
      recipientType: "CONSUMER",
      title: "t",
      content: "c",
      type: "ORDER",
      tenantId: "t1",
    });
    const params = (mocks.pool.query.mock.calls[0] as unknown as [string, unknown[]])[1];
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });
});

describe("admin/notification.service - listNotifications", () => {
  it("无筛选返回全部记录 + total", async () => {
    mocks.query.mockResolvedValue([{ id: 1, title: "x" }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listNotifications("t1", {}, 1, 10);
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("带 type + isRead 筛选时拼接条件", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });
    await listNotifications("t1", { type: "ALERT", isRead: 0 }, 1, 10);
    const where = (mocks.query.mock.calls[0] as unknown as [string])[0];
    expect(where).toContain("n.type = ?");
    expect(where).toContain("n.is_read = ?");
  });
});

describe("admin/notification.service - getUnreadCount", () => {
  it("返回未读数量", async () => {
    mocks.queryOne.mockResolvedValue({ count: 3 });
    expect(await getUnreadCount("t1", 5)).toEqual({ count: 3 });
  });

  it("无记录时兜底 0", async () => {
    mocks.queryOne.mockResolvedValue(null);
    expect((await getUnreadCount("t1", 5)).count).toBe(0);
  });
});

describe("admin/notification.service - markAsRead / markAllRead", () => {
  it("markAsRead 调用更新并返回 marked", async () => {
    mocks.query.mockResolvedValue([{}]);
    const res = await markAsRead("t1", 1);
    expect(res).toEqual({ marked: true });
    expect((mocks.query.mock.calls[0] as unknown as [string])[0]).toContain("UPDATE t_notification SET is_read = 1");
  });

  it("markAllRead 批量更新并返回 marked", async () => {
    mocks.query.mockResolvedValue([{}]);
    expect(await markAllRead("t1", 5)).toEqual({ marked: true });
  });
});

describe("admin/notification.service - getNotificationById", () => {
  it("存在时返回行", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, title: "x" });
    expect((await getNotificationById("t1", 1))?.id).toBe(1);
  });

  it("不存在返回 null", async () => {
    mocks.queryOne.mockResolvedValue(null);
    expect(await getNotificationById("t1", 9)).toBeNull();
  });
});

describe("admin/notification.service - deleteNotification", () => {
  it("删除成功返回 deleted true", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    expect(await deleteNotification("t1", 1)).toEqual({ deleted: true });
  });

  it("无影响时返回 deleted false", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 0 }]);
    expect(await deleteNotification("t1", 1)).toEqual({ deleted: false });
  });
});

describe("admin/notification.service - batchDeleteNotifications", () => {
  it("空 ids 直接返回 deleted 0", async () => {
    expect(await batchDeleteNotifications("t1", [])).toEqual({ deleted: 0 });
  });

  it("批量删除返回 affected 并生成 IN 占位符", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 2 }]);
    const res = await batchDeleteNotifications("t1", [1, 2]);
    expect(res.deleted).toBe(2);
    expect((mocks.queryWithTenant.mock.calls[0] as unknown as [string])[0]).toContain("IN (?, ?)");
  });
});

describe("admin/notification.service - 小程序通知", () => {
  it("listMyNotifications 返回记录 + total", async () => {
    mocks.query.mockResolvedValue([{ id: 1, title: "x" }]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listMyNotifications("t1", 5, 1, 10);
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("getMyUnreadCount 返回未读", async () => {
    mocks.queryOne.mockResolvedValue({ count: 2 });
    expect(await getMyUnreadCount("t1", 5)).toEqual({ count: 2 });
  });

  it("getMyUnreadCount 兜底 0", async () => {
    mocks.queryOne.mockResolvedValue(null);
    expect((await getMyUnreadCount("t1", 5)).count).toBe(0);
  });

  it("markMyRead 更新并返回 marked", async () => {
    mocks.query.mockResolvedValue([{}]);
    expect(await markMyRead("t1", 1)).toEqual({ marked: true });
  });

  it("markMyAllRead 批量更新并返回 marked", async () => {
    mocks.query.mockResolvedValue([{}]);
    expect(await markMyAllRead("t1", 5)).toEqual({ marked: true });
  });
});
