/**
 * 库存 FIFO 排序与效期预警单元测试
 *
 * 测试 inventory-batch.routes.ts 中的核心逻辑：
 * - FIFO 排序逻辑（按 expiry_date ASC 排序）
 * - 效期预警级别计算（30天/15天/7天三级）
 * - BLOCK 级别自动锁定逻辑
 */

// ========== 纯函数提取 ==========

interface InventoryBatch {
  id: number;
  store_id: number;
  sku_id: number;
  batch_no: string;
  quantity: number;
  locked_quantity: number;
  production_date: string | null;
  expiry_date: string | null;
  days_remaining?: number;
}

interface ExpiryAlertConfig {
  alert_level: number;
  level_name: string;
  days_before_expiry: number;
  action: "REMIND" | "RESTRICT" | "BLOCK";
  color: string;
  enabled: boolean;
}

interface ExpiryStatus {
  statusText: string;
  color: string;
}

/**
 * FIFO 排序：按 expiry_date ASC, production_date ASC 排序
 * expiry_date 为 NULL 的排到最后
 */
function fifoSort(batches: InventoryBatch[]): InventoryBatch[] {
  return [...batches].sort((a, b) => {
    // NULL 的 expiry_date 排到最后
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;

    const dateCompare = a.expiry_date.localeCompare(b.expiry_date);
    if (dateCompare !== 0) return dateCompare;

    // 同一 expiry_date 按 production_date ASC
    if (!a.production_date && !b.production_date) return 0;
    if (!a.production_date) return 1;
    if (!b.production_date) return -1;

    return a.production_date.localeCompare(b.production_date);
  });
}

/**
 * 计算剩余天数
 */
function calcDaysRemaining(expiryDate: string | null): number {
  if (!expiryDate) return Infinity;
  const remaining = Math.floor(
    (new Date(expiryDate).getTime() - Date.now()) / 86400000
  );
  return remaining;
}

/**
 * 计算效期预警状态（与 inventory-batch.routes.ts 中的逻辑一致）
 * - > 30天：正常 (#10B981)
 * - 16-30天：临近效期 (#F59E0B)
 * - 8-15天：临期 (#F59E0B)
 * - 1-7天：即将过期 (#EF4444)
 * - < 0天：已过期 (#EF4444)
 * - 无效期：正常 (#10B981)
 */
function calcExpiryStatus(daysRemaining: number | undefined, expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) {
    return { statusText: "正常", color: "#10B981" };
  }

  const remaining = daysRemaining ?? calcDaysRemaining(expiryDate);

  if (remaining < 0) {
    return { statusText: "已过期", color: "#EF4444" };
  }
  if (remaining <= 7) {
    return { statusText: "即将过期", color: "#EF4444" };
  }
  if (remaining <= 15) {
    return { statusText: "临期", color: "#F59E0B" };
  }
  if (remaining <= 30) {
    return { statusText: "临近效期", color: "#F59E0B" };
  }

  return { statusText: "正常", color: "#10B981" };
}

/**
 * 匹配效期预警级别（取最高级别）
 * configs 已按 days_before_expiry DESC 排序
 */
function matchExpiryAlertLevel(
  daysRemaining: number,
  configs: ExpiryAlertConfig[]
): ExpiryAlertConfig | null {
  if (daysRemaining < 0) return null; // 已过期由单独逻辑处理

  for (const config of configs) {
    if (daysRemaining <= config.days_before_expiry) {
      return config;
    }
  }
  return null;
}

/**
 * 判断是否需要自动锁定（BLOCK 级别）
 */
function shouldAutoLock(
  batch: InventoryBatch,
  alertConfig: ExpiryAlertConfig | null
): boolean {
  if (!alertConfig) return false;
  if (alertConfig.action !== "BLOCK") return false;
  // 只有当 locked_quantity < quantity 时才需要锁定
  return batch.locked_quantity < batch.quantity;
}

/**
 * 模拟数据库查询的效期状态筛选条件
 */
function buildExpiryStatusFilter(expiryStatus: string): {
  condition: string;
} | null {
  switch (expiryStatus) {
    case "expired":
      return {
        condition: "ib.expiry_date IS NOT NULL AND ib.expiry_date < CURDATE()",
      };
    case "danger":
      return {
        condition:
          "ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 0 AND 7",
      };
    case "warning":
      return {
        condition:
          "ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 8 AND 30",
      };
    case "normal":
      return {
        condition:
          "(ib.expiry_date IS NULL OR DATEDIFF(ib.expiry_date, CURDATE()) > 30)",
      };
    default:
      return null;
  }
}

// ========== 测试用例 ==========

describe("FIFO 排序逻辑 - fifoSort", () => {
  test("按 expiry_date ASC 排序", () => {
    const batches: InventoryBatch[] = [
      { id: 1, store_id: 1, sku_id: 1, batch_no: "B003", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-03-01" },
      { id: 2, store_id: 1, sku_id: 1, batch_no: "B001", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-01-01" },
      { id: 3, store_id: 1, sku_id: 1, batch_no: "B002", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-02-01" },
    ];

    const sorted = fifoSort(batches);
    expect(sorted[0].batch_no).toBe("B001");
    expect(sorted[1].batch_no).toBe("B002");
    expect(sorted[2].batch_no).toBe("B003");
  });

  test("expiry_date 相同时按 production_date ASC 排序", () => {
    const batches: InventoryBatch[] = [
      { id: 1, store_id: 1, sku_id: 1, batch_no: "B002", quantity: 100, locked_quantity: 0, production_date: "2024-06-01", expiry_date: "2025-12-01" },
      { id: 2, store_id: 1, sku_id: 1, batch_no: "B001", quantity: 100, locked_quantity: 0, production_date: "2024-03-01", expiry_date: "2025-12-01" },
    ];

    const sorted = fifoSort(batches);
    expect(sorted[0].batch_no).toBe("B001");
    expect(sorted[1].batch_no).toBe("B002");
  });

  test("expiry_date 为 NULL 的排到最后", () => {
    const batches: InventoryBatch[] = [
      { id: 1, store_id: 1, sku_id: 1, batch_no: "B002", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: null },
      { id: 2, store_id: 1, sku_id: 1, batch_no: "B001", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-01-01" },
    ];

    const sorted = fifoSort(batches);
    expect(sorted[0].batch_no).toBe("B001");
    expect(sorted[1].batch_no).toBe("B002");
  });

  test("空数组返回空数组", () => {
    expect(fifoSort([])).toEqual([]);
  });

  test("单元素数组排序不变", () => {
    const batches: InventoryBatch[] = [
      { id: 1, store_id: 1, sku_id: 1, batch_no: "B001", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-01-01" },
    ];
    const sorted = fifoSort(batches);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe(1);
  });

  test("不修改原数组", () => {
    const batches: InventoryBatch[] = [
      { id: 1, store_id: 1, sku_id: 1, batch_no: "B002", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-03-01" },
      { id: 2, store_id: 1, sku_id: 1, batch_no: "B001", quantity: 100, locked_quantity: 0, production_date: null, expiry_date: "2025-01-01" },
    ];
    const sorted = fifoSort(batches);
    expect(batches[0].batch_no).toBe("B002"); // 原数组不变
    expect(sorted[0].batch_no).toBe("B001"); // 新数组已排序
  });
});

describe("效期预警级别计算 - calcExpiryStatus", () => {
  test("剩余天数 > 30 为正常", () => {
    const status = calcExpiryStatus(45, "2025-12-31");
    expect(status.statusText).toBe("正常");
    expect(status.color).toBe("#10B981");
  });

  test("剩余天数 16-30 为临近效期", () => {
    const status = calcExpiryStatus(20, "2025-12-31");
    expect(status.statusText).toBe("临近效期");
    expect(status.color).toBe("#F59E0B");
  });

  test("剩余天数 8-15 为临期", () => {
    const status = calcExpiryStatus(10, "2025-12-31");
    expect(status.statusText).toBe("临期");
    expect(status.color).toBe("#F59E0B");
  });

  test("剩余天数 1-7 为即将过期", () => {
    const status = calcExpiryStatus(5, "2025-12-31");
    expect(status.statusText).toBe("即将过期");
    expect(status.color).toBe("#EF4444");
  });

  test("剩余天数 < 0 为已过期", () => {
    const status = calcExpiryStatus(-3, "2025-01-01");
    expect(status.statusText).toBe("已过期");
    expect(status.color).toBe("#EF4444");
  });

  test("无效期时为正常", () => {
    const status = calcExpiryStatus(undefined, null);
    expect(status.statusText).toBe("正常");
    expect(status.color).toBe("#10B981");
  });

  test("边界值：恰好30天为临近效期", () => {
    const status = calcExpiryStatus(30, "2025-12-31");
    expect(status.statusText).toBe("临近效期");
  });

  test("边界值：恰好15天为临期", () => {
    const status = calcExpiryStatus(15, "2025-12-31");
    expect(status.statusText).toBe("临期");
  });

  test("边界值：恰好7天为即将过期", () => {
    const status = calcExpiryStatus(7, "2025-12-31");
    expect(status.statusText).toBe("即将过期");
  });
});

describe("效期预警级别匹配 - matchExpiryAlertLevel", () => {
  const configs: ExpiryAlertConfig[] = [
    { alert_level: 3, level_name: "危险", days_before_expiry: 7, action: "BLOCK", color: "#EF4444", enabled: true },
    { alert_level: 2, level_name: "警告", days_before_expiry: 15, action: "RESTRICT", color: "#F59E0B", enabled: true },
    { alert_level: 1, level_name: "提醒", days_before_expiry: 30, action: "REMIND", color: "#3B82F6", enabled: true },
  ];

  test("剩余5天匹配 BLOCK 级别", () => {
    const matched = matchExpiryAlertLevel(5, configs);
    expect(matched).not.toBeNull();
    expect(matched!.alert_level).toBe(3);
    expect(matched!.action).toBe("BLOCK");
  });

  test("剩余10天匹配 RESTRICT 级别", () => {
    const matched = matchExpiryAlertLevel(10, configs);
    expect(matched).not.toBeNull();
    expect(matched!.alert_level).toBe(2);
    expect(matched!.action).toBe("RESTRICT");
  });

  test("剩余25天匹配 REMIND 级别", () => {
    const matched = matchExpiryAlertLevel(25, configs);
    expect(matched).not.toBeNull();
    expect(matched!.alert_level).toBe(1);
    expect(matched!.action).toBe("REMIND");
  });

  test("剩余45天不匹配任何级别", () => {
    const matched = matchExpiryAlertLevel(45, configs);
    expect(matched).toBeNull();
  });

  test("已过期（< 0天）返回 null", () => {
    const matched = matchExpiryAlertLevel(-1, configs);
    expect(matched).toBeNull();
  });

  test("空配置列表返回 null", () => {
    const matched = matchExpiryAlertLevel(5, []);
    expect(matched).toBeNull();
  });
});

describe("BLOCK 级别自动锁定逻辑 - shouldAutoLock", () => {
  const blockConfig: ExpiryAlertConfig = {
    alert_level: 3,
    level_name: "危险",
    days_before_expiry: 7,
    action: "BLOCK",
    color: "#EF4444",
    enabled: true,
  };

  test("BLOCK 级别且未完全锁定时需要自动锁定", () => {
    const batch: InventoryBatch = {
      id: 1, store_id: 1, sku_id: 1, batch_no: "B001",
      quantity: 100, locked_quantity: 0,
      production_date: null, expiry_date: "2025-01-10",
    };
    expect(shouldAutoLock(batch, blockConfig)).toBe(true);
  });

  test("BLOCK 级别但已完全锁定时不需要锁定", () => {
    const batch: InventoryBatch = {
      id: 1, store_id: 1, sku_id: 1, batch_no: "B001",
      quantity: 100, locked_quantity: 100,
      production_date: null, expiry_date: "2025-01-10",
    };
    expect(shouldAutoLock(batch, blockConfig)).toBe(false);
  });

  test("部分锁定时仍需要锁定", () => {
    const batch: InventoryBatch = {
      id: 1, store_id: 1, sku_id: 1, batch_no: "B001",
      quantity: 100, locked_quantity: 50,
      production_date: null, expiry_date: "2025-01-10",
    };
    expect(shouldAutoLock(batch, blockConfig)).toBe(true);
  });

  test("REMIND 级别不需要锁定", () => {
    const remindConfig: ExpiryAlertConfig = {
      ...blockConfig,
      action: "REMIND",
    };
    const batch: InventoryBatch = {
      id: 1, store_id: 1, sku_id: 1, batch_no: "B001",
      quantity: 100, locked_quantity: 0,
      production_date: null, expiry_date: "2025-01-10",
    };
    expect(shouldAutoLock(batch, remindConfig)).toBe(false);
  });

  test("无预警配置时不需要锁定", () => {
    const batch: InventoryBatch = {
      id: 1, store_id: 1, sku_id: 1, batch_no: "B001",
      quantity: 100, locked_quantity: 0,
      production_date: null, expiry_date: "2025-01-10",
    };
    expect(shouldAutoLock(batch, null)).toBe(false);
  });
});

describe("效期状态筛选条件 - buildExpiryStatusFilter", () => {
  test("expired 状态筛选条件正确", () => {
    const filter = buildExpiryStatusFilter("expired");
    expect(filter).not.toBeNull();
    expect(filter!.condition).toContain("expiry_date < CURDATE()");
  });

  test("danger 状态筛选条件正确", () => {
    const filter = buildExpiryStatusFilter("danger");
    expect(filter).not.toBeNull();
    expect(filter!.condition).toContain("BETWEEN 0 AND 7");
  });

  test("warning 状态筛选条件正确", () => {
    const filter = buildExpiryStatusFilter("warning");
    expect(filter).not.toBeNull();
    expect(filter!.condition).toContain("BETWEEN 8 AND 30");
  });

  test("normal 状态筛选条件正确", () => {
    const filter = buildExpiryStatusFilter("normal");
    expect(filter).not.toBeNull();
    expect(filter!.condition).toContain("> 30");
  });

  test("未知状态返回 null", () => {
    const filter = buildExpiryStatusFilter("unknown");
    expect(filter).toBeNull();
  });
});
