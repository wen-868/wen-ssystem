import { query, queryOne } from "../shared/db.js";
import { verifyPassword } from "../shared/password.js";

export async function login(wxData: { openid: string; session_key: string; unionid?: string }, signWxToken: (wxUserId: number, openid: string) => string) {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM wx_user WHERE openid = ?",
    [wxData.openid]
  );

  let wxUserId: number;
  if (existing) {
    await query(
      "UPDATE wx_user SET session_key = ?, unionid = ?, last_login_at = NOW() WHERE id = ?",
      [wxData.session_key, wxData.unionid || null, existing.id]
    );
    wxUserId = existing.id;
  } else {
    const result = await query<{ insertId: number }>(
      "INSERT INTO wx_user (openid, unionid, session_key, last_login_at) VALUES (?, ?, ?, NOW())",
      [wxData.openid, wxData.unionid || null, wxData.session_key]
    ) as { insertId: number };
    wxUserId = result.insertId as unknown as number;
  }

  const userInfo = await queryOne<any>(
    "SELECT id, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country FROM wx_user WHERE id = ?",
    [wxUserId]
  );

  const token = signWxToken(wxUserId, wxData.openid);

  return {
    token,
    userInfo: {
      id: userInfo!.id,
      nickname: userInfo!.nickname || "微信用户",
      avatarUrl: userInfo!.avatarUrl || "",
      phone: userInfo!.phone || "",
    },
  };
}

export async function decryptPhone(
  wxUserId: number,
  phone: string
) {
  await query(
    "UPDATE wx_user SET phone = ? WHERE id = ?",
    [phone, wxUserId]
  );

  return { phone };
}

export async function updateProfile(wxUserId: number, body: { nickname?: string; avatarUrl?: string }) {
  await query(
    "UPDATE wx_user SET nickname = ?, avatar_url = ? WHERE id = ?",
    [body.nickname || null, body.avatarUrl || null, wxUserId]
  );
}

export async function getProfile(wxUserId: number) {
  const userInfo = await queryOne<any>(
    `SELECT id, openid, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country,
            last_login_at AS lastLoginAt, created_at AS createdAt
     FROM wx_user WHERE id = ?`,
    [wxUserId]
  );

  if (!userInfo) {
    return null;
  }

  const bindings = await query<any>(
    `SELECT ub.id, ub.binding_type, ub.status, ub.bound_at,
            su.username, su.real_name AS realName
     FROM user_binding ub
     LEFT JOIN sys_user su ON su.id = ub.system_user_id
     WHERE ub.wx_user_id = ? AND ub.status = 'ACTIVE'`,
    [wxUserId]
  );

  return { ...userInfo, bindings };
}

export async function bindUser(
  wxUserId: number,
  body: { username: string; password: string; bindingType: string }
) {
  const sysUser = await queryOne<{ id: number; password_hash: string; username: string; real_name: string }>(
    "SELECT id, password_hash, username, real_name FROM sys_user WHERE username = ? AND status = 1",
    [body.username]
  );

  if (!sysUser) {
    return { success: false, code: "400", message: "账号不存在或已禁用" };
  }

  if (!(await verifyPassword(body.password, sysUser.password_hash))) {
    return { success: false, code: "400", message: "密码错误" };
  }

  const existingBinding = await queryOne<{ id: number }>(
    "SELECT id FROM user_binding WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUserId, sysUser.id]
  );

  if (existingBinding) {
    return { success: false, code: "400", message: "该账号已绑定" };
  }

  await query(
    "INSERT INTO user_binding (wx_user_id, system_user_id, binding_type, status) VALUES (?, ?, ?, 'ACTIVE')",
    [wxUserId, sysUser.id, body.bindingType]
  );

  return {
    success: true,
    data: {
      bindingType: body.bindingType,
      systemUser: {
        id: sysUser.id,
        username: sysUser.username,
        realName: sysUser.real_name,
      },
    }
  };
}

export async function unbindUser(wxUserId: number, systemUserId: number) {
  const result = await query<any>(
    "UPDATE user_binding SET status = 'UNBOUND', unbound_at = NOW() WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUserId, systemUserId]
  );

  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { success: false, code: "400", message: "未找到有效绑定关系" };
  }

  return { success: true, message: "解绑成功" };
}