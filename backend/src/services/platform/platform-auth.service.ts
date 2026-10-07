import { queryOne, query } from "../../shared/db";
import { hashPassword, verifyPassword, validatePassword } from "../../shared/password";
import { signPlatformToken } from "../../middleware/auth";
import { signPlatformMfaToken } from "../../middleware/mfa-token";
import { generateCsrfToken } from "../../middleware/csrf";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";
import type { ResultSetHeader } from "mysql2";

// ==================== 类型定义 ====================

/** 平台管理员登录行 */
interface PlatformAdminLoginRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  /** 迁移 196 未执行时该列不存在，缺列防御下按 undefined 处理（等价于未启用） */
  mfa_enabled?: number;
}

/** 平台管理员信息行 */
interface PlatformAdminRow {
  id: number;
  username: string;
  real_name: string;
  /** 迁移 196 未执行时该列不存在，缺列防御下按 undefined 处理（等价于未启用） */
  mfa_enabled?: number;
}

/** 用户名存在性检查行 */
interface PlatformAdminExistRow {
  id: number;
}

/** INSERT 返回结果 */
interface InsertResult extends ResultSetHeader { }

// ==================== 平台管理员 MFA 缺列防御（S3-58-F1-F1） ====================
//
// 背景：S3-58-F1 R3 的平台端 MFA 直接读 t_platform_admin.mfa_enabled / mfa_secret，
// 但生产这两列当时并不存在（判红：SHOW COLUMNS 无此两列、SELECT 实测 ERROR 1054）⇒
// 平台控制台（saas.onepan.cn）全员登录 500。迁移 docs/migrations/196_平台管理员MFA.sql 负责补列，
// 但**部署顺序不可控**（迁移可能没跑或跑失败），故这里再做一层缺列防御：
// 缺列时平台登录与 /me 都**不得 500**，一律按 mfa_enabled = 0（未启用）处理，并打一条 warn。
//
// 两道防线（探测 + 兜底），命中任一即可保证不把 1054 抛给上层：
//  ① 探测：带缓存地查 information_schema.COLUMNS，判断两列是否齐全，齐全才把 mfa 列拼进 SELECT；
//  ② 兜底：真正的 SELECT 若仍报 1054 且点名 mfa 列，则标记缺列、改用不含 mfa 列的 SELECT。
// 注：探测拿不到真实计数（例如单测里 db 被整体 mock）时按「有列」处理，交给第 ② 道兜底，
//     这样既不改变既有测试与正常路径行为，生产缺列时也仍然兜得住。

type PlatformMfaColumnsState = "unknown" | "present" | "absent";
let platformMfaColumnsState: PlatformMfaColumnsState = "unknown";
let platformMfaColumnsWarned = false;

/** t_platform_admin 上**必然存在**的列（不含 MFA 列，缺列时只用这些拼 SELECT，不用 SELECT *） */
const PLATFORM_ADMIN_BASE_COLUMNS = {
  login: "id, username, password_hash, real_name",
  me: "id, username, real_name",
} as const;

function markPlatformMfaColumnsAbsent(reason?: unknown): void {
  platformMfaColumnsState = "absent";
  if (platformMfaColumnsWarned) return;
  platformMfaColumnsWarned = true;
  const detail = reason ? `（原始错误：${reason instanceof Error ? reason.message : String(reason)}）` : "";
  logger.warn(
    `[platform-auth] t_platform_admin 缺少 mfa_secret / mfa_enabled 列，已按 mfa_enabled=0 降级处理${detail}；` +
      "请执行迁移 docs/migrations/196_平台管理员MFA.sql"
  );
}

/** 判断错误是否为「SELECT 引用了不存在的 mfa 列」（MySQL ERROR 1054 / ER_BAD_FIELD_ERROR） */
export function isMissingMfaColumnError(error: unknown): boolean {
  const err = error as { code?: unknown; errno?: unknown; message?: unknown } | null | undefined;
  if (!err) return false;
  const isBadField = err.code === "ER_BAD_FIELD_ERROR" || Number(err.errno) === 1054;
  if (!isBadField) return false;
  return /mfa_secret|mfa_enabled/i.test(String(err.message ?? ""));
}

/** 单列存在性（真实库返回 true/false；非计数行返回 null 表示无法判定） */
async function platformMfaColumnExists(column: "mfa_secret" | "mfa_enabled"): Promise<boolean | null> {
  const row = await queryOne<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_platform_admin' AND COLUMN_NAME = ?",
    [column]
  );
  const cnt = Number((row as { cnt?: unknown } | null)?.cnt);
  return Number.isFinite(cnt) ? cnt > 0 : null;
}

/**
 * t_platform_admin 的 MFA 两列是否可用（带缓存）。
 * 得到确定结论（present / absent）后缓存；无法判定时返回 true（按有列处理，由 1054 兜底）。
 */
export async function platformMfaColumnsReady(): Promise<boolean> {
  if (platformMfaColumnsState === "present") return true;
  if (platformMfaColumnsState === "absent") return false;
  try {
    const hasSecret = await platformMfaColumnExists("mfa_secret");
    const hasEnabled = await platformMfaColumnExists("mfa_enabled");
    if (hasSecret === null || hasEnabled === null) return true;
    if (hasSecret && hasEnabled) {
      platformMfaColumnsState = "present";
      return true;
    }
    markPlatformMfaColumnsAbsent();
    return false;
  } catch {
    // 探测本身失败（权限 / 连接 / mock）⇒ 不作结论，交给 1054 兜底
    return true;
  }
}

/** 查询平台管理员登录行；缺列时退回不含 mfa 列的 SELECT（mfa_enabled 视作 0） */
async function selectPlatformAdminForLogin(username: string): Promise<PlatformAdminLoginRow | null> {
  const withMfa = await platformMfaColumnsReady();
  const sql = (includeMfa: boolean) =>
    `SELECT ${PLATFORM_ADMIN_BASE_COLUMNS.login}${includeMfa ? ", mfa_enabled" : ""} FROM t_platform_admin WHERE username = ? AND status = 1`;
  try {
    return await queryOne<PlatformAdminLoginRow>(sql(withMfa), [username]);
  } catch (error) {
    if (!withMfa || !isMissingMfaColumnError(error)) throw error;
    markPlatformMfaColumnsAbsent(error);
    return queryOne<PlatformAdminLoginRow>(sql(false), [username]);
  }
}

/** 查询平台管理员信息行；缺列时退回不含 mfa 列的 SELECT（mfaEnabled 视作 false） */
async function selectPlatformAdminForMe(adminId: number): Promise<PlatformAdminRow | null> {
  const withMfa = await platformMfaColumnsReady();
  const sql = (includeMfa: boolean) =>
    `SELECT ${PLATFORM_ADMIN_BASE_COLUMNS.me}${includeMfa ? ", mfa_enabled" : ""} FROM t_platform_admin WHERE id = ?`;
  try {
    return await queryOne<PlatformAdminRow>(sql(withMfa), [adminId]);
  } catch (error) {
    if (!withMfa || !isMissingMfaColumnError(error)) throw error;
    markPlatformMfaColumnsAbsent(error);
    return queryOne<PlatformAdminRow>(sql(false), [adminId]);
  }
}

function getStringOrDefault(value: unknown, defaultValue: string): string {
  return value ? String(value) : defaultValue;
}

function checkRequired(fields: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    if (!fields[name]) return name;
  }
  return null;
}

export async function login(username: string, password: string) {
  const missing = checkRequired({ username, password }, ["username", "password"]);
  if (missing) throw new AppError(`缺少必填字段: ${missing}`, 400);

  const admin = await selectPlatformAdminForLogin(username);

  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    throw new AppError("用户名或密码错误", 401);
  }

  // 双因素认证（S3-58-F1 R3，默认不强制）：账号启用 MFA 时，
  // 第一步**只**返回挑战令牌，正式 token 必须经 POST /mfa/verify 二次验证后签发。
  if (Number(admin.mfa_enabled) === 1) {
    return {
      mfaRequired: true as const,
      mfaToken: signPlatformMfaToken({ id: admin.id, username: admin.username }),
    };
  }

  return issueLoginResult(admin);
}

/**
 * 根据已通过密码校验的平台管理员签发完整登录结果（登录 / MFA 二次验证共用）。
 * 注意：只接收 id/username/real_name，**不接触** mfa_secret。
 */
export function issueLoginResult(admin: { id: number; username: string; real_name: string }) {
  const token = signPlatformToken({
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    type: "platform_admin",
  });

  // 下发 CSRF token，saas-admin 写操作需注入 x-csrf-token header（与 admin-web 保持一致）
  return { token, admin: { id: admin.id, username: admin.username, realName: admin.real_name }, csrfToken: generateCsrfToken(admin.id) };
}

export async function getMe(adminId: number) {
  const admin = await selectPlatformAdminForMe(adminId);
  if (!admin) throw new AppError("管理员不存在", 404);
  // /me 接口同步下发 csrfToken，便于前端刷新页面后重新获取
  // mfaEnabled（S3-58-F1 R3）：只作为「总台侧引导开启 MFA」的提示位，默认不强制
  return {
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    mfaEnabled: Number(admin.mfa_enabled) === 1,
    csrfToken: generateCsrfToken(admin.id),
  };
}

export async function createAdmin(data: {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  role?: string;
}) {
  const missing = checkRequired(data, ["username", "password", "realName"]);
  if (missing) throw new AppError(`缺少必填字段: ${missing}`, 400);

  const validation = validatePassword(data.password);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const existing = await queryOne<PlatformAdminExistRow>("SELECT id FROM t_platform_admin WHERE username = ?", [data.username]);
  if (existing) throw new AppError("用户名已存在", 400);

  const passwordHash = await hashPassword(data.password);

  const result = await query<InsertResult>(
    "INSERT INTO t_platform_admin (username, password_hash, real_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
    [
      data.username,
      passwordHash,
      data.realName,
      getStringOrDefault(data.email, ""),
      getStringOrDefault(data.phone, ""),
      getStringOrDefault(data.role, "PLATFORM_ADMIN"),
    ]
  );

  const adminId = (result as unknown as ResultSetHeader).insertId;
  return { id: adminId, username: data.username, realName: data.realName, message: "创建成功" };
}
