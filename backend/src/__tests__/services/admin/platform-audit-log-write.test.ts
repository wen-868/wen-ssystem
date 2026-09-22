/**
 * C1-2：平台审计日志「写入」函数测试
 * 目标：证明写函数落地的是**仓库 DDL 真实存在的列**，且 detail 承载 type/description。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getAuditLogById,
  insertPlatformAuditLog,
} from "../../../services/admin/platform-audit-log.service";

describe("platform-audit-log.service · insertPlatformAuditLog（C1-2 新增写函数）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("只写 DDL 存在的列：admin_id/admin_name/action/target_type/target_id/detail/ip/module", async () => {
    mocks.query.mockResolvedValueOnce({ insertId: 42 });

    const id = await insertPlatformAuditLog({
      adminId: 7,
      adminName: "platform_admin",
      module: "tenant",
      auditType: "PROXY_LOGIN",
      action: "PROXY_LOGIN",
      targetType: "tenant",
      targetId: "tenant_1",
      description: "代登录租户「测试租户」",
      detail: { reason: "客户报障排查", ttlSeconds: 1800 },
      ip: "10.0.0.9",
    });

    expect(id).toBe(42);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_platform_audit_log");
    for (const column of ["admin_id", "admin_name", "action", "target_type", "target_id", "detail", "ip", "module"]) {
      expect(sql).toContain(column);
    }
    // detail / user_agent / type / description 列在仓库 DDL 不存在 → 不得出现在写入列表
    expect(sql).not.toMatch(/\(\s*admin_id,\s*admin_name,\s*action,\s*target_type,\s*target_id,\s*detail,\s*ip,\s*module,\s*type/);
    expect(params).toEqual([
      7,
      "platform_admin",
      "PROXY_LOGIN",
      "tenant",
      "tenant_1",
      expect.any(String),
      "10.0.0.9",
      "tenant",
    ]);
    const detail = JSON.parse(String(params[5]));
    expect(detail.type).toBe("PROXY_LOGIN");
    expect(detail.description).toContain("代登录租户");
    expect(detail.reason).toBe("客户报障排查");
  });

  it("可选字段缺省时写入 null 占位（不产生 undefined 参数）", async () => {
    mocks.query.mockResolvedValueOnce({ insertId: 0 });

    await insertPlatformAuditLog({
      adminId: 1,
      adminName: "admin",
      module: "plan",
      action: "PLAN_COPY",
    });

    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBeNull();
    expect(params[4]).toBeNull();
    expect(params[6]).toBeNull();
  });

  it("既有读函数未被改动（仍按原列读取，签名不变）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 });
    await getAuditLogById(1);
    const [sql, params] = mocks.queryOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM t_platform_audit_log WHERE id = ?");
    expect(params).toEqual([1]);
  });
});
