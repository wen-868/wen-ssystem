import { z } from "zod";
import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import * as service from "../../services/platform/platform-notification.service";

/**
 * C6-2-T1：平台通知控制器（3 条端点，路径由派单卡钉死，不得自拟/增减）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md 交付物②③
 *   · GET  /api/platform/notifications         → { total, page, pageSize, unreadCount, records[] } ← notification:view
 *   · POST /api/platform/notifications/:id/read → 标记该通知对当前管理员已读（幂等）              ← notification:read
 *   · POST /api/platform/notifications/read-all → 标记当前管理员可见的全部未读（返回 marked）     ← notification:read
 *
 * 口径：
 * - 校验口径：zod 解析失败 ⇒ ZodError ⇒ 由 errorHandler 统一转 400（与既有平台端点同风格）；
 *   `pageSize` 越界（>100 / <1 / 非数字）与 `page` <1 一律 400，**不静默夹取**；
 * - 业务错误（通知不存在或不可见 404 / 缺管理员身份 401）由 service 或本控制器抛 AppError；
 * - 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler（红线④）；
 * - 权限点只以注释登记（service 层 PLATFORM_NOTIFICATION_PERMISSIONS 给出取值），
 *   **本单不实现按角色强制鉴权**——PERMISSION_CATALOG 当前无 notification 域，写一个"永远放行的假校验"
 *   即为假鉴权（卡内 ⑥ + 红线⑤）。
 */

const notificationIdSchema = z.coerce.number().int().positive();

/** 布尔 query 参数：axios 会把 boolean 序列化成 "true"/"false"，兼容 "1"/"0"（与 T7 同风格） */
const boolQuerySchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // 卡内钉死 pageSize ≤ 100：超限显式 400（不静默夹取成 100）
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: boolQuerySchema.optional(),
});

/** 当前平台管理员（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ 401（不静默造 id） */
function currentAdminId(req: any): number {
  const adminId = Number(req?.user?.id ?? 0);
  if (!adminId) {
    throw new AppError("缺少平台管理员身份", 401);
  }
  return adminId;
}

/** GET /api/platform/notifications —— 通知列表（空表 ⇒ 诚实空态 records: [] / unreadCount: 0） */
export async function listNotifications(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  const result = await service.listNotifications({
    adminId: currentAdminId(req),
    unreadOnly: query.unreadOnly,
    page: query.page,
    pageSize: query.pageSize,
  });
  res.json(ok(result));
}

/** POST /api/platform/notifications/:id/read —— 标记对当前管理员已读（幂等；不可见 ⇒ 404） */
export async function markNotificationRead(req: any, res: any) {
  const id = notificationIdSchema.parse(req.params.id);
  res.json(ok(await service.markNotificationRead(id, currentAdminId(req))));
}

/** POST /api/platform/notifications/read-all —— 当前管理员可见的全部未读一次性标记已读 */
export async function markAllNotificationsRead(req: any, res: any) {
  res.json(ok(await service.markAllNotificationsRead(currentAdminId(req))));
}
