import { describe, expect, it } from "vitest";
import { normalizeStoreSaleBillItem } from "../routes/store.routes.js";
import { calcReservation, getInitialMiniappOrderState, nextFulfillmentState } from "../shared/fulfillment.js";

describe("门店销售单商品行", () => {
  it("兼容前端传入 quantity 作为销售瓶数", () => {
    const item = normalizeStoreSaleBillItem({
      skuId: 1,
      quantity: 1,
      unitPrice: 129
    });

    expect(item.totalBottleQty).toBe(1);
    expect(item.boxQty).toBe(0);
    expect(item.bottleQty).toBe(1);
  });

  it("保留正式字段 totalBottleQty", () => {
    const item = normalizeStoreSaleBillItem({
      skuId: 1,
      boxQty: 1,
      bottleQty: 2,
      totalBottleQty: 8,
      unitPrice: 99
    });

    expect(item.totalBottleQty).toBe(8);
    expect(item.boxQty).toBe(1);
    expect(item.bottleQty).toBe(2);
  });
});

describe("批发订货履约集成", () => {
  it("批发订单库存不足时只占用当前可售库存", () => {
    expect(calcReservation({ orderQty: 100, availableQty: 30 })).toEqual({
      reservedQty: 30,
      unreservedQty: 70
    });
  });

  it("批发客户小程序下单后直接进入待配送", () => {
    expect(getInitialMiniappOrderState("WHOLESALE")).toEqual({
      orderStatus: "WAIT_DELIVERY",
      payStatus: "UNPAID"
    });
  });

  it("零售客户小程序下单后仍等待支付", () => {
    expect(getInitialMiniappOrderState("RETAIL")).toEqual({
      orderStatus: "PENDING_PAYMENT",
      payStatus: "UNPAID"
    });
  });

  it("配送完成后进入已完成状态", () => {
    expect(nextFulfillmentState("DELIVERING", "COMPLETE")).toBe("COMPLETED");
  });

  it("拒收后进入已拒收状态", () => {
    expect(nextFulfillmentState("DELIVERING", "REJECT")).toBe("REJECTED");
  });

  it("取消待配送订单进入已取消状态", () => {
    expect(nextFulfillmentState("WAIT_DELIVERY", "CANCEL")).toBe("CANCELLED");
  });
});
