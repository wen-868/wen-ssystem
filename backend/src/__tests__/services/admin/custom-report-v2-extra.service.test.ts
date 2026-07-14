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
  generateReport,
  exportReport,
} from "../../../services/admin/custom-report-v2.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("custom-report-v2.service - generateReport", () => {
  it("报表不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(generateReport(tenantId, 99, {}))
      .rejects.toMatchObject({ statusCode: 404, message: "报表不存在" });
  });

  it("生成报表数据（有维度和指标）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({
        id: 1,
        reportName: "销售报表",
        reportType: "SALES",
        dataSource: "sale_bill",
        config: JSON.stringify({
          dimensions: ["date"],
          metrics: ["SUM(amount) as total"],
          filters: [],
        }),
        chartType: "LINE",
      });
    mocks.queryWithTenant.mockResolvedValue([{ date: "2026-01-01", total: 1000 }]);
    const res: any = await generateReport(tenantId, 1, {
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
    });
    expect(res.total).toBe(1);
    expect(res.report.reportName).toBe("销售报表");
  });

  it("生成报表数据（无维度指标，用 *）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({
        id: 2,
        reportName: "全部数据",
        reportType: "SALES",
        dataSource: "orders",
        config: JSON.stringify({}),
        chartType: "TABLE",
      });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, amount: 100 }]);
    const res: any = await generateReport(tenantId, 2, {
      filters: { status: "PAID" },
    });
    expect(res.total).toBe(1);
  });

  it("config 为对象（非字符串）也能正常解析", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({
        id: 3,
        reportName: "测试",
        reportType: "SALES",
        dataSource: "sale_bill",
        config: { dimensions: ["store_id"], metrics: ["COUNT(*)"] },
        chartType: "BAR",
      });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res: any = await generateReport(tenantId, 3, {});
    expect(res.total).toBe(0);
  });
});

describe("custom-report-v2.service - exportReport", () => {
  it("导出报表成功", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({
        id: 1,
        reportName: "销售报表",
        reportType: "SALES",
        dataSource: "sale_bill",
        config: JSON.stringify({}),
        chartType: "TABLE",
      });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, amount: 100 }]);
    const res: any = await exportReport(tenantId, 1, "EXCEL", {});
    expect(res.exportFormat).toBe("EXCEL");
    expect(res.fileUrl).toBeDefined();
    expect(res.fileName).toContain("销售报表");
  });

  it("导出 CSV 格式", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({
        id: 1,
        reportName: "库存",
        reportType: "INVENTORY",
        dataSource: "inventory_balance",
        config: JSON.stringify({}),
        chartType: "TABLE",
      });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res: any = await exportReport(tenantId, 1, "CSV", {});
    expect(res.exportFormat).toBe("CSV");
    expect(res.fileName).toContain(".csv");
  });
});
