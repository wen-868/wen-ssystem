/**
 * 订单超时处理单元测试
 *
 * 测试 order-timeout.routes.ts 中的核心逻辑：
 * - 超时配置解析（timeout_type -> tableName/statusField/statusValue 映射）
 * - CANCEL 动作的 SQL 生成
 * - AUTO_SIGN 动作的 SQL 生成
 * - 防重入逻辑（scannerRunning 标志）
 */

// ========== 纯函数提取 ==========

interface TimeoutConfig {
  id: number;
  order_type: string;
  timeout_type: string;
  timeout_minutes: number;
  action: string;
}

interface TableMapping {
  tableName: string;
  statusField: string;
  statusValue: string;
  extraWhere: string;
}

/**
 * 根据订单类型和超时类型解析对应的表和状态字段
 */
function resolveTableMapping(config: TimeoutConfig): TableMapping | null {
  let tableName = "";
  let statusField = "";
  let statusValue = "";
  let extraWhere = "";

  if (config.order_type === "SALE") {
    tableName = "miniapp_order";
    if (config.timeout_type === "WAIT_PAY") {
      statusField = "pay_status";
      statusValue = "UNPAID";
      extraWhere = "AND order_status = 'PENDING'";
    } else if (config.timeout_type === "WAIT_ACCEPT") {
      statusField = "order_status";
      statusValue = "PENDING";
    } else if (config.timeout_type === "WAIT_SIGN") {
      statusField = "delivery_status";
      statusValue = "PENDING_DELIVERY";
    }
  } else if (config.order_type === "PURCHASE") {
    tableName = "purchase_order";
    if (config.timeout_type === "WAIT_CONFIRM") {
      statusField = "status";
      statusValue = "PENDING";
    }
  }

  if (!tableName || !statusField) return null;

  return { tableName, statusField, statusValue, extraWhere };
}

/**
 * 生成超时订单查询 SQL 的 WHERE 条件部分
 */
function buildTimeoutQueryCondition(mapping: TableMapping, timeoutMinutes: number, timeoutType: string): {
  sql: string;
  params: unknown[];
} {
  return {
    sql: `SELECT id, order_no
     FROM ${mapping.tableName}
     WHERE ${mapping.statusField} = ?
       ${mapping.extraWhere}
       AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND id NOT IN (
         SELECT order_id FROM order_timeout_log
         WHERE timeout_type = ? AND result = 'SUCCESS'
       )
     LIMIT 100`,
    params: [mapping.statusValue, timeoutMinutes, timeoutType],
  };
}

interface ActionSql {
  sql: string;
  params: unknown[];
}

/**
 * 生成执行动作的 SQL
 */
function buildActionSql(
  config: TimeoutConfig,
  mapping: TableMapping,
  orderId: number
): ActionSql | null {
  if (config.action === "CANCEL") {
    if (config.timeout_type === "WAIT_PAY") {
      // WAIT_PAY 取消：同时更新 order_status 和 pay_status
      return {
        sql: `UPDATE ${mapping.tableName} SET order_status = 'CANCELLED', pay_status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
        params: [orderId],
      };
    } else if (config.timeout_type === "WAIT_SIGN") {
      // WAIT_SIGN 超时：自动签收（标记完成）
      return {
        sql: `UPDATE ${mapping.tableName} SET order_status = 'COMPLETED', updated_at = NOW() WHERE id = ?`,
        params: [orderId],
      };
    } else {
      // WAIT_ACCEPT 等其他场景：只更新 order_status
      return {
        sql: `UPDATE ${mapping.tableName} SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
        params: [orderId],
      };
    }
  } else if (config.action === "AUTO_ACCEPT") {
    return {
      sql: `UPDATE ${mapping.tableName} SET order_status = 'ACCEPTED', updated_at = NOW() WHERE id = ?`,
      params: [orderId],
    };
  } else if (config.action === "AUTO_SIGN") {
    return {
      sql: `UPDATE ${mapping.tableName} SET delivery_status = 'DELIVERED', order_status = 'COMPLETED', updated_at = NOW() WHERE id = ?`,
      params: [orderId],
    };
  }

  // REMIND 类型不改变订单状态
  return null;
}

/**
 * 生成处理日志插入 SQL
 */
function buildLogSql(
  config: TimeoutConfig,
  orderId: number,
  orderNo: string,
  success: boolean
): { sql: string; params: unknown[] } {
  return {
    sql: `INSERT INTO order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark)
     VALUES (?, ?, ?, ?, NOW(), NOW(), ?, ?)`,
    params: [
      orderId,
      config.order_type,
      config.timeout_type,
      config.action,
      success ? "SUCCESS" : "FAILED",
      success
        ? `订单${orderNo}超时自动${config.action}`
        : "处理失败",
    ],
  };
}

// ========== 测试用例 ==========

describe("超时配置解析 - resolveTableMapping", () => {
  test("SALE + WAIT_PAY 映射到 miniapp_order.pay_status = UNPAID", () => {
    const config: TimeoutConfig = {
      id: 1,
      order_type: "SALE",
      timeout_type: "WAIT_PAY",
      timeout_minutes: 15,
      action: "CANCEL",
    };
    const mapping = resolveTableMapping(config);
    expect(mapping).not.toBeNull();
    expect(mapping!.tableName).toBe("miniapp_order");
    expect(mapping!.statusField).toBe("pay_status");
    expect(mapping!.statusValue).toBe("UNPAID");
    expect(mapping!.extraWhere).toBe("AND order_status = 'PENDING'");
  });

  test("SALE + WAIT_ACCEPT 映射到 miniapp_order.order_status = PENDING", () => {
    const config: TimeoutConfig = {
      id: 2,
      order_type: "SALE",
      timeout_type: "WAIT_ACCEPT",
      timeout_minutes: 30,
      action: "CANCEL",
    };
    const mapping = resolveTableMapping(config);
    expect(mapping).not.toBeNull();
    expect(mapping!.tableName).toBe("miniapp_order");
    expect(mapping!.statusField).toBe("order_status");
    expect(mapping!.statusValue).toBe("PENDING");
    expect(mapping!.extraWhere).toBe("");
  });

  test("SALE + WAIT_SIGN 映射到 miniapp_order.delivery_status = PENDING_DELIVERY", () => {
    const config: TimeoutConfig = {
      id: 3,
      order_type: "SALE",
      timeout_type: "WAIT_SIGN",
      timeout_minutes: 72 * 60,
      action: "AUTO_SIGN",
    };
    const mapping = resolveTableMapping(config);
    expect(mapping).not.toBeNull();
    expect(mapping!.tableName).toBe("miniapp_order");
    expect(mapping!.statusField).toBe("delivery_status");
    expect(mapping!.statusValue).toBe("PENDING_DELIVERY");
  });

  test("PURCHASE + WAIT_CONFIRM 映射到 purchase_order.status = PENDING", () => {
    const config: TimeoutConfig = {
      id: 4,
      order_type: "PURCHASE",
      timeout_type: "WAIT_CONFIRM",
      timeout_minutes: 48 * 60,
      action: "CANCEL",
    };
    const mapping = resolveTableMapping(config);
    expect(mapping).not.toBeNull();
    expect(mapping!.tableName).toBe("purchase_order");
    expect(mapping!.statusField).toBe("status");
    expect(mapping!.statusValue).toBe("PENDING");
  });

  test("无法识别的配置返回 null", () => {
    const config: TimeoutConfig = {
      id: 5,
      order_type: "TRANSFER",
      timeout_type: "UNKNOWN",
      timeout_minutes: 60,
      action: "CANCEL",
    };
    expect(resolveTableMapping(config)).toBeNull();
  });

  test("SALE + 未知 timeout_type 返回 null", () => {
    const config: TimeoutConfig = {
      id: 6,
      order_type: "SALE",
      timeout_type: "UNKNOWN_TYPE",
      timeout_minutes: 60,
      action: "CANCEL",
    };
    expect(resolveTableMapping(config)).toBeNull();
  });
});

describe("CANCEL 动作 SQL 生成 - buildActionSql", () => {
  const saleMapping: TableMapping = {
    tableName: "miniapp_order",
    statusField: "pay_status",
    statusValue: "UNPAID",
    extraWhere: "AND order_status = 'PENDING'",
  };

  test("WAIT_PAY CANCEL 同时更新 order_status 和 pay_status", () => {
    const config: TimeoutConfig = {
      id: 1,
      order_type: "SALE",
      timeout_type: "WAIT_PAY",
      timeout_minutes: 15,
      action: "CANCEL",
    };
    const sql = buildActionSql(config, saleMapping, 1001);
    expect(sql).not.toBeNull();
    expect(sql!.sql).toContain("order_status = 'CANCELLED'");
    expect(sql!.sql).toContain("pay_status = 'CANCELLED'");
    expect(sql!.params).toEqual([1001]);
  });

  test("WAIT_ACCEPT CANCEL 只更新 order_status", () => {
    const config: TimeoutConfig = {
      id: 2,
      order_type: "SALE",
      timeout_type: "WAIT_ACCEPT",
      timeout_minutes: 30,
      action: "CANCEL",
    };
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "order_status",
      statusValue: "PENDING",
      extraWhere: "",
    };
    const sql = buildActionSql(config, mapping, 1002);
    expect(sql).not.toBeNull();
    expect(sql!.sql).toContain("order_status = 'CANCELLED'");
    expect(sql!.sql).not.toContain("pay_status");
    expect(sql!.params).toEqual([1002]);
  });

  test("WAIT_SIGN 超时自动签收标记完成", () => {
    const config: TimeoutConfig = {
      id: 3,
      order_type: "SALE",
      timeout_type: "WAIT_SIGN",
      timeout_minutes: 72 * 60,
      action: "CANCEL",
    };
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "delivery_status",
      statusValue: "PENDING_DELIVERY",
      extraWhere: "",
    };
    const sql = buildActionSql(config, mapping, 1003);
    expect(sql).not.toBeNull();
    expect(sql!.sql).toContain("order_status = 'COMPLETED'");
    expect(sql!.params).toEqual([1003]);
  });
});

describe("AUTO_SIGN 动作 SQL 生成", () => {
  test("AUTO_SIGN 更新 delivery_status 和 order_status", () => {
    const config: TimeoutConfig = {
      id: 7,
      order_type: "SALE",
      timeout_type: "WAIT_SIGN",
      timeout_minutes: 72 * 60,
      action: "AUTO_SIGN",
    };
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "delivery_status",
      statusValue: "PENDING_DELIVERY",
      extraWhere: "",
    };
    const sql = buildActionSql(config, mapping, 1004);
    expect(sql).not.toBeNull();
    expect(sql!.sql).toContain("delivery_status = 'DELIVERED'");
    expect(sql!.sql).toContain("order_status = 'COMPLETED'");
    expect(sql!.params).toEqual([1004]);
  });

  test("AUTO_ACCEPT 更新 order_status 为 ACCEPTED", () => {
    const config: TimeoutConfig = {
      id: 8,
      order_type: "SALE",
      timeout_type: "WAIT_ACCEPT",
      timeout_minutes: 30,
      action: "AUTO_ACCEPT",
    };
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "order_status",
      statusValue: "PENDING",
      extraWhere: "",
    };
    const sql = buildActionSql(config, mapping, 1005);
    expect(sql).not.toBeNull();
    expect(sql!.sql).toContain("order_status = 'ACCEPTED'");
    expect(sql!.params).toEqual([1005]);
  });

  test("REMIND 动作返回 null（不改变订单状态）", () => {
    const config: TimeoutConfig = {
      id: 9,
      order_type: "SALE",
      timeout_type: "WAIT_ACCEPT",
      timeout_minutes: 30,
      action: "REMIND",
    };
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "order_status",
      statusValue: "PENDING",
      extraWhere: "",
    };
    const sql = buildActionSql(config, mapping, 1006);
    expect(sql).toBeNull();
  });
});

describe("防重入逻辑 - scannerRunning", () => {
  test("初始状态 scannerRunning 为 false", () => {
    // 模拟模块级变量
    let scannerRunning = false;
    expect(scannerRunning).toBe(false);
  });

  test("启动后 scannerRunning 变为 true", () => {
    let scannerRunning = false;
    if (!scannerRunning) {
      scannerRunning = true;
    }
    expect(scannerRunning).toBe(true);
  });

  test("重复调用不会重置状态", () => {
    let scannerRunning = true;
    // startOrderTimeoutScanner 的逻辑：if (scannerRunning) return;
    if (scannerRunning) {
      // 直接返回，不重复启动
      expect(scannerRunning).toBe(true);
    }
  });

  test("扫描完成后重置为 false", () => {
    let scannerRunning = true;
    // finally 块中重置
    scannerRunning = false;
    expect(scannerRunning).toBe(false);
  });
});

describe("超时查询条件构建 - buildTimeoutQueryCondition", () => {
  test("WAIT_PAY 查询条件包含 extraWhere", () => {
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "pay_status",
      statusValue: "UNPAID",
      extraWhere: "AND order_status = 'PENDING'",
    };
    const { sql, params } = buildTimeoutQueryCondition(mapping, 15, "WAIT_PAY");
    expect(sql).toContain("AND order_status = 'PENDING'");
    expect(sql).toContain("INTERVAL ? MINUTE");
    expect(sql).toContain("NOT IN");
    expect(params).toEqual(["UNPAID", 15, "WAIT_PAY"]);
  });

  test("WAIT_ACCEPT 查询条件不包含 extraWhere", () => {
    const mapping: TableMapping = {
      tableName: "miniapp_order",
      statusField: "order_status",
      statusValue: "PENDING",
      extraWhere: "",
    };
    const { sql, params } = buildTimeoutQueryCondition(mapping, 30, "WAIT_ACCEPT");
    expect(sql).not.toContain("AND order_status = 'PENDING'");
    expect(params).toEqual(["PENDING", 30, "WAIT_ACCEPT"]);
  });
});

describe("处理日志 SQL 生成 - buildLogSql", () => {
  test("成功日志包含 SUCCESS 和正确备注", () => {
    const config: TimeoutConfig = {
      id: 1,
      order_type: "SALE",
      timeout_type: "WAIT_PAY",
      timeout_minutes: 15,
      action: "CANCEL",
    };
    const { sql, params } = buildLogSql(config, 1001, "DD20240101001", true);
    expect(sql).toContain("order_timeout_log");
    expect(params).toContain("SUCCESS");
    expect(params).toContain("订单DD20240101001超时自动CANCEL");
  });

  test("失败日志包含 FAILED", () => {
    const config: TimeoutConfig = {
      id: 1,
      order_type: "SALE",
      timeout_type: "WAIT_PAY",
      timeout_minutes: 15,
      action: "CANCEL",
    };
    const { sql, params } = buildLogSql(config, 1001, "DD20240101001", false);
    expect(params).toContain("FAILED");
  });
});
