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
vi.mock("../../../middleware/mfa-token", () => ({
  verifyMfaToken: vi.fn().mockReturnValue({ id: 9, username: "admin", tenantId: "default" }),
}));

import {
  setupMfa,
  confirmMfa,
  disableMfa,
  getMfaStatus,
  verifyMfaChallenge,
} from "../../../services/admin/mfa.service";
import { verifyTOTP } from "../../../shared/totp";

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    username: "admin",
    mfa_secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    mfa_enabled: 0,
    tenant_id: "default",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryOne.mockResolvedValue(mockUser());
  mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
  (verifyTOTP as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe("mfa.service - 双因素认证", () => {
  it("getMfaStatus 返回启用状态", async () => {
    const res = await getMfaStatus(9);
    expect(res).toEqual({ enabled: false, hasSecret: true });
  });

  it("setupMfa 未启用时返回 secret 与 otpauth 并写入库", async () => {
    const res = await setupMfa(9);
    expect(res.secret).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
    expect(res.otpauthUrl).toContain("otpauth://totp/");
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE t_sys_user SET mfa_secret"), ["ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", 9]);
  });

  it("setupMfa 已启用时抛 400", async () => {
    mocks.queryOne.mockResolvedValue(mockUser({ mfa_enabled: 1 }));
    await expect(setupMfa(9)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("confirmMfa 校验通过后启用", async () => {
    const res = await confirmMfa(9, "123456");
    expect(res).toEqual({ enabled: true });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("mfa_enabled = 1"), [9]);
  });

  it("confirmMfa 验证码错误时抛 400", async () => {
    (verifyTOTP as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    await expect(confirmMfa(9, "000000")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("disableMfa 未启用时抛 400", async () => {
    await expect(disableMfa(9, "123456")).rejects.toMatchObject({ statusCode: 400, message: "双因素认证未启用" });
  });

  it("disableMfa 校验通过后清空 secret", async () => {
    mocks.queryOne.mockResolvedValue(mockUser({ mfa_enabled: 1 }));
    const res = await disableMfa(9, "123456");
    expect(res).toEqual({ enabled: false });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("mfa_secret = NULL"), [9]);
  });

  it("verifyMfaChallenge 通过后签发完整登录结果", async () => {
    mocks.queryOne.mockResolvedValue(mockUser({ mfa_enabled: 1 }));
    // 模拟 issueLoginResult 内部查询（roles/permissions）
    mocks.query.mockResolvedValueOnce([]); // roles
    const res = await verifyMfaChallenge("mfa-token", "123456");
    expect(res).toHaveProperty("token");
    expect(res).toHaveProperty("user");
    expect(res).toHaveProperty("csrfToken");
  });

  it("verifyMfaChallenge 账号未启用 MFA 抛 400", async () => {
    await expect(verifyMfaChallenge("mfa-token", "123456"))
      .rejects.toMatchObject({ statusCode: 400, message: "该账号未启用双因素认证" });
  });
});
