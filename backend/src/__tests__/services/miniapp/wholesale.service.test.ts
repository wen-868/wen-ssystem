import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWholesaleProducts,
  getWholesaleProductDetail,
  getWholesaleCategories,
  getWholesaleCart,
  addWholesaleCartItem,
  updateWholesaleCartItem,
  deleteWholesaleCartItem,
  createWholesaleOrder,
  getWholesaleOrders,
  getWholesaleOrderDetail,
} from "../../../services/miniapp/wholesale.service";

vi.mock("../../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "PF1234567890"),
}));

import {
  queryWithTenant,
  queryOneWithTenant,
  transaction,
  connExecute,
} from "../../../shared/db";

const mocks = {
  queryWithTenant: queryWithTenant as any,
  queryOneWithTenant: queryOneWithTenant as any,
  transaction: transaction as any,
  connExecute: connExecute as any,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connExecute.mockImplementation(async (conn: any, sql: string, params: unknown[]) => conn.execute(sql, params));
});

describe("miniapp/wholesale.service", () => {
  const mockProductRow = {
    spuId: 1,
    spuCode: "SPU001",
    name: "飞天茅台53度500ml",
    mainImage: "moutai.jpg",
    categoryId: 1,
    unit: "瓶",
    specs: "500ml",
    isNew: 1,
    skuId: 1,
    skuName: "飞天茅台53度500ml",
    skuCode: "SKU001",
    wholesalePrice: 1200,
    retailPrice: 1499,
    minOrderQty: 6,
    stockQty: 100,
    stepPrice: null,
    stepMinQty: null,
  };

  describe("getWholesaleProducts", () => {
    it("应返回批发商品列表（按SPU分组）", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([mockProductRow]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });

      const res = await getWholesaleProducts("t1", { page: 1, pageSize: 20 });
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
      expect(res.records[0].spuId).toBe(1);
      expect(res.records[0].name).toBe("飞天茅台53度500ml");
      expect(res.records[0].minPrice).toBe(1200);
      expect(res.records[0].skus.length).toBe(1);
      expect(res.records[0].skus[0].skuId).toBe(1);
      expect(res.records[0].skus[0].wholesalePrice).toBe(1200);
    });

    it("支持按关键词搜索", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getWholesaleProducts("t1", { keyword: "茅台" });
      const sql = mocks.queryWithTenant.mock.calls[0][0];
      expect(sql).toContain("LIKE");
    });

    it("支持按分类过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getWholesaleProducts("t1", { categoryId: 1 });
      const sql = mocks.queryWithTenant.mock.calls[0][0];
      expect(sql).toContain("category_id = ?");
    });

    it("支持按价格排序", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getWholesaleProducts("t1", { sortBy: "price", sortOrder: "asc" });
      const sql = mocks.queryWithTenant.mock.calls[0][0];
      expect(sql).toContain("wholesale_price ASC");
    });
  });

  describe("getWholesaleProductDetail", () => {
    const mockSpu = {
      id: 1,
      spuCode: "SPU001",
      name: "飞天茅台53度500ml",
      mainImage: "moutai.jpg",
      categoryId: 1,
      categoryName: "白酒",
      unit: "瓶",
      specs: "500ml",
      alcoholContent: "53%vol",
      origin: "贵州茅台镇",
      imageUrls: '["img1.jpg","img2.jpg"]',
      detail: "详情描述",
      description: "简介",
      isNew: 1,
      isRecommend: 1,
      brandId: 1,
      brandName: "茅台",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };

    const mockSku = {
      skuId: 1,
      skuName: "飞天茅台53度500ml",
      skuCode: "SKU001",
      barcode: "6901234567890",
      volume: 500,
      packaging: "瓶装",
      baseUnit: "瓶",
      boxUnit: "箱",
      boxRatio: 12,
      wholesalePrice: 1200,
      retailPrice: 1499,
      miniappPrice: null,
      minOrderQty: 6,
      availableQty: 100,
    };

    it("应返回批发商品详情含SKU列表", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(mockSpu);
      mocks.queryWithTenant
        .mockResolvedValueOnce([mockSku])  // SKU列表
        .mockResolvedValueOnce([]);       // 阶梯价

      const res = await getWholesaleProductDetail(1, "t1");
      expect(res.spuId).toBe(1);
      expect(res.name).toBe("飞天茅台53度500ml");
      expect(res.minWholesalePrice).toBe(1200);
      expect(res.skus.length).toBe(1);
      expect(res.skus[0].skuId).toBe(1);
      expect(res.skus[0].wholesalePrice).toBe(1200);
      expect(res.skus[0].stepPrices).toEqual([]);
    });

    it("商品不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(getWholesaleProductDetail(999, "t1")).rejects.toThrow("商品不存在");
    });
  });

  describe("getWholesaleCategories", () => {
    const mockCategory = {
      id: 1,
      name: "白酒",
      parentId: 0,
      sortNo: 1,
      icon: "icon.png",
      level: 1,
    };

    it("应返回批发分类列表", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([mockCategory]);
      const res = await getWholesaleCategories("t1");
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(1);
      expect(res[0].name).toBe("白酒");
    });
  });

  describe("getWholesaleCart", () => {
    const mockCartItem = {
      id: 1,
      skuId: 1,
      quantity: 12,
      skuName: "飞天茅台53度500ml",
      skuCode: "SKU001",
      spuId: 1,
      spuName: "飞天茅台53度500ml",
      mainImage: "moutai.jpg",
      wholesalePrice: 1200,
      minOrderQty: 6,
      availableQty: 100,
      categoryId: 1,
      categoryName: "白酒",
    };

    it("应返回批发购物车列表含金额统计", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([mockCartItem]);
      const res = await getWholesaleCart(1, "t1");
      expect(res.items.length).toBe(1);
      expect(res.totalCount).toBe(12);
      expect(res.totalAmount).toBe(14400);
      expect(res.items[0].subtotal).toBe(14400);
    });

    it("空购物车应返回空列表和0金额", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      const res = await getWholesaleCart(1, "t1");
      expect(res.items.length).toBe(0);
      expect(res.totalCount).toBe(0);
      expect(res.totalAmount).toBe(0);
    });

    it("多商品应正确计算小计和总计", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        mockCartItem,
        { ...mockCartItem, id: 2, skuId: 2, skuName: "五粮液", quantity: 6, wholesalePrice: 800 },
      ]);
      const res = await getWholesaleCart(1, "t1");
      expect(res.items.length).toBe(2);
      expect(res.totalCount).toBe(18);
      expect(res.totalAmount).toBe(14400 + 4800);
    });
  });

  describe("addWholesaleCartItem", () => {
    const mockSku = {
      id: 1,
      skuName: "飞天茅台53度500ml",
      wholesalePrice: 1200,
      minOrderQty: 6,
    };

    it("新增购物车商品应返回ID和数量", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce(mockSku)    // 查询SKU
        .mockResolvedValueOnce(null);       // 检查是否已存在
      mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });

      const res = await addWholesaleCartItem(1, "t1", 1, 12);
      expect(res.id).toBe(1);
      expect(res.quantity).toBe(12);
      expect(res.message).toBe("已添加到购物车");
    });

    it("商品已在购物车应累加数量", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce(mockSku)          // 查询SKU
        .mockResolvedValueOnce({ id: 1, quantity: 6 });  // 已存在
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const res = await addWholesaleCartItem(1, "t1", 1, 6);
      expect(res.id).toBe(1);
      expect(res.quantity).toBe(12);
    });

    it("批发商品不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(addWholesaleCartItem(1, "t1", 999, 1)).rejects.toThrow("批发商品不存在");
    });

    it("数量低于起订量应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(mockSku);
      await expect(addWholesaleCartItem(1, "t1", 1, 1)).rejects.toThrow("起订量为6件");
    });
  });

  describe("updateWholesaleCartItem", () => {
    it("应更新购物车商品数量", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, skuId: 1 });
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const res = await updateWholesaleCartItem(1, "t1", 1, 24);
      expect(res.id).toBe(1);
      expect(res.quantity).toBe(24);
      expect(res.message).toBe("更新成功");
    });

    it("数量为0应删除商品", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, skuId: 1 });
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const res = await updateWholesaleCartItem(1, "t1", 1, 0);
      expect(res.message).toBe("已删除");
    });

    it("购物车商品不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(updateWholesaleCartItem(1, "t1", 999, 10)).rejects.toThrow("购物车商品不存在");
    });
  });

  describe("deleteWholesaleCartItem", () => {
    it("应删除购物车商品", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const res = await deleteWholesaleCartItem(1, "t1", 1);
      expect(res.message).toBe("删除成功");
    });

    it("购物车商品不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(deleteWholesaleCartItem(1, "t1", 999)).rejects.toThrow("购物车商品不存在");
    });
  });

  describe("createWholesaleOrder", () => {
    const mockSku = {
      id: 1,
      skuName: "飞天茅台53度500ml",
      spuId: 1,
      spuName: "飞天茅台53度500ml",
      mainImage: "moutai.jpg",
      wholesalePrice: 1200,
      minOrderQty: 6,
      availableQty: 100,
    };

    it("应成功创建批发订单含完整返回信息", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[mockSku]])          // 查询SKU
            .mockResolvedValueOnce({ affectedRows: 1 })  // 创建订单
            .mockResolvedValueOnce({ affectedRows: 1 })  // 创建订单项
            .mockResolvedValueOnce({ affectedRows: 1 })  // 扣减库存
            .mockResolvedValueOnce({ affectedRows: 1 }), // 清空购物车
        };
        return fn(mockConn);
      });

      const res = await createWholesaleOrder(1, "t1", {
        items: [{ skuId: 1, quantity: 12 }],
      });

      expect(res.orderNo).toBe("PF1234567890");
      expect(res.orderStatus).toBe("PENDING");
      expect(res.payStatus).toBe("UNPAID");
      expect(res.goodsAmount).toBe(14400);
      expect(res.discountAmount).toBe(0);
      expect(res.shippingAmount).toBe(0);
      expect(res.payableAmount).toBe(14400);
      expect(res.items.length).toBe(1);
      expect(res.items[0].skuId).toBe(1);
      expect(res.items[0].quantity).toBe(12);
      expect(res.items[0].unitPrice).toBe(1200);
      expect(res.items[0].subtotal).toBe(14400);
    });

    it("使用地址ID获取收货地址", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[mockSku]])          // 查询SKU
            .mockResolvedValueOnce([[{                   // 查询地址
              name: "张三",
              mobile: "13800138000",
              province: "北京市",
              city: "北京市",
              district: "朝阳区",
              address: "三里屯路1号",
            }]])
            .mockResolvedValueOnce({ affectedRows: 1 })  // 创建订单
            .mockResolvedValueOnce({ affectedRows: 1 })  // 创建订单项
            .mockResolvedValueOnce({ affectedRows: 1 })  // 扣减库存
            .mockResolvedValueOnce({ affectedRows: 1 }), // 清空购物车
        };
        return fn(mockConn);
      });

      const res = await createWholesaleOrder(1, "t1", {
        items: [{ skuId: 1, quantity: 12 }],
        addressId: 1,
      });

      expect(res.orderNo).toBeDefined();
    });

    it("订单商品为空应抛出错误", async () => {
      await expect(createWholesaleOrder(1, "t1", { items: [] })).rejects.toThrow("订单商品不能为空");
    });

    it("商品SKU不存在应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[]]),  // SKU不存在
        };
        return fn(mockConn);
      });

      await expect(
        createWholesaleOrder(1, "t1", { items: [{ skuId: 999, quantity: 1 }] })
      ).rejects.toThrow("商品SKU不存在或无批发价");
    });

    it("数量低于起订量应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[mockSku]]),
        };
        return fn(mockConn);
      });

      await expect(
        createWholesaleOrder(1, "t1", { items: [{ skuId: 1, quantity: 1 }] })
      ).rejects.toThrow("起订量为6件");
    });

    it("库存不足应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[
            { ...mockSku, availableQty: 5 }
          ]]),
        };
        return fn(mockConn);
      });

      await expect(
        createWholesaleOrder(1, "t1", { items: [{ skuId: 1, quantity: 12 }] })
      ).rejects.toThrow("库存不足");
    });
  });

  describe("getWholesaleOrders", () => {
    const mockOrder = {
      id: 1,
      orderNo: "PF1234567890",
      orderStatus: "PENDING",
      payStatus: "UNPAID",
      goodsAmount: 14400,
      discountAmount: 0,
      shippingAmount: 0,
      payableAmount: 14400,
      paidAmount: 0,
      receiverName: "张三",
      receiverMobile: "13800138000",
      createdAt: "2024-01-01",
      paidAt: null,
      shippedAt: null,
      completedAt: null,
    };

    const mockOrderItem = {
      orderNo: "PF1234567890",
      skuId: 1,
      skuName: "飞天茅台53度500ml",
      skuImage: "moutai.jpg",
      quantity: 12,
      unitPrice: 1200,
      subtotalAmount: 14400,
    };

    it("应返回批发订单列表含商品信息", async () => {
      mocks.queryWithTenant
        .mockResolvedValueOnce([mockOrder])    // 订单列表
        .mockResolvedValueOnce([mockOrderItem]); // 订单项
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });

      const res = await getWholesaleOrders(1, "t1", 1, 20);
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
      expect(res.records[0].orderNo).toBe("PF1234567890");
      expect(res.records[0].itemCount).toBe(1);
      expect(res.records[0].firstItem).toBeDefined();
      expect(res.records[0].items.length).toBe(1);
    });

    it("支持按状态过滤", async () => {
      mocks.queryWithTenant
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getWholesaleOrders(1, "t1", 1, 20, "PENDING");
      const sql = mocks.queryWithTenant.mock.calls[0][0];
      expect(sql).toContain("order_status = ?");
    });

    it("ALL状态不过滤", async () => {
      mocks.queryWithTenant
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getWholesaleOrders(1, "t1", 1, 20, "ALL");
      const sql = mocks.queryWithTenant.mock.calls[0][0];
      expect(sql).not.toContain("order_status = ?");
    });
  });

  describe("getWholesaleOrderDetail", () => {
    const mockOrder = {
      id: 1,
      orderNo: "PF1234567890",
      orderStatus: "PENDING",
      payStatus: "UNPAID",
      goodsAmount: 14400,
      discountAmount: 0,
      shippingAmount: 0,
      payableAmount: 14400,
      paidAmount: 0,
      receiverName: "张三",
      receiverMobile: "13800138000",
      receiverProvince: "北京市",
      receiverCity: "北京市",
      receiverDistrict: "朝阳区",
      receiverAddress: "三里屯路1号",
      remark: "测试订单",
      couponId: null,
      couponAmount: 0,
      pointsUsed: 0,
      pointsAmount: 0,
      createdAt: "2024-01-01",
      paidAt: null,
      shippedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
    };

    const mockItem = {
      id: 1,
      spuId: 1,
      skuId: 1,
      skuName: "飞天茅台53度500ml",
      skuImage: "moutai.jpg",
      quantity: 12,
      unitPrice: 1200,
      subtotalAmount: 14400,
      specInfo: null,
    };

    it("应返回订单详情含商品列表", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(mockOrder);
      mocks.queryWithTenant.mockResolvedValueOnce([mockItem]);

      const res = await getWholesaleOrderDetail(1, "t1", "PF1234567890");
      expect(res.orderNo).toBe("PF1234567890");
      expect(res.receiver.name).toBe("张三");
      expect(res.items.length).toBe(1);
      expect(res.items[0].skuId).toBe(1);
      expect(res.items[0].quantity).toBe(12);
    });

    it("订单不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(
        getWholesaleOrderDetail(1, "t1", "PF999")
      ).rejects.toThrow("订单不存在");
    });
  });
});
