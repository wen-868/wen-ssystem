import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { signToken, getUserAccessInfo, AuthUser } from "../../middleware/auth";
import { verifyPassword, validatePassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import { generateCsrfToken } from "../../middleware/csrf";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * 根据用户ID获取其所有角色的权限列表（去重合并）
 * 角色 permissions 字段存储 JSON 数组格式的权限编码
 */
async function getUserPermissions(userId: number, tenantId: string): Promise<string[]> {
  const roles = await query<any>(
    `SELECT r.permissions
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ? AND r.status = 'ACTIVE'`,
    [userId, tenantId]
  );

  const permSet = new Set<string>();
  for (const role of roles) {
    const perms: string[] = role.permissions ? JSON.parse(role.permissions) : [];
    for (const p of perms) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
}

export async function login(username: string, password: string) {
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id, login_fail_count, locked_until FROM t_sys_user WHERE username = ? LIMIT 1",
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

  const roles = await query<any>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [account.id]
  );
  const roleCodes = roles.map((r: any) => r.role_code);
  const resolvedTenantId = account.tenant_id || 'default';

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

export async function getMe(user: AuthUser) {
  const userSetting = await queryOneWithTenant<any>(
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
  const userSetting = await queryOneWithTenant<any>(
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
  const user = await queryOneWithTenant<any>(
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

  const { hashPassword } = await import("../../shared/password.js");
  const hashed = await hashPassword(newPassword);
  await queryWithTenant("UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hashed, userId], tenantId);
  return { message: "密码修改成功" };
}