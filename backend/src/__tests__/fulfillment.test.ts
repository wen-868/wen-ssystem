import { describe, expect, it } from "vitest";
import {
  calcReservation,
  getInitialMiniappOrderState,
  nextFulfillmentState
} from "../shared/fulfillment.js";

describe("线上线下一体化履约规则", () => {
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
});
