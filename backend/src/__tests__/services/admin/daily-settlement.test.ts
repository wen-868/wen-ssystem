/**
 * 管理端日结 service 单元测试
 * 被测文件：src/services/admin/daily-settlement.service.ts
 * 覆盖全部 3 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import {
  createDailySettlement,
  listDailySettlements,
  getDailySettlementDetail,
} from "../../../services/admin/daily-settlement.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
});

// ============ createDailySettlement ============
describe("admin daily-settlement.service - createDailySettlement", () => {
  it("已有日结记录时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    await expect(createDailySettlement({ settleDate: "2026-07-09", tenantId: "t1", operatorId: 1 }))
      .rejects.toMatchObject({ statusCode: 400, message: "该日期已有日结记录" });
  });

  it("成功创建日结 + 全部渠道有数据（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // existing → null
      .mockResolvedValueOnce({ totalSales: 5000 })  // salesRow
      .mockResolvedValueOnce({ totalRefund: 500 });  // refundRow
    mocks.queryWithTenant
      .mockResolvedValueOnce([
        { channel: "CASH", amount: 1000 },
        { channel: "WECHAT", amount: 2000 },
        { channel: "ALIPAY", amount: 500 },
        { channel: "TRANSFER", amount: 800 },
        { channel: "OTHER", amount: 200 },
      ])  // channelRows
      .mockResolvedValueOnce({});  // INSERT
    const res = await createDailySettlement({ settleDate: "2026-07-09", tenantId: "t1", operatorId: 1 });
    expect(res.settleDate).toBe("2026-07-09");
    expect(res.totalSales).toBe(5000);
    expect(res.totalRefund).toBe(500);
    expect(res.cashAmount).toBe(1000);
    expect(res.wechatAmount).toBe(2000);
    expect(res.alipayAmount).toBe(500);
    expect(res.transferAmount).toBe(800);
    expect(res.otherAmount).toBe(200);
    expect(res.totalReceived).toBe(4500);
    expect(res.message).toBe("日结成功");
  });

  it("成功创建日结 + 无渠道数据（?? 右分支）+ salesRow/refundRow null", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)  // existing → null
      .mockResolvedValueOnce(null)  // salesRow → null
      .mockResolvedValueOnce(null);  // refundRow → null
    mocks.queryWithTenant
      .mockResolvedValueOnce([])  // channelRows → empty
      .mockResolvedValueOnce({});  // INSERT
    const res = await createDailySettlement({ settleDate: "2026-07-08", tenantId: "t1", operatorId: 1 });
    expect(res.totalSales).toBe(0);
    expect(res.totalRefund).toBe(0);
    expect(res.cashAmount).toBe(0);
    expect(res.wechatAmount).toBe(0);
    expect(res.alipayAmount).toBe(0);
    expect(res.transferAmount).toBe(0);
    expect(res.otherAmount).toBe(0);
    expect(res.totalReceived).toBe(0);
  });
});

// ============ listDailySettlements ============
describe("admin daily-settlement.service - listDailySettlements", () => {
  it("有 dateStart + dateEnd + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, settleDate: "2026-07-09" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listDailySettlements({ page: 1, pageSize: 10, tenantId: "t1", dateStart: "2026-07-01", dateEnd: "2026-07-31" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ id: 1, settleDate: "2026-07-09" }] });
  });

  it("无日期范围 + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listDailySettlements({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getDailySettlementDetail ============
describe("admin daily-settlement.service - getDailySettlementDetail", () => {
  it("记录存在时返回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, settleDate: "2026-07-09", totalSales: 5000 });
    const res = await getDailySettlementDetail(1, "t1");
    expect(res.id).toBe(1);
  });

  it("记录不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getDailySettlementDetail(99, "t1")).rejects.toMatchObject({ statusCode: 404, message: "日结记录不存在" });
  });
});
