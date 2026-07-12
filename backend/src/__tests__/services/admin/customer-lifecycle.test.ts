/**
 * 管理端客户生命周期 service 单元测试
 * 被测文件：src/services/admin/customer-lifecycle.service.ts
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
  getLifecycleStages,
  getLifecycleTrend,
  getLifecycleDetail,
} from "../../../services/admin/customer-lifecycle.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ getLifecycleStages ============
describe("admin customer-lifecycle.service - getLifecycleStages", () => {
  it("返回阶段统计", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ stage: "ACTIVE", customerCount: 50 }]);
    const res = await getLifecycleStages("t1");
    expect(res).toEqual([{ stage: "ACTIVE", customerCount: 50 }]);
  });
});

// ============ getLifecycleTrend ============
describe("admin customer-lifecycle.service - getLifecycleTrend", () => {
  it("有数据 + stage 匹配（hasOwnProperty true 分支）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ stage: "ACTIVE", cnt: 30 }, { stage: "NEW", cnt: 10 }])
      .mockResolvedValueOnce([{ stage: "DORMANT", cnt: 5 }]);
    const res = await getLifecycleTrend("t1", 2);
    expect(res).toHaveLength(2);
    expect(res[0].ACTIVE).toBe(30);
    expect(res[0].NEW).toBe(10);
    expect(res[1].DORMANT).toBe(5);
  });

  it("有数据 + stage 不匹配（hasOwnProperty false 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ stage: "UNKNOWN", cnt: 99 }]);
    const res = await getLifecycleTrend("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0].ACTIVE).toBe(0);  // UNKNOWN 不匹配，不更新
  });

  it("无数据（for 循环不执行）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await getLifecycleTrend("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0].PROSPECT).toBe(0);
  });
});

// ============ getLifecycleDetail ============
describe("admin customer-lifecycle.service - getLifecycleDetail", () => {
  it("stage 有值 + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getLifecycleDetail({ stage: "ACTIVE", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ customerId: 1, customerName: "张三" }] });
  });

  it("stage 无值 + total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getLifecycleDetail({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});
