/**
 * 管理端自定义报表 service 单元测试
 * 被测文件：src/services/admin/custom-report.service.ts
 * 覆盖：listTemplates / createTemplate / updateTemplate / deleteTemplate /
 *       executeTemplate / listSchedules / createSchedule / updateSchedule /
 *       deleteSchedule / toggleSchedule / runSchedule
 *
 * 约定（与项目现有测试一致）：
 *  - queryWithTenant 返回行集合数组，SELECT 直接 const rows = await ... 取数组；
 *    INSERT 端 const result = await ...（result 为数组，result.insertId 由业务取用）。
 *  - queryOneWithTenant 返回单条对象或 null。
 *  - AppError 真实导入用于错误断言。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../../services/admin/custom-report.service";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
  // 默认：列表返回空 + total 0；INSERT 返回一个带 insertId 的元信息
  mocks.queryWithTenant.mockResolvedValue([{ insertId: 1 }]);
  mocks.queryOneWithTenant.mockResolvedValue(null);
});

describe("custom-report.service - listTemplates", () => {
  it("带关键字/类型/状态筛选", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 2 });
    mocks.queryWithTenant.mockResolvedValue([
      { id: 1, name: "报表A", type: "sales" },
      { id: 2, name: "报表B", type: "orders" },
    ]);

    const res = await service.listTemplates(tenantId, {
      page: 1,
      pageSize: 10,
      keyword: "报表",
      type: "sales",
      status: "active",
    });

    expect(res.total).toBe(2);
    expect(res.records).toHaveLength(2);
    // 所有查询都带 tenant_id 过滤（经 queryWithTenant 注入）
    expect(mocks.queryOneWithTenant).toHaveBeenCalled();
    expect(mocks.queryWithTenant).toHaveBeenCalled();
  });

  it("无任何筛选条件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.listTemplates(tenantId, { page: 1, pageSize: 10 });

    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });

  it("total 为 null（无匹配行）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.listTemplates(tenantId, { page: 2, pageSize: 5 });

    expect(res.total).toBe(0);
    expect(res.page).toBe(2);
    expect(res.pageSize).toBe(5);
  });
});

describe("custom-report.service - createTemplate", () => {
  it("创建报表模板并记录调用", async () => {
    const res = await service.createTemplate(tenantId, {
      name: "销售报表",
      type: "sales",
      config: { dims: ["a"], metrics: ["COUNT(*)"] },
      description: "desc",
    });

    expect(res).toHaveProperty("id");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });

  it("仅必填字段（无 config/description）", async () => {
    const res = await service.createTemplate(tenantId, { name: "X", type: "inventory" });
    expect(res).toHaveProperty("id");
  });
});

describe("custom-report.service - updateTemplate", () => {
  it("全字段更新", async () => {
    const res = await service.updateTemplate(tenantId, 1, {
      name: "新名",
      type: "orders",
      config: { a: 1 },
      description: "新描述",
      status: "inactive",
    });

    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });

  it("部分字段更新", async () => {
    const res = await service.updateTemplate(tenantId, 2, { name: "部分" });
    expect(res).toEqual({ id: 2 });
  });

  it("空 body 仍执行 UPDATE（仅更新 updated_at）", async () => {
    const res = await service.updateTemplate(tenantId, 3, {});
    expect(res).toEqual({ id: 3 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });
});

describe("custom-report.service - deleteTemplate", () => {
  it("删除报表模板", async () => {
    const res = await service.deleteTemplate(tenantId, 1);
    expect(res).toEqual({ id: 1 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });
});

describe("custom-report.service - executeTemplate", () => {
  const validConfigObj = {
    dimensions: ["sku_id"],
    metrics: ["COUNT(*) AS cnt"],
    filters: [],
  };

  it("模板不存在抛 Error", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(service.executeTemplate(tenantId, 99, {}))
      .rejects.toThrow("模板不存在");
  });

  it("config 为对象时正常执行并返回行", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1,
      name: "销售报表",
      type: "sales",
      config: validConfigObj,
    });
    mocks.queryWithTenant.mockResolvedValue([
      { sku_id: 10, cnt: 5 },
      { sku_id: 20, cnt: 3 },
    ]);

    const res = await service.executeTemplate(tenantId, 1, {});

    expect(res.template.name).toBe("销售报表");
    expect(res.rows).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it("config 为 JSON 字符串时正常解析执行", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 2,
      name: "订单报表",
      type: "orders",
      config: JSON.stringify({
        dimensions: [],
        metrics: ["SUM(amount) AS amt"],
        filters: [],
      }),
    });
    mocks.queryWithTenant.mockResolvedValue([{ amt: 100 }]);

    const res = await service.executeTemplate(tenantId, 2, {});
    expect(res.rows).toHaveLength(1);
  });

  it("未知 type 时回退到默认表 sale_bill", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 3,
      name: "未知类型",
      type: "unknown_type",
      config: { dimensions: [], metrics: ["COUNT(*) AS cnt"], filters: [] },
    });
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.executeTemplate(tenantId, 3, {});
    expect(res.rows).toEqual([]);
    // 默认表名应出现在生成的 SQL 中
    expect(mocks.queryWithTenant.mock.calls[0][0]).toContain("FROM sale_bill");
  });

  it("带日期范围参数追加过滤条件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 4,
      name: "带日期",
      type: "sales",
      config: { dimensions: [], metrics: ["COUNT(*) AS cnt"], filters: [] },
    });
    mocks.queryWithTenant.mockResolvedValue([]);

    await service.executeTemplate(tenantId, 4, { dateStart: "2026-01-01", dateEnd: "2026-12-31" });

    const sql = mocks.queryWithTenant.mock.calls[0][0] as string;
    expect(sql).toContain("created_at >= ?");
    expect(sql).toContain("created_at <= ?");
  });

  it("非法字段名（维度）抛 AppError 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 5,
      name: "坏维度",
      type: "sales",
      config: { dimensions: ["bad field!"], metrics: [], filters: [] },
    });
    await expect(service.executeTemplate(tenantId, 5, {}))
      .rejects.toMatchObject({ statusCode: 400, message: "非法的字段名: bad field!" });
  });

  it("非法聚合函数（指标）抛 AppError 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 6,
      name: "坏指标",
      type: "sales",
      config: { dimensions: [], metrics: ["BADFUNC(x)"], filters: [] },
    });
    await expect(service.executeTemplate(tenantId, 6, {}))
      .rejects.toMatchObject({ statusCode: 400, message: "非法的字段名: BADFUNC(x)" });
  });

  it("不支持的操作符（过滤）抛 AppError 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 7,
      name: "坏操作符",
      type: "sales",
      config: {
        dimensions: [],
        metrics: [],
        filters: [{ field: "sku_id", op: "NOPE", value: 1 }],
      },
    });
    await expect(service.executeTemplate(tenantId, 7, {}))
      .rejects.toMatchObject({ statusCode: 400, message: "不支持的操作符: NOPE" });
  });

  it("IS NULL / IS NOT NULL 操作符无需占位符", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 8,
      name: "空值过滤",
      type: "sales",
      config: {
        dimensions: [],
        metrics: ["COUNT(*) AS cnt"],
        filters: [{ field: "supplier_id", op: "IS NULL", value: null }],
      },
    });
    mocks.queryWithTenant.mockResolvedValue([]);

    await service.executeTemplate(tenantId, 8, {});
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });
});

describe("custom-report.service - listSchedules", () => {
  it("带关键字/状态筛选", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "每日销售", templateName: "销售报表" }]);

    const res = await service.listSchedules(tenantId, {
      page: 1,
      pageSize: 10,
      keyword: "每日",
      status: "active",
    });

    expect(res.total).toBe(1);
    expect(res.records[0].templateName).toBe("销售报表");
  });

  it("无筛选 + total 为 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);

    const res = await service.listSchedules(tenantId, { page: 1, pageSize: 10 });
    expect(res.total).toBe(0);
  });
});

describe("custom-report.service - createSchedule", () => {
  it("创建定时任务", async () => {
    const res = await service.createSchedule(tenantId, {
      name: "每日",
      templateId: 1,
      cronExpression: "0 0 * * *",
      exportFormat: "excel",
      recipients: "a@b.com",
    });
    expect(res).toHaveProperty("id");
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
  });
});

describe("custom-report.service - updateSchedule", () => {
  it("全字段更新", async () => {
    const res = await service.updateSchedule(tenantId, 1, {
      name: "新名",
      templateId: 2,
      cronExpression: "0 1 * * *",
      exportFormat: "pdf",
      recipients: "c@d.com",
    });
    expect(res).toEqual({ id: 1 });
  });

  it("部分字段更新", async () => {
    const res = await service.updateSchedule(tenantId, 2, { name: "只改名" });
    expect(res).toEqual({ id: 2 });
  });
});

describe("custom-report.service - deleteSchedule", () => {
  it("删除定时任务", async () => {
    const res = await service.deleteSchedule(tenantId, 1);
    expect(res).toEqual({ id: 1 });
  });
});

describe("custom-report.service - toggleSchedule", () => {
  it("切换定时任务状态", async () => {
    const res = await service.toggleSchedule(tenantId, 1, "paused");
    expect(res).toEqual({ id: 1, status: "paused" });
  });
});

describe("custom-report.service - runSchedule", () => {
  it("定时任务不存在抛 Error", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(service.runSchedule(tenantId, 99))
      .rejects.toThrow("定时任务不存在");
  });

  it("存在时更新 last_run 并执行关联模板", async () => {
    // 第一次 queryOneWithTenant: 查找 schedule；第二次（executeTemplate 内）: 查找 template
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "每日销售", templateId: 5 })
      .mockResolvedValueOnce({ id: 5, name: "销售报表", type: "sales", config: { dimensions: [], metrics: ["COUNT(*) AS cnt"], filters: [] } });
    // 第一次 queryWithTenant: 更新 last_run；第二次（executeTemplate 内）: 报表查询
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 7 }]);

    const res = await service.runSchedule(tenantId, 1);

    expect(res.scheduleId).toBe(1);
    expect(res.scheduleName).toBe("每日销售");
    expect(res.result.rows).toHaveLength(1);
    expect(typeof res.executedAt).toBe("string");
  });
});
