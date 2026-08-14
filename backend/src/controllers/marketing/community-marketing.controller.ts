import { z } from "zod";
import { ok } from "../../shared/response";
import * as communityService from "../../services/marketing/community-marketing.service";

// ==================== 拼团 ====================

/** 拼团活动列表 */
export async function listGroupBuys(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await communityService.listGroupBuyActivities(
    tenantId, params.page, params.pageSize, params.status
  );
  res.json(ok(result));
}

/** 拼团活动详情 */
export async function getGroupBuy(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await communityService.getGroupBuyActivity(tenantId, id);
  res.json(ok(result));
}

/** 发起拼团 */
export async function startGroupBuy(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const userId = req.user?.id;
  const { quantity } = z.object({
    quantity: z.coerce.number().int().min(1).default(1),
  }).parse(req.body || {});
  const result = await communityService.startGroupBuy(tenantId, id, userId, quantity);
  res.json(ok(result));
}

/** 参团 */
export async function joinGroupBuy(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const userId = req.user?.id;
  const { quantity } = z.object({
    quantity: z.coerce.number().int().min(1).default(1),
  }).parse(req.body || {});
  const result = await communityService.joinGroupBuy(tenantId, id, userId, quantity);
  res.json(ok(result));
}

// ==================== 砍价 ====================

/** 砍价活动列表 */
export async function listBargains(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await communityService.listBargainActivities(
    tenantId, params.page, params.pageSize, params.status
  );
  res.json(ok(result));
}

/** 砍价活动详情 */
export async function getBargain(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await communityService.getBargainActivity(tenantId, id);
  res.json(ok(result));
}

/** 发起砍价 */
export async function startBargain(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const userId = req.user?.id;
  const result = await communityService.startBargain(tenantId, id, userId);
  res.json(ok(result));
}

/** 帮砍 */
export async function helpBargain(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const helperId = req.user?.id;
  const helperName = req.user?.name || req.user?.nickname;
  const result = await communityService.helpBargain(tenantId, id, helperId, helperName);
  res.json(ok(result));
}

// ==================== 秒杀 ====================

/** 秒杀活动列表 */
export async function listSeckills(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
  }).parse(req.query);
  const result = await communityService.listSeckillActivities(
    tenantId, params.page, params.pageSize, params.status
  );
  res.json(ok(result));
}

/** 秒杀活动详情 */
export async function getSeckill(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await communityService.getSeckillActivity(tenantId, id);
  res.json(ok(result));
}

/** 秒杀下单 */
export async function buySeckill(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const userId = req.user?.id;
  const { quantity } = z.object({
    quantity: z.coerce.number().int().min(1).default(1),
  }).parse(req.body || {});
  const result = await communityService.buySeckill(tenantId, id, userId, quantity);
  res.json(ok(result));
}

// ==================== 结束活动（管理端） ====================

/** 结束拼团活动 */
export async function endGroupBuy(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(ok(await communityService.endGroupBuyActivity(tenantId, id)));
}

/** 结束砍价活动 */
export async function endBargain(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(ok(await communityService.endBargainActivity(tenantId, id)));
}

/** 结束秒杀活动 */
export async function endSeckill(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(ok(await communityService.endSeckillActivity(tenantId, id)));
}

// ==================== 参与记录（管理端，分页） ====================

/** 拼团参与记录 */
export async function listGroupBuyRecords(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await communityService.listGroupBuyParticipationRecords(
    tenantId, id, params.page, params.pageSize
  );
  res.json(ok(result));
}

/** 砍价参与记录 */
export async function listBargainRecords(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await communityService.listBargainParticipationRecords(
    tenantId, id, params.page, params.pageSize
  );
  res.json(ok(result));
}

/** 秒杀参与记录 */
export async function listSeckillRecords(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await communityService.listSeckillParticipationRecords(
    tenantId, id, params.page, params.pageSize
  );
  res.json(ok(result));
}
