import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import {
  signToken,
  getUserAccessInfo,
  AuthUser,
  MERCHANT_TOKEN_TTL_DEFAULT,
  MERCHANT_TOKEN_TTL_REMEMBER_ME,
  MERCHANT_TOKEN_TTL_SECONDS,
  MerchantTokenTtl,
} from "../../middleware/auth";
import { verifyPassword, validatePassword, hashPassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import { generateCsrfToken } from "../../middleware/csrf";
import { env } from "../../config/env";
import { constants } from "../../config/constants";
import { signMfaToken } from "../../middleware/mfa-token";
// S3-203：权限集合解析移入 shared（唯一出处），工作台与移动端共用同一处判据
import { getUserPermissions } from "../../shared/user-permissions";

// ==================== 类型定义 ====================

/** 系统用户登录信息行（含 MFA 字段） */
export interface SysUserLoginRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  store_id: number | null;
  status: number;
  tenant_id: string;
  login_fail_count: number;
  locked_until: Date | string | null;
  mfa_secret?: string | null;
  mfa_enabled?: number;
}

/** 角色编码行 */
interface RoleCodeRow {
  role_code: string;
}

/** 用户主页设置行 */
interface UserHomepageRow {
  default_homepage: string;
}

/** 用户密码行 */
interface UserPasswordRow {
  passwordHash: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * 演示账号用户名（唯一来源）。
 *
 * S3-160-F1b：`demoLogin()` 与 `issueLoginResult()` 的「记住我」长效判定共用此常量，
 * 全文件不得再出现第二处演示账号用户名硬编码字面量。
 *
 * S3-172：值本身移入 `config/constants.ts`（无依赖的业务常量文件），
 * 好让 `middleware/login-fail-limiter.ts` 能在**不引入 services 层**的前提下共用同一口径；
 * 本常量仍是本文件与外部的对外入口（引用路径不变）。
 */
export const DEMO_USERNAME = constants.DEMO_USERNAME;

/**
 * 唯一对外账号（= 演示入口账号）的归属租户（唯一来源）。
 *
 * S3-174-F1 曾要求演示账号独立落在演示租户 `demo`（避免公开口令读到真实业务数据）；
 * **S3-203（2026-10-15 业主口径）已作废该隔离**：业主明示
 * 「不要做那么多的和演示相关账号，全部统一为一个，另外就是真实租户账号」+「演示 = 真实数据」，
 * 唯一对外账号就是**真实租户 default 的超管 `admin`**，故本常量回到 `default`。
 *
 * ⚠️ 随之作废的还有"归属自愈"：既然账号本来就是 default 的超管，登录路径**不得**再改写
 * `t_sys_user.tenant_id`（旧自愈会把超管搬到 demo 租户，属于破坏性写操作）。见 `demoLogin()`。
 */
export const DEMO_TENANT = "default";

export async function login(username: string, password: string, rememberMe = false) {
  const account = await queryOne<SysUserLoginRow>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id, login_fail_count, locked_until, mfa_secret, mfa_enabled FROM t_sys_user WHERE username = ? LIMIT 1",
    [username]
  );

  if (!account) {
    throw new AppError("账号或密码错误", 400);
  }

  if (account.status !== 1) {
    throw new AppError("账号已禁用", 400);
  }

  // S3-172：演示账号对「账号锁定」免疫。
  // 理由：演示口令是**公开值**（登录页一键演示用），锁它只会毁演示、没有任何安全收益；
  // 真实的滥用防护在限流层（IP 维度，见 middleware/login-fail-limiter.ts）。
  // 只跳过「锁定阻断」与「失败累加」两处，其余分支（禁用判定、成功清零、MFA、签发）一字不改。
  const isDemoAccount = account.username === DEMO_USERNAME;

  if (!isDemoAccount && account.locked_until && new Date(account.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
    throw new AppError(`账号已锁定，请${remainingMinutes}分钟后重试`, 400);
  }

  if (!(await verifyPassword(password, account.password_hash))) {
    // S3-172：演示账号口令错误时**不累加** login_fail_count、**不写** locked_until
    // （其它账号一字不改：仍是 5 次锁 15 分钟 + 剩余次数提示）。
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

  // 双因素认证：账号启用 MFA 时，第一步仅返回挑战令牌，需动态码二次验证
  if (Number(account.mfa_enabled) === 1) {
    return {
      mfaRequired: true,
      mfaToken: signMfaToken({
        id: account.id,
        username: account.username,
        tenantId: account.tenant_id || "default",
      }),
    };
  }

  return issueLoginResult(account, rememberMe);
}

/**
 * 根据已通过密码校验的账号签发完整登录结果（登录/MFA 二次验证共用）
 *
 * 记住我（S3-160 / F1b 收窄）：仅**演示账号**（`username === DEMO_USERNAME`）且显式
 * `rememberMe === true` 才签发 30 天长效 token；其余一切情形（含正式账号传 `true`、
 * 缺省/`false`）一律 4h 短效。
 */
export async function issueLoginResult(account: SysUserLoginRow, rememberMe = false) {
  const resolvedTenantId = account.tenant_id || 'default';
  const roles = await query<RoleCodeRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?
       AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [account.id, resolvedTenantId]
  );
  const roleCodes = roles.map((r) => r.role_code);

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
  // S3-160：如实回一个字段说明本次签发的是长效还是短效（秒），便于前端与验收核对；不含任何密钥信息
  // S3-160-F1b：只有演示账号 + 显式勾选记住我才长效；正式账号传 true 也只签 4h
  const ttl: MerchantTokenTtl =
    account.username === DEMO_USERNAME && rememberMe === true
      ? MERCHANT_TOKEN_TTL_REMEMBER_ME
      : MERCHANT_TOKEN_TTL_DEFAULT;
  return {
    token: signToken(authUser, ttl),
    user,
    csrfToken: generateCsrfToken(account.id),
    expiresIn: MERCHANT_TOKEN_TTL_SECONDS[ttl],
  };
}

/**
 * 运营系统服务账号换发 JWT（统一工作台方案 §5.4 / P0）。
 * - 校验服务账号凭证（环境变量 SERVICE_ACCOUNT_CLIENT_ID/SECRET）
 * - 按请求方指定 tenantId 签发（租户隔离来自 JWT，须按租户换发）
 * - 角色固定 SUPER_ADMIN（服务账号专用，仅服务端调用，权限最小化后续可收紧）
 */
export async function issueServiceToken(
  clientId: string,
  clientSecret: string,
  tenantId?: string,
) {
  const expectedId = env.SERVICE_ACCOUNT_CLIENT_ID;
  const expectedSecret = env.SERVICE_ACCOUNT_CLIENT_SECRET;
  if (
    !expectedId ||
    !expectedSecret ||
    clientId !== expectedId ||
    clientSecret !== expectedSecret
  ) {
    throw new AppError("服务账号凭证无效", 401);
  }

  const authUser: AuthUser = {
    id: -1,
    username: "service-ops",
    realName: "运营系统服务账号",
    roles: ["SUPER_ADMIN"],
    storeId: null,
    tenantId: tenantId || "default",
  };
  const token = signToken(authUser);
  return { token, expiresIn: MERCHANT_TOKEN_TTL_SECONDS[MERCHANT_TOKEN_TTL_DEFAULT] };
}

export async function getMe(user: AuthUser) {
  const userSetting = await queryOneWithTenant<UserHomepageRow>(
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
  const userSetting = await queryOneWithTenant<UserHomepageRow>(
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
  const user = await queryOneWithTenant<UserPasswordRow>(
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

  const hashed = await hashPassword(newPassword);
  // S3-65：必须校验受影响行数。UPDATE 未命中任何行时（用户不存在 / 租户不匹配 / 记录已被删除 /
  // 租户条件注入后 WHERE 不成立）绝不能返回"密码修改成功"——生产实测过这种"假成功"：
  // 接口返回 code 0，但库内 password_hash 未变、新口令登录 400、旧口令登录 200。
  const updateRows = await queryWithTenant<{ affectedRows: number }>(
    "UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ?",
    [hashed, userId],
    tenantId
  );
  const affectedRows = Array.isArray(updateRows) ? Number(updateRows[0]?.affectedRows ?? 0) : 0;
  if (affectedRows === 0) {
    throw new AppError("密码修改失败：未更新任何记录（用户不存在、租户不匹配或记录已被删除）", 500);
  }
  return { message: "密码修改成功" };
}

/**
 * 演示入口登录（免密）：对**唯一对外账号**（`admin`，租户 default 的真实超管）签发 token。
 *
 * S3-203 口径变更（业主 2026-10-15）：演示入口不再是独立的 `demo` 账号，而是真实超管 `admin`
 * ——「演示 = 真实数据」。因此：
 *   · 保留：禁用自动恢复、锁定计数清零（对外演示必须随时可用）、幂等绑 SUPER_ADMIN、
 *     角色/权限按 `DEMO_TENANT`（=default）解析；
 *   · **移除**：账号不存在时自动建号（那条路径现在会凭空造出一个 default 租户的超管账号，
 *     属越权建号 ⇒ 改为 fail-closed 报错，账号必须由迁移/后台创建）；
 *   · **移除**：归属自愈（旧口径要把账号搬进 demo 租户；现在账号本就该在 default，
 *     登录路径不得改写 tenant_id）。
 * ⚠️ 本接口在生产环境由 `isDemoLoginEnabled()` 门控关闭（403），见 controllers/admin/auth.controller.ts。
 */
export async function demoLogin() {
  let account = await queryOne<SysUserLoginRow>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id, login_fail_count, locked_until FROM t_sys_user WHERE username = ? AND tenant_id = ? LIMIT 1",
    [DEMO_USERNAME, DEMO_TENANT]
  );

  if (!account) {
    // S3-203：不再自动建号。唯一对外账号 `admin` 是**真实超管**，
    // 免密演示路径凭空创建它 = 越权建号（且会给新号绑上 SUPER_ADMIN）。
    throw new AppError("演示入口账号未初始化，请联系管理员", 500);
  }

  if (account.status !== 1) {
    // 演示账号被禁用时自动恢复
    await query("UPDATE t_sys_user SET status = 1, updated_at = NOW() WHERE id = ?", [account.id]);
    account.status = 1;
  }

  // 确保绑定 SUPER_ADMIN 角色（幂等：存在则跳过、缺失才补，不用 INSERT IGNORE 掩盖冲突）
  // S3-174-F2：角色行是**租户内实体**（t_sys_role 唯一键 uk_role_code_tenant），此查询必须限定
  // DEMO_TENANT —— 不限租户时 LIMIT 1 会命中 default 租户的 SUPER_ADMIN 行，登录一次就把
  // default 的角色 id 绑进 demo（该跨租户绑定过不了 getUserPermissions 的 r.tenant_id = ur.tenant_id，
  // 还会让随后重跑迁移 197 的"按 role_code 重指向"撞上 uk_sys_user_role (user_id, role_id) 唯一键）。
  const superRole = await queryOne<RoleRow>(
    "SELECT id, role_code FROM t_sys_role WHERE role_code = 'SUPER_ADMIN' AND tenant_id = ? LIMIT 1",
    [DEMO_TENANT]
  );
  if (superRole) {
    await query(
      `INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
       SELECT ?, ?, ? FROM (SELECT 1 AS whether_to_bind) AS bind_probe
       WHERE NOT EXISTS (SELECT 1 FROM t_sys_user_role WHERE user_id = ? AND role_id = ?)`,
      [account.id, superRole.id, DEMO_TENANT, account.id, superRole.id]
    );
  }

  await query(
    "UPDATE t_sys_user SET login_fail_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
    [account.id]
  );

  // S3-183（收口总清单第 17 项）：roles 查询必须限定"角色行属于该绑定行所在租户"。
  // 缺这条过滤时，只要存在一条跨租户绑定（如绑定指向 default 的 SUPER_ADMIN），登录返回的
  // roles 里就会出现重复的 SUPER_ADMIN（同一 role_code 命中两行）。必须与第 18 项的存量修复
  // （198 把绑定指回本租户角色行）**同批**上线：先加过滤会把尚未修复的账号打空。
  const roles = await query<RoleCodeRow>(
    `SELECT r.role_code
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [account.id]
  );
  const roleCodes = roles.map((r) => r.role_code);
  const permissions = await getUserPermissions(account.id, DEMO_TENANT);

  const authUser: AuthUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes,
    storeId: account.store_id,
    tenantId: DEMO_TENANT,
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    tenantId: DEMO_TENANT,
    roles: roleCodes,
    permissions,
    ...accessInfo,
  };
  return { token: signToken(authUser), user, csrfToken: generateCsrfToken(account.id), demo: true };
}

/** 插入结果行（mysql2 ResultSetHeader 的最小字段） */
interface ResultSetHeaderRow {
  insertId: number;
}

/** 角色行 */
interface RoleRow {
  id: number;
  role_code: string;
}
