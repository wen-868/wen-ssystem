/**
 * 租户管理单元测试 (Phase 18-A)
 *
 * 测试平台租户管理核心逻辑：
 * - 租户列表查询参数构建
 * - 租户创建数据验证
 * - 租户状态切换
 * - 分页计算
 */

// ========== 类型定义 ==========

interface TenantQueryParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: number;
}

interface TenantCreateData {
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  adminPassword: string;
  modules?: string[];
}

// ========== 纯函数提取 ==========

/**
 * 构建租户列表查询条件
 */
function buildTenantQueryConditions(params: TenantQueryParams) {
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.keyword) {
    conditions.push("(name LIKE ? OR contact_phone LIKE ?)");
    sqlParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }
  if (params.status !== undefined) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }

  return { where: conditions.join(" AND "), params: sqlParams };
}

/**
 * 分页计算
 */
function calculatePagination(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  return { offset, limit: pageSize };
}

/**
 * 验证租户创建数据
 */
function validateTenantCreateData(data: TenantCreateData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push("租户名称不能为空");
  }
  if (data.name && data.name.length > 100) {
    errors.push("租户名称不能超过100个字符");
  }
  if (!data.contactName || data.contactName.trim().length === 0) {
    errors.push("联系人不能为空");
  }
  if (!data.contactPhone || !/^1[3-9]\d{9}$/.test(data.contactPhone)) {
    errors.push("手机号格式不正确");
  }
  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    errors.push("邮箱格式不正确");
  }
  if (!data.adminPassword || data.adminPassword.length < 6) {
    errors.push("管理员密码至少6位");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 获取租户状态标签
 */
function getTenantStatusLabel(status: number): { label: string; type: string } {
  const map: Record<number, { label: string; type: string }> = {
    0: { label: "待激活", type: "warning" },
    1: { label: "已启用", type: "success" },
    2: { label: "已停用", type: "danger" },
    3: { label: "已过期", type: "info" },
  };
  return map[status] || { label: "未知", type: "info" };
}

// ========== 测试用例 ==========

describe("租户列表查询 - 查询条件构建", () => {
  test("无筛选条件时返回基础查询", () => {
    const result = buildTenantQueryConditions({ page: 1, pageSize: 20 });
    expect(result.where).toBe("1=1");
    expect(result.params).toEqual([]);
  });

  test("按关键词筛选", () => {
    const result = buildTenantQueryConditions({ page: 1, pageSize: 20, keyword: "测试" });
    expect(result.where).toContain("name LIKE ?");
    expect(result.where).toContain("contact_phone LIKE ?");
    expect(result.params).toEqual(["%测试%", "%测试%"]);
  });

  test("按状态筛选", () => {
    const result = buildTenantQueryConditions({ page: 1, pageSize: 20, status: 1 });
    expect(result.where).toContain("status = ?");
    expect(result.params).toEqual([1]);
  });

  test("同时按关键词和状态筛选", () => {
    const result = buildTenantQueryConditions({ page: 1, pageSize: 20, keyword: "测试", status: 1 });
    expect(result.where).toContain("status = ?");
    expect(result.params).toHaveLength(3);
    expect(result.params).toEqual(["%测试%", "%测试%", 1]);
  });
});

describe("分页计算", () => {
  test("第1页偏移量为0", () => {
    const result = calculatePagination(1, 20);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });

  test("第3页偏移量为40", () => {
    const result = calculatePagination(3, 20);
    expect(result.offset).toBe(40);
    expect(result.limit).toBe(20);
  });

  test("pageSize=50 时第2页偏移量为50", () => {
    const result = calculatePagination(2, 50);
    expect(result.offset).toBe(50);
    expect(result.limit).toBe(50);
  });
});

describe("租户创建数据验证", () => {
  test("有效数据通过验证", () => {
    const data: TenantCreateData = {
      name: "测试租户",
      contactName: "张三",
      contactPhone: "13800138000",
      contactEmail: "test@example.com",
      adminPassword: "123456",
    };
    const result = validateTenantCreateData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("租户名称为空时报错", () => {
    const data: TenantCreateData = {
      name: "",
      contactName: "张三",
      contactPhone: "13800138000",
      contactEmail: "test@example.com",
      adminPassword: "123456",
    };
    const result = validateTenantCreateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("租户名称不能为空");
  });

  test("手机号格式错误时报错", () => {
    const data: TenantCreateData = {
      name: "测试租户",
      contactName: "张三",
      contactPhone: "12345",
      contactEmail: "test@example.com",
      adminPassword: "123456",
    };
    const result = validateTenantCreateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("手机号格式不正确");
  });

  test("邮箱格式错误时报错", () => {
    const data: TenantCreateData = {
      name: "测试租户",
      contactName: "张三",
      contactPhone: "13800138000",
      contactEmail: "invalid-email",
      adminPassword: "123456",
    };
    const result = validateTenantCreateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("邮箱格式不正确");
  });

  test("密码太短时报错", () => {
    const data: TenantCreateData = {
      name: "测试租户",
      contactName: "张三",
      contactPhone: "13800138000",
      contactEmail: "test@example.com",
      adminPassword: "123",
    };
    const result = validateTenantCreateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("管理员密码至少6位");
  });
});

describe("租户状态标签", () => {
  test("状态0 -> 待激活", () => {
    expect(getTenantStatusLabel(0)).toEqual({ label: "待激活", type: "warning" });
  });
  test("状态1 -> 已启用", () => {
    expect(getTenantStatusLabel(1)).toEqual({ label: "已启用", type: "success" });
  });
  test("状态2 -> 已停用", () => {
    expect(getTenantStatusLabel(2)).toEqual({ label: "已停用", type: "danger" });
  });
  test("状态3 -> 已过期", () => {
    expect(getTenantStatusLabel(3)).toEqual({ label: "已过期", type: "info" });
  });
  test("未知状态返回默认", () => {
    expect(getTenantStatusLabel(99)).toEqual({ label: "未知", type: "info" });
  });
});