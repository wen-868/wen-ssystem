/**
 * 小程序购物车 service 单元测试
 * 被测文件：src/services/miniapp/cart.service.ts
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
}));

vi.mock("../../../shared/fulfillment", () => ({
  shouldReserveStock: (customerType: string) => customerType === "WHOLESALE",
}));

import {
  getCartList,
  addToCart,
  updateCartItemQuantity,
  deleteCartItem,
  clearCart,
  getCartCount,
} from "../../../services/miniapp/cart.service";

describe("miniapp/cart.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("getCartList", () => {
    it("应返回购物车列表（零售客户）", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, skuId: 1, quantity: 2, skuName: "商品1", spuName: "SPU1", image: "img1.jpg", retailPrice: 100, miniappPrice: 99, availableQty: 10 },
      ]);
      const res = await getCartList("t1", 1, "RETAIL");
      expect(res.items.length).toBe(1);
      expect(res.items[0].price).toBe(99);
      expect(res.items[0].priceType).toBe("RETAIL");
      expect(res.totalAmount).toBe(198);
      expect(res.totalQty).toBe(2);
    });

    it("批发客户应显示批发价", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, skuId: 1, quantity: 2, skuName: "商品1", spuName: "SPU1", image: "img1.jpg", retailPrice: 100, wholesalePrice: 80, availableQty: 10 },
      ]);
      const res = await getCartList("t1", 1, "WHOLESALE");
      expect(res.items[0].price).toBe(80);
      expect(res.items[0].priceType).toBe("WHOLESALE");
      expect(res.totalAmount).toBe(160);
    });

    it("批发客户无批发价时使用零售价", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, skuId: 1, quantity: 1, skuName: "商品1", spuName: "SPU1", image: "img1.jpg", retailPrice: 100, availableQty: 10 },
      ]);
      const res = await getCartList("t1", 1, "WHOLESALE");
      expect(res.items[0].price).toBe(100);
      expect(res.items[0].priceType).toBe("RETAIL");
    });

    it("空购物车应返回空列表和0金额", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      const res = await getCartList("t1", 1, "RETAIL");
      expect(res.items.length).toBe(0);
      expect(res.totalAmount).toBe(0);
      expect(res.totalQty).toBe(0);
    });

    it("多个商品应正确计算小计和总计", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, skuId: 1, quantity: 2, skuName: "商品1", spuName: "SPU1", image: "img1.jpg", retailPrice: 100, miniappPrice: 99.99, availableQty: 10 },
        { id: 2, skuId: 2, quantity: 3, skuName: "商品2", spuName: "SPU2", image: "img2.jpg", retailPrice: 50, miniappPrice: 49.99, availableQty: 20 },
      ]);
      const res = await getCartList("t1", 1, "RETAIL");
      expect(res.items.length).toBe(2);
      expect(res.items[0].subtotal).toBe(199.98);
      expect(res.items[1].subtotal).toBe(149.97);
      expect(res.totalAmount).toBe(349.95);
      expect(res.totalQty).toBe(5);
    });
  });

  describe("addToCart", () => {
    it("商品不存在应返回失败", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await addToCart("t1", 1, 999, 1);
      expect(res.success).toBe(false);
      expect(res.message).toBe("商品不存在或已下架");
    });

    it("购物车已有商品应增加数量", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 1, sku_name: "商品1" })
        .mockResolvedValueOnce({ id: 10, quantity: 2 });
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await addToCart("t1", 1, 1, 3);
      expect(res.success).toBe(true);
      expect(res.message).toBe("已加入购物车");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        [3, 10],
        "t1"
      );
    });

    it("购物车无此商品应新增", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 1, sku_name: "商品1" })
        .mockResolvedValueOnce(null);
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await addToCart("t1", 1, 1, 2);
      expect(res.success).toBe(true);
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("INSERT"),
        [1, 1, 2],
        "t1"
      );
    });
  });

  describe("updateCartItemQuantity", () => {
    it("数量为0应删除商品", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await updateCartItemQuantity("t1", 1, 1, 0);
      expect(res.success).toBe(true);
      expect(res.message).toBe("已更新");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        [1, 1],
        "t1"
      );
    });

    it("数量大于0应更新数量", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 } as any);
      const res = await updateCartItemQuantity("t1", 1, 1, 5);
      expect(res.success).toBe(true);
      expect(res.message).toBe("已更新");
    });

    it("商品不存在应返回失败", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 } as any);
      const res = await updateCartItemQuantity("t1", 1, 999, 5);
      expect(res.success).toBe(false);
      expect(res.message).toBe("购物车中无此商品");
    });
  });

  describe("deleteCartItem", () => {
    it("应删除指定商品", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await deleteCartItem("t1", 1, 1);
      expect(res.message).toBe("已删除");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        [1, 1],
        "t1"
      );
    });
  });

  describe("clearCart", () => {
    it("应清空购物车", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 5 });
      const res = await clearCart("t1", 1);
      expect(res.message).toBe("购物车已清空");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        [1],
        "t1"
      );
    });
  });

  describe("getCartCount", () => {
    it("应返回购物车商品总数", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
      const res = await getCartCount("t1", 1);
      expect(res.count).toBe(5);
    });

    it("空购物车应返回0", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      const res = await getCartCount("t1", 1);
      expect(res.count).toBe(0);
    });

    it("返回 null 时应返回0", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await getCartCount("t1", 1);
      expect(res.count).toBe(0);
    });
  });
});
