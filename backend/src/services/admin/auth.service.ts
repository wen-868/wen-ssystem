import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { signToken, getUserAccessInfo, AuthUser } from "../../middleware/auth";
import { verifyPassword, validatePassword, hashPassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import { generateCsrfToken } from "../../middleware/csrf";
import { env } from "../../config/env";
import { signMfaToken } from "../../middleware/mfa-token";

// ==================== 类型定义 ====================

/** 系统用户登录信息行（含 MFA 字段） */
export interface SysUserLoginRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  store_id: number | null;
  status: number;
  tenant_id: string;
  login_fail_count: number;
  locked_until: Date | string | null;
  mfa_secret?: string | null;
  mfa_enabled?: number;
}

/** 角色权限行 */
interface RolePermissionRow {
  permissions: unknown;
}

/** 角色编码行 */
interface RoleCodeRow {
  role_code: string;
}

/** 用户主页设置行 */
interface UserHomepageRow {
  default_homepage: string;
}

/** 用户密码行 */
interface UserPasswordRow {
  passwordHash: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * 规范化角色 permissions 字段为字符串数组
 *
 * 兼容 mysql2 对 JSON 类型的多种返回形态（R54-15 引入 getUserPermissions 后的生产 500 修复）：
 * - mysql2 默认会自动解析 JSON 类型列为 JS 对象（数组/对象），此时 JSON.parse(数组) 会抛异常
 * - 不同 mysql2 版本 / 配置下，permissions 可能返回：
 *   1) JS 数组（mysql2 自动解析 JSON）—— 直接使用
 *   2) JSON 字符串（如 '["perm1"]'）—— JSON.parse 解析
 *   3) 空字符串 "" —— 返回 []
 *   4) null / undefined —— 返回 []
 *   5) 非法 JSON 字符串 —— 容错返回 []
 *
 * 关联任务：R54遗留 生产环境登录 API 500 错误修复
 */
function normalizePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string");
  }
  if (typeof raw === "string") {
    if (raw === "") return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === "string");
      }
    } catch {
      // 非法 JSON 字符串，容错返回空数组，避免登录 500
      return [];
    }
  }
  // null / undefined / 其他类型
  return [];
}

/**
 * 根据用户ID获取其所有角色的权限列表（去重合并）
 * 角色 permissions 字段存储 JSON 数组格式的权限编码
 *
 * 注意：status 查询条件兼容 VARCHAR('ACTIVE') 和 TINYINT(1) 两种类型，
 *       因为 init_database.sql 中 status 是 VARCHAR DEFAULT 'ACTIVE'，
 *       但 079_权限矩阵.sql 的 seed 数据用 1（被转成字符串 "1"）。
 */
async function getUserPermissions(userId: number, tenantId: string): Promise<string[]> {
  const roles = await query<RolePermissionRow>(
    `SELECT r.permissions
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [userId, tenantId]
  );

  const permSet = new Set<string>();
  for (const role of roles) {
    const perms = normalizePermissions(role.permissions);
    for (const p of perms) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
}

export async function login(username: string, password: string) {
  const account = await queryOne<SysUserLoginRow>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id, login_fail_count, locked_until, mfa_secret, mfa_enabled FROM t_sys_user WHERE username = ? LIMIT 1",
    [username]
  );

  if (!account) {
    throw new AppError("账号或密码错误", 400);
  }

  if (account.status !== 1) {
    throw new AppError("账号已禁用", 400);
  }

  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
    throw new AppError(`账号已锁定，请${remainingMinutes}分钟后重试`, 400);
  }

  if (!(await verifyPassword(password, account.password_hash))) {
    const newFailCount = (account.login_fail_count || 0) + 1;
    let lockedUntil = null;

    if (newFailCount >= MAX_LOGIN_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000);
    }

    await query(
      "UPDATE t_sys_user SET login_fail_count = ?, locked_until = ?, updated_at = NOW() WHERE id = ?",
      [newFailCount, lockedUntil, account.id]
    );

    if (lockedUntil) {
      throw new AppError(`登录失败次数过多，账号已锁定${LOCK_DURATION_MINUTES}分钟`, 400);
    }

    const remainingAttempts = MAX_LOGIN_ATTEMPTS - newFailCount;
    throw new AppError(`账号或密码错误，还剩${remainingAttempts}次尝试机会`, 400);
  }

  await query(
    "UPDATE t_sys_user SET login_fail_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
    [account.id]
  );

  // 双因素认证：账号启用 MFA 时，第一步仅返回挑战令牌，需动态码二次验证
  if (Number(account.mfa_enabled) === 1) {
    return {
      mfaRequired: true,
      mfaToken: signMfaToken({
        id: account.id,
        username: account.username,
        tenantId: account.tenant_id || "default",
      }),
    };
  }

  return issueLoginResult(account);
}

/**
 * 根据已通过密码校验的账号签发完整登录结果（登录/MFA 二次验证共用）
 */
export async function issueLoginResult(account: SysUserLoginRow) {
  const resolvedTenantId = account.tenant_id || 'default';
  const roles = await query<RoleCodeRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?
       AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [account.id, resolvedTenantId]
  );
  const roleCodes = roles.map((r) => r.role_code);

  // 根据用户角色获取实际权限列表
  const permissions = await getUserPermissions(account.id, resolvedTenantId);

  const authUser: AuthUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes,
    storeId: account.store_id,
    tenantId: resolvedTenantId
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    tenantId: resolvedTenantId,
    roles: roleCodes,
    permissions,
    ...accessInfo
  };
  return { token: signToken(authUser), user, csrfToken: generateCsrfToken(account.id) };
}

/**
 * 运营系统服务账号换发 JWT（统一工作台方案 §5.4 / P0）。
 * - 校验服务账号凭证（环境变量 SERVICE_ACCOUNT_CLIENT_ID/SECRET）
 * - 按请求方指定 tenantId 签发（租户隔离来自 JWT，须按租户换发）
 * - 角色固定 SUPER_ADMIN（服务账号专用，仅服务端调用，权限最小化后续可收紧）
 */
export async function issueServiceToken(
  clientId: string,
  clientSecret: string,
  tenantId?: string,
) {
  const expectedId = env.SERVICE_ACCOUNT_CLIENT_ID;
  const expectedSecret = env.SERVICE_ACCOUNT_CLIENT_SECRET;
  if (
    !expectedId ||
    !expectedSecret ||
    clientId !== expectedId ||
    clientSecret !== expectedSecret
  ) {
    throw new AppError("服务账号凭证无效", 401);
  }

  const authUser: AuthUser = {
    id: -1,
    username: "service-ops",
    realName: "运营系统服务账号",
    roles: ["SUPER_ADMIN"],
    storeId: null,
    tenantId: tenantId || "default",
  };
  const token = signToken(authUser);
  return { token, expiresIn: 4 * 3600 };
}

export async function getMe(user: AuthUser) {
  const userSetting = await queryOneWithTenant<UserHomepageRow>(
    "SELECT default_homepage FROM t_sys_user WHERE id = ?",
    [user.id],
    user.tenantId
  );
  const permissions = await getUserPermissions(user.id, user.tenantId);
  const accessInfo = getUserAccessInfo(user);
  const defaultMode = userSetting?.default_homepage
    ? (userSetting.default_homepage === '/cashier' ? 'CASHIER' : 'ADMIN')
    : accessInfo.defaultMode;
  return { ...user, permissions, ...accessInfo, defaultMode, csrfToken: generateCsrfToken(user.id) };
}

export async function getSettings(userId: number, tenantId: string) {
  const userSetting = await queryOneWithTenant<UserHomepageRow>(
    "SELECT default_homepage FROM t_sys_user WHERE id = ?",
    [userId],
    tenantId
  );
  return {
    defaultHomepage: userSetting?.default_homepage || null
  };
}

export async function updateSettings(userId: number, defaultHomepage: string | null, tenantId: string) {
  await queryWithTenant(
    "UPDATE t_sys_user SET default_homepage = ? WHERE id = ?",
    [defaultHomepage, userId],
    tenantId
  );
  return { success: true };
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string, tenantId: string) {
  const user = await queryOneWithTenant<UserPasswordRow>(
    "SELECT id, password_hash AS passwordHash FROM t_sys_user WHERE id = ?",
    [userId],
    tenantId
  );
  if (!user) throw new AppError("用户不存在", 400);
  if (!(await verifyPassword(oldPassword, user.passwordHash))) throw new AppError("旧密码错误", 400);

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const hashed = await hashPassword(newPassword);
  await queryWithTenant("UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hashed, userId], tenantId);
  return { message: "密码修改成功" };
}

/**
 * 演示账号登录（免密）：确保 demo 账号存在并绑定超级管理员角色后签发 token。
 * 演示账号仅用于产品演示，不暴露真实密码。
 */
export async function demoLogin() {
  const DEMO_USERNAME = "demo";
  const DEMO_TENANT = "default";

  let account = await queryOne<SysUserLoginRow>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id, login_fail_count, locked_until FROM t_sys_user WHERE username = ? LIMIT 1",
    [DEMO_USERNAME]
  );

  if (!account) {
    // 创建演示账号：随机密码哈希，仅用于占位，无法通过密码登录
    const randomPassword = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const hashed = await hashPassword(randomPassword);
    const insert = (await query(
      "INSERT INTO t_sys_user (username, password_hash, real_name, store_id, status, tenant_id, last_login_at) VALUES (?, ?, ?, NULL, 1, ?, NOW())",
      [DEMO_USERNAME, hashed, "演示账号", DEMO_TENANT]
    )) as unknown as ResultSetHeaderRow;
    account = {
      id: insert.insertId,
      username: DEMO_USERNAME,
      password_hash: hashed,
      real_name: "演示账号",
      store_id: null,
      status: 1,
      tenant_id: DEMO_TENANT,
      login_fail_count: 0,
      locked_until: null,
    };
  }

  if (account.status !== 1) {
    // 演示账号被禁用时自动恢复
    await query("UPDATE t_sys_user SET status = 1, updated_at = NOW() WHERE id = ?", [account.id]);
    account.status = 1;
  }

  // 确保绑定 SUPER_ADMIN 角色（幂等）
  const superRole = await queryOne<RoleRow>(
    "SELECT id, role_code FROM t_sys_role WHERE role_code = 'SUPER_ADMIN' LIMIT 1"
  );
  if (superRole) {
    await query(
      "INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
      [account.id, superRole.id, DEMO_TENANT]
    );
  }

  await query(
    "UPDATE t_sys_user SET login_fail_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
    [account.id]
  );

  const roles = await query<RoleCodeRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [account.id]
  );
  const roleCodes = roles.map((r) => r.role_code);
  const permissions = await getUserPermissions(account.id, DEMO_TENANT);

  const authUser: AuthUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes,
    storeId: account.store_id,
    tenantId: DEMO_TENANT,
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    tenantId: DEMO_TENANT,
    roles: roleCodes,
    permissions,
    ...accessInfo,
  };
  return { token: signToken(authUser), user, csrfToken: generateCsrfToken(account.id), demo: true };
}

/** 插入结果行（mysql2 ResultSetHeader 的最小字段） */
interface ResultSetHeaderRow {
  insertId: number;
}

/** 角色行 */
interface RoleRow {
  id: number;
  role_code: string;
}
