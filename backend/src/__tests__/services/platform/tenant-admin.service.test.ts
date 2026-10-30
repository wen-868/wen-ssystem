/**
 * 平台租户管理 service 单元测试（MS-SECURITY-BASELINE-01）
 * 被测文件：src/services/platform/tenant-admin.service.ts
 * 关注点：创建租户时默认管理员不再使用硬编码口令 "123456"，
 *         改为随机一次性初始口令，并在创建响应中返回一次。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  connQuery: vi.fn(),
  hashPassword: vi.fn(),
  makeBizNo: vi.fn(),
  provisionTenantRbac: vi.fn(),
  bindTenantAdminToOwnSuperAdmin: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: (fn: (conn: unknown) => Promise<unknown>) =>
    fn({ query: mocks.connQuery }),
}));

vi.mock("../../../shared/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("../../../services/platform/tenant-rbac-provision.service", () => ({
  provisionTenantRbac: mocks.provisionTenantRbac,
  bindTenantAdminToOwnSuperAdmin: mocks.bindTenantAdminToOwnSuperAdmin,
}));

import { createPlatformTenant } from "../../../services/platform/tenant-admin.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connQuery.mockResolvedValue([{ insertId: 1 }]);
  mocks.provisionTenantRbac.mockResolvedValue(undefined);
  mocks.bindTenantAdminToOwnSuperAdmin.mockResolvedValue(undefined);
  mocks.makeBizNo.mockReturnValue("SUB1");
  mocks.hashPassword.mockResolvedValue("hashed");
});

describe("tenant-admin.service - createPlatformTenant（MS-SECURITY-BASELINE-01）", () => {
  it("创建租户时管理员口令为随机一次性凭据，不再使用默认 123456", async () => {
    const res = await createPlatformTenant({
      tenantName: "测试租户",
      tenantCode: "T-SEC01",
      contactName: "联系人",
      contactPhone: "13800000000",
    } as never);

    // hashPassword 收到的是生成的随机口令，而非 "123456"
    const [calledPassword] = mocks.hashPassword.mock.calls[0];
    expect(calledPassword).not.toBe("123456");
    expect(calledPassword).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]{12}$/);

    // 落库的是哈希
    const adminInsert = mocks.connQuery.mock.calls
      .map((c) => c[0] as string)
      .findIndex((sql) => sql.includes("INSERT INTO t_sys_user"));
    expect(adminInsert).toBeGreaterThanOrEqual(0);
    expect(mocks.connQuery.mock.calls[adminInsert][1]).toContain("hashed");

    // 一次性初始口令仅在创建响应中返回一次
    expect(res.adminInitialPassword).toBe(calledPassword);
  });

  it("两次创建租户得到不同的初始口令（随机性）", async () => {
    const r1 = await createPlatformTenant({
      tenantName: "租户A", tenantCode: "T-A", contactName: "c", contactPhone: "13800000000",
    } as never);
    const r2 = await createPlatformTenant({
      tenantName: "租户B", tenantCode: "T-B", contactName: "c", contactPhone: "13800000000",
    } as never);
    expect(r1.adminInitialPassword).not.toBe(r2.adminInitialPassword);
  });
});
