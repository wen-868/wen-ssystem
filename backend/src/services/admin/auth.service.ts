import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { signToken, getUserAccessInfo, AuthUser } from "../../middleware/auth.js";
import { verifyPassword } from "../../shared/password.js";

export async function login(username: string, password: string) {
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id FROM t_sys_user WHERE username = ? LIMIT 1",
    [username]
  );
  if (!account || account.status !== 1 || !(await verifyPassword(password, account.password_hash))) {
    throw new Error("账号或密码错误");
  }
  const roles = await query<any>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [account.id]
  );
  const roleCodes = roles.map((r: any) => r.role_code);
  const resolvedTenantId = account.tenant_id || 'default';
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
    permissions: ["*"],
    ...accessInfo
  };
  return { token: signToken(authUser), user };
}

export async function getMe(user: AuthUser) {
  const userSetting = await queryOneWithTenant<any>(
    "SELECT default_homepage FROM t_sys_user WHERE id = ?",
    [user.id],
    user.tenantId
  );
  const accessInfo = getUserAccessInfo(user);
  const defaultMode = userSetting?.default_homepage
    ? (userSetting.default_homepage === '/cashier' ? 'CASHIER' : 'ADMIN')
    : accessInfo.defaultMode;
  return { ...user, ...accessInfo, defaultMode };
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

export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await queryOne<any>("SELECT id, password_hash AS passwordHash FROM t_sys_user WHERE id = ?", [userId]);
  if (!user) throw new Error("用户不存在");
  if (!(await verifyPassword(oldPassword, user.passwordHash))) throw new Error("旧密码错误");
  const { hashPassword } = await import("../../shared/password.js");
  const hashed = await hashPassword(newPassword);
  await queryWithTenant("UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hashed, userId], "default");
  return { message: "密码修改成功" };
}