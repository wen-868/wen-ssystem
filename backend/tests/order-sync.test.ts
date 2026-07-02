/**
 * 订单管理P1单元测试 (Phase 19-A)
 *
 * 测试同步日志、对账、审核核心逻辑：
 * - 同步日志状态映射
 * - 对账数据验证
 * - 审核统计计算
 */

// ========== 类型定义 ==========

interface SyncLog {
  id: number;
  orderNo: string;
  platformOrderNo: string;
  status: number;
  response?: string;
  createdAt: string;
  updatedAt: string;
}

interface Reconciliation {
  id: number;
  reconciliationNo: string;
  platformNo: string;
  platformName: string;
  type: number;
  amount: number;
  status: number;
  recordedAt?: string;
}

interface Review {
  id: number;
  platformNo: string;
  platformName: string;
  reviewType: number;
  status: number;
  reviewResult?: string;
  reviewAt?: string;
}

// ========== 纯函数提取 ==========

/**
 * 同步日志状态映射
 */
function getSyncStatusInfo(status: number): { label: string; isRetryable: boolean } {
  const map: Record<number, { label: string; isRetryable: boolean }> = {
    0: { label: "初始化", isRetryable: true },
    1: { label: "同步成功", isRetryable: false },
    2: { label: "同步失败", isRetryable: true },
    3: { label: "已推送", isRetryable: false },
    4: { label: "推送失败", isRetryable: true },
  };
  return map[status] || { label: "未知", isRetryable: false };
}

/**
 * 构建同步日志查询条件
 */
function buildSyncLogQueryConditions(params: {
  orderNo?: string;
  status?: number;
}) {
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = ["tenant_id"];

  if (params.orderNo) {
    conditions.push("order_no LIKE ?");
    sqlParams.push(`%${params.orderNo}%`);
  }
  if (params.status !== undefined) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }

  return { where: conditions.join(" AND "), params: sqlParams };
}

/**
 * 对账类型映射
 */
function getReconciliationTypeInfo(type: number): { label: string } {
  return type === 1 ? { label: "订单" } : type === 2 ? { label: "退款" } : { label: "未知" };
}

/**
 * 对账状态映射
 */
function getReconciliationStatusInfo(status: number): { label: string; canUpdate: boolean } {
  const map: Record<number, { label: string; canUpdate: boolean }> = {
    0: { label: "初始", canUpdate: true },
    1: { label: "成功", canUpdate: false },
    2: { label: "失败", canUpdate: true },
  };
  return map[status] || { label: "未知", canUpdate: false };
}

/**
 * 审核类型映射
 */
function getReviewTypeInfo(type: number): { label: string } {
  const map: Record<number, { label: string }> = {
    1: { label: "商品" },
    2: { label: "店铺" },
    3: { label: "会员" },
  };
  return map[type] || { label: "未知" };
}

/**
 * 审核状态映射
 */
function getReviewStatusInfo(status: number): { label: string; canReply: boolean } {
  const map: Record<number, { label: string; canReply: boolean }> = {
    0: { label: "待审核", canReply: true },
    1: { label: "审核通过", canReply: true },
    2: { label: "审核拒绝", canReply: true },
  };
  return map[status] || { label: "未知", canReply: false };
}

/**
 * 审核统计计算
 */
function calculateReviewStats(reviews: Review[]): { platformName: string; cnt: number }[] {
  const statsMap = new Map<string, number>();
  for (const review of reviews) {
    const name = review.platformName || "未知平台";
    statsMap.set(name, (statsMap.get(name) || 0) + 1);
  }
  return Array.from(statsMap.entries())
    .map(([platformName, cnt]) => ({ platformName, cnt }))
    .sort((a, b) => b.cnt - a.cnt);
}

/**
 * 验证对账数据
 */
function validateReconciliationData(data: {
  reconciliationNo: string;
  platformNo: string;
  platformName: string;
  type: number;
  amount: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.reconciliationNo) errors.push("对账单号不能为空");
  if (!data.platformNo) errors.push("平台编号不能为空");
  if (!data.platformName) errors.push("平台名称不能为空");
  if (![1, 2].includes(data.type)) errors.push("类型必须为1(订单)或2(退款)");
  if (data.amount < 0) errors.push("金额不能为负数");
  return { valid: errors.length === 0, errors };
}

// ========== 测试用例 ==========

describe("同步日志 - 状态映射", () => {
  test("状态0-初始化 可重试", () => {
    expect(getSyncStatusInfo(0)).toEqual({ label: "初始化", isRetryable: true });
  });
  test("状态1-同步成功 不可重试", () => {
    expect(getSyncStatusInfo(1)).toEqual({ label: "同步成功", isRetryable: false });
  });
  test("状态2-同步失败 可重试", () => {
    expect(getSyncStatusInfo(2)).toEqual({ label: "同步失败", isRetryable: true });
  });
  test("状态3-已推送 不可重试", () => {
    expect(getSyncStatusInfo(3)).toEqual({ label: "已推送", isRetryable: false });
  });
  test("状态4-推送失败 可重试", () => {
    expect(getSyncStatusInfo(4)).toEqual({ label: "推送失败", isRetryable: true });
  });
  test("只有失败状态才可重试", () => {
    const retryableStatuses = [0, 1, 2, 3, 4].filter(s => getSyncStatusInfo(s).isRetryable);
    expect(retryableStatuses).toEqual([0, 2, 4]);
  });
});

describe("同步日志 - 查询条件构建", () => {
  test("无筛选条件", () => {
    const result = buildSyncLogQueryConditions({});
    expect(result.where).toBe("tenant_id = ?");
    expect(result.params).toEqual(["tenant_id"]);
  });

  test("按订单号筛选", () => {
    const result = buildSyncLogQueryConditions({ orderNo: "20240101001" });
    expect(result.where).toContain("order_no LIKE ?");
    expect(result.params).toContain("%20240101001%");
  });

  test("按状态筛选", () => {
    const result = buildSyncLogQueryConditions({ status: 2 });
    expect(result.where).toContain("status = ?");
    expect(result.params).toContain(2);
  });
});

describe("对账 - 数据验证", () => {
  test("有效数据通过验证", () => {
    const result = validateReconciliationData({
      reconciliationNo: "REC-001",
      platformNo: "P001",
      platformName: "京东",
      type: 1,
      amount: 1000.50,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("对账单号为空时报错", () => {
    const result = validateReconciliationData({
      reconciliationNo: "",
      platformNo: "P001",
      platformName: "京东",
      type: 1,
      amount: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("对账单号不能为空");
  });

  test("金额为负数时报错", () => {
    const result = validateReconciliationData({
      reconciliationNo: "REC-001",
      platformNo: "P001",
      platformName: "京东",
      type: 1,
      amount: -100,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("金额不能为负数");
  });

  test("类型无效时报错", () => {
    const result = validateReconciliationData({
      reconciliationNo: "REC-001",
      platformNo: "P001",
      platformName: "京东",
      type: 99,
      amount: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("类型必须为1(订单)或2(退款)");
  });
});

describe("对账 - 类型和状态映射", () => {
  test("类型1=订单", () => {
    expect(getReconciliationTypeInfo(1)).toEqual({ label: "订单" });
  });
  test("类型2=退款", () => {
    expect(getReconciliationTypeInfo(2)).toEqual({ label: "退款" });
  });
  test("初始状态可更新", () => {
    expect(getReconciliationStatusInfo(0)).toEqual({ label: "初始", canUpdate: true });
  });
  test("成功状态不可更新", () => {
    expect(getReconciliationStatusInfo(1)).toEqual({ label: "成功", canUpdate: false });
  });
});

describe("审核 - 类型和状态映射", () => {
  test("类型1=商品", () => {
    expect(getReviewTypeInfo(1)).toEqual({ label: "商品" });
  });
  test("类型2=店铺", () => {
    expect(getReviewTypeInfo(2)).toEqual({ label: "店铺" });
  });
  test("类型3=会员", () => {
    expect(getReviewTypeInfo(3)).toEqual({ label: "会员" });
  });
  test("所有状态都可以回复", () => {
    expect(getReviewStatusInfo(0).canReply).toBe(true);
    expect(getReviewStatusInfo(1).canReply).toBe(true);
    expect(getReviewStatusInfo(2).canReply).toBe(true);
  });
});

describe("审核 - 统计计算", () => {
  test("空列表返回空数组", () => {
    const result = calculateReviewStats([]);
    expect(result).toEqual([]);
  });

  test("按平台名称统计", () => {
    const reviews: Review[] = [
      { id: 1, platformNo: "P001", platformName: "京东", reviewType: 1, status: 0 },
      { id: 2, platformNo: "P001", platformName: "京东", reviewType: 2, status: 1 },
      { id: 3, platformNo: "P002", platformName: "美团", reviewType: 1, status: 0 },
      { id: 4, platformNo: "P003", platformName: "饿了么", reviewType: 3, status: 0 },
      { id: 5, platformNo: "P002", platformName: "美团", reviewType: 2, status: 2 },
      { id: 6, platformNo: "P002", platformName: "美团", reviewType: 1, status: 1 },
    ];
    const result = calculateReviewStats(reviews);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ platformName: "美团", cnt: 3 });
    expect(result[1]).toEqual({ platformName: "京东", cnt: 2 });
    expect(result[2]).toEqual({ platformName: "饿了么", cnt: 1 });
  });

  test("相同平台名称合并统计", () => {
    const reviews: Review[] = [
      { id: 1, platformNo: "P001", platformName: "京东", reviewType: 1, status: 0 },
      { id: 2, platformNo: "P001", platformName: "京东", reviewType: 1, status: 0 },
    ];
    const result = calculateReviewStats(reviews);
    expect(result).toHaveLength(1);
    expect(result[0].cnt).toBe(2);
  });
});