import { ok } from "../../shared/response";
import * as userSessionService from "../../services/admin/user-session.service";

/** 获取用户会话列表 */
export async function getUserSessions(req: any, res: any) {
  const data = await userSessionService.getUserSessions(req.tenantId, req.query);
  res.json(ok(data));
}

/** 撤销指定会话 */
export async function revokeSession(req: any, res: any) {
  const data = await userSessionService.revokeSession(Number(req.params.id));
  res.json(ok(data));
}

/** 撤销用户所有会话 */
export async function revokeUserSessions(req: any, res: any) {
  const userId = Number(req.params.userId);
  const sessions = await userSessionService.getUserSessions(req.tenantId, { userId });
  for (const s of (sessions as { records?: unknown[] }).records || []) {
    await userSessionService.revokeSession((s as any).id);
  }
  res.json(ok({ success: true }));
}

/** 获取在线统计 */
export async function getOnlineStats(_req: any, res: any) {
  const data = await userSessionService.getOnlineStats();
  res.json(ok(data));
}
