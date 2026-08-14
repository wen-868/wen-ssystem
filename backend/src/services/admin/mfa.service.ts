import { query, queryOne } from "../../shared/db";
import { generateSecret, verifyTOTP, buildOtpAuthUri } from "../../shared/totp";
import { AppError } from "../../shared/app-error";
import { issueLoginResult, type SysUserLoginRow } from "./auth.service";
import { verifyMfaToken } from "../../middleware/mfa-token";

interface MfaUserRow {
  id: number;
  username: string;
  mfa_secret: string | null;
  mfa_enabled: number;
  tenant_id: string | null;
}

async function getMfaUser(userId: number): Promise<MfaUserRow> {
  const row = await queryOne<MfaUserRow>(
    "SELECT id, username, mfa_secret, mfa_enabled, tenant_id FROM t_sys_user WHERE id = ?",
    [userId]
  );
  if (!row) throw new AppError("用户不存在", 404);
  return row;
}

/** 获取当前用户 MFA 状态 */
export async function getMfaStatus(userId: number) {
  const row = await getMfaUser(userId);
  return { enabled: Number(row.mfa_enabled) === 1, hasSecret: !!row.mfa_secret };
}

/** 发起绑定：生成 Secret 并暂存（enabled 保持 0，confirm 后生效） */
export async function setupMfa(userId: number) {
  const row = await getMfaUser(userId);
  if (Number(row.mfa_enabled) === 1) {
    throw new AppError("双因素认证已启用，如需更换请先关闭后重新绑定", 400);
  }
  const secret = generateSecret();
  await query(
    "UPDATE t_sys_user SET mfa_secret = ?, updated_at = NOW() WHERE id = ?",
    [secret, userId]
  );
  return {
    secret,
    otpauthUrl: buildOtpAuthUri(secret, row.username),
    enabled: false,
  };
}

/** 确认绑定：校验动态码后启用 */
export async function confirmMfa(userId: number, code: string) {
  const row = await getMfaUser(userId);
  if (!row.mfa_secret) throw new AppError("请先发起绑定获取密钥", 400);
  if (!verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  await query(
    "UPDATE t_sys_user SET mfa_enabled = 1, updated_at = NOW() WHERE id = ?",
    [userId]
  );
  return { enabled: true };
}

/** 关闭双因素认证：需校验当前动态码 */
export async function disableMfa(userId: number, code: string) {
  const row = await getMfaUser(userId);
  if (Number(row.mfa_enabled) !== 1) {
    throw new AppError("双因素认证未启用", 400);
  }
  if (!row.mfa_secret || !verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  await query(
    "UPDATE t_sys_user SET mfa_secret = NULL, mfa_enabled = 0, updated_at = NOW() WHERE id = ?",
    [userId]
  );
  return { enabled: false };
}

/** 登录二次验证：校验 MFA 挑战令牌 + 动态码，成功后签发完整登录结果 */
export async function verifyMfaChallenge(mfaToken: string, code: string) {
  const { id, tenantId } = verifyMfaToken(mfaToken);
  const row = await getMfaUser(id);
  if (Number(row.mfa_enabled) !== 1) {
    throw new AppError("该账号未启用双因素认证", 400);
  }
  if (!row.mfa_secret || !verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  const account: SysUserLoginRow = {
    id: row.id,
    username: row.username,
    real_name: "",
    store_id: null,
    tenant_id: row.tenant_id || "default",
    password_hash: "",
    status: 1,
    login_fail_count: 0,
    locked_until: null,
    mfa_enabled: 1,
  };
  return issueLoginResult(account);
}
