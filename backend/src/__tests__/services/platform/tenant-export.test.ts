/**
 * TOTAL-TENANT-NAME-SERVER-TRUTH-01 · 导出同源契约测试（服务端阶段）
 *
 * 被测：src/services/platform/tenant-export.service.ts
 *   · listTenantsForExport 与列表接口同源（同一 listTenants + 同一 enrichTenantRecords 单点）；
 *   · toCsvRows 租户名称列走同一回退链（tenantName→name→companyName→「未命名租户」），不落「—」；
 *   · tenantCode/contactMobile 空值透传为空串（formatCell null → ""），不冒充。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  listTenants: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

vi.mock("../../../services/platform-tenant.service", () => ({
  listTenants: mocks.listTenants,
}));

import {
  listTenantsForExport,
  toCsvRows,
  formatCell,
  TENANT_EXPORT_COLUMNS,
} from "../../../services/platform/tenant-export.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([]);
});

describe("tenant-export - 导出与列表同源（TOTAL-TENANT-NAME-SERVER-TRUTH-01）", () => {
  it("listTenantsForExport 走同一 listTenants，且出口经 enrichTenantRecords 补齐真源三字段", async () => {
    mocks.listTenants.mockResolvedValue({
      total: 2,
      records: [
        { id: "t1", tenantName: "酒行A", tenantCode: "T001", contactName: "张三", contactMobile: "138", contactEmail: "", status: "ACTIVE", expireAt: null, createdAt: "2026-01-01" },
        { id: "t2", tenantName: null, tenantCode: "", contactName: "李四", contactMobile: null, contactEmail: null, status: "ACTIVE", expireAt: null, createdAt: "2026-01-02" },
      ],
    });
    mocks.query.mockResolvedValue([
      { id: "t1", tenantName: "酒行A", name: "酒行A公司全称", companyName: "酒行A公司全称" },
      { id: "t2", tenantName: null, name: "存量真名", companyName: null },
    ]);
    const res = await listTenantsForExport();
    expect(mocks.listTenants).toHaveBeenCalledWith(1, expect.any(Number), undefined);
    expect(res.exported).toBe(2);
    expect(res.columns).toEqual([...TENANT_EXPORT_COLUMNS]);
    expect(res.records[0].name).toBe("酒行A公司全称");
    expect(res.records[0].tenantDisplayName).toBe("酒行A");
    expect(res.records[1].tenantDisplayName).toBe("存量真名");
  });

  it("toCsvRows：租户名称列与列表同一回退链，全空 → 「未命名租户」，且全行不出现「—」", () => {
    const rows = toCsvRows([
      {
        id: "t1", tenantName: "酒行A", tenantCode: "T001", contactName: "张三",
        contactMobile: "138", contactEmail: "", status: "ACTIVE", expireAt: null, createdAt: "2026-01-01",
        name: "酒行A公司全称", companyName: "酒行A公司全称", tenantDisplayName: "酒行A",
      },
      {
        id: "t2", tenantName: null as unknown as string, tenantCode: "", contactName: "李四",
        contactMobile: null as unknown as string, contactEmail: null as unknown as string,
        status: "ACTIVE", expireAt: null, createdAt: "2026-01-02",
        name: null as unknown as string, companyName: null as unknown as string,
        tenantDisplayName: "未命名租户",
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0][2]).toBe("酒行A");
    expect(rows[1][2]).toBe("未命名租户");
    // 标识/联系字段空值透传为空串，不冒充「—」
    expect(rows[1][1]).toBe("");
    expect(rows[1][4]).toBe("");
    expect(rows[1][5]).toBe("");
    for (const row of rows) {
      for (const cell of row) {
        expect(cell).not.toContain("—");
      }
    }
  });

  it("toCsvRows：未补齐字段的裸记录也能按回退链复算（tenantName→name→companyName）", () => {
    const rows = toCsvRows([
      {
        id: "t3", tenantName: "", contactName: "", contactMobile: "", contactEmail: "",
        status: "ACTIVE", expireAt: null, createdAt: "",
        name: "公司名列", companyName: null as unknown as string,
      } as never,
    ]);
    expect(rows[0][2]).toBe("公司名列");
  });

  it("formatCell：null/undefined → 空串（不是「—」）", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
    expect(formatCell("—")).toBe("—"); // 真值原样，不主动加工
  });
});
