import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() }
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { runDailyAggregation } from "../../jobs/report-aggregation.job";

describe("report-aggregation.job", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("runDailyAggregation", () => {
    it("应正常执行汇总任务", async () => {
      // getTenants 返回租户列表
      (queryWithTenant as any).mockImplementation((sql: string) => {
        if (sql.includes("DISTINCT tenant_id")) return Promise.resolve([{ tenant_id: "t1" }]);
        if (sql.includes("FROM t_store")) return Promise.resolve([{ id: 1 }]);
        if (sql.includes("t_sale_bill_item")) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      // 所有 queryOneWithTenant 返回默认值
      (queryOneWithTenant as any).mockResolvedValue({ cnt: 0, orderCount: 0, customerCount: 0 });

      await expect(runDailyAggregation()).resolves.not.toThrow();
    });

    it("当无租户时应快速完成", async () => {
      (queryWithTenant as any).mockResolvedValue([]);
      (queryOneWithTenant as any).mockResolvedValue({});

      await expect(runDailyAggregation()).resolves.not.toThrow();
      expect(queryWithTenant).toHaveBeenCalled();
    });

    it("当数据库查询出错时应捕获错误", async () => {
      (queryWithTenant as any).mockRejectedValue(new Error("DB连接失败"));

      await expect(runDailyAggregation()).resolves.not.toThrow();
    });
  });
});
