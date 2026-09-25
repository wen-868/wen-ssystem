import { query, queryOne, transaction, connExecute } from "../../shared/db";
import { normalizePagination, calculateOffset } from "../../shared/pagination";
import type { ResultSetHeader } from "mysql2";
import { AppError } from "../../shared/app-error";

/**
 * C6-2-T1：平台通知服务（t_platform_notification / t_platform_notification_read）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md 交付物②③、验收标准③⑤⑥
 *       + docs/tasks/cards/R101-C6-2-批2-立项卡-T1+T2+T3+T5.md §二 T1 行、§三 通用硬口径
 *
 * 口径（逐条可核对）：
 * - 平台级表（无租户语义）：用 query()/queryOne()，不走 queryWithTenant（不注入 tenant_id 条件）；
 * - 可见性（唯一判据）：`target_admin_id IS NULL`（全员通知）或 `target_admin_id = <当前管理员>`（定向通知）；
 * - 未读数（卡内硬口径）：**服务端按当前管理员实时计算** —— "可见 + 已读表无该管理员行" 的数量，
 *   与查询条件 unreadOnly 无关（unreadOnly 只影响列表/total）；
 * - 零假数据：所有返回值来自真实查询，空表一律诚实空态（records: [] / total: 0 / unreadCount: 0），
 *   不用 localStorage、不用进程内缓存、不造示例通知（立项清单 R1）；
 * - 标记已读幂等：INSERT IGNORE + 唯一键 (notification_id, admin_id) ⇒ 重复调用不报错、不新增行；
 * - read-all 为**服务端一次写入**（INSERT IGNORE ... SELECT，不做"先查再逐条插入"的竞态写法），
 *   返回 marked = 本次真实新增的已读行数（第二次调用应为 0）；
 * - 通知不存在或对当前管理员不可见 ⇒ 显式抛 404（**不静默成功**、不标记成功）。
 *
 * 权限点（交付物③⑥）：本常量按 T6 目录 `PERMISSION_CATALOG` 的 `ticket:*` 命名风格**预登记**，
 * 但该目录当前**没有 notification 域**（8 个 moduleCode = tenant/billing/sysconfig/monitor/ticket/
 * marketing/ai/common，共 18 条，见 backend/src/services/platform/platform-role.service.ts）
 * ⇒ **未登记**，待凌舟裁定后并入。端点级**只挂 requirePlatformAuth**，
 * 本文件**不实现**任何"永远放行却宣称已鉴权"的假校验（红线⑤）。
 */
export const PLATFORM_NOTIFICATION_PERMISSIONS = {
  view: "notification:view",
  read: "notification:read",
} as const;

/** 通知级别三态（与迁移 181 的 level 列口径逐字一致） */
export const PLATFORM_NOTIFICATION_LEVELS = ["INFO", "WARN", "URGENT"] as const;
export type PlatformNotificationLevel = (typeof PLATFORM_NOTIFICATION_LEVELS)[number];

export interface PlatformNotificationItem {
  id: number;
  title: string;
  content: string | null;
  type: string;
  level: string;
  linkUrl: string | null;
  createdAt: unknown;
  /** 当前管理员是否已读（由已读表真实左连接得出，非前端推断） */
  read: boolean;
}

export interface PlatformNotificationPage {
  total: number;
  page: number;
  pageSize: number;
  /** 服务端按当前管理员计算的未读数（全员 + 定向，且已读者不计） */
  unreadCount: number;
  records: PlatformNotificationItem[];
}

export interface PlatformNotificationListQuery {
  /** 当前平台管理员 ID（requirePlatformAuth 解码出的 id）——未读数与 read 标记都按它计算 */
  adminId: number;
  /** true ⇒ 列表只返回当前管理员未读的通知（total 同时变为筛选后的数量） */
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

interface NotificationRow {
  id: number | string;
  title: string;
  content: string | null;
  type: string;
  level: string;
  linkUrl: string | null;
  createdAt: unknown;
  isRead: number | string | null;
}

/** 可见性条件（全服务唯一一份，避免三处查询口径漂移） */
const VISIBLE_CLAUSE = "(n.target_admin_id IS NULL OR n.target_admin_id = ?)";

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireAdminId(adminId: number): number {
  const parsed = Number(adminId ?? 0);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    // 拿不到当前管理员身份即无法计算"谁读了什么"——显式拒绝，不静默造 ID（红线⑤）
    throw new AppError("缺少平台管理员身份", 401);
  }
  return parsed;
}

function toItem(row: NotificationRow): PlatformNotificationItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    content: row.content === null || row.content === undefined ? null : String(row.content),
    type: String(row.type),
    level: String(row.level),
    linkUrl: row.linkUrl === null || row.linkUrl === undefined ? null : String(row.linkUrl),
    createdAt: row.createdAt,
    // 真实左连接结果：已读行存在 ⇒ isRead=1；不存在 ⇒ NULL/0。不用默认值冒充已读
    read: toNumber(row.isRead) === 1,
  };
}

/**
 * 可见通知计数（可选只看未读）。
 * unreadOnly=true 时附加 `r.id IS NULL`（已读表左连接后为空 ⇒ 未读）。
 */
async function countVisible(adminId: number, unreadOnly: boolean): Promise<number> {
  const rows = await query<{ total: number | string }>(
    `SELECT COUNT(*) AS total
       FROM t_platform_notification n
       LEFT JOIN t_platform_notification_read r
         ON r.notification_id = n.id AND r.admin_id = ?
      WHERE ${VISIBLE_CLAUSE}${unreadOnly ? " AND r.id IS NULL" : ""}`,
    [adminId, adminId]
  );
  return toNumber(rowsOf<{ total: number | string }>(rows)[0]?.total);
}

/**
 * 通知列表（GET /api/platform/notifications）—— 权限点 notification:view
 *
 * - `total` = 当前筛选条件（含 unreadOnly）下的可见通知总数；
 * - `unreadCount` = 服务端按当前管理员计算的未读数，**不受 unreadOnly 影响**；
 * - 分页作用于筛选后的集合；空表 ⇒ records: [] / total: 0 / unreadCount: 0。
 */
export async function listNotifications(
  input: PlatformNotificationListQuery
): Promise<PlatformNotificationPage> {
  const adminId = requireAdminId(input.adminId);
  const unreadOnly = input.unreadOnly === true;
  // 控制器已用 zod 卡住默认值（1 / 20）与上限（100）；此处再规范化一次，防止其它调用方绕过校验
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const offset = calculateOffset(page, pageSize);

  const total = await countVisible(adminId, unreadOnly);
  // unreadOnly=true 时 total 即未读数，不再重复查一次（口径不变，省一次往返）
  const unreadCount = unreadOnly ? total : await countVisible(adminId, true);

  const rows = await query<NotificationRow>(
    `SELECT n.id AS id, n.title AS title, n.content AS content, n.type AS type,
            n.level AS level, n.link_url AS linkUrl, n.created_at AS createdAt,
            CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS isRead
       FROM t_platform_notification n
       LEFT JOIN t_platform_notification_read r
         ON r.notification_id = n.id AND r.admin_id = ?
      WHERE ${VISIBLE_CLAUSE}${unreadOnly ? " AND r.id IS NULL" : ""}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ? OFFSET ?`,
    [adminId, adminId, pageSize, offset]
  );

  return {
    total,
    page,
    pageSize,
    unreadCount,
    records: rowsOf<NotificationRow>(rows).map(toItem),
  };
}

/**
 * 标记单个通知对当前管理员已读（POST /api/platform/notifications/:id/read）—— 权限点 notification:read
 *
 * 幂等：`INSERT IGNORE` + 唯一键 (notification_id, admin_id)，重复调用不报错、不新增行（marked=0）。
 * 通知不存在或对该管理员不可见 ⇒ 404（不可见通知不得因为"调用成功"而变成已读）。
 */
export async function markNotificationRead(
  notificationId: number,
  adminId: number
): Promise<{ id: number; read: true; marked: number }> {
  const admin = requireAdminId(adminId);
  const id = Number(notificationId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`通知不存在：${notificationId}`, 404);
  }

  const visible = await queryOne<{ id: number | string }>(
    `SELECT n.id AS id
       FROM t_platform_notification n
      WHERE n.id = ? AND ${VISIBLE_CLAUSE}`,
    [id, admin]
  );
  if (!visible) {
    throw new AppError(`通知不存在或对当前管理员不可见：${id}`, 404);
  }

  const marked = await transaction(async (conn) => {
    const [result] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT IGNORE INTO t_platform_notification_read (notification_id, admin_id, read_at)
       VALUES (?, ?, NOW())`,
      [id, admin]
    );
    return toNumber(result?.affectedRows);
  });

  return { id, read: true, marked };
}

/**
 * 把当前管理员可见的所有未读一次性标记已读（POST /api/platform/notifications/read-all）—— 权限点 notification:read
 *
 * 单条 `INSERT IGNORE ... SELECT`：可见性由 SQL 一次性判定，已读行由唯一键 IGNORE 掉，
 * **不做**"先查未读列表再逐条插入"（那会产生竞态与多次往返）。
 * 返回 `marked` = 本次真实新增的已读行数（第二次调用为 0）。
 */
export async function markAllNotificationsRead(adminId: number): Promise<{ marked: number }> {
  const admin = requireAdminId(adminId);

  const marked = await transaction(async (conn) => {
    const [result] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT IGNORE INTO t_platform_notification_read (notification_id, admin_id, read_at)
       SELECT n.id AS notification_id, ?, NOW()
         FROM t_platform_notification n
        WHERE ${VISIBLE_CLAUSE}`,
      [admin, admin]
    );
    return toNumber(result?.affectedRows);
  });

  return { marked };
}
