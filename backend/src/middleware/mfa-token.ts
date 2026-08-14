import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { MERCHANT_JWT_ISSUER, MERCHANT_JWT_AUDIENCE } from "./auth";
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
