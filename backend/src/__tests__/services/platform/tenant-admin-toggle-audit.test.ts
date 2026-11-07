/**
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01 · legacy 写路径审计测试
 *
 * legacy 路径：services/platform/tenant-admin.service.ts::updatePlatformTenant 的
 * status 写分支（控制器 platform.controller.ts::updateTenant → PUT /:tenantId）。
 * 判据：status 写分支必留 TENANT_TOGGLE 痕（SUCCESS/FAILED）；纯资料更新不留痕；
 * 未知租户 + status ⇒ FAILED 行 + 原语义 404；审计上下文缺省按 api/自生成 traceId 补齐。
 */
import { vi, describe, it, beforeEach, expect } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: vi.fn(async () => 1),
  listAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
}));

import { insertPlatformAuditLog } from "../../../services/admin/platform-audit-log.service";
import { updatePlatformTenant } from "../../../services/platform/tenant-admin.service";

const CTX = {
  operatorId: 7,
  operatorName: "super01",
  source: "ui" as const,
  traceId: "trace-legacy-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ affectedRows: 1 });
});

describe("TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01 · legacy updatePlatformTenant status 写分支审计", () => {
  it("带 status 更新 ⇒ SUCCESS 行（含 fromStatus/目标名/操作者/traceId），返回值契约不变", async () => {
    mocks.queryOne.mockResolvedValue({ id: 3, tenantName: "legacy租户", status: 1 });

    const result = await updatePlatformTenant("tenant_x", { status: "DISABLED" }, CTX);

    expect(result).toEqual({ tenantId: "tenant_x", updated: true });
    const rows = (insertPlatformAuditLog.mock.calls as Array<[Record<string, unknown>]>).map(
      (c) => c[0]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      adminId: 7,
      adminName: "super01",
      module: "tenant",
      action: "TENANT_TOGGLE",
      targetType: "tenant",
      targetId: "tenant_x",
    });
    expect(rows[0].detail).toMatchObject({
      result: "SUCCESS",
      fromStatus: "1",
      toStatus: "DISABLED",
      targetTenantName: "legacy租户",
      source: "ui",
      traceId: "trace-legacy-01",
    });
    const updateCall = (mocks.query.mock.calls as Array<[string, unknown[]]>)[0];
    expect(updateCall[0]).toContain("UPDATE t_tenant SET");
    expect(updateCall[1]).toContain("DISABLED");
  });

  it("纯资料更新（无 status）⇒ 不留 TENANT_TOGGLE 痕（不误记启停）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 3, tenantName: "legacy租户", status: 1 });

    await updatePlatformTenant("tenant_x", { tenantName: "改名" }, CTX);

    expect(insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("未知租户 + status ⇒ FAILED 行（tenant_not_found）+ 原语义 404", async () => {
    mocks.queryOne.mockResolvedValue(null);

    await expect(updatePlatformTenant("ghost", { status: "ACTIVE" }, CTX)).rejects.toMatchObject({
      statusCode: 404,
      message: "租户不存在",
    });

    const rows = (insertPlatformAuditLog.mock.calls as Array<[Record<string, unknown>]>).map(
      (c) => c[0]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toMatchObject({
      result: "FAILED",
      failReason: "tenant_not_found(404)",
      toStatus: "ACTIVE",
      traceId: "trace-legacy-01",
    });
    // 未 UPDATE（预读即 404）
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("纯资料更新打未知租户 ⇒ 404 但不留启停痕（404 留痕仅限 status 写分支）", async () => {
    mocks.queryOne.mockResolvedValue(null);

    await expect(updatePlatformTenant("ghost", { tenantName: "改名" }, CTX)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("审计上下文缺省（frozen 控制器未注入）⇒ 仍留痕：source=api、traceId 自生成非空", async () => {
    mocks.queryOne.mockResolvedValue({ id: 3, tenantName: "legacy租户", status: 0 });

    const result = await updatePlatformTenant("tenant_x", { status: "ACTIVE" });

    expect(result).toEqual({ tenantId: "tenant_x", updated: true });
    const row = (insertPlatformAuditLog.mock.calls as Array<[Record<string, unknown>]>)[0][0];
    expect(row.detail).toMatchObject({
      result: "SUCCESS",
      fromStatus: "0",
      toStatus: "ACTIVE",
      source: "api",
      // legacy 口径：raw 值 "0" 与 "ACTIVE" 字面不同 ⇒ 不标 duplicate（不猜语义）
      duplicate: false,
    });
    expect(String((row.detail as Record<string, unknown>).traceId)).not.toBe("");
    expect(row.adminId).toBe(0);
  });
});
