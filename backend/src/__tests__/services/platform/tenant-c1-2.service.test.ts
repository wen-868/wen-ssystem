/**
 * C1-2 批次 A（租户域）service 级测试：
 * - tenant-status-stats.service：状态计数归类（禁止把无枚举状态算成真实计数）
 * - tenant-ops.service：代登录（事由校验 + 同机制令牌 + 留痕）、临时扩容（幅度/有效期校验 + 落 KV + 留痕）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  insertPlatformAuditLog: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: mocks.insertPlatformAuditLog,
}));

import { getTenantStatusStats } from "../../../services/platform/tenant-status-stats.service";
import {
  PROXY_LOGIN_TTL_SECONDS,
  QUOTA_EXPAND_CONFIG_KEY,
  expandTenantQuota,
  proxyLogin,
} from "../../../services/platform/tenant-ops.service";

const OPERATOR = { id: 7, name: "platform_admin" };

describe("tenant-status-stats.service（C1-2 A1）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("按真实枚举归类：ACTIVE/1→正常、DISABLED/0→停用、EXPIRED→已到期，未知值进 unmapped", async () => {
    mocks.query.mockResolvedValueOnce([
      { statusValue: "ACTIVE", total: "3" },
      { statusValue: "DISABLED", total: "2" },
      { statusValue: "EXPIRED", total: 1 },
      { statusValue: 1, total: "4" },
      { statusValue: 0, total: "5" },
      { statusValue: "SUSPENDED", total: "6" },
    ]);

    const stats = await getTenantStatusStats();

    expect(stats.total).toBe(21);
    expect(stats.counts.normal).toBe(7); // ACTIVE 3 + '1' 4
    expect(stats.counts.frozen).toBe(7); // DISABLED 2 + '0' 5
    expect(stats.counts.expired).toBe(1);
    // 设计稿四态中「欠费/已注销」后端无枚举 → 恒 0，不编造
    expect(stats.counts.owed).toBe(0);
    expect(stats.counts.cancelled).toBe(0);
    expect(stats.unmapped).toEqual([{ status: "SUSPENDED", count: 6 }]);
    expect(stats.byStatus).toHaveLength(6);

    const [sql] = mocks.query.mock.calls[0] as [string];
    expect(sql).toContain("FROM t_tenant");
    expect(sql).toContain("GROUP BY status");
  });
});

describe("tenant-ops.service · proxyLogin（C1-2 A4）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("事由缺失/过短 → 400，且不查库、不写留痕", async () => {
    await expect(proxyLogin("tenant_1", { reason: "" }, OPERATOR, null)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(proxyLogin("tenant_1", { reason: "x" }, OPERATOR, null)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("租户不存在 → 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(
      proxyLogin("tenant_404", { reason: "客户报障排查" }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("成功：下发商家机制同源令牌（issuer/audience 一致、30 分钟）并写平台审计留痕", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: "tenant_1",
        tenantCode: "T001",
        tenantName: "测试租户",
        tenantId: "tenant_1",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({ id: 11, username: "admin", realName: "管理员", role: "ADMIN" });
    mocks.insertPlatformAuditLog.mockResolvedValueOnce(88);

    const result = await proxyLogin(
      "tenant_1",
      { reason: "客户报障排查" },
      OPERATOR,
      "10.0.0.9"
    );

    expect(result.auditLogId).toBe(88);
    expect(result.loginUsername).toBe("admin");
    expect(result.expiresInSeconds).toBe(PROXY_LOGIN_TTL_SECONDS);

    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string, {
      algorithms: ["HS256"],
      issuer: "zhixiang-system",
      audience: "zhixiang-client",
    }) as Record<string, unknown>;
    expect(decoded.tenantId).toBe("tenant_1");
    expect(decoded.proxy).toBe(true);
    expect(decoded.proxyOperator).toBe("platform_admin");
    expect(Number((jwt.decode(result.token) as Record<string, unknown>).exp) -
      Number((jwt.decode(result.token) as Record<string, unknown>).iat)).toBe(
      PROXY_LOGIN_TTL_SECONDS
    );

    // 留痕三段证据之一：写函数入参（表/列见 audit service 测试与回执）
    expect(mocks.insertPlatformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 7,
        adminName: "platform_admin",
        module: "tenant",
        action: "PROXY_LOGIN",
        targetType: "tenant",
        targetId: "tenant_1",
        ip: "10.0.0.9",
      })
    );
  });

  it("指定账号不存在 → 404", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: "tenant_1",
        tenantCode: "T001",
        tenantName: "测试租户",
        tenantId: "tenant_1",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce(null);

    await expect(
      proxyLogin("tenant_1", { reason: "排查问题", username: "nobody" }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("tenant-ops.service · expandTenantQuota（C1-2 A5）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("维度非法 / 幅度非法 / 有效期非法 → 400，且不落库、不留痕", async () => {
    await expect(
      expandTenantQuota("tenant_1", { field: "cpu", amount: 1, days: 7 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      expandTenantQuota("tenant_1", { field: "storage", amount: 0, days: 7 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      expandTenantQuota("tenant_1", { field: "storage", amount: 1.5, days: 7 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      expandTenantQuota("tenant_1", { field: "storage", amount: 1_000_001, days: 7 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      expandTenantQuota("tenant_1", { field: "storage", amount: 10, days: 0 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      expandTenantQuota("tenant_1", { field: "storage", amount: 10, days: 366 }, OPERATOR, null)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("成功（首次）：落 t_tenant_config（不新建表）+ 写平台审计留痕", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({
        id: "tenant_1",
        tenantCode: "T001",
        tenantName: "测试租户",
        tenantId: "tenant_1",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce(null); // 无既有扩容记录
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.insertPlatformAuditLog.mockResolvedValueOnce(89);

    const result = await expandTenantQuota(
      "tenant_1",
      { field: "storage", amount: 10, days: 7, reason: "活动期临时扩容" },
      OPERATOR,
      "10.0.0.9"
    );

    expect(result.auditLogId).toBe(89);
    expect(result.field).toBe("storage");
    expect(result.amount).toBe(10);
    expect(result.records).toHaveLength(1);

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_tenant_config");
    expect(params[0]).toBe("tenant_1");
    expect(params[1]).toBe(QUOTA_EXPAND_CONFIG_KEY);
    const saved = JSON.parse(String(params[2]));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved[0]).toMatchObject({ field: "storage", amount: 10, days: 7 });

    expect(mocks.insertPlatformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "tenant",
        action: "QUOTA_EXPAND",
        targetId: "tenant_1",
        ip: "10.0.0.9",
      })
    );
  });

  it("成功（追加）：既有记录解析后追加，UPDATE 而非重复 INSERT", async () => {
    const existingRecord = {
      field: "storage",
      amount: 5,
      days: 3,
      reason: "",
      effectiveFrom: "2026-09-01 10:00:00",
      expireAt: "2026-09-04 10:00:00",
      operator: "platform_admin",
      createdAt: "2026-09-01 10:00:00",
    };
    mocks.queryOne
      .mockResolvedValueOnce({
        id: "tenant_1",
        tenantCode: "T001",
        tenantName: "测试租户",
        tenantId: "tenant_1",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({ id: 5, config_value: JSON.stringify([existingRecord]) });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.insertPlatformAuditLog.mockResolvedValueOnce(90);

    const result = await expandTenantQuota(
      "tenant_1",
      { field: "products", amount: 200, days: 30 },
      OPERATOR,
      null
    );

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE t_tenant_config");
    expect(params[2]).toBe(5); // WHERE id = 5
    expect(result.records).toHaveLength(2);
    expect(JSON.parse(String(params[0]))).toHaveLength(2);
  });
});
