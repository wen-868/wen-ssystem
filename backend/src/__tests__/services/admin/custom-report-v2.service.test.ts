import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  listReports,
  createReport,
  getReport,
  updateReport,
  deleteReport,
} from "../../../services/admin/custom-report-v2.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("custom-report-v2.service - listReports", () => {
  it("无筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, reportName: "销售报表" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listReports(tenantId, { page: 1, pageSize: 10 });
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("有 keyword 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listReports(tenantId, { page: 1, pageSize: 10, keyword: "销售" });
    expect(res.total).toBe(0);
  });

  it("有 reportType 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listReports(tenantId, { page: 1, pageSize: 10, reportType: "SALES" });
    expect(res.total).toBe(0);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listReports(tenantId, { page: 1, pageSize: 10, status: "ACTIVE" });
    expect(res.total).toBe(0);
  });

  it("total 为 null 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listReports(tenantId, { page: 1, pageSize: 10 });
    expect(res.total).toBe(0);
  });
});

describe("custom-report-v2.service - createReport", () => {
  it("创建报表成功", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
    const res = await createReport(tenantId, {
      reportName: "销售报表",
      reportType: "SALES",
      dataSource: "sale_bill",
      config: { dimensions: ["date"], metrics: ["SUM(amount)"] },
    }, 1);
    expect(res.id).toBe(1);
  });

  it("无用户ID也能创建", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 2 });
    const res = await createReport(tenantId, {
      reportName: "库存报表",
      reportType: "INVENTORY",
      dataSource: "inventory_balance",
      config: {},
      chartType: "BAR",
      description: "测试描述",
    });
    expect(res.id).toBe(2);
  });
});

describe("custom-report-v2.service - getReport", () => {
  it("报表存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, reportName: "销售报表" });
    const res = await getReport(tenantId, 1);
    expect(res.id).toBe(1);
  });

  it("报表不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getReport(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "报表不存在" });
  });
});

describe("custom-report-v2.service - updateReport", () => {
  it("报表不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateReport(tenantId, 99, { reportName: "新名称" }))
      .rejects.toMatchObject({ statusCode: 404, message: "报表不存在" });
  });

  it("全字段更新成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await updateReport(tenantId, 1, {
      reportName: "新报表名",
      reportType: "FINANCE",
      dataSource: "finance_log",
      config: { test: true },
      chartType: "PIE",
      description: "新描述",
      status: "DISABLED",
    });
    expect(res.id).toBe(1);
  });

  it("空更新（无字段）直接返回", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await updateReport(tenantId, 1, {});
    expect(res.id).toBe(1);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });
});

describe("custom-report-v2.service - deleteReport", () => {
  it("报表不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deleteReport(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "报表不存在" });
  });

  it("删除成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteReport(tenantId, 1);
    expect(res.id).toBe(1);
    expect(res.deleted).toBe(true);
  });
});
