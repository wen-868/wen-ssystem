import { z } from "zod";
import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { signToken, getUserAccessInfo } from "../../middleware/auth.js";
import { verifyPassword } from "../../shared/password.js";

export async function login(username: string, password: string) {
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id FROM sys_user WHERE username = ? LIMIT 1",
    [username]
  );
  if (!account || account.status !== 1 || !(await verifyPassword(password, account.password_hash))) {
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

export function getCurrentUser(user: any) {
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
  const store = await queryOneWithTenant<any>(
    `SELECT name, address, phone, contact,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
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