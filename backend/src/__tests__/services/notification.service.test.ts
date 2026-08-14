import { describe, it, expect, vi } from "vitest";
import { sendNotification } from "../../services/notification.service";

describe("notification.service - 站内通知发送", () => {
  it("sendNotification 插入通知并返回 insertId", async () => {
    const pool = { query: vi.fn().mockResolvedValue([{ insertId: 42 }]) } as any;
    const id = await sendNotification(pool, {
      recipientId: 9,
      recipientType: "MERCHANT",
      title: "订单提醒",
      content: "您有新订单",
      type: "ORDER",
      relatedId: 100,
      relatedType: "sale_bill",
      tenantId: "t1",
    });
    expect(id).toBe(42);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_notification");
    expect(params).toEqual([9, "MERCHANT", "订单提醒", "您有新订单", "ORDER", 100, "sale_bill", "t1"]);
  });

  it("relatedId/relatedType 缺省时写入 null", async () => {
    const pool = { query: vi.fn().mockResolvedValue([{ insertId: 1 }]) } as any;
    await sendNotification(pool, {
      recipientId: 1,
      recipientType: "ADMIN",
      title: "系统公告",
      content: "维护通知",
      type: "SYSTEM",
      tenantId: "t1",
    });
    const params = pool.query.mock.calls[0][1];
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });
});
