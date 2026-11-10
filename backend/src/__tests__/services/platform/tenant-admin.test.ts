/**
 * TOTAL-TENANT-NAME-SERVER-TRUTH-01 · 租户名称真源单点契约测试（服务端阶段）
 *
 * 被测：src/services/platform/tenant-admin.service.ts 的名称真源单点实现
 *   · resolveTenantDisplayName：回退链 tenantName → name → companyName，全空 → 「未命名租户」；
 *   · isBlankNameValue：null/空白/「—」占位都算空（占位清零）；
 *   · loadTenantNameTruthMap：一条 IN 参数绑定查询，id 去重、空列表短路；
 *   · enrichTenantRecords：补齐 name/companyName/tenantDisplayName 三字段；
 *   · legacy 列表/详情（listPlatformTenants / getPlatformTenantDetail）同一回退规则。
 *
 * 前端对齐：saas-admin TenantList/TenantDetail（UI 阶段）将用同一规则计算单一
 * tenantDisplayName——本文件锁死后端出口语义。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

import {
  TENANT_DISPLAY_NAME_FALLBACK,
  isBlankNameValue,
  resolveTenantDisplayName,
  loadTenantNameTruthMap,
  enrichTenantRecords,
  listPlatformTenants,
  getPlatformTenantDetail,
} from "../../../services/platform/tenant-admin.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([]);
  mocks.queryOne.mockResolvedValue(null);
});

describe("resolveTenantDisplayName - 名称回退链单点（TOTAL-TENANT-NAME-SERVER-TRUTH-01）", () => {
  it("回退链顺序：tenantName → name → companyName，真名原样透出（仅去首尾空白）", () => {
    expect(resolveTenantDisplayName("酒行A", "酒行A公司全称", "某公司")).toBe("酒行A");
    expect(resolveTenantDisplayName("  酒行A  ", "酒行A公司全称", "某公司")).toBe("酒行A");
    expect(resolveTenantDisplayName(null, "酒行A公司全称", "某公司")).toBe("酒行A公司全称");
    expect(resolveTenantDisplayName("", undefined, "某公司")).toBe("某公司");
  });

  it("全空（null/空白/「—」占位混排）→ 「未命名租户」，任何情况不得出现「—」", () => {
    expect(resolveTenantDisplayName(null, null, null)).toBe("未命名租户");
    expect(resolveTenantDisplayName("", "  ", "—")).toBe("未命名租户");
    expect(resolveTenantDisplayName("—", null, undefined)).toBe("未命名租户");
    expect(resolveTenantDisplayName()).toBe(TENANT_DISPLAY_NAME_FALLBACK);
    expect(resolveTenantDisplayName(null, null, null)).not.toContain("—");
  });

  it("isBlankNameValue：null/undefined/空串/纯空白/「—」为空；其余（含 0）非空", () => {
    for (const v of [null, undefined, "", "   ", "—"]) {
      expect(isBlankNameValue(v)).toBe(true);
    }
    expect(isBlankNameValue("默认租户")).toBe(false);
    expect(isBlankNameValue(0)).toBe(false);
  });
});

describe("loadTenantNameTruthMap - 真值批量读取（IN 参数绑定）", () => {
  it("拼接 IN(?,?) 占位且参数逐个绑定；id 去重；SQL 必须读全名称真值三列", async () => {
    mocks.query.mockResolvedValue([
      { id: "t1", tenantName: "酒行A", name: "酒行A公司全称", companyName: null },
    ]);
    const map = await loadTenantNameTruthMap(["t1", "t1", "t2"]);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_tenant");
    expect(sql).toContain("IN (?, ?)");
    // SQL 形状契约：真值查询必须同时读 tenant_name / name / company_name 三列
    //（删任一列即回退链残缺，mutation MA 点名红）
    expect(sql).toContain("tenant_name AS tenantName");
    expect(sql).toContain("name, company_name AS companyName");
    expect(mocks.query.mock.calls[0][1]).toEqual(["t1", "t2"]);
    expect(map.get("t1")?.name).toBe("酒行A公司全称");
  });

  it("空 id 列表直接短路，不落库", async () => {
    const map = await loadTenantNameTruthMap([]);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });
});

describe("enrichTenantRecords - 出口补齐名称真源三字段", () => {
  it("真名透出：tenantName 有值时 tenantDisplayName=tenantName，name/companyName 真值同出", async () => {
    mocks.query.mockResolvedValue([
      { id: "t1", tenantName: "酒行A", name: "酒行A公司全称", companyName: "酒行A公司全称" },
    ]);
    const [row] = await enrichTenantRecords([{ id: "t1", tenantName: "酒行A", tenantCode: "T001" }]);
    expect(row.name).toBe("酒行A公司全称");
    expect(row.companyName).toBe("酒行A公司全称");
    expect(row.tenantDisplayName).toBe("酒行A");
  });

  it("空名回退：tenant_name 空但 name 有值 → 回退 name；真值查询无该 id → 按自身 tenantName 兜底", async () => {
    mocks.query.mockResolvedValue([
      { id: "t1", tenantName: null, name: "存量真名", companyName: null },
    ]);
    const [hit] = await enrichTenantRecords([
      { id: "t1", tenantName: null as unknown as string, tenantCode: "T001" },
      { id: "t9", tenantName: "自身兜底名", tenantCode: "T009" },
    ]);
    expect(hit.tenantDisplayName).toBe("存量真名");
    expect(hit.name).toBe("存量真名");
    expect(hit.tenantDisplayName).not.toBe("—");
  });

  it("全空名 → 「未命名租户」（后端出口语义与前端单点 helper 对齐）", async () => {
    mocks.query.mockResolvedValue([
      { id: "t1", tenantName: null, name: "", companyName: "—" },
    ]);
    const [row] = await enrichTenantRecords([{ id: "t1", tenantName: null as unknown as string, tenantCode: "T001" }]);
    expect(row.tenantDisplayName).toBe("未命名租户");
    expect(JSON.stringify(row)).not.toContain("—");
  });
});

describe("legacy 列表/详情 - 与单点同一回退规则", () => {
  it("listPlatformTenants：SELECT 读真名三列，记录带 tenantDisplayName", async () => {
    mocks.query.mockResolvedValue([
      {
        id: 1, tenantId: "tenant_1", tenantName: "酒行A", name: "酒行A公司全称",
        companyName: null, tenantCode: "T001", contactName: "张三", contactPhone: "138",
        contactEmail: null, status: "ACTIVE", userCount: 0, storeCount: 0,
        createdAt: new Date(), expireAt: null, planCode: null, planName: null,
        startDate: null, endDate: null, subscriptionStatus: null,
      },
    ]);
    mocks.queryOne.mockResolvedValue({ total: 1 });
    const res = await listPlatformTenants(1, 20);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("t.tenant_name AS tenantName");
    expect(sql).toContain("t.name");
    expect(sql).toContain("t.company_name AS companyName");
    expect(res.records[0].tenantDisplayName).toBe("酒行A");
  });

  it("getPlatformTenantDetail：详情与列表同一 tenantDisplayName 口径", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: 1, tenantId: "tenant_1", tenantName: null, name: "存量真名", companyName: null,
        tenantCode: "T001", contactName: "张三", contactPhone: "138", contactEmail: null,
        status: "ACTIVE", userCount: 0, storeCount: 0, createdAt: new Date(),
        expireAt: null, remark: null,
      })
      .mockResolvedValue(null);
    mocks.query.mockResolvedValue([]);
    const detail = await getPlatformTenantDetail("tenant_1");
    expect(detail?.tenantDisplayName).toBe("存量真名");
    expect(detail?.name).toBe("存量真名");
    expect(detail?.tenantDisplayName).not.toBe("—");
  });
});
