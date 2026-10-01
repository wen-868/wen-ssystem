import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed_password") },
}));

import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  toggleTenantStatus,
  createTenant,
} from "../../services/platform-tenant.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ insertId: 0 });
});

describe("platform-tenant.service - 平台租户管理", () => {
  it("listTenants 无关键词返回全量分页", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([{ id: 1, tenantName: "酒行A" }]);
    const res = await listTenants(1, 20);
    expect(res.total).toBe(1);
    expect(res.records[0].tenantName).toBe("酒行A");
    expect(mocks.query.mock.calls[0][0]).toContain("LIMIT ? OFFSET ?");
  });

  it("listTenants 带关键词时拼接 LIKE 条件", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    mocks.query.mockResolvedValue([]);
    await listTenants(2, 10, "酒");
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("tenant_name LIKE ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["%酒%", 10, 10]);
  });

  it("getTenantById 返回租户详情", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, tenantName: "酒行A", status: "ACTIVE" });
    const res = await getTenantById(1);
    expect(res?.tenantName).toBe("酒行A");
  });

  it("checkTenantNameExists 命中返回 true，未命中 false", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 });
    expect(await checkTenantNameExists("酒行A")).toBe(true);
    mocks.queryOne.mockResolvedValueOnce(null);
    expect(await checkTenantNameExists("不存在")).toBe(false);
  });

  it("toggleTenantStatus 更新状态", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await toggleTenantStatus(1, "SUSPENDED");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("UPDATE t_tenant");
    expect(params).toEqual(["SUSPENDED", 1]);
  });

  describe("createTenant（S3-144 A 项真缺陷修复）", () => {
    const input = {
      tenantName: "测试租户",
      contactName: "张三",
      contactMobile: "13800000000",
      adminUsername: "admin",
      adminPassword: "Pass@1234",
    };

    it("返回真实 UUID（非 0 insertId）且补齐 NOT NULL 列", async () => {
      const tenantId = await createTenant(input);

      // 真实 tenant_id 由应用层生成，绝不是 MySQL insertId（VARCHAR 主键下恒 0）
      expect(tenantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(tenantId).not.toBe("0");

      const [sql, params] = mocks.query.mock.calls[0];
      expect(String(sql)).toContain("INSERT INTO t_tenant");
      for (const column of [
        "id",
        "tenant_code",
        "name",
        "company_name",
        "contact_person",
        "contact_mobile",
        "source",
      ]) {
        expect(String(sql)).toContain(column);
      }
      // 数值状态（t_tenant.status 是 TINYINT），来源固定 MANUAL（平台侧开租户不是归因宿主）
      expect(String(sql)).toContain("'MANUAL', 1");
      expect(params[0]).toBe(tenantId);
      expect(params[1]).toMatch(/^T\d{8}\d{5}$/);
    });

    it("租户编码按 T+日期+随机 生成且同批两次不同", async () => {
      await createTenant(input);
      await createTenant({ ...input, tenantName: "测试租户2" });
      const code1 = mocks.query.mock.calls[0][1][1];
      const code2 = mocks.query.mock.calls[2][1][1];
      expect(code1).not.toBe(code2);
    });

    it("管理员账号落在新租户下（tenant_id 用同一个 UUID）", async () => {
      const tenantId = await createTenant(input);
      const userInsert = mocks.query.mock.calls[1];
      expect(String(userInsert[0])).toContain("INSERT INTO t_sys_user");
      expect(userInsert[1][0]).toBe(tenantId);
    });
  });
});
