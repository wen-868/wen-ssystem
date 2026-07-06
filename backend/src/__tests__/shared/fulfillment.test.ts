import { describe, it, expect } from "vitest";
import {
  getSettlementType,
  getCustomerLevelCode,
  getMemberLevelLabel,
  getPriceType,
  shouldReserveStock,
  computeSellingPrice,
  calcReservation,
  getInitialMiniappOrderState,
  nextFulfillmentState,
} from "../../shared/fulfillment.js";

// ========== getSettlementType ==========
describe("getSettlementType", () => {
  it("批发客户默认返回 ACCOUNT", () => {
    expect(getSettlementType("WHOLESALE")).toBe("ACCOUNT");
  });

  it("批发客户可指定结算方式", () => {
    expect(getSettlementType("WHOLESALE", "CASH")).toBe("CASH");
  });

  it("零售客户返回 CASH", () => {
    expect(getSettlementType("RETAIL")).toBe("CASH");
  });

  it("零售客户忽略 headerValue", () => {
    expect(getSettlementType("RETAIL", "ACCOUNT")).toBe("CASH");
  });
});

// ========== getCustomerLevelCode ==========
describe("getCustomerLevelCode", () => {
  it("批发客户返回 WHOLESALE", () => {
    expect(getCustomerLevelCode("WHOLESALE")).toBe("WHOLESALE");
  });

  it("零售客户返回 NORMAL", () => {
    expect(getCustomerLevelCode("RETAIL")).toBe("NORMAL");
  });
});

// ========== getMemberLevelLabel ==========
describe("getMemberLevelLabel", () => {
  it("批发客户返回中文标签", () => {
    expect(getMemberLevelLabel("WHOLESALE")).toBe("批发客户");
  });

  it("零售客户返回中文标签", () => {
    expect(getMemberLevelLabel("RETAIL")).toBe("普通会员");
  });
});

// ========== getPriceType ==========
describe("getPriceType", () => {
  it("批发客户返回 WHOLESALE", () => {
    expect(getPriceType("WHOLESALE")).toBe("WHOLESALE");
  });

  it("零售客户返回 STORE", () => {
    expect(getPriceType("RETAIL")).toBe("STORE");
  });
});

// ========== shouldReserveStock ==========
describe("shouldReserveStock", () => {
  it("批发客户需要预留库存", () => {
    expect(shouldReserveStock("WHOLESALE")).toBe(true);
  });

  it("零售客户不需要预留库存", () => {
    expect(shouldReserveStock("RETAIL")).toBe(false);
  });
});

// ========== computeSellingPrice ==========
describe("computeSellingPrice", () => {
  it("批发客户优先使用批发价", () => {
    const price = computeSellingPrice("WHOLESALE", 80, 90, 100);
    expect(price).toBe(80);
  });

  it("批发客户无批发价时使用小程序价", () => {
    const price = computeSellingPrice("WHOLESALE", null, 90, 100);
    expect(price).toBe(90);
  });

  it("批发客户无批发价和小程序价时使用零售价", () => {
    const price = computeSellingPrice("WHOLESALE", null, null, 100);
    expect(price).toBe(100);
  });

  it("批发客户批发价为 0 时仍使用 0", () => {
    const price = computeSellingPrice("WHOLESALE", 0, 90, 100);
    expect(price).toBe(0);
  });

  it("零售客户忽略批发价，直接使用小程序价", () => {
    const price = computeSellingPrice("RETAIL", 80, 90, 100);
    expect(price).toBe(90);
  });

  it("零售客户无小程序价时使用零售价", () => {
    const price = computeSellingPrice("RETAIL", 80, null, 100);
    expect(price).toBe(100);
  });

  it("零售客户无任何价格时返回 0", () => {
    const price = computeSellingPrice("RETAIL", null, null, null);
    expect(price).toBe(0);
  });
});

// ========== calcReservation ==========
describe("calcReservation", () => {
  it("库存充足时全部预留", () => {
    const result = calcReservation({ orderQty: 10, availableQty: 20 });
    expect(result.reservedQty).toBe(10);
    expect(result.unreservedQty).toBe(0);
  });

  it("库存不足时部分预留", () => {
    const result = calcReservation({ orderQty: 10, availableQty: 5 });
    expect(result.reservedQty).toBe(5);
    expect(result.unreservedQty).toBe(5);
  });

  it("订单数量为 0 时全部为 0", () => {
    const result = calcReservation({ orderQty: 0, availableQty: 20 });
    expect(result.reservedQty).toBe(0);
    expect(result.unreservedQty).toBe(0);
  });

  it("库存为 0 时全部不可预留", () => {
    const result = calcReservation({ orderQty: 10, availableQty: 0 });
    expect(result.reservedQty).toBe(0);
    expect(result.unreservedQty).toBe(10);
  });

  it("负数输入应被截断为 0", () => {
    const result = calcReservation({ orderQty: -5, availableQty: -3 });
    expect(result.reservedQty).toBe(0);
    expect(result.unreservedQty).toBe(0);
  });

  it("小数输入应被截断为整数", () => {
    const result = calcReservation({ orderQty: 10.7, availableQty: 5.3 });
    expect(result.reservedQty).toBe(5);
    expect(result.unreservedQty).toBe(5);
  });
});

// ========== getInitialMiniappOrderState ==========
describe("getInitialMiniappOrderState", () => {
  it("批发客户初始状态为待配送", () => {
    const state = getInitialMiniappOrderState("WHOLESALE");
    expect(state.orderStatus).toBe("WAIT_DELIVERY");
    expect(state.payStatus).toBe("UNPAID");
  });

  it("零售客户初始状态为待支付", () => {
    const state = getInitialMiniappOrderState("RETAIL");
    expect(state.orderStatus).toBe("PENDING_PAYMENT");
    expect(state.payStatus).toBe("UNPAID");
  });
});

// ========== nextFulfillmentState ==========
describe("nextFulfillmentState", () => {
  it("START_DELIVERY: WAIT_DELIVERY → DELIVERING", () => {
    const result = nextFulfillmentState("WAIT_DELIVERY", "START_DELIVERY");
    expect(result).toBe("DELIVERING");
  });

  it("START_DELIVERY: 非待配送状态应抛出错误", () => {
    expect(() => nextFulfillmentState("COMPLETED", "START_DELIVERY")).toThrow(
      "只有待配送订单可以开始配送"
    );
  });

  it("COMPLETE: WAIT_DELIVERY → COMPLETED", () => {
    expect(nextFulfillmentState("WAIT_DELIVERY", "COMPLETE")).toBe("COMPLETED");
  });

  it("COMPLETE: DELIVERING → COMPLETED", () => {
    expect(nextFulfillmentState("DELIVERING", "COMPLETE")).toBe("COMPLETED");
  });

  it("COMPLETE: 已完成状态应抛出错误", () => {
    expect(() => nextFulfillmentState("COMPLETED", "COMPLETE")).toThrow(
      "只有待配送或配送中订单可以完成"
    );
  });

  it("REJECT: WAIT_DELIVERY → REJECTED", () => {
    expect(nextFulfillmentState("WAIT_DELIVERY", "REJECT")).toBe("REJECTED");
  });

  it("REJECT: DELIVERING → REJECTED", () => {
    expect(nextFulfillmentState("DELIVERING", "REJECT")).toBe("REJECTED");
  });

  it("CANCEL: PENDING_PAYMENT → CANCELLED", () => {
    expect(nextFulfillmentState("PENDING_PAYMENT", "CANCEL")).toBe("CANCELLED");
  });

  it("CANCEL: COMPLETED → 应抛出错误", () => {
    expect(() => nextFulfillmentState("COMPLETED", "CANCEL")).toThrow(
      "已完成订单不能取消"
    );
  });

  it("未知动作应抛出错误", () => {
    expect(() =>
      nextFulfillmentState("WAIT_DELIVERY", "UNKNOWN" as any)
    ).toThrow("未知履约动作");
  });
});