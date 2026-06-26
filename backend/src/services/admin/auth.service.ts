import { query, queryOne } from "../../shared/db.js";
import { signToken, getUserAccessInfo, AuthUser } from "../../shared/auth.js";
import { verifyPassword } from "../../shared/password.js";

export async function login(username: string, password: string) {
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id FROM sys_user WHERE username = ? LIMIT 1",
    [username]
  );
  if (!account || account.status !== 1 || !verifyPassword(password, account.password_hash)) {
    throw new Error("账号或密码错误");
  }
  const roles = await query<any>(
    `SELECT r.role_code
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [account.id]
  );
  const roleCodes = roles.map((r: any) => r.role_code);
  const tenantId = account.tenant_id || 'default';
  const authUser: AuthUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes,
    storeId: account.store_id,
    tenantId
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    tenantId,
    roles: roleCodes,
    permissions: ["*"],
    ...accessInfo
  };
  return { token: signToken(authUser), user };
}

export async function getMe(user: AuthUser) {
  const userSetting = await queryOne<any>(
    "SELECT default_homepage FROM sys_user WHERE id = ?",
    [user.id]
  );
  const accessInfo = getUserAccessInfo(user);
  const defaultMode = userSetting?.default_homepage
    ? (userSetting.default_homepage === '/cashier' ? 'CASHIER' : 'ADMIN')
    : accessInfo.defaultMode;
  return { ...user, ...accessInfo, defaultMode };
}

export async function getSettings(userId: number) {
  const userSetting = await queryOne<any>(
    "SELECT default_homepage FROM sys_user WHERE id = ?",
    [userId]
  );
  return {
    defaultHomepage: userSetting?.default_homepage || null
  };
}

export async function updateSettings(userId: number, defaultHomepage: string | null) {
  await query(
    "UPDATE sys_user SET default_homepage = ? WHERE id = ?",
    [defaultHomepage, userId]
  );
  return { success: true };
}