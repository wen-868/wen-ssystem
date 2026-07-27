import { z } from "zod";
import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { signToken, getUserAccessInfo } from "../../middleware/auth";
import { verifyPassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

// ─── 类型定义 ─────────────────────────────────────────────────

/** 登录账号行 */
interface LoginAccountRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  store_id: number | null;
  status: number;
  tenant_id: string | null;
  login_fail_count: number;
  locked_until: Date | string | null;
}

/** 角色行 */
interface RoleRow {
  role_code: string;
}

/** 门店信息行 */
interface StoreInfoRow {
  name: string;
  address: string;
  phone: string;
  contact: string;
  miniappAppid: string;
  wxMerchantName: string;
  wxServicePhone: string;
  wxHeadImg: string;
  wxQrcodeUrl: string;
}

export async function login(username: string, password: string) {
  const account = await queryOne<LoginAccountRow>(
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

  const roles = await query<RoleRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [account.id]
  );
  const roleCodes = roles.map((r) => r.role_code);
  const tenantId = account.tenant_id || 'default';
  const authUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes.length > 0 ? roleCodes : ["STAFF"],
    storeId: account.store_id,
    tenantId
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name || account.username,
    roles: authUser.roles,
    storeId: account.store_id ?? 1,
    tenantId,
    ...accessInfo
  };
  const token = signToken(authUser);
  return { token, user };
}

/** getCurrentUser 入参 — 登录账号/用户信息 */
interface StoreAuthUserInput {
  id: number;
  username?: string | null;
  storeId?: number | null;
  roles?: string[];
}

export function getCurrentUser(user: StoreAuthUserInput) {
  return {
    userId: user.id,
    realName: user.username ?? "商家用户",
    storeId: user.storeId ?? 1,
    role: user.roles?.[0] ?? "STAFF",
    permissions: [
      "dashboard.view", "order.view", "order.deliver", "order.complete",
      "inventory.view", "customer.view", "receivable.view", "report.view"
    ],
    menus: ["home", "orders", "inventory", "customers", "receivables", "reports", "profile"]
  };
}

export async function getStoreInfo(storeId: number, tenantId: string) {
  const store = await queryOneWithTenant<StoreInfoRow>(
    `SELECT name, address, phone, contact,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM t_store WHERE id = ? AND tenant_id = ?`,
    [storeId, tenantId],
    tenantId
  );
  if (!store) return null;
  return {
    storeName: store.name,
    storeAddress: store.address,
    storePhone: store.phone,
    storeContact: store.contact,
    miniappAppid: store.miniappAppid,
    wxMerchantName: store.wxMerchantName,
    wxServicePhone: store.wxServicePhone,
    wxHeadImg: store.wxHeadImg,
    wxQrcodeUrl: store.wxQrcodeUrl
  };
}