/**
 * S3-160 商家端登录「记住我」单元测试
 * 被测：src/services/admin/auth.service.ts 的 login 链路（controller → service → signToken）
 *
 * 卡内验收标准③：必须用**真实 `jwt.verify` 解出 token 的 exp**，断言 `exp - iat` ≈ 4h / 30d；
 * 只断言 signToken 的调用参数（mock 参数）不算通过。
 * 因此本文件**故意不 mock** `middleware/auth`：使用真实 signToken + 真实 jsonwebtoken，
 * 仅 mock 数据库查询与口令校验（登录链路里唯一的外部依赖）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

import { login, DEMO_USERNAME } from "../../../services/admin/auth.service";
import { env } from "../../../config/env";
import { MERCHANT_JWT_ISSUER, MERCHANT_JWT_AUDIENCE } from "../../../middleware/auth";

const FOUR_HOURS = 4 * 3600;
const THIRTY_DAYS = 30 * 24 * 3600;

const FORMAL_ACCOUNT = {
  id: 2,
  username: "store_manager",
  password_hash: "hashed",
  real_name: "门店经理",
  store_id: 1,
  status: 1,
  tenant_id: "default",
  login_fail_count: 0,
  locked_until: null,
};

/** 演示账号：用户名一律引用后端唯一来源 DEMO_USERNAME，测试内不写死字面量 */
const DEMO_ACCOUNT = {
  ...FORMAL_ACCOUNT,
  id: 3,
  username: DEMO_USERNAME,
  real_name: "演示账号",
  store_id: null,
};

/** 用真实 jwt.verify 解出 payload（与 requireAuth 同算法/issuer/audience） */
function decode(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: MERCHANT_JWT_ISSUER,
    audience: MERCHANT_JWT_AUDIENCE,
  }) as jwt.JwtPayload & { iat: number; exp: number };
}

/** login 未启用 MFA 时返回 { token, user, csrfToken, expiresIn }；启用 MFA 时返回挑战令牌 */
function expectTokenResult(res: Awaited<ReturnType<typeof login>>) {
  if (!("token" in res)) throw new Error("期望登录返回 token，实际落到 MFA 挑战分支");
  return res;
}

describe("商家端登录 rememberMe（S3-160 / F1b 收窄）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.queryOne.mockResolvedValue(FORMAL_ACCOUNT);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.query.mockResolvedValue([]);
  });

  it("正式账号 + 缺省（不传 rememberMe）⇒ 真实解出的 exp-iat = 4h（默认不放松）", async () => {
    const res = expectTokenResult(await login("store_manager", "x"));
    expect(res.expiresIn).toBe(FOUR_HOURS);
    const payload = decode(res.token);
    expect(payload.exp - payload.iat).toBe(FOUR_HOURS);
  });

  it("正式账号 + rememberMe=false ⇒ 真实解出的 exp-iat = 4h", async () => {
    const res = expectTokenResult(await login("store_manager", "x", false));
    expect(res.expiresIn).toBe(FOUR_HOURS);
    const payload = decode(res.token);
    expect(payload.exp - payload.iat).toBe(FOUR_HOURS);
  });

  it("正式账号 + rememberMe=true ⇒ 真实解出的 exp-iat = 4h（不得长效，S3-160-F1b 口径更正）", async () => {
    const res = expectTokenResult(await login("store_manager", "x", true));
    expect(res.expiresIn).toBe(FOUR_HOURS);
    const payload = decode(res.token);
    expect(payload.exp - payload.iat).toBe(FOUR_HOURS);
  });

  it("演示账号 + rememberMe=true ⇒ 真实解出的 exp-iat = 30d（长效）", async () => {
    mocks.queryOne.mockResolvedValue(DEMO_ACCOUNT);
    const res = expectTokenResult(await login(DEMO_USERNAME, "x", true));
    expect(res.expiresIn).toBe(THIRTY_DAYS);
    const payload = decode(res.token);
    expect(payload.exp - payload.iat).toBe(THIRTY_DAYS);
  });

  it("演示账号 + 缺省/false ⇒ 真实解出的 exp-iat = 4h（只有演示账号显式勾选才长效）", async () => {
    mocks.queryOne.mockResolvedValue(DEMO_ACCOUNT);
    for (const rememberMe of [undefined, false] as const) {
      const res = expectTokenResult(await login(DEMO_USERNAME, "x", rememberMe));
      expect(res.expiresIn).toBe(FOUR_HOURS);
      const payload = decode(res.token);
      expect(payload.exp - payload.iat).toBe(FOUR_HOURS);
    }
  });

  it("长效 token 与短效 token 的 issuer/audience 完全一致（只差 TTL）", async () => {
    const short = expectTokenResult(await login("store_manager", "x", false));
    mocks.queryOne.mockResolvedValue(DEMO_ACCOUNT);
    const long = expectTokenResult(await login(DEMO_USERNAME, "x", true));
    const shortPayload = decode(short.token);
    const longPayload = decode(long.token);
    expect(longPayload.iss).toBe(MERCHANT_JWT_ISSUER);
    expect(longPayload.aud).toBe(MERCHANT_JWT_AUDIENCE);
    expect(longPayload.iss).toBe(shortPayload.iss);
    expect(longPayload.aud).toBe(shortPayload.aud);
  });

  it("响应字段 expiresIn 与实签 token 的 exp-iat 严格同源（S3-160-F1 绑死断言）", async () => {
    mocks.queryOne.mockResolvedValue(DEMO_ACCOUNT);
    const demoLong = expectTokenResult(await login(DEMO_USERNAME, "x", true));
    mocks.queryOne.mockResolvedValue(FORMAL_ACCOUNT);
    const formalLong = expectTokenResult(await login("store_manager", "x", true));
    // 两种 rememberMe=true 的账号必须走不同 TTL（演示 30d / 正式 4h），否则本断言失去区分力
    expect(demoLong.expiresIn).toBe(THIRTY_DAYS);
    expect(formalLong.expiresIn).toBe(FOUR_HOURS);
    for (const res of [demoLong, formalLong]) {
      const payload = decode(res.token);
      // 把"响应里的 expiresIn"绑在"真实 jwt.verify 解出的有效期"上：
      // 只要两者将来由不同来源推出（例如只改了常量或只改了秒数表），本断言即红。
      expect(res.expiresIn).toBe(payload.exp - payload.iat);
    }
  });
});
