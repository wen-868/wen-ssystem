/**
 * 开放平台 · API 密钥控制器（R101-C3-1，路由前缀 /api/platform/open）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §三 + 派单卡 C3-1 交付物 1（密钥 8 条端点）。
 * 分层：controller 只做参数接收（zod）+ 调用 service + 返回统一信封；
 *       zod 解析失败 ⇒ 由 middleware/error-handler 的 `ZodError ⇒ 400` 链路统一返回；
 *       业务冲突（不存在 404 / 轮换中 409）由 service 抛 AppError。
 * 安全：本文件**不返回、不打印**任何密钥明文；明文只在 create / rotate 的 service 返回中一次性透传。
 */

import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/open-api-key.service";
import type { OperatorContext } from "../../services/platform/open-api-key.service";

const idSchema = z.coerce.number().int().positive();
const pageSchema = z.coerce.number().int().min(1).max(10000).optional();
const pageSizeSchema = z.coerce.number().int().min(1).max(200).optional();
const stringArraySchema = z.array(z.string().trim().min(1).max(64)).max(50);

const listQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  tenantId: z.string().trim().min(1).max(36).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  keyword: z.string().trim().max(128).optional(),
});

const createBodySchema = z.object({
  appName: z.string().trim().min(1).max(128),
  tenantId: z.string().trim().min(1).max(36).optional(),
  allowedIps: stringArraySchema.nullable().optional(),
  dailyLimit: z.coerce.number().int().min(0).max(1000000).optional(),
  qps: z.coerce.number().int().min(1).max(1000).optional(),
  scopes: stringArraySchema.optional(),
  remark: z.string().trim().max(500).optional(),
});

const updateBodySchema = z.object({
  dailyLimit: z.coerce.number().int().min(0).max(1000000).optional(),
  qps: z.coerce.number().int().min(1).max(1000).optional(),
  allowedIps: stringArraySchema.nullable().optional(),
  scopes: stringArraySchema.optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  remark: z.string().trim().max(500).optional(),
});

const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

/** 操作人（平台令牌）：审计署名用；不参与密钥任何字段的拼装 */
function operatorOf(req: any): OperatorContext {
  return {
    adminId: Number(req.user?.id ?? 0),
    adminName: String(req.user?.username || req.user?.realName || "platform_admin"),
    ip: req.ip ? String(req.ip) : null,
  };
}

/** GET /api/platform/open/api-keys - 密钥列表（AppKey 已打码，不含任何密钥本体） */
export async function listApiKeys(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  const result = await service.listApiKeys({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    tenantId: query.tenantId,
    status: query.status,
    keyword: query.keyword,
  });
  res.json(ok(result));
}

/** POST /api/platform/open/api-keys - 签发密钥（明文 AppSecret 仅本响应出现一次） */
export async function createApiKey(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  const result = await service.createApiKey(body, operatorOf(req));
  res.status(201).json(ok(result));
}

/** PUT /api/platform/open/api-keys/:id - 编辑（限额 / QPS / 白名单 / 权限范围 / 状态 / 备注） */
export async function updateApiKey(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const body = updateBodySchema.parse(req.body ?? {});
  const result = await service.updateApiKey(id, body, operatorOf(req));
  res.json(ok(result));
}

/** DELETE /api/platform/open/api-keys/:id - 吊销（本批按裁定 §二.2 = 立即吊销） */
export async function deleteApiKey(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.revokeApiKey(id, operatorOf(req));
  res.json(ok(result));
}

/** POST /api/platform/open/api-keys/:id/enable - 启用（裁定 §二.3：语义化子路由，薄封装 status=1） */
export async function enableApiKey(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.enableApiKey(id, operatorOf(req));
  res.json(ok(result));
}

/** POST /api/platform/open/api-keys/:id/rotate - 轮换（返回新密钥一次，旧密钥并行 7 天） */
export async function rotateApiKey(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.rotateApiKey(id, operatorOf(req));
  res.json(ok(result));
}

/** POST /api/platform/open/api-keys/:id/rotate-complete - 完成轮换（旧密钥立即失效） */
export async function completeRotation(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const result = await service.completeRotation(id, operatorOf(req));
  res.json(ok(result));
}

/** GET /api/platform/open/api-keys/:id/stats - 调用统计（近 N 日，默认 7） */
export async function getApiKeyStats(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const query = statsQuerySchema.parse(req.query ?? {});
  const result = await service.getApiKeyStats(id, query.days ?? 7, operatorOf(req));
  res.json(ok(result));
}
