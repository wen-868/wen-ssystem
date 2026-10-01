import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  audit: vi.fn()
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne
}));

vi.mock("../../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: mocks.audit
}));

import {
  invitePlatformAdmin,
  resetPlatformAdminPassword,
  listPlatformAdmins,
  updatePlatformAdminStatus
} from "../../../services/platform/admin-account.service";

const operator = { adminId: 1, adminName: "凌舟", ip: "10.0.0.1" };

beforeEach(() => {
  mocks.query.mockReset();
  mocks.queryOne.mockReset();
  mocks.audit.mockReset();
  mocks.audit.mockResolvedValue(1);
});

describe("C6-1A · invitePlatformAdmin（#45 建号，裁定 R6：不发信 + 初始口令一次性展示）", () => {
  it("复用既有建号逻辑：口令服务端生成、只存 bcrypt 哈希、只回传一次", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ insertId: 9, affectedRows: 1 });

    const res = await invitePlatformAdmin(
      {
        username: "ops01",
        realName: "运营一号",
        phone: "13800138000",
        email: "ops01@example.com",
        role: "ADMIN"
      },
      operator
    );

    const insertCall = mocks.query.mock.calls[0];
    const sql = String(insertCall[0]);
    const params = insertCall[1] as unknown[];
    expect(sql).toContain("INSERT INTO t_platform_admin");
    expect(params[0]).toBe("ops01");
    // 落库的是哈希，不是明文（明文绝不能进 DB）
    expect(params[1]).not.toBe(res.initialPassword);
    expect(bcrypt.compareSync(res.initialPassword, String(params[1]))).toBe(true);
    expect(res).toMatchObject({ id: 9, username: "ops01", role: "ADMIN", passwordShownOnce: true });
    expect(String(res.initialPassword)).toHaveLength(12);
  });

  it("审计留痕写 CREATE_ADMIN，且明细里不得出现明文口令", async () => {
    mocks.queryOne.mockResolvedValue(null);
    mocks.query.mockResolvedValue({ insertId: 9, affectedRows: 1 });

    const res = await invitePlatformAdmin(
      { username: "ops02", realName: "运营二号", phone: "13800138001", role: "SUPPORT" },
      operator
    );

    expect(mocks.audit).toHaveBeenCalledTimes(1);
    const auditInput = mocks.audit.mock.calls[0][0] as any;
    expect(auditInput).toMatchObject({
      adminId: 1,
      adminName: "凌舟",
      module: "platform_admin",
      action: "CREATE_ADMIN"
    });
    expect(JSON.stringify(auditInput)).not.toContain(res.initialPassword);
  });

  it("用户名重复时沿用既有 400 口径（不吞异常、不静默改用户名）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    await expect(
      invitePlatformAdmin(
        { username: "admin", realName: "重复账号", phone: "13800138002", role: "ADMIN" },
        operator
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("C6-1A · resetPlatformAdminPassword（#51 管理员代重置，零 DDL）", () => {
  it("UPDATE password_hash 为新口令哈希，返回一次性初始口令并留痕", async () => {
    mocks.queryOne.mockResolvedValue({ id: 3, username: "ops03", realName: "运营三号" });
    mocks.query.mockResolvedValue({ affectedRows: 1 });

    const res = await resetPlatformAdminPassword(3, operator);

    const sql = String(mocks.query.mock.calls[0][0]);
    const params = mocks.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("UPDATE t_platform_admin");
    expect(sql).toContain("password_hash");
    expect(bcrypt.compareSync(res.initialPassword, String(params[0]))).toBe(true);
    expect(params[1]).toBe(3);
    expect(res).toMatchObject({ id: 3, username: "ops03", passwordShownOnce: true });
    expect((mocks.audit.mock.calls[0][0] as any).action).toBe("RESET_ADMIN_PASSWORD");
    expect(JSON.stringify(mocks.audit.mock.calls[0][0])).not.toContain(res.initialPassword);
  });

  it("管理员不存在时 404（不静默成功）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(resetPlatformAdminPassword(999, operator)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

// S3-138：status 的对外口径统一为字符串 'ACTIVE'/'DISABLED'（DB 列仍是 TINYINT，映射只在服务层）
describe("S3-138 · 平台管理员 status 口径统一", () => {
  const buildRow = (over: Record<string, unknown>) => ({
    id: 1,
    username: "admin",
    realName: "超管",
    phone: "13800138000",
    email: null,
    role: "SUPER_ADMIN",
    status: 1,
    lastLoginAt: null,
    createdAt: "2026-10-01 00:00:00",
    ...over
  });

  it("列表读：DB TINYINT 1/0 ⇒ 'ACTIVE'/'DISABLED'（与启停端点同形）", async () => {
    mocks.query.mockResolvedValue([buildRow({ id: 1, status: 1 }), buildRow({ id: 2, status: 0 })]);
    mocks.queryOne.mockResolvedValue({ total: 2 });

    const res = await listPlatformAdmins(1, 20);

    expect(res.records.map((r) => r.status)).toEqual(["ACTIVE", "DISABLED"]);
  });

  it("列表筛选入参走同一口径并映射回 TINYINT（ACTIVE ⇒ 1、DISABLED ⇒ 0）", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ total: 0 });

    await listPlatformAdmins(1, 20, { status: "ACTIVE" });
    expect((mocks.query.mock.calls[0][1] as unknown[])[0]).toBe(1);

    mocks.query.mockClear();
    await listPlatformAdmins(1, 20, { status: "DISABLED" });
    expect((mocks.query.mock.calls[0][1] as unknown[])[0]).toBe(0);
  });

  it("列表筛选入参不在口径内 ⇒ 400（不静默兜底成 ACTIVE）", async () => {
    await expect(listPlatformAdmins(1, 20, { status: "ON" })).rejects.toMatchObject({
      statusCode: 400
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("启停写：响应体是字符串口径，DB 落库仍是 TINYINT", async () => {
    mocks.queryOne.mockResolvedValue({ id: 7 });
    mocks.query.mockResolvedValue({ affectedRows: 1 });

    const res = await updatePlatformAdminStatus(7, "DISABLED");

    expect(res).toEqual({ id: 7, status: "DISABLED" });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("UPDATE t_platform_admin SET status = ?");
    expect((params as unknown[])[0]).toBe(0);
  });

  it("启停写：管理员不存在 ⇒ 404（与 reset-password 一致，不静默成功）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(updatePlatformAdminStatus(999999, "ACTIVE")).rejects.toMatchObject({
      statusCode: 404
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
