/**
 * 自定义报表单元测试 (Phase 21-A)
 *
 * 测试报表引擎核心逻辑：
 * - 模板配置解析
 * - 动态 SQL 构建
 * - 定时任务状态切换
 * - CRON 表达式基本验证
 */

// ========== 类型定义 ==========

interface ReportTemplate {
  id: number;
  name: string;
  type: string;
  config: ReportConfig;
  status: string;
}

interface ReportConfig {
  dimensions?: string[];
  metrics?: string[];
  filters?: FilterItem[];
}

interface FilterItem {
  field: string;
  op: string;
  value: unknown;
}

interface ReportSchedule {
  id: number;
  name: string;
  templateId: number;
  cronExpression: string;
  exportFormat: string;
  recipients?: string;
  status: string;
  lastRunAt?: string;
}

// ========== 纯函数提取 ==========

/**
 * 解析模板配置，确保格式正确
 */
function parseTemplateConfig(rawConfig: unknown): ReportConfig {
  if (typeof rawConfig === "string") {
    try {
      return JSON.parse(rawConfig);
    } catch {
      return { dimensions: [], metrics: [], filters: [] };
    }
  }
  if (typeof rawConfig === "object" && rawConfig !== null) {
    return rawConfig as ReportConfig;
  }
  return { dimensions: [], metrics: [], filters: [] };
}

/**
 * 根据模板类型获取表名
 */
function getReportTableName(type: string): string {
  const map: Record<string, string> = {
    sales: "sale_bill",
    inventory: "inventory_balance",
    orders: "orders",
    purchase: "purchase_order",
    customers: "customer",
  };
  return map[type] || "orders";
}

/**
 * 构建动态报表 SQL
 */
function buildReportSQL(
  config: ReportConfig,
  type: string,
  dateStart?: string,
  dateEnd?: string
): { sql: string; params: unknown[] } {
  const tableName = getReportTableName(type);
  const selectParts: string[] = [];
  const groupParts: string[] = [];
  const whereConditions: string[] = ["tenant_id = ?"];
  const whereParams: unknown[] = ["tenant_id"];

  // 维度
  if (config.dimensions && config.dimensions.length > 0) {
    config.dimensions.forEach((d) => {
      selectParts.push(d);
      groupParts.push(d);
    });
  }

  // 指标
  if (config.metrics && config.metrics.length > 0) {
    config.metrics.forEach((m) => selectParts.push(m));
  }

  // 如果没有选择任何字段，默认返回 COUNT(*)
  if (selectParts.length === 0) {
    selectParts.push("COUNT(*) AS total");
  }

  // 筛选条件
  if (config.filters && Array.isArray(config.filters)) {
    config.filters.forEach((f) => {
      whereConditions.push(`${f.field} ${f.op} ?`);
      whereParams.push(f.value);
    });
  }

  if (dateStart) {
    whereConditions.push("created_at >= ?");
    whereParams.push(dateStart);
  }
  if (dateEnd) {
    whereConditions.push("created_at <= ?");
    whereParams.push(dateEnd);
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM ${tableName}`;
  sql += " WHERE " + whereConditions.join(" AND ");

  if (groupParts.length > 0) {
    sql += " GROUP BY " + groupParts.join(", ");
  }

  sql += " ORDER BY created_at DESC LIMIT 1000";

  return { sql, params: whereParams };
}

/**
 * 验证 CRON 表达式基本格式
 */
function isValidCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  // 检查每个字段是否有效
  const validField = (field: string): boolean => {
    return /^(\*|\d+(-\d+)?(\/\d+)?|(\d+,)*\d+)$/.test(field);
  };

  return parts.every(validField);
}

/**
 * 状态切换
 */
function toggleStatus(currentStatus: string): string {
  return currentStatus === "active" ? "paused" : "active";
}

/**
 * 验证模板数据
 */
function validateTemplateData(data: {
  name: string;
  type: string;
  config?: ReportConfig;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length === 0) errors.push("模板名称不能为空");
  if (!data.type || !["sales", "inventory", "orders", "purchase", "customers"].includes(data.type)) {
    errors.push("无效的报表类型");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 验证定时任务数据
 */
function validateScheduleData(data: {
  name: string;
  templateId: number;
  cronExpression: string;
  exportFormat: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length === 0) errors.push("任务名称不能为空");
  if (!data.templateId || data.templateId <= 0) errors.push("请选择关联模板");
  if (!isValidCronExpression(data.cronExpression)) errors.push("CRON表达式格式不正确");
  if (!["csv", "xlsx", "pdf"].includes(data.exportFormat)) errors.push("导出格式不支持");
  return { valid: errors.length === 0, errors };
}

// ========== 测试用例 ==========

describe("模板配置解析", () => {
  test("解析 JSON 字符串配置", () => {
    const config = parseTemplateConfig('{"dimensions":["DATE(created_at)"],"metrics":["SUM(amount)"]}');
    expect(config.dimensions).toEqual(["DATE(created_at)"]);
    expect(config.metrics).toEqual(["SUM(amount)"]);
  });

  test("解析对象配置", () => {
    const config = parseTemplateConfig({ dimensions: ["store_id"], metrics: ["COUNT(*)"] });
    expect(config.dimensions).toEqual(["store_id"]);
    expect(config.metrics).toEqual(["COUNT(*)"]);
  });

  test("无效 JSON 返回默认配置", () => {
    const config = parseTemplateConfig("invalid json");
    expect(config.dimensions).toEqual([]);
    expect(config.metrics).toEqual([]);
  });

  test("null/undefined 返回默认配置", () => {
    expect(parseTemplateConfig(null)).toEqual({ dimensions: [], metrics: [], filters: [] });
    expect(parseTemplateConfig(undefined)).toEqual({ dimensions: [], metrics: [], filters: [] });
  });
});

describe("报表表名映射", () => {
  test("sales -> sale_bill", () => expect(getReportTableName("sales")).toBe("sale_bill"));
  test("inventory -> inventory_balance", () => expect(getReportTableName("inventory")).toBe("inventory_balance"));
  test("orders -> orders", () => expect(getReportTableName("orders")).toBe("orders"));
  test("purchase -> purchase_order", () => expect(getReportTableName("purchase")).toBe("purchase_order"));
  test("customers -> customer", () => expect(getReportTableName("customers")).toBe("customer"));
  test("未知类型默认为 orders", () => expect(getReportTableName("unknown")).toBe("orders"));
});

describe("动态 SQL 构建", () => {
  test("销售报表 - 按日期+金额", () => {
    const config: ReportConfig = {
      dimensions: ["DATE(created_at)"],
      metrics: ["SUM(amount) AS total_amount", "COUNT(*) AS order_count"],
    };
    const { sql, params } = buildReportSQL(config, "sales");
    expect(sql).toContain("SELECT DATE(created_at), SUM(amount) AS total_amount, COUNT(*) AS order_count");
    expect(sql).toContain("FROM sale_bill");
    expect(sql).toContain("GROUP BY DATE(created_at)");
    expect(sql).toContain("tenant_id = ?");
  });

  test("库存报表 - 按门店+SKU", () => {
    const config: ReportConfig = {
      dimensions: ["store_id", "sku_id"],
      metrics: ["SUM(quantity) AS total_quantity"],
    };
    const { sql, params } = buildReportSQL(config, "inventory");
    expect(sql).toContain("FROM inventory_balance");
    expect(sql).toContain("GROUP BY store_id, sku_id");
  });

  test("带日期范围筛选", () => {
    const config: ReportConfig = { metrics: ["COUNT(*) AS total"] };
    const { sql, params } = buildReportSQL(config, "orders", "2024-01-01", "2024-01-31");
    expect(sql).toContain("created_at >= ?");
    expect(sql).toContain("created_at <= ?");
    expect(params).toContain("2024-01-01");
    expect(params).toContain("2024-01-31");
  });

  test("带自定义筛选条件", () => {
    const config: ReportConfig = {
      metrics: ["SUM(amount) AS total"],
      filters: [{ field: "status", op: "=", value: "PAID" }],
    };
    const { sql, params } = buildReportSQL(config, "sales");
    expect(sql).toContain("status = ?");
    expect(params).toContain("PAID");
  });

  test("无维度无指标时默认返回 COUNT(*)", () => {
    const config: ReportConfig = {};
    const { sql } = buildReportSQL(config, "orders");
    expect(sql).toContain("SELECT COUNT(*) AS total");
    expect(sql).not.toContain("GROUP BY");
  });
});

describe("CRON 表达式验证", () => {
  test("有效 CRON: 每天8点", () => {
    expect(isValidCronExpression("0 8 * * *")).toBe(true);
  });
  test("有效 CRON: 工作日16点", () => {
    expect(isValidCronExpression("0 16 * * 1-5")).toBe(true);
  });
  test("有效 CRON: 每月1号9点", () => {
    expect(isValidCronExpression("0 9 1 * *")).toBe(true);
  });
  test("无效: 字段不足", () => {
    expect(isValidCronExpression("0 8 * *")).toBe(false);
  });
  test("无效: 字段过多", () => {
    expect(isValidCronExpression("0 8 * * * *")).toBe(false);
  });
  test("无效: 空字符串", () => {
    expect(isValidCronExpression("")).toBe(false);
  });
  test("无效: 包含非法字符", () => {
    expect(isValidCronExpression("0 8 * * abc")).toBe(false);
  });
});

describe("状态切换", () => {
  test("active -> paused", () => {
    expect(toggleStatus("active")).toBe("paused");
  });
  test("paused -> active", () => {
    expect(toggleStatus("paused")).toBe("active");
  });
});

describe("模板数据验证", () => {
  test("有效数据通过验证", () => {
    const result = validateTemplateData({ name: "销售日报", type: "sales" });
    expect(result.valid).toBe(true);
  });
  test("名称为空", () => {
    const result = validateTemplateData({ name: "", type: "sales" });
    expect(result.valid).toBe(false);
  });
  test("无效类型", () => {
    const result = validateTemplateData({ name: "测试", type: "invalid" });
    expect(result.valid).toBe(false);
  });
});

describe("定时任务数据验证", () => {
  test("有效数据通过验证", () => {
    const result = validateScheduleData({
      name: "日报任务",
      templateId: 1,
      cronExpression: "0 8 * * *",
      exportFormat: "csv",
    });
    expect(result.valid).toBe(true);
  });
  test("CRON无效", () => {
    const result = validateScheduleData({
      name: "任务",
      templateId: 1,
      cronExpression: "invalid",
      exportFormat: "csv",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CRON表达式格式不正确");
  });
  test("导出格式无效", () => {
    const result = validateScheduleData({
      name: "任务",
      templateId: 1,
      cronExpression: "0 8 * * *",
      exportFormat: "json",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("导出格式不支持");
  });
  test("模板ID无效", () => {
    const result = validateScheduleData({
      name: "任务",
      templateId: 0,
      cronExpression: "0 8 * * *",
      exportFormat: "csv",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("请选择关联模板");
  });
});