/**
 * S3-172：平台超管「代重置租户账号口令」service 单测
 * 被测：src/services/platform/tenant-ops.service.ts 的 resetTenantUserPassword()
 *
 * 盯死三件事：
 *  ① **跨租户必须拒**（`WHERE id = ? AND tenant_id = ?` 双条件，不命中 ⇒ 404，不 UPDATE、不写审计）；
 *  ② 口令服务端生成、只落哈希、**明文只回传一次**（审计明细里不得出现明文）；
 *  ③ **不得假成功**（S3-65 教训）：UPDATE 受影响行数 0 ⇒ 抛错；mock 的 `[header]` 与
 *     生产 mysql2 的 ResultSetHeader 对象两种形态都必须认。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyPassword } from "../../../shared/password";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: mocks.audit,
}));

import { resetTenantUserPassword } from "../../../services/platform/tenant-ops.service";

const operator = { id: 1, name: "凌舟" };
const TENANT_ROW = {
  id: "default",
  tenantCode: "T20260623001",
  tenantName: "智享全链酒业有限公司",
  tenantId: "default",
  status: "ACTIVE",
};
const USER_ROW = { id: 3, username: "demo", realName: "演示账号" };

beforeEach(() => {
  mocks.query.mockReset();
  mocks.queryOne.mockReset();
  mocks.audit.mockReset();
  mocks.audit.mockResolvedValue(77);
});

describe("S3-172 · resetTenantUserPassword（平台代重置租户账号口令）", () => {
  it("命中：返回一次性口令 + 只落哈希 + 审计留痕（明细不含明文）", async () => {
    mocks.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(USER_ROW);
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);

    const res = await resetTenantUserPassword("default", 3, operator, "10.0.0.9");

    expect(res).toMatchObject({
      tenantId: "default",
      tenantCode: "T20260623001",
      userId: 3,
      username: "demo",
      realName: "演示账号",
      passwordShownOnce: true,
      auditLogId: 77,
    });
    expect(res.initialPassword).toHaveLength(12);

    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("UPDATE t_sys_user");
    expect(String(sql)).toContain("password_hash = ?");
    // 重置口令同时清空锁定状态（否则「重置了仍登不上」＝假修复）
    expect(String(sql)).toContain("login_fail_count = 0");
    expect(String(sql)).toContain("locked_until = NULL");
    // ★ 跨租户防御落在 SQL 上：id 与 tenant_id 必须同时命中
    expect(String(sql)).toContain("WHERE id = ? AND tenant_id = ?");
    // 落库的是哈希（可用明文验通），不是明文。
    // 注意：产品哈希出自 shared/password.ts 的 hashPassword()，带 `v2$` 版本前缀，
    // 裸 bcrypt.compareSync 认不出该前缀（必然 false）——必须走项目校验入口 verifyPassword()。
    expect(params[0]).not.toBe(res.initialPassword);
    expect(String(params[0]).startsWith("v2$")).toBe(true);
    await expect(verifyPassword(res.initialPassword, String(params[0]))).resolves.toBe(true);
    expect(params[1]).toBe(3);
    expect(params[2]).toBe("default");

    const auditInput = mocks.audit.mock.calls[0][0] as Record<string, unknown>;
    expect(auditInput).toMatchObject({
      adminId: 1,
      adminName: "凌舟",
      module: "tenant",
      action: "RESET_TENANT_USER_PASSWORD",
      auditType: "RESET_TENANT_USER_PASSWORD",
      targetType: "tenant_user",
      targetId: 3,
      ip: "10.0.0.9",
    });
    // 明文口令只允许出现在响应体里一次，不得进审计明细
    expect(JSON.stringify(auditInput)).not.toContain(res.initialPassword);
  });

  it("② 跨租户必须拒：userId 不属于该 tenantId ⇒ 404，且不 UPDATE、不写审计", async () => {
    mocks.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(null);

    await expect(
      resetTenantUserPassword("default", 99, operator, null)
    ).rejects.toMatchObject({ statusCode: 404, message: "该租户下不存在该账号" });

    const [userSql, userParams] = mocks.queryOne.mock.calls[1];
    expect(String(userSql)).toContain("t_sys_user");
    expect(String(userSql)).toContain("WHERE id = ? AND tenant_id = ?");
    expect(userParams).toEqual([99, "default"]);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("租户不存在 ⇒ 404，且不落到账号查询", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(
      resetTenantUserPassword("none", 3, operator, null)
    ).rejects.toMatchObject({ statusCode: 404, message: "租户不存在" });

    expect(mocks.queryOne).toHaveBeenCalledTimes(1);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("③ 不得假成功：UPDATE 命中 0 行 ⇒ 抛错且不写审计", async () => {
    mocks.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(USER_ROW);
    mocks.query.mockResolvedValue([{ affectedRows: 0 }]);

    await expect(
      resetTenantUserPassword("default", 3, operator, null)
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("③ 生产形态（mysql2 返回 ResultSetHeader 对象，非数组）同样按 affectedRows 判定", async () => {
    mocks.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(USER_ROW);
    mocks.query.mockResolvedValue({ affectedRows: 1 } as never);
    await expect(resetTenantUserPassword("default", 3, operator, null)).resolves.toMatchObject({
      userId: 3,
    });

    mocks.query.mockReset();
    mocks.query.mockResolvedValue({ affectedRows: 0 } as never);
    mocks.queryOne.mockResolvedValueOnce(TENANT_ROW).mockResolvedValueOnce(USER_ROW);
    await expect(
      resetTenantUserPassword("default", 3, operator, null)
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("userId 非正整数 ⇒ 400，且不查库", async () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(
        resetTenantUserPassword("default", bad, operator, null)
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
