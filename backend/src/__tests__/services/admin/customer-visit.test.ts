/**
 * 管理端客户拜访 service 单元测试
 * 被测文件：src/services/admin/customer-visit.service.ts
 * 覆盖全部 9 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listVisits,
  getVisitDetail,
  createVisit,
  updateVisit,
  checkin,
  checkout,
  cancelVisit,
  listPendingFollowUps,
  getVisitStatistics,
} from "../../../services/admin/customer-visit.service.js";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("BF20260709000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ listVisits ============
describe("admin customer-visit.service - listVisits", () => {
  it("全部筛选条件有值 + totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, visitNo: "BF001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listVisits("t1", {
      customer_id: "1", visitor_id: "2", visit_type: "ONSITE", visit_purpose: "ROUTINE",
      status: "PLANNED", start_date: "2026-01-01", end_date: "2026-12-31", follow_up_required: "1",
      page: 1, pageSize: 10,
    });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, visitNo: "BF001" }] });
  });

  it("无筛选条件 + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listVisits("t1", { page: 2, pageSize: 5 });
    expect(res.total).toBe(0);
    expect(res.page).toBe(2);
  });
});

// ============ getVisitDetail ============
describe("admin customer-visit.service - getVisitDetail", () => {
  it("拜访记录存在时返回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, visitNo: "BF001", status: "PLANNED" });
    const res = await getVisitDetail("t1", "BF001");
    expect(res).toEqual({ id: 1, visitNo: "BF001", status: "PLANNED" });
  });

  it("拜访记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getVisitDetail("t1", "BF999")).rejects.toMatchObject({ statusCode: 404, message: "拜访记录不存在" });
  });
});

// ============ createVisit ============
describe("admin customer-visit.service - createVisit", () => {
  it("客户不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(createVisit("t1", 1, "user1", "张三", {
      customer_id: 99, customer_name: "客户", store_id: 1, visit_date: "2026-07-09",
    } as any)).rejects.toMatchObject({ statusCode: 404, message: "客户不存在" });
  });

  it("成功创建拜访（全字段有值，|| 全左分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "客户A" });
    mockConn.execute.mockResolvedValue([]);
    const res = await createVisit("t1", 1, "user1", "张三", {
      customer_id: 1, customer_name: "客户A", customer_mobile: "138",
      store_id: 1, visit_type: "ONSITE", visit_purpose: "ROUTINE", visit_date: "2026-07-09",
      start_time: "09:00", end_time: "10:00", duration_minutes: 60,
      address: "地址", latitude: 30.5, longitude: 120.3,
      contact_person: "联系人", contact_position: "经理", contact_mobile: "139",
      visit_summary: "总结", follow_up_required: 1, follow_up_date: "2026-07-10",
      follow_up_content: "跟进内容", next_action: "下一步",
      related_order_no: "O001", images: { url: "img" }, remark: "备注",
    });
    expect(res).toEqual({ visit_no: "BF20260709000001" });
    expect(mockConn.execute).toHaveBeenCalledTimes(2);
  });

  it("成功创建拜访（可选字段全缺省，|| 全右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "客户A" });
    mockConn.execute.mockResolvedValue([]);
    const res = await createVisit("t1", 1, "user1", undefined, {
      customer_id: 1, customer_name: "客户A", store_id: 1, visit_date: "2026-07-09",
    } as any);
    expect(res).toEqual({ visit_no: "BF20260709000001" });
    // 验证 realName 为 undefined 时用 username
    const insertCall = mockConn.execute.mock.calls[0][1] as unknown[];
    expect(insertCall).toContain("user1"); // visitor_name = realName || username
  });
});

// ============ updateVisit ============
describe("admin customer-visit.service - updateVisit", () => {
  it("拜访记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateVisit("t1", 1, "user1", "BF999", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("全字段更新 + images 有值（updates.length > 0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "PLANNED" })
      .mockResolvedValueOnce({ visitNo: "BF001", status: "VISITED" });
    const res = await updateVisit("t1", 1, "user1", "BF001", {
      visit_type: "PHONE", visit_purpose: "ORDER", visit_date: "2026-07-10",
      start_time: "09:00", end_time: "10:00", duration_minutes: 60,
      address: "新地址", latitude: 31, longitude: 121,
      contact_person: "新人", contact_position: "总监", contact_mobile: "137",
      visit_summary: "新总结", follow_up_required: 1, follow_up_date: "2026-07-11",
      follow_up_content: "新跟进", next_action: "新动作",
      status: "VISITED", related_order_no: "O002", images: { url: "new" }, remark: "新备注",
    } as any);
    expect(res).toEqual({ visitNo: "BF001", status: "VISITED" });
    // 2 次 queryWithTenant：UPDATE + INSERT 操作日志
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("空更新（updates.length === 0，不执行 UPDATE）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, status: "PLANNED" })
      .mockResolvedValueOnce({ visitNo: "BF001", status: "PLANNED" });
    const res = await updateVisit("t1", 1, "user1", "BF001", {} as any);
    expect(res).toEqual({ visitNo: "BF001", status: "PLANNED" });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

// ============ checkin ============
describe("admin customer-visit.service - checkin", () => {
  it("拜访记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(checkin("t1", 1, "user1", "BF999", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PLANNED 时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VISITED" });
    await expect(checkin("t1", 1, "user1", "BF001", {})).rejects.toMatchObject({ statusCode: 400, message: "只有计划中的拜访可以签到" });
  });

  it("成功签到（全字段有值）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PLANNED" });
    const res = await checkin("t1", 1, "user1", "BF001", {
      latitude: 30.5, longitude: 120.3, address: "签到地址",
    });
    expect(res.status).toBe("VISITED");
    expect(res.visit_no).toBe("BF001");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2); // UPDATE + 操作日志
  });

  it("成功签到（无定位信息，body 全空）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PLANNED" });
    const res = await checkin("t1", 1, "user1", "BF001", {});
    expect(res.status).toBe("VISITED");
  });
});

// ============ checkout ============
describe("admin customer-visit.service - checkout", () => {
  it("拜访记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(checkout("t1", 1, "user1", "BF999", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 VISITED 时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PLANNED", start_time: null });
    await expect(checkout("t1", 1, "user1", "BF001", {})).rejects.toMatchObject({ statusCode: 400, message: "只有已签到的拜访可以签退" });
  });

  it("成功签退（有 start_time，全字段有值）", async () => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1小时前
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VISITED", start_time: pastTime });
    const res = await checkout("t1", 1, "user1", "BF001", {
      visit_summary: "总结", follow_up_required: 1, follow_up_date: "2026-07-10",
      follow_up_content: "跟进", next_action: "动作", images: { url: "img" }, remark: "备注",
    } as any);
    expect(res.status).toBe("COMPLETED");
    expect(res.duration_minutes).not.toBeNull();
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("成功签退（无 start_time，durationMinutes 为 null，全字段无值）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VISITED", start_time: null });
    const res = await checkout("t1", 1, "user1", "BF001", {} as any);
    expect(res.status).toBe("COMPLETED");
    expect(res.duration_minutes).toBeNull();
  });
});

// ============ cancelVisit ============
describe("admin customer-visit.service - cancelVisit", () => {
  it("拜访记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(cancelVisit("t1", 1, "user1", "BF999")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 PLANNED 时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "VISITED" });
    await expect(cancelVisit("t1", 1, "user1", "BF001")).rejects.toMatchObject({ statusCode: 400, message: "只有计划中的拜访可以取消" });
  });

  it("成功取消", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PLANNED" });
    const res = await cancelVisit("t1", 1, "user1", "BF001");
    expect(res).toEqual({ visit_no: "BF001", status: "CANCELLED" });
  });
});

// ============ listPendingFollowUps ============
describe("admin customer-visit.service - listPendingFollowUps", () => {
  it("visitorId 有值 + totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, visitNo: "BF001" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPendingFollowUps("t1", 5, 1, 10);
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, visitNo: "BF001" }] });
  });

  it("visitorId 为 null + totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPendingFollowUps("t1", null, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ getVisitStatistics ============
describe("admin customer-visit.service - getVisitStatistics", () => {
  it("visitorId 有值 + 全部统计有值", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 50 })      // totalVisits
      .mockResolvedValueOnce({ avgMinutes: 30 })  // avgDuration
      .mockResolvedValueOnce({ total: 5 });       // pendingFollowUp
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ visitType: "ONSITE", count: 30 }, { visitType: "PHONE", count: 20 }])  // byType
      .mockResolvedValueOnce([{ visitPurpose: "ROUTINE", count: 40 }, { visitPurpose: "ORDER", count: 10 }])  // byPurpose
      .mockResolvedValueOnce([{ status: "COMPLETED", count: 45 }, { status: "CANCELLED", count: 5 }]);  // byStatus
    const res = await getVisitStatistics("t1", 5, "2026-01-01", "2026-12-31");
    expect(res.totalVisits).toBe(50);
    expect(res.avgDurationMinutes).toBe(30);
    expect(res.pendingFollowUps).toBe(5);
    expect(res.byType).toEqual({ ONSITE: 30, PHONE: 20 });
    expect(res.byPurpose).toEqual({ ROUTINE: 40, ORDER: 10 });
    expect(res.byStatus).toEqual({ COMPLETED: 45, CANCELLED: 5 });
  });

  it("visitorId 为 null + 全部统计为 null", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await getVisitStatistics("t1", null, "2026-01-01", "2026-12-31");
    expect(res.totalVisits).toBe(0);
    expect(res.avgDurationMinutes).toBe(0);
    expect(res.pendingFollowUps).toBe(0);
    expect(res.byType).toEqual({});
    expect(res.byPurpose).toEqual({});
    expect(res.byStatus).toEqual({});
  });
});
