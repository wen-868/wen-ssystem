import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/miniapp/cart.service", () => ({
  getCartList: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  deleteCartItem: vi.fn(),
  clearCart: vi.fn(),
  getCartCount: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as cartService from "../../../services/miniapp/cart.service";
import { ok, fail } from "../../../shared/response";
import { getCartList, addToCart, updateCartItemQuantity, deleteCartItem, clearCart, getCartCount } from "../../../controllers/miniapp/cart.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: {},
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("miniapp/cart.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCartList - 应返回购物车列表", async () => {
    (cartService.getCartList as any).mockResolvedValue({ items: [], total: 0 });
    const req = mockReq({ headers: { "x-customer-type": "RETAIL" } });
    const res = mockRes();
    await getCartList(req as any, res as any);
    expect(cartService.getCartList).toHaveBeenCalledWith("t1", 1, "RETAIL");
    expect(ok).toHaveBeenCalled();
  });

  it("getCartList - 默认 customerType 为 RETAIL", async () => {
    (cartService.getCartList as any).mockResolvedValue({ items: [] });
    const req = mockReq({ headers: {} });
    const res = mockRes();
    await getCartList(req as any, res as any);
    expect(cartService.getCartList).toHaveBeenCalledWith("t1", 1, "RETAIL");
    expect(ok).toHaveBeenCalled();
  });

  it("addToCart - 添加成功应返回 ok", async () => {
    (cartService.addToCart as any).mockResolvedValue({ success: true, message: "添加成功" });
    const req = mockReq({ body: { skuId: 1, quantity: 2 } });
    const res = mockRes();
    await addToCart(req as any, res as any);
    expect(cartService.addToCart).toHaveBeenCalledWith("t1", 1, 1, 2);
    expect(ok).toHaveBeenCalledWith({ message: "添加成功" });
  });

  it("addToCart - 添加失败应返回400", async () => {
    (cartService.addToCart as any).mockResolvedValue({ success: false, message: "库存不足" });
    const req = mockReq({ body: { skuId: 1, quantity: 100 } });
    const res = mockRes();
    await addToCart(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("库存不足");
  });

  it("addToCart - quantity 默认值为 1", async () => {
    (cartService.addToCart as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { skuId: 1 } });
    const res = mockRes();
    await addToCart(req as any, res as any);
    expect(cartService.addToCart).toHaveBeenCalledWith("t1", 1, 1, 1);
    expect(ok).toHaveBeenCalled();
  });

  it("updateCartItemQuantity - 更新成功应返回 ok", async () => {
    (cartService.updateCartItemQuantity as any).mockResolvedValue({ success: true, message: "更新成功" });
    const req = mockReq({ params: { skuId: "1" }, body: { quantity: 5 } });
    const res = mockRes();
    await updateCartItemQuantity(req as any, res as any);
    expect(cartService.updateCartItemQuantity).toHaveBeenCalledWith("t1", 1, 1, 5);
    expect(ok).toHaveBeenCalledWith({ message: "更新成功" });
  });

  it("updateCartItemQuantity - 商品不存在应返回404", async () => {
    (cartService.updateCartItemQuantity as any).mockResolvedValue({ success: false, message: "商品不在购物车中" });
    const req = mockReq({ params: { skuId: "999" }, body: { quantity: 5 } });
    const res = mockRes();
    await updateCartItemQuantity(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("商品不在购物车中");
  });

  it("deleteCartItem - 应删除购物车商品", async () => {
    (cartService.deleteCartItem as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { skuId: "1" } });
    const res = mockRes();
    await deleteCartItem(req as any, res as any);
    expect(cartService.deleteCartItem).toHaveBeenCalledWith("t1", 1, 1);
    expect(ok).toHaveBeenCalled();
  });

  it("clearCart - 应清空购物车", async () => {
    (cartService.clearCart as any).mockResolvedValue({ success: true });
    const req = mockReq();
    const res = mockRes();
    await clearCart(req as any, res as any);
    expect(cartService.clearCart).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("getCartCount - 应返回购物车数量", async () => {
    (cartService.getCartCount as any).mockResolvedValue(5);
    const req = mockReq();
    const res = mockRes();
    await getCartCount(req as any, res as any);
    expect(cartService.getCartCount).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalledWith(5);
  });
});
