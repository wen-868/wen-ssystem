﻿﻿﻿﻿﻿/**
 * 库存报损报溢 service 单元测试
 * 被测文件：src/services/admin/inventory-loss-gain.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  reportLossGain,
  listLossGains,
} from "../../../services/admin/inventory-loss-gain.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("SY20260709000001");
});

describe("inventory-loss-gain.service - reportLossGain", () => {
  it("报损 LOSS + reason 有值（type === LOSS true + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await reportLossGain({
      storeId: 1, type: "LOSS", skuId: 1, qty: 5, costPrice: 10,
      reason: "破损", operatorId: 1, tenantId: "t1",
    });
    expect(res.lgNo).toBe("SY20260709000001");
    expect(res.amount).toBe(50);
    // 验证 changeQty 为负数
    expect(mocks.queryWithTenant.mock.calls[1][1][0]).toBe(-5);
  });

  it("报溢 GAIN + reason 无值（type === LOSS false + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await reportLossGain({
      storeId: 1, type: "GAIN", skuId: 2, qty: 3, costPrice: 20,
      reason: undefined as any, operatorId: 1, tenantId: "t1",
    });
    expect(res.amount).toBe(60);
    // 验证 changeQty 为正数
    expect(mocks.queryWithTenant.mock.calls[1][1][0]).toBe(3);
    // 验证 reason ?? null → null
    expect(mocks.queryWithTenant.mock.calls[0][1][7]).toBeNull();
  });
});

describe("inventory-loss-gain.service - listLossGains", () => {
  it("无可选条件 + totalRow 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ lgNo: "SY1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listLossGains({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ lgNo: "SY1" }] });
  });

  it("有 storeId + type + totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listLossGains({ page: 1, pageSize: 10, tenantId: "t1", storeId: 1, type: "LOSS" });
    expect(res.total).toBe(0);
  });
});
