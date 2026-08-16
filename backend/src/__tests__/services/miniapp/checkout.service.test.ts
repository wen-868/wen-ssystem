import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  makeBizNo: vi.fn(),
  calcReservation: vi.fn(),
  getInitialMiniappOrderState: vi.fn(),
  completeOrderDelivery: vi.fn(),
  shouldReserveStock: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));
vi.mock("../../../shared/fulfillment", () => ({
  calcReservation: mocks.calcReservation,
  getInitialMiniappOrderState: mocks.getInitialMiniappOrderState,
  completeOrderDelivery: mocks.completeOrderDelivery,
  shouldReserveStock: mocks.shouldReserveStock,
}));
vi.mock("../../../config/constants", () => ({ constants: {} }));

import { checkoutPreview, createCheckoutOrder, completeDelivery } from "../../../services/miniapp/checkout.service";

const connQuery = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("DD-TEST");
  mocks.getInitialMiniappOrderState.mockReturnValue({ orderStatus: "PENDING_PAYMENT", payStatus: "UNPAID" });
  mocks.shouldReserveStock.mockReturnValue(false);
  mocks.calcReservation.mockReturnValue({ reservedQty: 0, unreservedQty: 1 });
  mocks.completeOrderDelivery.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (fn: any) => fn({ query: connQuery }));
  connQuery.mockReset();
  connQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes("FROM t_cart_item")) return [[{ skuId: 1, quantity: 2 }]];
    if (String(sql).includes("t_product_sku s JOIN t_product_price")) return [[{ sku_name: "茅台", retail_price: 100, wholesale_price: 90, miniapp_price: 95 }]];
    if (String(sql).includes("t_customer_price_binding")) return [[{ price: 50 }]];
    if (String(sql).includes("t_inventory_balance")) return [[{ available_qty: 100, physical_qty: 200, locked_qty: 0 }]];
    return [[]];
  });
});

describe("checkout.service - preview", () => {
  it("checkoutPreview 指定 skuIds → 计算金额与运费", async () => {
    mocks.queryWithTenant.mockImplementation(async (sql: string) => {
      if (String(sql).includes("t_cart_item")) return [{ skuId: 1, quantity: 2, skuName: "茅台", spuName: "SPU1", image: "img", retailPrice: 100, wholesalePrice: 90, miniappPrice: 95, availableQty: 10 }];
      if (String(sql).includes("t_customer_price_binding")) return [[{ price: 50 }]];
      return [[]];
    });
    const res = await checkoutPreview({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: [1], storeId: 2, couponId: undefined, fullReductionId: undefined });
    expect(res.success).toBe(true);
    expect(res.data.items[0].unitPrice).toBe(50); // getBestPrice 绑定价
    expect(res.data.items[0].subtotal).toBe(100);
    expect(res.data.goodsAmount).toBe(100);
    expect(res.data.shippingFee).toBe(0); // >= 99 包邮
    expect(res.data.payableAmount).toBe(100);
  });

  it("checkoutPreview 空购物车 → 失败", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await checkoutPreview({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: [1], storeId: 2, couponId: undefined, fullReductionId: undefined });
    expect(res.success).toBe(false);
    expect(res.message).toBe("购物车为空");
  });

  it("checkoutPreview 带优惠券 → 计算优惠", async () => {
    mocks.queryWithTenant.mockImplementation(async (sql: string) => {
      if (String(sql).includes("t_cart_item")) return [{ skuId: 1, quantity: 1, skuName: "茅台", spuName: "SPU1", image: "img", retailPrice: 100, wholesalePrice: 90, miniappPrice: 95, availableQty: 10 }];
      if (String(sql).includes("t_customer_price_binding")) return [[{ price: 50 }]];
      return [[]];
    });
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 7, template_id: 3, status: "UNUSED", valid_end: "2030-01-01" })
      .mockResolvedValueOnce({ coupon_value: 10, coupon_type: "AMOUNT" });
    const res = await checkoutPreview({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: [1], storeId: 2, couponId: 7, fullReductionId: undefined });
    expect(res.data.discountAmount).toBe(10);
    expect(res.data.discountDesc).toContain("优惠券减10");
    expect(res.data.payableAmount).toBe(50); // goods 50 - coupon 10 + ship 10
  });
});

describe("checkout.service - 下单/发货", () => {
  it("createCheckoutOrder 零售下单成功 → 返回单号", async () => {
    const res = await createCheckoutOrder({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: undefined, storeId: 2, remark: "" });
    expect(res.orderNo).toBe("DD-TEST");
    expect(mocks.makeBizNo).toHaveBeenCalledWith("DD");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const orderInsert = mocks.connExecute.mock.calls.find((c) => String(c[1]).includes("INSERT INTO t_miniapp_order ("))!;
    expect(orderInsert).toBeDefined();
  });

  it("createCheckoutOrder 空购物车 → 抛错", async () => {
    connQuery.mockImplementation(async (sql: string) => (String(sql).includes("FROM t_cart_item") ? [[],] : [[]]));
    await expect(createCheckoutOrder({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: undefined, storeId: 2, remark: "" }))
      .rejects.toThrow("购物车为空");
  });

  it("createCheckoutOrder 库存不足 → 抛错", async () => {
    connQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes("FROM t_cart_item")) return [[{ skuId: 1, quantity: 2 }]];
      if (String(sql).includes("t_product_sku s JOIN t_product_price")) return [[{ sku_name: "茅台", retail_price: 100, wholesale_price: 90, miniapp_price: 95 }]];
      if (String(sql).includes("t_customer_price_binding")) return [[{ price: 50 }]];
      if (String(sql).includes("t_inventory_balance")) return [[{ available_qty: 0, physical_qty: 0, locked_qty: 0 }]];
      return [[]];
    });
    await expect(createCheckoutOrder({ tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: undefined, storeId: 2, remark: "" }))
      .rejects.toThrow("库存不足");
  });

  it("completeDelivery 包裹 completeOrderDelivery 调用", async () => {
    await completeDelivery("DD1", 5);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.completeOrderDelivery).toHaveBeenCalledWith(expect.anything(), "DD1", 5, mocks.makeBizNo);
  });
});
