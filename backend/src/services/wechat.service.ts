import { query, queryOne } from "../shared/db";
import { verifyPassword } from "../shared/password";

interface WxUserInfoRow {
  id: number;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  gender: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}

interface WxUserProfileRow {
  id: number;
  openid: string;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  gender: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

interface UserBindingRow {
  id: number;
  binding_type: string;
  status: string;
  bound_at: string | null;
  username: string | null;
  realName: string | null;
}

export async function login(wxData: { openid: string; session_key: string; unionid?: string }, signWxToken: (wxUserId: number, openid: string) => string) {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM t_wx_user WHERE openid = ?",
    [wxData.openid]
  );

  let wxUserId: number;
  if (existing) {
    await query(
      "UPDATE t_wx_user SET session_key = ?, unionid = ?, last_login_at = NOW() WHERE id = ?",
      [wxData.session_key, wxData.unionid || null, existing.id]
    );
    wxUserId = existing.id;
  } else {
    const result = await query<Array<{ insertId?: number }> | { insertId?: number }>(
      "INSERT INTO t_wx_user (openid, unionid, session_key, last_login_at) VALUES (?, ?, ?, NOW())",
      [wxData.openid, wxData.unionid || null, wxData.session_key]
    );
    // database.ts 将 ResultSetHeader 归一化为数组返回，需从首元素取 insertId
    wxUserId = Array.isArray(result) ? (result[0]?.insertId ?? 0) : (result?.insertId ?? 0);
  }

  const userInfo = await queryOne<WxUserInfoRow>(
    "SELECT id, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country FROM t_wx_user WHERE id = ?",
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

export async function getSessionKey(
  wxUserId: number
): Promise<{ session_key: string } | null> {
  return await queryOne<{ session_key: string }>(
    "SELECT session_key FROM t_wx_user WHERE id = ?",
    [wxUserId]
  );
}

export async function decryptPhone(
  wxUserId: number,
  phone: string
) {
  await query(
    "UPDATE t_wx_user SET phone = ? WHERE id = ?",
    [phone, wxUserId]
  );

  return { phone };
}

export async function updateProfile(wxUserId: number, body: { nickname?: string; avatarUrl?: string }) {
  await query(
    "UPDATE t_wx_user SET nickname = ?, avatar_url = ? WHERE id = ?",
    [body.nickname || null, body.avatarUrl || null, wxUserId]
  );
}

export async function getProfile(wxUserId: number) {
  const userInfo = await queryOne<WxUserProfileRow>(
    `SELECT id, openid, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country,
            last_login_at AS lastLoginAt, created_at AS createdAt
     FROM t_wx_user WHERE id = ?`,
    [wxUserId]
  );

  if (!userInfo) {
    return null;
  }

  const bindings = await query<UserBindingRow>(
    `SELECT ub.id, ub.binding_type, ub.status, ub.bound_at,
            su.username, su.real_name AS realName
     FROM t_user_binding ub
     LEFT JOIN t_sys_user su ON su.id = ub.system_user_id
     WHERE ub.wx_user_id = ? AND ub.status = 'ACTIVE'`,
    [wxUserId]
  );

  return { ...userInfo, bindings };
}

export async function bindUser(
  wxUserId: number,
  body: { username: string; password: string; bindingType: string },
  tenantId: string
) {
  const sysUser = await queryOne<{ id: number; password_hash: string; username: string; real_name: string }>(
    "SELECT id, password_hash, username, real_name FROM t_sys_user WHERE username = ? AND tenant_id = ? AND status = 1",
    [body.username, tenantId]
  );

  if (!sysUser) {
    return { success: false, code: "400", message: "账号不存在或已禁用" };
  }

  if (!(await verifyPassword(body.password, sysUser.password_hash))) {
    return { success: false, code: "400", message: "密码错误" };
  }

  const existingBinding = await queryOne<{ id: number }>(
    "SELECT id FROM t_user_binding WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUserId, sysUser.id]
  );

  if (existingBinding) {
    return { success: false, code: "400", message: "该账号已绑定" };
  }

  await query(
    "INSERT INTO t_user_binding (wx_user_id, system_user_id, binding_type, status) VALUES (?, ?, ?, 'ACTIVE')",
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
  const result = await query<{ affectedRows: number }>(
    "UPDATE t_user_binding SET status = 'UNBOUND', unbound_at = NOW() WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUserId, systemUserId]
  );

  if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
    return { success: false, code: "400", message: "未找到有效绑定关系" };
  }

  return { success: true, message: "解绑成功" };
}
