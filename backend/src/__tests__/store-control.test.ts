/**
 * 门店管控单元测试
 *
 * 测试 store-control.routes.ts 中的核心逻辑：
 * - 自动开门逻辑（当前时间 >= auto_open_time 且状态为 CLOSED）
 * - 自动关门逻辑（当前时间 >= auto_close_time 且状态为 OPEN）
 * - 订单限额检查（当日订单数 >= max_daily_orders）
 * - 状态变更日志记录
 */

// ========== 纯函数提取 ==========

interface StoreControlConfig {
  store_id: number;
  store_name: string;
  current_status: string;
  auto_open_time: string | null;
  auto_close_time: string | null;
  max_daily_orders: number | null;
  max_order_amount: number | null;
}

interface StatusChange {
  storeId: number;
  fromStatus: string;
  toStatus: string;
  changeType: "MANUAL" | "SCHEDULED" | "AUTO";
  remark: string;
}

/**
 * 检查是否需要自动开门
 * 条件：有 auto_open_time 且当前状态为 CLOSED 且当前时间 >= auto_open_time 且 < auto_close_time
 */
function shouldAutoOpen(config: StoreControlConfig, currentTime: string): boolean {
  return !!(
    config.auto_open_time &&
    config.current_status === "CLOSED" &&
    currentTime >= config.auto_open_time &&
    currentTime < (config.auto_close_time || "23:59")
  );
}

/**
 * 检查是否需要自动关门
 * 条件：有 auto_close_time 且当前状态为 OPEN 且当前时间 >= auto_close_time
 */
function shouldAutoClose(config: StoreControlConfig, currentTime: string): boolean {
  return !!(
    config.auto_close_time &&
    config.current_status === "OPEN" &&
    currentTime >= config.auto_close_time
  );
}

/**
 * 检查是否因订单限额需要关门
 * 条件：有 max_daily_orders 且当前状态为 OPEN 且当日订单数 >= max_daily_orders
 */
function shouldCloseByOrderLimit(
  config: StoreControlConfig,
  todayOrderCount: number
): boolean {
  return !!(
    config.max_daily_orders &&
    config.current_status === "OPEN" &&
    todayOrderCount >= config.max_daily_orders
  );
}

/**
 * 检查是否因金额限额需要关门
 */
function shouldCloseByAmountLimit(
  config: StoreControlConfig,
  todayTotalAmount: number
): boolean {
  return !!(
    config.max_order_amount &&
    config.current_status === "OPEN" &&
    todayTotalAmount >= config.max_order_amount
  );
}

/**
 * 生成自动开门的状态变更记录
 */
function buildAutoOpenLog(config: StoreControlConfig): StatusChange {
  return {
    storeId: config.store_id,
    fromStatus: "CLOSED",
    toStatus: "OPEN",
    changeType: "SCHEDULED",
    remark: "定时自动开门",
  };
}

/**
 * 生成自动关门的状态变更记录
 */
function buildAutoCloseLog(
  config: StoreControlConfig,
  reason: string
): StatusChange {
  return {
    storeId: config.store_id,
    fromStatus: "OPEN",
    toStatus: "CLOSED",
    changeType: reason.includes("订单") ? "AUTO" : "SCHEDULED",
    remark: reason,
  };
}

/**
 * 生成订单限额关门的备注
 */
function buildOrderLimitRemark(orderCount: number, maxOrders: number): string {
  return `当日订单数(${orderCount})已达上限(${maxOrders})，自动关门`;
}

/**
 * 生成金额限额关门的备注
 */
function buildAmountLimitRemark(totalAmount: number, maxAmount: number): string {
  return `当日订单金额(${totalAmount.toFixed(2)})已达上限(${maxAmount})，自动关门`;
}

/**
 * 生成手动开门的状态变更记录
 */
function buildManualOpenLog(storeId: number, fromStatus: string, userId: number): StatusChange {
  return {
    storeId,
    fromStatus,
    toStatus: "OPEN",
    changeType: "MANUAL",
    remark: "手动开门",
  };
}

/**
 * 生成手动关门的状态变更记录
 */
function buildManualCloseLog(storeId: number, fromStatus: string, userId: number): StatusChange {
  return {
    storeId,
    fromStatus,
    toStatus: "CLOSED",
    changeType: "MANUAL",
    remark: "手动关门",
  };
}

/**
 * 生成暂停营业的状态变更记录
 */
function buildSuspendLog(storeId: number, fromStatus: string, userId: number, reason: string): StatusChange {
  return {
    storeId,
    fromStatus,
    toStatus: "SUSPENDED",
    changeType: "MANUAL",
    remark: reason || "手动暂停营业",
  };
}

/**
 * 生成恢复营业的状态变更记录
 */
function buildResumeLog(storeId: number, fromStatus: string, userId: number): StatusChange {
  return {
    storeId,
    fromStatus,
    toStatus: "OPEN",
    changeType: "MANUAL",
    remark: "恢复营业",
  };
}

/**
 * 格式化当前时间为 HH:mm 格式
 */
function formatCurrentTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// ========== 测试用例 ==========

describe("自动开门逻辑 - shouldAutoOpen", () => {
  const baseConfig: StoreControlConfig = {
    store_id: 1,
    store_name: "测试门店",
    current_status: "CLOSED",
    auto_open_time: "08:00",
    auto_close_time: "22:00",
    max_daily_orders: null,
    max_order_amount: null,
  };

  test("当前时间 >= auto_open_time 且状态为 CLOSED 时自动开门", () => {
    const config = { ...baseConfig };
    expect(shouldAutoOpen(config, "08:00")).toBe(true);
    expect(shouldAutoOpen(config, "09:30")).toBe(true);
    expect(shouldAutoOpen(config, "12:00")).toBe(true);
  });

  test("当前时间 < auto_open_time 时不自动开门", () => {
    const config = { ...baseConfig };
    expect(shouldAutoOpen(config, "07:59")).toBe(false);
    expect(shouldAutoOpen(config, "00:00")).toBe(false);
  });

  test("状态为 OPEN 时不自动开门", () => {
    const config = { ...baseConfig, current_status: "OPEN" };
    expect(shouldAutoOpen(config, "08:00")).toBe(false);
  });

  test("无 auto_open_time 时不自动开门", () => {
    const config = { ...baseConfig, auto_open_time: null };
    expect(shouldAutoOpen(config, "08:00")).toBe(false);
  });

  test("当前时间 >= auto_close_time 时不自动开门", () => {
    const config = { ...baseConfig };
    expect(shouldAutoOpen(config, "22:00")).toBe(false);
    expect(shouldAutoOpen(config, "23:00")).toBe(false);
  });

  test("无 auto_close_time 时使用默认值 23:59", () => {
    const config = { ...baseConfig, auto_close_time: null };
    expect(shouldAutoOpen(config, "23:58")).toBe(true);
    expect(shouldAutoOpen(config, "23:59")).toBe(false);
  });
});

describe("自动关门逻辑 - shouldAutoClose", () => {
  const baseConfig: StoreControlConfig = {
    store_id: 1,
    store_name: "测试门店",
    current_status: "OPEN",
    auto_open_time: "08:00",
    auto_close_time: "22:00",
    max_daily_orders: null,
    max_order_amount: null,
  };

  test("当前时间 >= auto_close_time 且状态为 OPEN 时自动关门", () => {
    const config = { ...baseConfig };
    expect(shouldAutoClose(config, "22:00")).toBe(true);
    expect(shouldAutoClose(config, "23:00")).toBe(true);
  });

  test("当前时间 < auto_close_time 时不自动关门", () => {
    const config = { ...baseConfig };
    expect(shouldAutoClose(config, "21:59")).toBe(false);
    expect(shouldAutoClose(config, "08:00")).toBe(false);
  });

  test("状态为 CLOSED 时不自动关门", () => {
    const config = { ...baseConfig, current_status: "CLOSED" };
    expect(shouldAutoClose(config, "22:00")).toBe(false);
  });

  test("无 auto_close_time 时不自动关门", () => {
    const config = { ...baseConfig, auto_close_time: null };
    expect(shouldAutoClose(config, "22:00")).toBe(false);
  });
});

describe("订单限额检查 - shouldCloseByOrderLimit", () => {
  const baseConfig: StoreControlConfig = {
    store_id: 1,
    store_name: "测试门店",
    current_status: "OPEN",
    auto_open_time: "08:00",
    auto_close_time: "22:00",
    max_daily_orders: 100,
    max_order_amount: null,
  };

  test("当日订单数 >= max_daily_orders 时触发关门", () => {
    const config = { ...baseConfig };
    expect(shouldCloseByOrderLimit(config, 100)).toBe(true);
    expect(shouldCloseByOrderLimit(config, 150)).toBe(true);
  });

  test("当日订单数 < max_daily_orders 时不触发", () => {
    const config = { ...baseConfig };
    expect(shouldCloseByOrderLimit(config, 99)).toBe(false);
    expect(shouldCloseByOrderLimit(config, 0)).toBe(false);
  });

  test("无 max_daily_orders 时不触发", () => {
    const config = { ...baseConfig, max_daily_orders: null };
    expect(shouldCloseByOrderLimit(config, 200)).toBe(false);
  });

  test("状态非 OPEN 时不触发", () => {
    const config = { ...baseConfig, current_status: "CLOSED" };
    expect(shouldCloseByOrderLimit(config, 200)).toBe(false);
  });
});

describe("金额限额检查 - shouldCloseByAmountLimit", () => {
  const baseConfig: StoreControlConfig = {
    store_id: 1,
    store_name: "测试门店",
    current_status: "OPEN",
    auto_open_time: "08:00",
    auto_close_time: "22:00",
    max_daily_orders: null,
    max_order_amount: 50000,
  };

  test("当日金额 >= max_order_amount 时触发关门", () => {
    const config = { ...baseConfig };
    expect(shouldCloseByAmountLimit(config, 50000)).toBe(true);
    expect(shouldCloseByAmountLimit(config, 60000)).toBe(true);
  });

  test("当日金额 < max_order_amount 时不触发", () => {
    const config = { ...baseConfig };
    expect(shouldCloseByAmountLimit(config, 49999.99)).toBe(false);
  });

  test("无 max_order_amount 时不触发", () => {
    const config = { ...baseConfig, max_order_amount: null };
    expect(shouldCloseByAmountLimit(config, 100000)).toBe(false);
  });
});

describe("状态变更日志记录", () => {
  test("自动开门日志正确", () => {
    const config: StoreControlConfig = {
      store_id: 1,
      store_name: "测试门店",
      current_status: "CLOSED",
      auto_open_time: "08:00",
      auto_close_time: "22:00",
      max_daily_orders: null,
      max_order_amount: null,
    };
    const log = buildAutoOpenLog(config);
    expect(log.storeId).toBe(1);
    expect(log.fromStatus).toBe("CLOSED");
    expect(log.toStatus).toBe("OPEN");
    expect(log.changeType).toBe("SCHEDULED");
    expect(log.remark).toBe("定时自动开门");
  });

  test("定时自动关门日志 changeType 为 SCHEDULED", () => {
    const config: StoreControlConfig = {
      store_id: 1,
      store_name: "测试门店",
      current_status: "OPEN",
      auto_open_time: "08:00",
      auto_close_time: "22:00",
      max_daily_orders: null,
      max_order_amount: null,
    };
    const log = buildAutoCloseLog(config, "定时自动关门");
    expect(log.changeType).toBe("SCHEDULED");
    expect(log.fromStatus).toBe("OPEN");
    expect(log.toStatus).toBe("CLOSED");
  });

  test("订单限额关门日志 changeType 为 AUTO", () => {
    const config: StoreControlConfig = {
      store_id: 1,
      store_name: "测试门店",
      current_status: "OPEN",
      auto_open_time: "08:00",
      auto_close_time: "22:00",
      max_daily_orders: null,
      max_order_amount: null,
    };
    const remark = buildOrderLimitRemark(100, 100);
    const log = buildAutoCloseLog(config, remark);
    expect(log.changeType).toBe("AUTO");
    expect(log.remark).toContain("订单数");
    expect(log.remark).toContain("100");
  });

  test("手动开门日志正确", () => {
    const log = buildManualOpenLog(1, "CLOSED", 10);
    expect(log.fromStatus).toBe("CLOSED");
    expect(log.toStatus).toBe("OPEN");
    expect(log.changeType).toBe("MANUAL");
    expect(log.remark).toBe("手动开门");
  });

  test("手动关门日志正确", () => {
    const log = buildManualCloseLog(1, "OPEN", 10);
    expect(log.fromStatus).toBe("OPEN");
    expect(log.toStatus).toBe("CLOSED");
    expect(log.changeType).toBe("MANUAL");
    expect(log.remark).toBe("手动关门");
  });

  test("暂停营业日志正确", () => {
    const log = buildSuspendLog(1, "OPEN", 10, "设备故障");
    expect(log.fromStatus).toBe("OPEN");
    expect(log.toStatus).toBe("SUSPENDED");
    expect(log.remark).toBe("设备故障");
  });

  test("恢复营业日志正确", () => {
    const log = buildResumeLog(1, "SUSPENDED", 10);
    expect(log.fromStatus).toBe("SUSPENDED");
    expect(log.toStatus).toBe("OPEN");
    expect(log.remark).toBe("恢复营业");
  });

  test("金额限额备注格式正确", () => {
    const remark = buildAmountLimitRemark(50000, 50000);
    expect(remark).toBe("当日订单金额(50000.00)已达上限(50000)，自动关门");
  });
});

describe("时间格式化 - formatCurrentTime", () => {
  test("正确格式化时间为 HH:mm", () => {
    const date = new Date(2024, 0, 1, 8, 5); // 08:05
    expect(formatCurrentTime(date)).toBe("08:05");
  });

  test("补零处理", () => {
    const date = new Date(2024, 0, 1, 9, 0); // 09:00
    expect(formatCurrentTime(date)).toBe("09:00");
  });
});
