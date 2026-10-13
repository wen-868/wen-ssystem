import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

import { createTenant } from "../../../services/admin/tenant.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * S3-183-F1 · 收口总清单第 48 项：
 * `POST /api/platform/tenants-management` 的 `INSERT INTO t_tenant` 原本**不写 id**，
 * 而生产 `t_tenant.id` 是 `varchar(36) NOT NULL` 且无默认值 ⇒ MySQL 1364 ⇒ 被 error-handler
 * 映射成 400「缺少必填参数：id」（生产实测 400）⇒ 该入口**根本建不出租户**。
 */
describe("admin tenant.service · createTenant（建租户落点必须真的能建出租户）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (runner: (conn: unknown) => Promise<unknown>) =>
      runner({ execute: mocks.connExecute })
    );
  });

  it("INSERT 的第一列是 id，主键为应用层生成的 UUID，且操作日志的 tenant_id 用同一个 UUID", async () => {
    mocks.makeBizNo.mockReturnValue("T20260101009");
    mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);

    const res = await createTenant(
      {
        companyName: "测试公司",
        contactPerson: "张三",
        contactMobile: "13800138000",
        source: "MANUAL",
      },
      7,
      "平台管理员"
    );

    expect(res.tenant_code).toBe("T20260101009");

    const [insertSql, insertParams] = mocks.connExecute.mock.calls[0] as [string, unknown[]];
    // id 是主键（原实现漏写 ⇒ 1364 ⇒ 400「缺少必填参数：id」）；name 是第二个 NOT NULL 无默认列
    // （补上 id 后实测报 400「缺少必填参数：name」）—— 两个都必须出现在显式列清单里
    expect(insertSql).toMatch(/INSERT INTO t_tenant \(\s*id,\s*tenant_code,\s*name,/);
    const tenantId = insertParams[0] as string;
    expect(tenantId).toMatch(UUID_RE);
    // 状态列是 TINYINT，写数字 1（不是字符串 'ACTIVE'）
    expect(insertSql).not.toContain("'ACTIVE'");

    // 操作日志的 tenant_id 必须是真主键 —— 沿用 insertId 会写成 '0'（varchar 主键无 AUTO_INCREMENT）
    const [logSql, logParams] = mocks.connExecute.mock.calls[1] as [string, unknown[]];
    expect(logSql).toContain("INSERT INTO t_operation_log");
    expect(logParams[logParams.length - 1]).toBe(tenantId);

    // 回传体同时给出 tenant_code 与真实 id
    expect(res.id).toBe(tenantId);
  });
});
