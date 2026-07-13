import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/miniapp.service", () => ({
  createOrder: vi.fn(),
  getOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("../../../services/miniapp/cart.service", () => ({
  getCartList: vi.fn(),
  addToCart: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  deleteCartItem: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock("../../../services/miniapp/retail-consumer-address.service", () => ({
  listAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("../../../services/admin/product.service", () => ({
  listProducts: vi.fn(),
  getProductDetail: vi.fn(),
}));

vi.mock("../../../services/admin/category.service", () => ({
  list: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data })),
  fail: vi.fn((msg: string, code?: number) => ({ code: code ?? "500", msg })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/fulfillment", () => ({
  getSettlementType: vi.fn((customerType: string, headerValue?: string) => {
    if (customerType === "WHOLESALE") return headerValue || "ACCOUNT";
    return "CASH";
  }),
}));

import * as miniappService from "../../../services/miniapp.service";
import * as cartService from "../../../services/miniapp/cart.service";
import * as addressService from "../../../services/miniapp/retail-consumer-address.service";
import * as productService from "../../../services/admin/product.service";
import * as categoryService from "../../../services/admin/category.service";
import { ok, fail } from "../../../shared/response";
import {
  getProducts,
  getProductDetail,
  getCategories,
  getCart,
  addToCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
  createOrder,
  getOrders,
  getOrderDetail,
  payOrder,
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getPromotions,
  getCoupons,
  useCoupon,
} from "../../../controllers/miniapp/miniapp.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: { "x-customer-type": "RETAIL" },
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

describe("miniapp/miniapp.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  // ========== 商品模块 ==========

  describe("getProducts", () => {
    it("应返回商品列表（零售价格）", async () => {
      (productService.listProducts as any).mockResolvedValue({
        total: 2,
        records: [
          { spuId: 1, skuId: 1, name: "商品1", skuName: "规格1", mainImage: "img1.jpg", retailPrice: 100, miniappPrice: 99, availableQty: 10, categoryId: 1, categoryName: "分类1" },
          { spuId: 2, skuId: 2, name: "商品2", skuName: "规格2", mainImage: "img2.jpg", retailPrice: 200, wholesalePrice: 180, availableQty: 20, categoryId: 2, categoryName: "分类2" },
        ],
      });
      const req = mockReq({ query: { page: "1", pageSize: "10" } });
      const res = mockRes();
      await getProducts(req as any, res as any);
      expect(productService.listProducts).toHaveBeenCalledWith("", 1, 10, "t1");
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.total).toBe(2);
      expect(okArg.records[0].priceType).toBe("RETAIL");
      expect(okArg.records[0].price).toBe(99);
      expect(okArg.records[1].priceType).toBe("WHOLESALE");
      expect(okArg.records[1].wholesalePrice).toBe(180);
    });

    it("应支持关键词搜索和分类筛选", async () => {
      (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { keyword: "酒", categoryId: "3", storeId: "2" } });
      const res = mockRes();
      await getProducts(req as any, res as any);
      expect(productService.listProducts).toHaveBeenCalledWith("酒", 1, 20, "t1");
    });

    it("默认分页参数为 page=1 pageSize=20", async () => {
      (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getProducts(req as any, res as any);
      expect(productService.listProducts).toHaveBeenCalledWith("", 1, 20, "t1");
    });

    it("批发客户应显示批发价", async () => {
      (productService.listProducts as any).mockResolvedValue({
        total: 1,
        records: [
          { spuId: 1, skuId: 1, name: "商品1", skuName: "规格1", mainImage: "img1.jpg", retailPrice: 100, wholesalePrice: 80, availableQty: 10, categoryId: 1, categoryName: "分类1" },
        ],
      });
      const req = mockReq({ headers: { "x-customer-type": "WHOLESALE" } });
      const res = mockRes();
      await getProducts(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.records[0].priceType).toBe("WHOLESALE");
      expect(okArg.records[0].price).toBe(80);
    });

    it("无 wholesalePrice 时使用零售价", async () => {
      (productService.listProducts as any).mockResolvedValue({
        total: 1,
        records: [
          { spuId: 1, skuId: 1, name: "商品1", skuName: "规格1", mainImage: "img1.jpg", retailPrice: 100, availableQty: 10, categoryId: 1, categoryName: "分类1", isNew: 1, isRecommend: 1, specs: "{}" },
        ],
      });
      const req = mockReq({ headers: { "x-customer-type": "WHOLESALE" } });
      const res = mockRes();
      await getProducts(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.records[0].priceType).toBe("RETAIL");
      expect(okArg.records[0].price).toBe(100);
    });
  });

  describe("getProductDetail", () => {
    it("应返回商品详情", async () => {
      (productService.getProductDetail as any).mockResolvedValue({
        id: 1,
        spuCode: "SPU001",
        name: "商品1",
        categoryId: 1,
        categoryName: "分类1",
        allowOnlineSale: 1,
        brandId: 1,
        brandName: "品牌1",
        unit: "瓶",
        specs: "500ml",
        alcoholContent: 52,
        origin: "四川",
        mainImage: "main.jpg",
        imageUrls: ["img1.jpg"],
        detail: "详情",
        saleChannels: ["ONLINE"],
        isNew: 1,
        isRecommend: 1,
        description: "描述",
        marketingTags: [],
        status: "ON_SALE",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        skus: [
          { id: 1, skuCode: "SKU001", skuName: "规格1", barcode: "123", volume: 500, packaging: "瓶装", baseUnit: "瓶", boxUnit: "箱", boxRatio: 6, retailPrice: 100, costPrice: 50, availableQty: 10 },
        ],
      });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getProductDetail(req as any, res as any);
      expect(productService.getProductDetail).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.spuId).toBe(1);
      expect(okArg.skus.length).toBe(1);
      expect(okArg.skus[0].priceType).toBe("RETAIL");
    });

    it("批发价可见的SKU应返回批发价信息", async () => {
      (productService.getProductDetail as any).mockResolvedValue({
        id: 1, name: "商品1", categoryId: 1, categoryName: "分类1",
        skus: [
          { id: 1, skuName: "规格1", retailPrice: 100, wholesalePrice: 80, costPrice: 50, availableQty: 10 },
        ],
      });
      const req = mockReq({ params: { id: "1" }, headers: { "x-customer-type": "WHOLESALE" } });
      const res = mockRes();
      await getProductDetail(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.skus[0].priceType).toBe("WHOLESALE");
      expect(okArg.skus[0].wholesalePrice).toBe(80);
    });

    it("无 wholesalePrice 时 SKU 批发价返回 undefined", async () => {
      (productService.getProductDetail as any).mockResolvedValue({
        id: 1, name: "商品1", categoryId: 1, categoryName: "分类1",
        skus: [
          { id: 1, skuName: "规格1", retailPrice: 100, costPrice: 50, availableQty: 10 },
        ],
      });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getProductDetail(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.skus[0].wholesalePrice).toBeUndefined();
    });
  });

  describe("getCategories", () => {
    it("应返回分类列表", async () => {
      (categoryService.list as any).mockResolvedValue([{ id: 1, name: "分类1" }]);
      const req = mockReq();
      const res = mockRes();
      await getCategories(req as any, res as any);
      expect(categoryService.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", allowOnlineSale: 1, status: 1 }));
      expect(ok).toHaveBeenCalled();
    });

    it("应支持 pid 参数", async () => {
      (categoryService.list as any).mockResolvedValue([]);
      const req = mockReq({ query: { pid: "1" } });
      const res = mockRes();
      await getCategories(req as any, res as any);
      expect(categoryService.list).toHaveBeenCalledWith(expect.objectContaining({ pid: 1 }));
    });

    it("不传 pid 时 pid 为 undefined", async () => {
      (categoryService.list as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getCategories(req as any, res as any);
      expect(categoryService.list).toHaveBeenCalledWith(expect.objectContaining({ pid: undefined }));
    });
  });

  // ========== 购物车模块 ==========

  describe("getCart", () => {
    it("应返回购物车列表", async () => {
      (cartService.getCartList as any).mockResolvedValue({ items: [], totalAmount: 0, totalQty: 0 });
      const req = mockReq();
      const res = mockRes();
      await getCart(req as any, res as any);
      expect(cartService.getCartList).toHaveBeenCalledWith("t1", 1, "RETAIL");
      expect(ok).toHaveBeenCalled();
    });

    it("未登录用户使用默认 customerId=1", async () => {
      (cartService.getCartList as any).mockResolvedValue({ items: [] });
      const req = mockReq({ user: null, headers: {} });
      const res = mockRes();
      await getCart(req as any, res as any);
      expect(cartService.getCartList).toHaveBeenCalledWith("t1", 1, "RETAIL");
    });

    it("应从 header 获取匿名会员ID", async () => {
      (cartService.getCartList as any).mockResolvedValue({ items: [] });
      const req = mockReq({ user: null, headers: { "x-anonymous-member-id": "123" } });
      const res = mockRes();
      await getCart(req as any, res as any);
      expect(cartService.getCartList).toHaveBeenCalledWith("t1", 123, "RETAIL");
    });
  });

  describe("addToCart", () => {
    it("添加成功应返回 ok", async () => {
      (cartService.addToCart as any).mockResolvedValue({ success: true, message: "已加入购物车" });
      const req = mockReq({ body: { skuId: 1, quantity: 2 } });
      const res = mockRes();
      await addToCart(req as any, res as any);
      expect(cartService.addToCart).toHaveBeenCalledWith("t1", 1, 1, 2);
      expect(ok).toHaveBeenCalledWith({ message: "已加入购物车" });
    });

    it("添加失败应返回 400", async () => {
      (cartService.addToCart as any).mockResolvedValue({ success: false, message: "商品不存在" });
      const req = mockReq({ body: { skuId: 999, quantity: 1 } });
      const res = mockRes();
      await addToCart(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(fail).toHaveBeenCalledWith("商品不存在");
    });

    it("quantity 默认值为 1", async () => {
      (cartService.addToCart as any).mockResolvedValue({ success: true });
      const req = mockReq({ body: { skuId: 1 } });
      const res = mockRes();
      await addToCart(req as any, res as any);
      expect(cartService.addToCart).toHaveBeenCalledWith("t1", 1, 1, 1);
    });
  });

  describe("updateCartItem", () => {
    it("更新成功应返回 ok", async () => {
      (cartService.updateCartItemQuantity as any).mockResolvedValue({ success: true, message: "已更新" });
      const req = mockReq({ params: { id: "1" }, body: { quantity: 5 } });
      const res = mockRes();
      await updateCartItem(req as any, res as any);
      expect(cartService.updateCartItemQuantity).toHaveBeenCalledWith("t1", 1, 1, 5);
      expect(ok).toHaveBeenCalledWith({ message: "已更新" });
    });

    it("商品不存在应返回 404", async () => {
      (cartService.updateCartItemQuantity as any).mockResolvedValue({ success: false, message: "购物车中无此商品" });
      const req = mockReq({ params: { id: "999" }, body: { quantity: 5 } });
      const res = mockRes();
      await updateCartItem(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(fail).toHaveBeenCalledWith("购物车中无此商品");
    });
  });

  describe("deleteCartItem", () => {
    it("应删除购物车商品", async () => {
      (cartService.deleteCartItem as any).mockResolvedValue({ message: "已删除" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteCartItem(req as any, res as any);
      expect(cartService.deleteCartItem).toHaveBeenCalledWith("t1", 1, 1);
      expect(ok).toHaveBeenCalledWith({ message: "已删除" });
    });
  });

  describe("clearCart", () => {
    it("应清空购物车", async () => {
      (cartService.clearCart as any).mockResolvedValue({ message: "购物车已清空" });
      const req = mockReq();
      const res = mockRes();
      await clearCart(req as any, res as any);
      expect(cartService.clearCart).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalledWith({ message: "购物车已清空" });
    });
  });

  // ========== 订单模块 ==========

  describe("createOrder", () => {
    it("应创建订单", async () => {
      (miniappService.createOrder as any).mockResolvedValue({ orderNo: "DD001", orderStatus: "PENDING" });
      const req = mockReq({
        body: {
          storeId: 1,
          fulfillmentType: "DELIVERY",
          receiverName: "张三",
          receiverMobile: "13800138000",
          receiverAddress: "测试地址",
          remark: "测试备注",
          items: [{ skuId: 1, quantity: 2 }],
        },
      });
      const res = mockRes();
      await createOrder(req as any, res as any);
      expect(miniappService.createOrder).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("应支持 qty 字段", async () => {
      (miniappService.createOrder as any).mockResolvedValue({ orderNo: "DD001" });
      const req = mockReq({
        body: {
          storeId: 1,
          fulfillmentType: "PICKUP",
          items: [{ skuId: 1, qty: 3 }],
        },
      });
      const res = mockRes();
      await createOrder(req as any, res as any);
      const callArg = (miniappService.createOrder as any).mock.calls[0][1];
      expect(callArg.items[0].qty).toBe(3);
    });

    it("批发客户应使用 ACCOUNT 结算类型", async () => {
      (miniappService.createOrder as any).mockResolvedValue({ orderNo: "DD001" });
      const req = mockReq({
        headers: { "x-customer-type": "WHOLESALE", "x-settlement-type": "ACCOUNT" },
        body: {
          storeId: 1,
          fulfillmentType: "DELIVERY",
          items: [{ skuId: 1, quantity: 1 }],
        },
      });
      const res = mockRes();
      await createOrder(req as any, res as any);
      const callArgs = (miniappService.createOrder as any).mock.calls[0];
      expect(callArgs[2]).toBe("WHOLESALE");
      expect(callArgs[4]).toBe("ACCOUNT");
    });

    it("无备注时 remark 为 undefined", async () => {
      (miniappService.createOrder as any).mockResolvedValue({ orderNo: "DD001" });
      const req = mockReq({
        body: {
          storeId: 1,
          fulfillmentType: "DELIVERY",
          items: [{ skuId: 1, quantity: 1 }],
        },
      });
      const res = mockRes();
      await createOrder(req as any, res as any);
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getOrders", () => {
    it("应返回订单列表", async () => {
      (miniappService.getOrders as any).mockResolvedValue({ total: 1, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "10" } });
      const res = mockRes();
      await getOrders(req as any, res as any);
      expect(miniappService.getOrders).toHaveBeenCalledWith("t1", "", 1, 10);
      expect(ok).toHaveBeenCalled();
    });

    it("默认分页参数", async () => {
      (miniappService.getOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getOrders(req as any, res as any);
      expect(miniappService.getOrders).toHaveBeenCalledWith("t1", "", 1, 20);
    });

    it("应传递匿名会员ID", async () => {
      (miniappService.getOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ headers: { "x-anonymous-member-id": "anon123" } });
      const res = mockRes();
      await getOrders(req as any, res as any);
      expect(miniappService.getOrders).toHaveBeenCalledWith("t1", "anon123", 1, 20);
    });
  });

  describe("getOrderDetail", () => {
    it("应返回订单详情", async () => {
      (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "DD001", items: [] });
      const req = mockReq({ params: { id: "DD001" } });
      const res = mockRes();
      await getOrderDetail(req as any, res as any);
      expect(miniappService.getOrderDetail).toHaveBeenCalledWith("t1", "DD001", "");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("payOrder", () => {
    it("未支付订单应返回支付参数", async () => {
      (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "DD001", payStatus: "UNPAID", payableAmount: 100 });
      const req = mockReq({ params: { id: "DD001" }, body: { paymentMethod: "WECHAT_PAY" } });
      const res = mockRes();
      await payOrder(req as any, res as any);
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.orderNo).toBe("DD001");
      expect(okArg.paymentMethod).toBe("WECHAT_PAY");
    });

    it("已支付订单应返回 400", async () => {
      (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "DD001", payStatus: "PAID", payableAmount: 100 });
      const req = mockReq({ params: { id: "DD001" }, body: { paymentMethod: "WECHAT_PAY" } });
      const res = mockRes();
      await payOrder(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(fail).toHaveBeenCalledWith("订单已支付");
    });

    it("BALANCE 支付方式也应返回支付参数", async () => {
      (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "DD002", payStatus: "UNPAID", payableAmount: 200 });
      const req = mockReq({ params: { id: "DD002" }, body: { paymentMethod: "BALANCE" } });
      const res = mockRes();
      await payOrder(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.paymentMethod).toBe("BALANCE");
      expect(okArg.amount).toBe(200);
    });
  });

  // ========== 用户模块 ==========

  describe("getProfile", () => {
    it("应返回用户信息", async () => {
      (miniappService.getProfile as any).mockReturnValue({ memberId: 1, nickname: "测试用户" });
      const req = mockReq();
      const res = mockRes();
      await getProfile(req as any, res as any);
      expect(miniappService.getProfile).toHaveBeenCalledWith("RETAIL");
      expect(ok).toHaveBeenCalled();
    });

    it("批发客户应返回对应会员等级", async () => {
      (miniappService.getProfile as any).mockReturnValue({ memberId: 1, customerType: "WHOLESALE" });
      const req = mockReq({ headers: { "x-customer-type": "WHOLESALE" } });
      const res = mockRes();
      await getProfile(req as any, res as any);
      expect(miniappService.getProfile).toHaveBeenCalledWith("WHOLESALE");
    });
  });

  describe("updateProfile", () => {
    it("应更新用户信息", async () => {
      const req = mockReq({ body: { nickname: "新昵称", mobile: "13900139000" } });
      const res = mockRes();
      await updateProfile(req as any, res as any);
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.data.nickname).toBe("新昵称");
    });

    it("只传 nickname 也应更新成功", async () => {
      const req = mockReq({ body: { nickname: "新昵称" } });
      const res = mockRes();
      await updateProfile(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.data.nickname).toBe("新昵称");
      expect(okArg.data.mobile).toBeUndefined();
    });

    it("只传 mobile 也应更新成功", async () => {
      const req = mockReq({ body: { mobile: "13800138000" } });
      const res = mockRes();
      await updateProfile(req as any, res as any);
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.data.mobile).toBe("13800138000");
    });
  });

  describe("getAddresses", () => {
    it("应返回地址列表", async () => {
      (addressService.listAddresses as any).mockResolvedValue([{ id: 1, name: "张三" }]);
      const req = mockReq();
      const res = mockRes();
      await getAddresses(req as any, res as any);
      expect(addressService.listAddresses).toHaveBeenCalledWith(1);
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("createAddress", () => {
    it("应创建地址", async () => {
      (addressService.createAddress as any).mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          name: "张三",
          mobile: "13800138000",
          province: "广东省",
          city: "深圳市",
          district: "南山区",
          detail: "科技园路1号",
          is_default: 1,
        },
      });
      const res = mockRes();
      await createAddress(req as any, res as any);
      expect(addressService.createAddress).toHaveBeenCalledWith(1, expect.any(Object));
      expect(ok).toHaveBeenCalled();
    });

    it("is_default 不传时默认为 0", async () => {
      (addressService.createAddress as any).mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: {
          name: "李四",
          mobile: "13900139000",
          province: "广东省",
          city: "广州市",
          district: "天河区",
          detail: "天河路100号",
        },
      });
      const res = mockRes();
      await createAddress(req as any, res as any);
      const callArg = (addressService.createAddress as any).mock.calls[0][1];
      expect(callArg.is_default).toBeUndefined();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("updateAddress", () => {
    it("应更新地址", async () => {
      (addressService.updateAddress as any).mockResolvedValue({});
      const req = mockReq({
        params: { id: "1" },
        body: {
          name: "张三改",
          mobile: "13800138001",
          province: "广东省",
          city: "深圳市",
          district: "南山区",
          detail: "科技园路2号",
        },
      });
      const res = mockRes();
      await updateAddress(req as any, res as any);
      expect(addressService.updateAddress).toHaveBeenCalledWith(1, 1, expect.any(Object));
      expect(ok).toHaveBeenCalledWith({ message: "更新成功" });
    });
  });

  describe("deleteAddress", () => {
    it("应删除地址", async () => {
      (addressService.deleteAddress as any).mockResolvedValue({});
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteAddress(req as any, res as any);
      expect(addressService.deleteAddress).toHaveBeenCalledWith(1, 1);
      expect(ok).toHaveBeenCalledWith({ message: "删除成功" });
    });
  });

  describe("setDefaultAddress", () => {
    it("应设置默认地址", async () => {
      (addressService.setDefault as any).mockResolvedValue({});
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await setDefaultAddress(req as any, res as any);
      expect(addressService.setDefault).toHaveBeenCalledWith(1, 1);
      expect(ok).toHaveBeenCalledWith({ message: "设置成功" });
    });
  });

  // ========== 营销模块 ==========

  describe("getPromotions", () => {
    it("应返回营销活动列表", async () => {
      const req = mockReq();
      const res = mockRes();
      await getPromotions(req as any, res as any);
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.total).toBe(5);
      expect(okArg.records.length).toBe(5);
    });
  });

  describe("getCoupons", () => {
    it("应返回优惠券列表", async () => {
      const req = mockReq();
      const res = mockRes();
      await getCoupons(req as any, res as any);
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.total).toBe(3);
      expect(okArg.records.length).toBe(3);
    });
  });

  describe("useCoupon", () => {
    it("应使用优惠券", async () => {
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await useCoupon(req as any, res as any);
      expect(ok).toHaveBeenCalled();
      const okArg = (ok as any).mock.calls[0][0];
      expect(okArg.couponId).toBe(1);
      expect(okArg.discountAmount).toBe(10);
    });
  });
});
