import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  getCartList,
  addToCart,
  updateCartItemQuantity,
  deleteCartItem,
  clearCart,
  getCartCount,
} from "../../../services/admin/cart.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cart.service - 购物车", () => {
  it("getCartList 零售价计算小计与合计", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, skuId: 10, quantity: 2, skuName: "白酒", spuName: "品牌白酒", image: "", retailPrice: 100, wholesalePrice: 80, miniappPrice: 95, availableQty: 50 },
    ]);
    const res = await getCartList(tenantId, 1, "RETAIL");
    expect(res.items).toHaveLength(1);
    expect(res.items[0].price).toBe(95); // 零售走 miniappPrice
    expect(res.items[0].subtotal).toBe(190);
    expect(res.totalAmount).toBe(190);
    expect(res.totalQty).toBe(2);
  });

  it("addToCart 商品不存在返回失败", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await addToCart(tenantId, 1, 999, 1);
    expect(res.success).toBe(false);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("addToCart 已存在时累加数量", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, sku_name: "白酒" })
      .mockResolvedValueOnce({ id: 5, quantity: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await addToCart(tenantId, 1, 10, 2);
    expect(res.success).toBe(true);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("quantity = quantity + ?");
    expect(params).toEqual([2, 5]);
  });

  it("updateCartItemQuantity 数量为 0 时删除", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateCartItemQuantity(tenantId, 1, 10, 0);
    expect(res.success).toBe(true);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_cart_item");
  });

  it("updateCartItemQuantity 更新不存在商品时返回失败（数组归一化 affectedRows）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 0 }]);
    const res = await updateCartItemQuantity(tenantId, 1, 999, 3);
    expect(res.success).toBe(false);
    expect(res.message).toBe("购物车中无此商品");
  });

  it("deleteCartItem / clearCart 执行删除", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    expect((await deleteCartItem(tenantId, 1, 10)).message).toBe("已删除");
    expect((await clearCart(tenantId, 1)).message).toContain("清空");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });

  it("getCartCount 返回数量合计", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 7 });
    expect(await getCartCount(tenantId, 1)).toEqual({ count: 7 });
  });
});
