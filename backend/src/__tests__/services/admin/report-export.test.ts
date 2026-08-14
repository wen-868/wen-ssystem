/**
 * 管理端报表导出 service 单元测试
 * 被测文件：src/services/admin/report-export.service.ts
 * 覆盖 exportReport + generateCsv + generateExcel，9 种报表类型，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import { exportReport } from "../../../services/admin/report-export.service";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ============ exportReport - 不支持的报表类型 ============
describe("admin report-export.service - exportReport 异常", () => {
  it("不支持的报表类型抛出错误", async () => {
    await expect(
      exportReport({ report_type: "unknown" as any, format: "csv" }, tenantId)
    ).rejects.toThrow("不支持的报表类型");
  });
});

// ============ 9 种报表类型 + 完整 filters + csv 格式（覆盖所有 if true 分支）============
describe("admin report-export.service - 9 种报表类型完整 filters + csv", () => {
  const fullFilters = { startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1 };

  const cases: Array<[string, any[]]> = [
    ["sales", [{ billNo: "B001", customerName: "张三" }]],
    ["collection", [{ linkNo: "L001", amount: 100 }]],
    ["product", [{ skuId: 1, skuName: "商品A" }]],
    ["customer", [{ customerId: 1, customerName: "李四" }]],
    ["inventory", [{ storeId: 1, skuName: "商品A" }]],
    ["purchase", [{ orderNo: "P001", supplierName: "供应商A" }]],
    ["finance", [{ expenseNo: "E001", amount: 500 }]],
    ["staff", [{ staffId: 1, staffName: "员工A" }]],
    ["dashboard", [{ date: "2026-07-09", orderCount: 5 }]],
  ];

  cases.forEach(([type, data]) => {
    it(`${type} 类型 + 完整 filters → csv 格式`, async () => {
      mocks.queryWithTenant.mockResolvedValue(data);
      const res: any = await exportReport(
        { report_type: type as any, format: "csv", filters: fullFilters },
        tenantId
      );
      expect(res.format).toBe("csv");
      expect(res.rowCount).toBe(data.length);
    });
  });
});

// ============ 9 种报表类型 + 空 filters + excel 格式（覆盖所有 if false 分支）============
describe("admin report-export.service - 9 种报表类型空 filters + excel", () => {
  const cases: Array<[string, any[]]> = [
    ["sales", [{ billNo: "B001" }]],
    ["collection", [{ linkNo: "L001" }]],
    ["product", [{ skuId: 1 }]],
    ["customer", [{ customerId: 1 }]],
    ["inventory", [{ storeId: 1 }]],
    ["purchase", [{ orderNo: "P001" }]],
    ["finance", [{ expenseNo: "E001" }]],
    ["staff", [{ staffId: 1 }]],
    ["dashboard", [{ date: "2026-07-09" }]],
  ];

  cases.forEach(([type, data]) => {
    it(`${type} 类型 + 空 filters → excel 格式`, async () => {
      mocks.queryWithTenant.mockResolvedValue(data);
      const res: any = await exportReport(
        { report_type: type as any, format: "excel", filters: {} },
        tenantId
      );
      expect(res.format).toBe("excel");
      expect(res.rowCount).toBe(data.length);
    });
  });
});

// ============ 异步分支 rows.length > 10000 ============
describe("admin report-export.service - 异步导出分支", () => {
  it("数据量超过 10000 行返回异步标识", async () => {
    const bigData = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    mocks.queryWithTenant.mockResolvedValue(bigData);
    const res: any = await exportReport(
      { report_type: "sales", format: "csv", filters: {} },
      tenantId
    );
    expect(res).toEqual({
      async: true,
      totalRows: 10001,
      message: "数据量超过10000行，将异步生成下载链接",
      downloadUrl: null,
    });
  });
});

// ============ generateCsv 分支 ============
describe("admin report-export.service - generateCsv 分支", () => {
  it("空数据返回空 csv", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res: any = await exportReport(
      { report_type: "sales", format: "csv", filters: {} },
      tenantId
    );
    expect(res).toEqual({ format: "csv", data: "", columns: [] });
  });

  it("指定 columns 输出指定列", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { billNo: "B001", customerName: "张三", extra: "忽略" },
    ]);
    const res: any = await exportReport(
      { report_type: "sales", format: "csv", filters: {}, columns: ["billNo", "customerName"] },
      tenantId
    );
    expect(res.columns).toEqual(["billNo", "customerName"]);
    expect(res.data).toContain("billNo,customerName");
    expect(res.data).toContain("B001,张三");
    expect(res.data).not.toContain("忽略");
  });

  it("值含逗号/引号/换行/undefined — 覆盖 includes 4 个分支 + 转义 + ?? 右分支", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      {
        normal: "正常值",
        comma: "有,逗号",
        quote: '有"引号',
        newline: "有\n换行",
        missing: undefined,
      },
    ]);
    const res: any = await exportReport(
      { report_type: "sales", format: "csv", filters: {} },
      tenantId
    );
    // 正常值不加引号
    expect(res.data).toContain("正常值");
    // 含逗号 → 加引号
    expect(res.data).toContain('"有,逗号"');
    // 含引号 → 加引号 + 转义为 ""
    expect(res.data).toContain('"有""引号"');
    // 含换行 → 加引号
    expect(res.data).toContain('"有\n换行"');
    // undefined → ?? "" → 空字符串，行末以逗号结尾表示空字段
    expect(res.data).toContain('换行",');
  });
});

// ============ generateExcel 分支 ============
describe("admin report-export.service - generateExcel 分支", () => {
  it("空数据 + 无 columns → keys 为空数组", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res: any = await exportReport(
      { report_type: "sales", format: "excel", filters: {} },
      tenantId
    );
    expect(res.format).toBe("excel");
    expect(res.columns).toEqual([]);
    expect(res.rowCount).toBe(0);
  });

  it("有数据 + 指定 columns", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { billNo: "B001", extra: "忽略" },
    ]);
    const res: any = await exportReport(
      { report_type: "sales", format: "excel", filters: {}, columns: ["billNo"] },
      tenantId
    );
    expect(res.columns).toEqual(["billNo"]);
    expect(res.rowCount).toBe(1);
  });
});
