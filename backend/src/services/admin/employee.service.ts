import bcrypt from "bcryptjs";
import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function listStaff(tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT id AS staffId, username, real_name AS realName, store_id AS storeId, status
     FROM sys_user
     WHERE status = 1
     ORDER BY id ASC`,
    [],
    tenantId
  );
  return { total: records.length, records };
}

export async function createStaff(body: {
  username: string;
  realName: string;
  mobile?: string;
  roleId?: string;
  storeId?: number;
  status?: number;
  password?: string;
}, tenantId: string) {
  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 10)
    : await bcrypt.hash("123456", 10);
  const result = await queryWithTenant<any>(
    `INSERT INTO sys_user (username, real_name, mobile, store_id, status, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [body.username, body.realName, body.mobile ?? null, body.storeId ?? 1, body.status ?? 1, passwordHash],
    tenantId
  );
  return { staffId: (result as any).insertId, username: body.username, realName: body.realName };
}

export async function updateStaff(id: number, body: {
  username?: string;
  realName?: string;
  mobile?: string;
  roleId?: string;
  storeId?: number;
  status?: number;
}, tenantId: string) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.username !== undefined) { sets.push("username = ?"); params.push(body.username); }
  if (body.realName !== undefined) { sets.push("real_name = ?"); params.push(body.realName); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.storeId !== undefined) { sets.push("store_id = ?"); params.push(body.storeId); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) return {};
  params.push(id);
  await queryWithTenant(`UPDATE sys_user SET ${sets.join(", ")} WHERE id = ?`, params, tenantId);
  return { staffId: id };
}

export async function disableStaff(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, username, status FROM sys_user WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("员工不存在"), { statusCode: 404 });
  }
  if (existing.status !== 1) {
    throw Object.assign(new Error("员工已停用"), { statusCode: 400 });
  }
  await queryWithTenant("UPDATE sys_user SET status = 0 WHERE id = ?", [id], tenantId);
  return { staffId: id, username: existing.username };
}

export async function listStores(page: number, pageSize: number, tenantId: string, keyword?: string) {
  const kw = `%${keyword || ""}%`;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store
     WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, kw, kw, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS total FROM store WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)",
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
    `INSERT INTO store (store_code, name, address, lng, lat, contact, phone, delivery_radius, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeCode, body.name, body.address, body.lng ?? null, body.lat ?? null, body.contact ?? null, body.phone ?? null, body.deliveryRadius ?? 3, tenantId],
    tenantId
  );
  const created = await queryOneWithTenant<any>(
    "SELECT id, store_code AS storeCode, name FROM store WHERE store_code = ? AND tenant_id = ?",
    [storeCode, tenantId],
    tenantId
  );
  return created;
}

export async function getStore(id: number, tenantId: string) {
  const store = await queryOneWithTenant<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
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
  const existing = await queryOneWithTenant<any>("SELECT id FROM store WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
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
    await queryWithTenant(`UPDATE store SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, id, tenantId], tenantId);
  }

  const store = await queryOneWithTenant<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return store;
}

export async function getStoreWechatInfo(id: number, tenantId: string) {
  const store = await queryOneWithTenant<any>(
    `SELECT id, name, phone, miniapp_appid AS miniappAppid,
            wx_merchant_name AS wxMerchantName, wx_service_phone AS wxServicePhone,
            wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
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

  // 模拟通过微信 API 根据 appid 拉取商户信息
  // 真实环境需要调用微信开放平台 API：https://open.weixin.qq.com
  // 需要配置 access_token 和对应的 API secret
  const mockWxInfo = {
    merchantName: store.name || "未命名商户",
    servicePhone: store.phone || "400-000-0000",
    headImg: "https://thirdwx.qlogo.cn/mmopen/test/132",
    qrcodeUrl: `https://mp.weixin.qq.com/a/~${appid}~`
  };

  // 更新到数据库
  await queryWithTenant(
    `UPDATE store SET wx_merchant_name = ?, wx_service_phone = ?, wx_head_img = ?, wx_qrcode_url = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [mockWxInfo.merchantName, mockWxInfo.servicePhone, mockWxInfo.headImg, mockWxInfo.qrcodeUrl, id, tenantId],
    tenantId
  );

  return {
    miniappAppid: appid,
    wxMerchantName: mockWxInfo.merchantName,
    wxServicePhone: mockWxInfo.servicePhone,
    wxHeadImg: mockWxInfo.headImg,
    wxQrcodeUrl: mockWxInfo.qrcodeUrl
  };
}