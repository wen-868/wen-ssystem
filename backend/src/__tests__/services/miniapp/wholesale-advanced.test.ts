import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "PF20260815001"),
}));

import {
  calculateTierPrice,
  deleteWholesaleCartItems,
  toggleWholesaleCartSelect,
  toggleWholesaleCartSelectAll,
  cancelWholesaleOrder,
  confirmWholesaleReceive,
  getWholesaleOrderConfirm,
} from "../../../services/miniapp/wholesale.service";

describe("miniapp wholesale advanced", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connExecute.mockImplementation(async (_conn: any, sql: string, params: unknown[]) => {
      // 模拟 conn.execute 返回 [rows] 结构
      const mockRows: Record<string, unknown> = {};
      return [mockRows];
    });
  });

  it("calculateTierPrice：命中阶梯价档位", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ price: 95 });
    const result = await calculateTierPrice(10, 20, "t1");
    expect(result.unitPrice).toBe(95);
    expect(result.subtotal).toBe(1900);
    expect(result.tier).toBe(true);
  });

  it("calculateTierPrice：无档位回退批发价", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ wholesale_price: 100 });
    const result = await calculateTierPrice(10, 2, "t1");
    expect(result.unitPrice).toBe(100);
    expect(result.tier).toBe(false);
  });

  it("deleteWholesaleCartItems：批量删除", async () => {
    await deleteWholesaleCartItems(1, [3, 4], "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_wholesale_cart"),
      [1, 3, 4, "t1"],
      "t1"
    );
  });

  it("toggleWholesaleCartSelectAll：全选更新", async () => {
    await toggleWholesaleCartSelectAll(1, true, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("SET selected = ?"),
      [1, 1, "t1"],
      "t1"
    );
  });

  it("cancelWholesaleOrder：释放库存并置 CANCELLED", async () => {
    const conn = { execute: vi.fn(), query: vi.fn() };
    conn.execute
      .mockResolvedValueOnce([[{ order_no: "PF001" }]]) // 订单查询
      .mockResolvedValueOnce([[{ sku_id: 10, quantity: 2 }]]) // 明细
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // 释放库存
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // 更新状态
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    mocks.connExecute.mockImplementation(async (_c: any, sql: string, params: unknown[]) => conn.execute(sql, params));

    const result = await cancelWholesaleOrder("PF001", 1, "不要了", "t1");
    expect(result.orderStatus).toBe("CANCELLED");
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_inventory_balance"),
      expect.arrayContaining([2, 2, 10])
    );
  });

  it("confirmWholesaleReceive：更新为已完成", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await confirmWholesaleReceive("PF001", 1, "t1");
    expect(result.orderStatus).toBe("COMPLETED");
  });

  it("getWholesaleOrderConfirm：结算预览含金额", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { spuId: 1, skuId: 10, skuName: "酒", skuImage: "a.jpg", quantity: 2, unitPrice: 100, subtotal: 200 },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // 无默认地址
    const result = await getWholesaleOrderConfirm(1, [5], "t1");
    expect(result.goodsAmount).toBe(200);
    expect(result.items.length).toBe(1);
    expect(result.address).toBeNull();
  });
});
