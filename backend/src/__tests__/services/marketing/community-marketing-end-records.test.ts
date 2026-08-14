/**
 * 社区营销 结束活动/参与记录 service 单元测试（R100-02）
 * 被测文件：src/services/marketing/community-marketing.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  endGroupBuyActivity,
  endBargainActivity,
  endSeckillActivity,
  listGroupBuyParticipationRecords,
  listBargainParticipationRecords,
  listSeckillParticipationRecords,
} from "../../../services/marketing/community-marketing.service";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("community-marketing.service - 结束活动（R100-02）", () => {
  it("endGroupBuyActivity 正常结束 ACTIVE 活动", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "ACTIVE" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await endGroupBuyActivity(tenantId, 1);
    expect(res).toEqual({ id: 1, status: "ENDED" });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("UPDATE t_group_buy SET status = 'ENDED'");
  });

  it("endGroupBuyActivity 活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(endGroupBuyActivity(tenantId, 99)).rejects.toMatchObject({
      message: "拼团活动不存在",
      statusCode: 404,
    });
  });

  it("endGroupBuyActivity 非 ACTIVE 活动抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "DRAFT" });
    await expect(endGroupBuyActivity(tenantId, 1)).rejects.toMatchObject({
      message: "仅进行中的活动可结束",
      statusCode: 400,
    });
  });

  it("endBargainActivity 正常结束", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 2, status: "ACTIVE" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await endBargainActivity(tenantId, 2);
    expect(res).toEqual({ id: 2, status: "ENDED" });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("UPDATE t_bargain_activity");
  });

  it("endSeckillActivity 正常结束", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 3, status: "ACTIVE" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await endSeckillActivity(tenantId, 3);
    expect(res).toEqual({ id: 3, status: "ENDED" });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("UPDATE t_seckill_product");
  });
});

describe("community-marketing.service - 参与记录（R100-02）", () => {
  it("listGroupBuyParticipationRecords 返回分页记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 10, activityId: 1, activityName: "拼团A", memberName: "张三", memberMobile: "13800000000", teamStatus: "COMPLETED" },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const res = await listGroupBuyParticipationRecords(tenantId, 1, 1, 20);
    expect(res.total).toBe(1);
    expect(res.records[0].activityName).toBe("拼团A");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("FROM t_group_buy_member gm");
  });

  it("listGroupBuyParticipationRecords 活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(listGroupBuyParticipationRecords(tenantId, 99, 1, 20)).rejects.toMatchObject({
      message: "拼团活动不存在",
      statusCode: 404,
    });
  });

  it("listBargainParticipationRecords 返回分页记录", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 2 });
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 11, activityId: 2, activityName: "砍价A", memberName: "李四", memberMobile: "13900000000", status: "SUCCESS" },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const res = await listBargainParticipationRecords(tenantId, 2, 1, 20);
    expect(res.total).toBe(1);
    expect(res.records[0].status).toBe("SUCCESS");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("FROM t_bargain_record br");
  });

  it("listSeckillParticipationRecords 无数据源返回空分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 3 });
    const res = await listSeckillParticipationRecords(tenantId, 3, 1, 20);
    expect(res).toEqual({ total: 0, page: 1, pageSize: 20, records: [] });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("listSeckillParticipationRecords 活动不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(listSeckillParticipationRecords(tenantId, 99, 1, 20)).rejects.toMatchObject({
      message: "秒杀活动不存在",
      statusCode: 404,
    });
  });
});
