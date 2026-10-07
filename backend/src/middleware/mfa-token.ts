import jwt from "jsonwebtoken";
import { env } from "../config/env";
import {
  MERCHANT_JWT_ISSUER,
  MERCHANT_JWT_AUDIENCE,
  PLATFORM_JWT_ISSUER,
  PLATFORM_JWT_AUDIENCE,
} from "./auth";
import { AppError } from "../shared/app-error";

/** MFA 挑战令牌有效期（分钟） */
export const MFA_TOKEN_TTL_MINUTES = 5;

/** MFA 挑战令牌载荷 */
export interface MfaTokenPayload {
  id: number;
  username: string;
  tenantId: string;
}

/** 签发 MFA 挑战令牌（短时效，仅用于登录二次验证） */
export function signMfaToken(user: MfaTokenPayload): string {
  return jwt.sign(
    { ...user, type: "mfa" },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: `${MFA_TOKEN_TTL_MINUTES}m`,
      issuer: MERCHANT_JWT_ISSUER,
      audience: MERCHANT_JWT_AUDIENCE,
    }
  );
}

/** 校验 MFA 挑战令牌，返回用户信息（失败抛 401） */
export function verifyMfaToken(token: string): MfaTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: MERCHANT_JWT_ISSUER,
      audience: MERCHANT_JWT_AUDIENCE,
    }) as jwt.JwtPayload & { type?: string };
    if (payload.type !== "mfa" || !payload.id || !payload.username) {
      throw new AppError("MFA 挑战已失效，请重新登录", 401);
    }
    return {
      id: payload.id,
      username: payload.username,
      tenantId: payload.tenantId || "default",
    };
  } catch {
    throw new AppError("MFA 挑战已过期，请重新登录", 401);
  }
}

// ─────────────────────────────────────────────────────────────
// 平台总后台（t_platform_admin）专用的 MFA 挑战令牌
//
// S3-58-F1 R3：平台端 MFA 与租户端（t_sys_user）**各用一套**，不得互相通用：
//  - 载荷类型不同（`platform_mfa` vs `mfa`）；
//  - issuer / audience 使用平台专用值（与平台登录 JWT 一致）。
// 因此租户端的 MFA 挑战令牌（或商家 JWT）不可能被平台二次验证端点接受，反之亦然。
// ─────────────────────────────────────────────────────────────

/** 平台管理员 MFA 挑战令牌有效期（分钟） */
export const PLATFORM_MFA_TOKEN_TTL_MINUTES = 5;

/** 平台管理员 MFA 挑战令牌载荷 */
export interface PlatformMfaTokenPayload {
  id: number;
  username: string;
}

/** 签发平台管理员 MFA 挑战令牌（短时效，仅用于登录二次验证） */
export function signPlatformMfaToken(admin: PlatformMfaTokenPayload): string {
  return jwt.sign(
    { ...admin, type: "platform_mfa" },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: `${PLATFORM_MFA_TOKEN_TTL_MINUTES}m`,
      issuer: PLATFORM_JWT_ISSUER,
      audience: PLATFORM_JWT_AUDIENCE,
    }
  );
}

/** 校验平台管理员 MFA 挑战令牌，返回管理员信息（失败抛 401） */
export function verifyPlatformMfaToken(token: string): PlatformMfaTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: PLATFORM_JWT_ISSUER,
      audience: PLATFORM_JWT_AUDIENCE,
    }) as jwt.JwtPayload & { type?: string };
    if (payload.type !== "platform_mfa" || !payload.id || !payload.username) {
      throw new AppError("MFA 挑战已失效，请重新登录", 401);
    }
    return { id: Number(payload.id), username: String(payload.username) };
  } catch {
    throw new AppError("MFA 挑战已过期，请重新登录", 401);
  }
}
