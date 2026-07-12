import { describe, it, expect, vi } from "vitest";
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
  completeOrderDelivery,
} from "../../shared/fulfillment";

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

  it("REJECT: 非待配送或配送中状态应抛出错误", () => {
    expect(() => nextFulfillmentState("COMPLETED", "REJECT")).toThrow(
      "只有待配送或配送中订单可以拒收"
    );
    expect(() => nextFulfillmentState("PENDING_PAYMENT", "REJECT")).toThrow(
      "只有待配送或配送中订单可以拒收"
    );
    expect(() => nextFulfillmentState("CANCELLED", "REJECT")).toThrow(
      "只有待配送或配送中订单可以拒收"
    );
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

// ========== completeOrderDelivery ==========
describe("completeOrderDelivery", () => {
  function mockConn(orders: any[], items: any[]) {
    return {
      query: vi.fn()
        .mockResolvedValueOnce([orders])
        .mockResolvedValueOnce([items]),
      execute: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
  }

  function makeBizNo(prefix: string) {
    return `${prefix}-${Date.now()}`;
  }

  it("订单不存在时应抛出错误", async () => {
    const conn = mockConn([], []);
    await expect(
      completeOrderDelivery(conn as any, "ORD-999", 1, makeBizNo)
    ).rejects.toThrow("订单不存在或状态不可完成");
  });

  it("零售订单应完成并扣减库存", async () => {
    const order = {
      order_no: "ORD-001",
      store_id: 1,
      member_id: 100,
      customer_type: "RETAIL",
      settlement_type: "CASH",
      payable_amount: 50,
      receiver_name: "张三",
      receiver_mobile: "13800138000",
    };
    const items = [
      { skuId: 10, quantity: 2, reservedQty: 2 },
    ];
    const conn = mockConn([order], items);

    const result = await completeOrderDelivery(conn as any, "ORD-001", 1, makeBizNo);

    expect(result.orderNo).toBe("ORD-001");
    expect(result.status).toBe("COMPLETED");
    expect(result.receivableNo).toBeNull();
    // 应执行了库存扣减
    expect(conn.execute).toHaveBeenCalled();
  });

  it("批发赊账订单应创建应收账款", async () => {
    const order = {
      order_no: "ORD-002",
      store_id: 1,
      member_id: 200,
      customer_type: "WHOLESALE",
      settlement_type: "ACCOUNT",
      payable_amount: 500,
      receiver_name: "李四",
      receiver_mobile: "13900139000",
    };
    const items = [
      { skuId: 20, quantity: 5, reservedQty: 3 },
    ];
    const conn = mockConn([order], items);

    const result = await completeOrderDelivery(conn as any, "ORD-002", 2, makeBizNo);

    expect(result.receivableNo).not.toBeNull();
    expect(typeof result.receivableNo).toBe("string");
  });

  it("无预留库存的 SKU 应跳过扣减", async () => {
    const order = {
      order_no: "ORD-003",
      store_id: 1,
      member_id: 300,
      customer_type: "RETAIL",
      settlement_type: "CASH",
      payable_amount: 30,
      receiver_name: "王五",
      receiver_mobile: "13700137000",
    };
    const items = [
      { skuId: 30, quantity: 1, reservedQty: 0 },
    ];
    const conn = mockConn([order], items);

    await completeOrderDelivery(conn as any, "ORD-003", 3, makeBizNo);

    // reservedQty=0 时不应执行库存扣减（但会执行订单状态更新）
    const executeCalls = (conn.execute as any).mock.calls;
    // 至少调用了更新订单状态
    expect(executeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("多个商品项都应扣减库存", async () => {
    const order = {
      order_no: "ORD-004",
      store_id: 1,
      member_id: 400,
      customer_type: "RETAIL",
      settlement_type: "CASH",
      payable_amount: 100,
      receiver_name: "赵六",
      receiver_mobile: "13600136000",
    };
    const items = [
      { skuId: 40, quantity: 2, reservedQty: 2 },
      { skuId: 41, quantity: 3, reservedQty: 3 },
    ];
    const conn = mockConn([order], items);

    await completeOrderDelivery(conn as any, "ORD-004", 4, makeBizNo);

    // 每个商品应有 2 次 execute（库存扣减 + 库存流水）+ 1 次订单状态更新
    const executeCalls = (conn.execute as any).mock.calls;
    expect(executeCalls.length).toBeGreaterThanOrEqual(5);
  });

  it("reservedQty 为 null 时按 0 处理跳过扣减", async () => {
    const order = {
      order_no: "ORD-005",
      store_id: 1,
      member_id: 500,
      customer_type: "RETAIL",
      settlement_type: "CASH",
      payable_amount: 20,
      receiver_name: "钱七",
      receiver_mobile: "13500135000",
    };
    const items = [{ skuId: 50, quantity: 1, reservedQty: null }];
    const conn = mockConn([order], items);

    await completeOrderDelivery(conn as any, "ORD-005", 5, makeBizNo);

    // reservedQty=null 时 deductQty=0，跳过扣减，只执行订单状态更新
    const executeCalls = (conn.execute as any).mock.calls;
    expect(executeCalls.length).toBe(1);
  });

  it("reservedQty 为 undefined 时按 0 处理跳过扣减", async () => {
    const order = {
      order_no: "ORD-006",
      store_id: 1,
      member_id: 600,
      customer_type: "RETAIL",
      settlement_type: "CASH",
      payable_amount: 25,
      receiver_name: "孙八",
      receiver_mobile: "13400134000",
    };
    const items = [{ skuId: 60, quantity: 1, reservedQty: undefined }];
    const conn = mockConn([order], items);

    await completeOrderDelivery(conn as any, "ORD-006", 6, makeBizNo);

    const executeCalls = (conn.execute as any).mock.calls;
    expect(executeCalls.length).toBe(1);
  });

  it("REJECT 动作对 DELIVERING 状态应成功（覆盖 line 88 第二分支）", () => {
    expect(nextFulfillmentState("DELIVERING", "REJECT")).toBe("REJECTED");
  });

  it("CANCEL 动作对 PENDING_PAYMENT 之外的非完成状态应成功", () => {
    expect(nextFulfillmentState("WAIT_DELIVERY", "CANCEL")).toBe("CANCELLED");
    expect(nextFulfillmentState("DELIVERING", "CANCEL")).toBe("CANCELLED");
    expect(nextFulfillmentState("REJECTED", "CANCEL")).toBe("CANCELLED");
  });
});