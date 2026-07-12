/**
 * 管理端购物车 controller 单元测试
 * 被测文件：src/controllers/admin/cart.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  getSettlementType: vi.fn(() => "CASH"),
  getCartList: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  deleteCartItem: vi.fn(),
  clearCart: vi.fn(),
  getCartCount: vi.fn(),
  checkoutPreview: vi.fn(),
  createCheckoutOrder: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../shared/fulfillment", () => ({
  getSettlementType: mocks.getSettlementType,
}));

vi.mock("../../../services/admin/cart.service", () => ({
  getCartList: mocks.getCartList,
  addToCart: mocks.addToCart,
  updateCartItemQuantity: mocks.updateCartItemQuantity,
  deleteCartItem: mocks.deleteCartItem,
  clearCart: mocks.clearCart,
  getCartCount: mocks.getCartCount,
  checkoutPreview: mocks.checkoutPreview,
  createCheckoutOrder: mocks.createCheckoutOrder,
}));

import {
  getCartList,
  addToCart,
  updateCartItemQuantity,
  deleteCartItem,
  getCartCount,
  checkoutPreview,
  createCheckoutOrder,
} from "../../../controllers/admin/cart.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettlementType.mockReturnValue("CASH");
});

describe("admin cart.controller", () => {
  it("getCartList 使用 x-customer-type 头并调用 service", async () => {
    mocks.getCartList.mockResolvedValue({ items: [] });
    const req = mockReq({ headers: { "x-customer-type": "WHOLESALE" } });
    const res = mockRes();
    await getCartList(req, res);
    expect(mocks.getCartList).toHaveBeenCalledWith("t1", 1, "WHOLESALE");
    expect(res.json).toHaveBeenCalled();
  });

  it("getCartList 缺少 x-customer-type 头时默认 RETAIL", async () => {
    mocks.getCartList.mockResolvedValue({ items: [] });
    const req = mockReq();
    const res = mockRes();
    await getCartList(req, res);
    expect(mocks.getCartList).toHaveBeenCalledWith("t1", 1, "RETAIL");
  });

  it("addToCart 成功添加商品", async () => {
    mocks.addToCart.mockResolvedValue({ success: true, message: "已加入购物车" });
    const req = mockReq({ body: { skuId: 10, quantity: 2 } });
    const res = mockRes();
    await addToCart(req, res);
    expect(mocks.addToCart).toHaveBeenCalledWith("t1", 1, 10, 2);
    expect(res.json).toHaveBeenCalled();
  });

  it("addToCart service 返回失败时回 400", async () => {
    mocks.addToCart.mockResolvedValue({ success: false, message: "库存不足" });
    const req = mockReq({ body: { skuId: 10, quantity: 2 } });
    const res = mockRes();
    await addToCart(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("库存不足");
  });

  it("updateCartItemQuantity 成功更新数量", async () => {
    mocks.updateCartItemQuantity.mockResolvedValue({ success: true, message: "更新成功" });
    const req = mockReq({ params: { skuId: "10" }, body: { quantity: 5 } });
    const res = mockRes();
    await updateCartItemQuantity(req, res);
    expect(mocks.updateCartItemQuantity).toHaveBeenCalledWith("t1", 1, 10, 5);
    expect(res.json).toHaveBeenCalled();
  });

  it("updateCartItemQuantity service 返回失败时回 404", async () => {
    mocks.updateCartItemQuantity.mockResolvedValue({ success: false, message: "商品不存在" });
    const req = mockReq({ params: { skuId: "10" }, body: { quantity: 0 } });
    const res = mockRes();
    await updateCartItemQuantity(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.fail).toHaveBeenCalledWith("商品不存在");
  });

  it("deleteCartItem 传递 skuId 调用 service", async () => {
    mocks.deleteCartItem.mockResolvedValue({ success: true });
    const req = mockReq({ params: { skuId: "8" } });
    const res = mockRes();
    await deleteCartItem(req, res);
    expect(mocks.deleteCartItem).toHaveBeenCalledWith("t1", 1, 8);
  });

  it("getCartCount 返回购物车数量", async () => {
    mocks.getCartCount.mockResolvedValue({ count: 5 });
    const req = mockReq();
    const res = mockRes();
    await getCartCount(req, res);
    expect(mocks.getCartCount).toHaveBeenCalledWith("t1", 1);
  });

  it("checkoutPreview 成功时返回 data", async () => {
    mocks.checkoutPreview.mockResolvedValue({ success: true, data: { total: 100 } });
    const req = mockReq({ body: { storeId: 1 } });
    const res = mockRes();
    await checkoutPreview(req, res);
    expect(mocks.ok).toHaveBeenCalledWith({ total: 100 });
  });

  it("checkoutPreview 失败时回 400", async () => {
    mocks.checkoutPreview.mockResolvedValue({ success: false, message: "商品已下架" });
    const req = mockReq({ body: { storeId: 1 } });
    const res = mockRes();
    await checkoutPreview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("商品已下架");
  });

  it("createCheckoutOrder 调用 getSettlementType 并创建订单", async () => {
    mocks.getSettlementType.mockReturnValue("ACCOUNT");
    mocks.createCheckoutOrder.mockResolvedValue({ orderNo: "O001" });
    const req = mockReq({
      headers: { "x-customer-type": "WHOLESALE", "x-settlement-type": "ACCOUNT" },
      body: { storeId: 1, fulfillmentType: "DELIVERY" },
    });
    const res = mockRes();
    await createCheckoutOrder(req, res);
    expect(mocks.getSettlementType).toHaveBeenCalledWith("WHOLESALE", "ACCOUNT");
    expect(mocks.createCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t1",
      customerId: 1,
      customerType: "WHOLESALE",
      settlementType: "ACCOUNT",
    }));
    expect(res.json).toHaveBeenCalled();
  });
});
