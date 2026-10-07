/**
 * 平台管理员 MFA 服务单测（S3-58-F1 R3）
 *
 * 重点证明两件事：
 *  1. 本服务只读写 `t_platform_admin`（与租户端 `t_sys_user` 的那套完全隔离，不串表）；
 *  2. 二段校验通过后才签发完整登录结果（挑战令牌用**真** JWT 签发/校验，非 mock）。
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
vi.mock("../../../shared/totp", () => ({
  generateSecret: () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
  verifyTOTP: vi.fn().mockReturnValue(true),
  buildOtpAuthUri: (secret: string, account: string) => `otpauth://totp/test:${account}?secret=${secret}`,
}));

import {
  setupMfa,
  confirmMfa,
  disableMfa,
  getMfaStatus,
  verifyMfaChallenge,
} from "../../../services/platform/platform-mfa.service";
import { signPlatformMfaToken } from "../../../middleware/mfa-token";
import { verifyTOTP } from "../../../shared/totp";

function mockAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    username: "platform-admin",
    real_name: "平台管理员",
    mfa_secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    mfa_enabled: 0,
    ...overrides,
  };
}

/** 取 mock 函数最后一次调用的第 N 个实参（避免 `calls.at(-1)` 的 possibly-undefined 类型噪音） */
function lastArg(fn: { mock: { calls: unknown[][] } }, index: number): unknown {
  const calls = fn.mock.calls;
  return calls[calls.length - 1][index];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryOne.mockResolvedValue(mockAdmin());
  mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
  (verifyTOTP as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe("services/platform/platform-mfa - 平台端双因素认证", () => {
  it("getMfaStatus 返回平台管理员启用状态（查 t_platform_admin）", async () => {
    const res = await getMfaStatus(9);
    expect(res).toEqual({ enabled: false, hasSecret: true });
    expect(String(lastArg(mocks.queryOne, 0))).toContain("t_platform_admin");
  });

  it("setupMfa 未启用时返回 secret 与 otpauth，并写 t_platform_admin.mfa_secret", async () => {
    const res = await setupMfa(9);
    expect(res.secret).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
    expect(res.otpauthUrl).toContain("otpauth://totp/");
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE t_platform_admin SET mfa_secret"), [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      9,
    ]);
  });

  it("setupMfa 已启用时抛 400", async () => {
    mocks.queryOne.mockResolvedValue(mockAdmin({ mfa_enabled: 1 }));
    await expect(setupMfa(9)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("confirmMfa 校验通过后置 mfa_enabled=1", async () => {
    const res = await confirmMfa(9, "123456");
    expect(res).toEqual({ enabled: true });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("mfa_enabled = 1"), [9]);
    expect(String(lastArg(mocks.query, 0))).toContain("t_platform_admin");
  });

  it("confirmMfa 验证码错误时抛 400", async () => {
    (verifyTOTP as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    await expect(confirmMfa(9, "000000")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("disableMfa 未启用时抛 400", async () => {
    await expect(disableMfa(9, "123456")).rejects.toMatchObject({ statusCode: 400, message: "双因素认证未启用" });
  });

  it("disableMfa 校验通过后清空 t_platform_admin 的 secret", async () => {
    mocks.queryOne.mockResolvedValue(mockAdmin({ mfa_enabled: 1 }));
    const res = await disableMfa(9, "123456");
    expect(res).toEqual({ enabled: false });
    const sql = String(lastArg(mocks.query, 0));
    expect(sql).toContain("mfa_secret = NULL");
    expect(sql).toContain("t_platform_admin");
  });

  it("verifyMfaChallenge 通过后签发完整登录结果（真平台挑战令牌）", async () => {
    mocks.queryOne.mockResolvedValue(mockAdmin({ mfa_enabled: 1 }));
    const mfaToken = signPlatformMfaToken({ id: 9, username: "platform-admin" });
    const res = await verifyMfaChallenge(mfaToken, "123456");
    expect(res).toHaveProperty("token");
    expect(res).toHaveProperty("admin");
    expect(res).toHaveProperty("csrfToken");
    expect((res as { admin: { username: string } }).admin.username).toBe("platform-admin");
  });

  it("verifyMfaChallenge 账号未启用 MFA 抛 400（不得跳过二段仍发令牌）", async () => {
    const mfaToken = signPlatformMfaToken({ id: 9, username: "platform-admin" });
    await expect(verifyMfaChallenge(mfaToken, "123456"))
      .rejects.toMatchObject({ statusCode: 400, message: "该账号未启用双因素认证" });
  });

  it("verifyMfaChallenge 挑战令牌非法（如租户端令牌）抛 401", async () => {
    await expect(verifyMfaChallenge("not-a-platform-token", "123456"))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});
