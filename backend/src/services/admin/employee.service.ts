import bcrypt from "bcryptjs";
import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { validatePassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import type { ResultSetHeader } from "mysql2/promise";

// ===== 类型定义 =====
/** id 查询行 */
interface IdRow {
  id: number | string;
}

/** COUNT(*) AS total 查询行 */
interface CountTotalRow {
  total: number | string;
}

/** 员工列表查询行 */
interface StaffListRow {
  staffId: number | string;
  username: string;
  realName: string | null;
  mobile: string | null;
  storeId: number | string | null;
  storeName: string | null;
  departmentId: number | string | null;
  departmentName: string | null;
  positionId: number | string | null;
  positionName: string | null;
  roleCodes: string | null;
  roleIds: string | null;
  status: number | string;
}

/** 员工 id/username/status 查询行 */
interface StaffIdUsernameStatusRow {
  id: number | string;
  username: string;
  status: number | string;
}

/** 门店列表/详情查询行 */
interface StoreListRow {
  id: number | string;
  storeCode: string;
  name: string;
  address: string | null;
  contact: string | null;
  phone: string | null;
  deliveryRadius: number | string | null;
  businessStatus: string | null;
  status: number | string;
  miniappAppid: string | null;
  wxMerchantName: string | null;
  wxServicePhone: string | null;
  wxHeadImg: string | null;
  wxQrcodeUrl: string | null;
}

/** 门店 id/storeCode/name 查询行 */
interface StoreIdCodeNameRow {
  id: number | string;
  storeCode: string;
  name: string;
}

/** 门店微信信息查询行 */
interface StoreWechatInfoRow {
  id: number | string;
  name: string;
  phone: string | null;
  miniappAppid: string | null;
  wxMerchantName: string | null;
  wxServicePhone: string | null;
  wxHeadImg: string | null;
  wxQrcodeUrl: string | null;
}

/** 校验角色是否可通过员工管理授权（超级管理员为老板唯一账号，禁止授权） */
async function assertRoleAssignable(roleId: number) {
  const role = await queryOne<{ role_code: string }>(
    "SELECT role_code FROM t_sys_role WHERE id = ?",
    [roleId]
  );
  if (role?.role_code === "SUPER_ADMIN") {
    throw new AppError("超级管理员为老板唯一账号，不能通过员工管理授权", 400);
  }
}

export async function listStaff(tenantId: string) {
  const records = await queryWithTenant<StaffListRow>(
    `SELECT u.id AS staffId, u.username, u.real_name AS realName, u.mobile,
            u.store_id AS storeId, u.department_id AS departmentId, u.position_id AS positionId,
            d.name AS departmentName, p.position_name AS positionName,
            s.name AS storeName,
            GROUP_CONCAT(r.role_code ORDER BY r.role_code SEPARATOR ',') AS roleCodes,
            GROUP_CONCAT(ur.role_id ORDER BY ur.role_id SEPARATOR ',') AS roleIds,
            u.status
     FROM t_sys_user u
     LEFT JOIN t_sys_department d ON d.id = u.department_id
     LEFT JOIN t_sys_position p ON p.id = u.position_id
     LEFT JOIN t_store s ON s.id = u.store_id AND s.tenant_id = u.tenant_id
     LEFT JOIN t_sys_user_role ur ON ur.user_id = u.id
     LEFT JOIN t_sys_role r ON r.id = ur.role_id
     WHERE u.tenant_id = ? AND u.status = 1
     GROUP BY u.id
     ORDER BY u.id ASC`,
    [tenantId],
    tenantId
  );
  return { total: records.length, records };
}

export async function createStaff(body: {
  username: string;
  realName: string;
  mobile?: string;
  roleId?: number | string;
  storeId?: number;
  departmentId?: number;
  positionId?: number;
  status?: number;
  password?: string;
}, tenantId: string) {
  if (body.password) {
    const validation = validatePassword(body.password);
    if (!validation.valid) {
      throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
    }
  }

  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 10)
    : await bcrypt.hash("123456", 10);
  const result = await queryWithTenant<ResultSetHeader>(
    `INSERT INTO t_sys_user (username, real_name, mobile, store_id, department_id, position_id, status, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.username, body.realName, body.mobile ?? null,
      body.storeId ?? null, body.departmentId ?? null, body.positionId ?? null,
      body.status ?? 1, passwordHash
    ],
    tenantId
  );
  const staffId = (result as unknown as Record<string, unknown>).insertId;
  // 绑定角色（角色权限一体化）
  if (body.roleId) {
    await assertRoleAssignable(Number(body.roleId));
    await queryWithTenant(
      "INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
      [staffId, Number(body.roleId), tenantId],
      tenantId
    );
  }
  return { staffId, username: body.username, realName: body.realName };
}

export async function updateStaff(id: number, body: {
  username?: string;
  realName?: string;
  mobile?: string;
  roleId?: number | string | null;
  storeId?: number;
  departmentId?: number | null;
  positionId?: number | null;
  status?: number;
}, tenantId: string) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.username !== undefined) { sets.push("username = ?"); params.push(body.username); }
  if (body.realName !== undefined) { sets.push("real_name = ?"); params.push(body.realName); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.storeId !== undefined) { sets.push("store_id = ?"); params.push(body.storeId); }
  if (body.departmentId !== undefined) { sets.push("department_id = ?"); params.push(body.departmentId); }
  if (body.positionId !== undefined) { sets.push("position_id = ?"); params.push(body.positionId); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE t_sys_user SET ${sets.join(", ")} WHERE id = ?`, params, tenantId);
  }
  // 角色变更：先清后绑（null 表示清空角色）
  if (body.roleId !== undefined) {
    await queryWithTenant("DELETE FROM t_sys_user_role WHERE user_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
    if (body.roleId) {
      await assertRoleAssignable(Number(body.roleId));
      await queryWithTenant(
        "INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
        [id, Number(body.roleId), tenantId],
        tenantId
      );
    }
  }
  return { staffId: id };
}

export async function disableStaff(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<StaffIdUsernameStatusRow>("SELECT id, username, status FROM t_sys_user WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("员工不存在"), { statusCode: 404 });
  }
  if (existing.status !== 1) {
    throw Object.assign(new Error("员工已停用"), { statusCode: 400 });
  }
  await queryWithTenant("UPDATE t_sys_user SET status = 0 WHERE id = ?", [id], tenantId);
  return { staffId: id, username: existing.username };
}

/** 启用/禁用员工（组织架构页统一入口） */
export async function setStaffStatus(id: number, status: number, tenantId: string) {
  const existing = await queryOneWithTenant<StaffIdUsernameStatusRow>("SELECT id, username, status FROM t_sys_user WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("员工不存在"), { statusCode: 404 });
  }
  await queryWithTenant("UPDATE t_sys_user SET status = ? WHERE id = ?", [status, id], tenantId);
  return { staffId: id, username: existing.username, status };
}

export async function listStores(page: number, pageSize: number, tenantId: string, keyword?: string) {
  const kw = `%${keyword || ""}%`;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<StoreListRow>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM t_store
     WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, kw, kw, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM t_store WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)",
    [tenantId, kw, kw],
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createStore(body: {
  name: string;
  address: string;
  lng?: number;
  lat?: number;
  contact?: string;
  phone?: string;
  deliveryRadius?: number;
}, tenantId: string) {
  const storeCode = makeBizNo("MD");
  await queryWithTenant(
    `INSERT INTO t_store (store_code, name, address, lng, lat, contact, phone, delivery_radius, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeCode, body.name, body.address, body.lng ?? null, body.lat ?? null, body.contact ?? null, body.phone ?? null, body.deliveryRadius ?? 3, tenantId],
    tenantId
  );
  const created = await queryOneWithTenant<StoreIdCodeNameRow>(
    "SELECT id, store_code AS storeCode, name FROM t_store WHERE store_code = ? AND tenant_id = ?",
    [storeCode, tenantId],
    tenantId
  );
  return created;
}

export async function getStore(id: number, tenantId: string) {
  const store = await queryOneWithTenant<StoreListRow>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM t_store WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!store) {
    throw Object.assign(new Error("门店不存在"), { statusCode: 404 });
  }
  return store;
}

export async function updateStore(id: number, body: {
  name?: string;
  address?: string;
  phone?: string;
  status?: number;
  longitude?: number;
  latitude?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>("SELECT id FROM t_store WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!existing) {
    throw Object.assign(new Error("门店不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.address !== undefined) { updates.push("address = ?"); params.push(body.address); }
  if (body.phone !== undefined) { updates.push("phone = ?"); params.push(body.phone); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }
  if (body.longitude !== undefined) { updates.push("longitude = ?"); params.push(body.longitude); }
  if (body.latitude !== undefined) { updates.push("latitude = ?"); params.push(body.latitude); }

  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    await queryWithTenant(`UPDATE t_store SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId], tenantId);
  }

  const store = await queryOneWithTenant<StoreListRow>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM t_store WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return store;
}

export async function getStoreWechatInfo(id: number, tenantId: string) {
  const store = await queryOneWithTenant<StoreWechatInfoRow>(
    `SELECT id, name, phone, miniapp_appid AS miniappAppid,
            wx_merchant_name AS wxMerchantName, wx_service_phone AS wxServicePhone,
            wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM t_store WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!store) {
    throw Object.assign(new Error("门店不存在"), { statusCode: 404 });
  }

  const appid = store.miniappAppid;
  if (!appid) {
    throw Object.assign(new Error("请先设置小程序 AppID"), { statusCode: 400 });
  }

  // 真实环境：不再模拟微信商户信息；未配置时明确提示
  if (!store.wxMerchantName) {
    throw Object.assign(
      new Error("尚未配置微信商户信息（商户名称/服务电话/头像/二维码），请在门店信息中补充"),
      { statusCode: 400 }
    );
  }
  return {
    miniappAppid: appid,
    wxMerchantName: store.wxMerchantName,
    wxServicePhone: store.wxServicePhone,
    wxHeadImg: store.wxHeadImg,
    wxQrcodeUrl: store.wxQrcodeUrl
  };
}
