
import { query, queryOne, queryOneWithTenant } from "../../shared/db";
import { signToken, getUserAccessInfo } from "../../middleware/auth";
import { verifyPassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
// S3-203：移动端（store）与工作台（admin）必须从**同一处**解析同一角色的权限集合
import { getUserPermissions } from "../../shared/user-permissions";
// S3-203：唯一对外账号（admin）的核定口径与 auth.service.ts / 限流器同源
import { constants } from "../../config/constants";

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
    // 注册是平台审核制：审核通过才写入 t_sys_user。账号不存在时先查是否有待审申请，
    // 避免把"还没审核"误报成"账号或密码错误"（2026-09-08 生产实证：8 条申请全 PENDING，
    // 用户注册后登录被误报密码错误）
    const pendingApplication = await queryOne<{ id: number }>(
      "SELECT id FROM t_tenant_register_application WHERE admin_username = ? AND status = 'PENDING' LIMIT 1",
      [username]
    );
    if (pendingApplication) {
      throw new AppError("注册申请正在审核中，审核通过后即可登录", 403);
    }
    throw new AppError("账号或密码错误", 400);
  }

  if (account.status !== 1) {
    throw new AppError("账号已禁用", 400);
  }

  // S3-203：唯一对外账号（`admin`，同时承担演示入口）对「账号锁定」免疫 —— 与
  // services/admin/auth.service.ts 的 S3-172 豁免同一口径（常量同源：config/constants.ts 的
  // DEMO_USERNAME）。理由：该口令是公开值（登录页一键演示），锁它只毁演示、没有安全收益；
  // 真实滥用防护在限流/审计层。
  const isDemoAccount = account.username === constants.DEMO_USERNAME;

  if (!isDemoAccount && account.locked_until && new Date(account.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
    throw new AppError(`账号已锁定，请${remainingMinutes}分钟后重试`, 400);
  }

  if (!(await verifyPassword(password, account.password_hash))) {
    // S3-203：豁免账号不累加失败计数、不写 locked_until（其余分支一字不改）
    if (isDemoAccount) {
      throw new AppError("账号或密码错误", 400);
    }
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

  const tenantId = account.tenant_id || 'default';
  // S3-203（跨端口径一致）：角色行必须与被绑定行同租户 —— 与工作台
  // `getUserPermissions()`（`r.tenant_id = ur.tenant_id`）保持同一判据；
  // 缺这条过滤时跨租户绑定会让同一 role_code 命中多行，两端口径就此分叉。
  const roles = await query<RoleRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [account.id]
  );
  const roleCodes = roles.map((r) => r.role_code);
  // S3-203：登录响应**必须带上**与工作台同源的权限集合（此前移动端登录响应里没有 permissions，
  // 权限只能靠 getCurrentUser 里那份硬编码数组 ⇒ 同一角色两端不一致）。
  const permissions = await getUserPermissions(account.id, tenantId);
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
    permissions,
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
  /** 租户 id（S3-203：解析权限集合必须限定租户，与工作台同判据） */
  tenantId?: string | null;
}

/**
 * 移动端「当前用户」。
 *
 * S3-203 口径变更：`permissions` 原先是一份**硬编码数组**（`dashboard.view` / `order.view` …），
 * 那是移动端自带的**第二套权限口径** —— 同一角色在工作台读 `t_sys_role.permissions`、
 * 在移动端读这份常量，两端天然可能不一致，且角色配置改了移动端不会跟。
 * 现在改成读**同一处** `getUserPermissions()`（shared/user-permissions.ts）。
 * `menus` 仍是移动端自己的页面清单（不属于权限口径），维持不变。
 */
export async function getCurrentUser(user: StoreAuthUserInput) {
  const tenantId = user.tenantId || "default";
  const permissions = await getUserPermissions(user.id, tenantId);
  return {
    userId: user.id,
    realName: user.username ?? "商家用户",
    storeId: user.storeId ?? 1,
    role: user.roles?.[0] ?? "STAFF",
    permissions,
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
