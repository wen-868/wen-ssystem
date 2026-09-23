/**
 * 开放平台 · Webhook 控制器（R101-C3-1，路由前缀 /api/platform/open）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §三 + 派单卡 C3-1 交付物 1（Webhook 7 条 + /events）。
 * 分层与校验口径同 `platform-open-api-key.controller.ts`（zod 失败 ⇒ 生产 `ZodError ⇒ 400` 链路）。
 */

import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/open-webhook.service";
import { OPEN_PLATFORM_EVENTS, OPEN_PLATFORM_EVENT_CODES } from "../../config/open-platform";
import type { OperatorContext } from "../../services/platform/open-api-key.service";

const idSchema = z.coerce.number().int().positive();
const pageSchema = z.coerce.number().int().min(1).max(10000).optional();
const pageSizeSchema = z.coerce.number().int().min(1).max(200).optional();
/** 事件类型必须是事件目录内的码（目录外的值 ⇒ 400，不落脏订阅） */
const eventTypeSchema = z.enum(OPEN_PLATFORM_EVENT_CODES as [string, ...string[]]);

const listQuerySchema = z.object({
  tenantId: z.string().trim().min(1).max(36).optional(),
  paused: z.coerce.number().int().min(0).max(1).optional(),
});

const createBodySchema = z.object({
  eventType: eventTypeSchema,
  callbackUrl: z.string().trim().min(1).max(512),
  tenantId: z.string().trim().min(1).max(36).optional(),
});

const deliveriesQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
});

const failuresQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const redeliverBodySchema = z.object({
  deliveryId: z.coerce.number().int().positive().optional(),
});

function operatorOf(req: any): OperatorContext {
  return {
    adminId: Number(req.user?.id ?? 0),
    adminName: String(req.user?.username || req.user?.realName || "platform_admin"),
    ip: req.ip ? String(req.ip) : null,
  };
}

/** GET /api/platform/open/events - 事件目录（常量枚举，零 DDL） */
export async function listEvents(_req: any, res: any) {
  res.json(ok({ records: OPEN_PLATFORM_EVENTS, total: OPEN_PLATFORM_EVENTS.length }));
}

/** GET /api/platform/open/webhooks - 订阅列表（含近 7 日推送数/成功率派生值） */
export async function listWebhooks(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  const result = await service.listWebhooks({ tenantId: query.tenantId, paused: query.paused });
  res.json(ok(result));
}

/** POST /api/platform/open/webhooks - 新建订阅（签名密钥明文仅本响应出现一次） */
export async function createWebhook(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  const result = await service.createWebhook(body, operatorOf(req));
  res.status(201).json(ok(result));
}

/** POST /api/platform/open/webhooks/:id/test - 测试推送 */
export async function testWebhook(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.testWebhook(id, operatorOf(req));
  res.json(ok(result));
}

/** GET /api/platform/open/webhooks/:id/logs - 投递日志（分页） */
export async function listDeliveries(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const query = deliveriesQuerySchema.parse(req.query ?? {});
  const result = await service.listDeliveries(id, {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  });
  res.json(ok(result));
}

/** POST /api/platform/open/webhooks/:id/redeliver - 手动重推（默认重推最近一条投递） */
export async function redeliver(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const body = redeliverBodySchema.parse(req.body ?? {});
  const result = await service.redeliver(id, body.deliveryId, operatorOf(req));
  res.json(ok(result));
}

/** POST /api/platform/open/webhooks/:id/resume - 恢复订阅（取消自动暂停） */
export async function resumeWebhook(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.resumeWebhook(id, operatorOf(req));
  res.json(ok(result));
}

/** GET /api/platform/open/webhooks/:id/failures - 失败原因（最近失败投递） */
export async function listFailures(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const query = failuresQuerySchema.parse(req.query ?? {});
  const result = await service.listFailures(id, query.limit ?? 20);
  res.json(ok(result));
}
