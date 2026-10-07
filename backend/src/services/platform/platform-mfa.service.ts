/**
 * 平台总后台双因素认证服务（S3-58-F1 R3，2026-10-06）
 *
 * 与租户端 `services/admin/mfa.service.ts` **完全独立**：
 *  - 本服务只读写 `t_platform_admin.mfa_secret` / `t_platform_admin.mfa_enabled`；
 *  - 不复用、不改写租户端（`t_sys_user`）的那一套逻辑，避免串表；
 *  - 挑战令牌走 `middleware/mfa-token.ts` 的**平台专用**签发/校验（issuer/audience/type 均不同），
 *    租户端令牌与平台端令牌互不通用。
 *
 * 默认不强制：`mfa_enabled = 0` 的账号照常直发正式令牌（见 platform-auth.service.login）。
 * 凭据纪律：密钥与动态码一律**不写日志**、不回显明文（setup 端点返回 secret 是绑定流程必需）。
 */
import { query, queryOne } from "../../shared/db";
import { generateSecret, verifyTOTP, buildOtpAuthUri } from "../../shared/totp";
import { AppError } from "../../shared/app-error";
import { issueLoginResult, isMissingMfaColumnError, platformMfaColumnsReady } from "./platform-auth.service";
import { verifyPlatformMfaToken } from "../../middleware/mfa-token";

interface PlatformMfaRow {
  id: number;
  username: string;
  real_name: string;
  mfa_secret: string | null;
  mfa_enabled: number;
}

/**
 * S3-58-F1-F1：t_platform_admin 的 MFA 两列由迁移 196 补齐，部署顺序不可控。
 * 缺列时 MFA 端点**不得吐 500**，统一按「暂不可用」回 503（登录链路另有 mfa_enabled=0 降级）。
 * 探测与 1054 兜底复用 platform-auth.service 的同一份缓存状态。
 */
const MFA_UNAVAILABLE_MESSAGE = "平台端 MFA 暂不可用：数据库缺少 mfa_secret / mfa_enabled 列，请联系运维执行迁移 196";

async function getPlatformMfaAdmin(adminId: number): Promise<PlatformMfaRow> {
  if (!(await platformMfaColumnsReady())) {
    throw new AppError(MFA_UNAVAILABLE_MESSAGE, 503);
  }
  let row: PlatformMfaRow | null;
  try {
    row = await queryOne<PlatformMfaRow>(
      "SELECT id, username, real_name, mfa_secret, mfa_enabled FROM t_platform_admin WHERE id = ?",
      [adminId]
    );
  } catch (error) {
    if (isMissingMfaColumnError(error)) throw new AppError(MFA_UNAVAILABLE_MESSAGE, 503);
    throw error;
  }
  if (!row) throw new AppError("管理员不存在", 404);
  return row;
}

/** 获取当前平台管理员的 MFA 状态 */
export async function getMfaStatus(adminId: number) {
  // 缺列时按「未启用」返回，保证总台侧状态面板不因 500 整体挂掉（warn 由探测处统一打）
  if (!(await platformMfaColumnsReady())) {
    return { enabled: false, hasSecret: false };
  }
  const row = await getPlatformMfaAdmin(adminId);
  return { enabled: Number(row.mfa_enabled) === 1, hasSecret: !!row.mfa_secret };
}

/** 发起绑定：生成 Secret 并暂存（enabled 保持 0，confirm 后才生效） */
export async function setupMfa(adminId: number) {
  const row = await getPlatformMfaAdmin(adminId);
  if (Number(row.mfa_enabled) === 1) {
    throw new AppError("双因素认证已启用，如需更换请先关闭后重新绑定", 400);
  }
  const secret = generateSecret();
  await query(
    "UPDATE t_platform_admin SET mfa_secret = ?, updated_at = NOW() WHERE id = ?",
    [secret, adminId]
  );
  return {
    secret,
    otpauthUrl: buildOtpAuthUri(secret, row.username),
    enabled: false,
  };
}

/** 确认绑定：校验动态码后启用 */
export async function confirmMfa(adminId: number, code: string) {
  const row = await getPlatformMfaAdmin(adminId);
  if (!row.mfa_secret) throw new AppError("请先发起绑定获取密钥", 400);
  if (!verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  await query(
    "UPDATE t_platform_admin SET mfa_enabled = 1, updated_at = NOW() WHERE id = ?",
    [adminId]
  );
  return { enabled: true };
}

/** 关闭双因素认证：需校验当前动态码，并清空 secret */
export async function disableMfa(adminId: number, code: string) {
  const row = await getPlatformMfaAdmin(adminId);
  if (Number(row.mfa_enabled) !== 1) {
    throw new AppError("双因素认证未启用", 400);
  }
  if (!row.mfa_secret || !verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  await query(
    "UPDATE t_platform_admin SET mfa_secret = NULL, mfa_enabled = 0, updated_at = NOW() WHERE id = ?",
    [adminId]
  );
  return { enabled: false };
}

/** 登录二次验证：校验平台 MFA 挑战令牌 + 动态码，成功后签发完整登录结果 */
export async function verifyMfaChallenge(mfaToken: string, code: string) {
  const { id } = verifyPlatformMfaToken(mfaToken);
  const row = await getPlatformMfaAdmin(id);
  if (Number(row.mfa_enabled) !== 1) {
    throw new AppError("该账号未启用双因素认证", 400);
  }
  if (!row.mfa_secret || !verifyTOTP(row.mfa_secret, code)) {
    throw new AppError("验证码错误或已过期，请重试", 400);
  }
  return issueLoginResult({
    id: row.id,
    username: row.username,
    real_name: row.real_name,
  });
}
