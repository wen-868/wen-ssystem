import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as fixService from "../../services/admin/instant-retail-fix.service";

const tenant = (req: any) => req.tenantId as string;
const num = (v: unknown) => (v === undefined ? undefined : Number(v));

/** 同步日志列表 */
export const listSyncLogs = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await fixService.listSyncLogs(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), status: q.status, platform: q.platform,
  });
  res.json(ok(result));
});

/** 同步统计 */
export const getSyncStats = asyncHandler(async (req, res) => {
  const result = await fixService.getSyncStats(tenant(req));
  res.json(ok(result));
});

/** 商品映射列表 */
export const listProductMaps = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await fixService.listProductMaps(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), platform: q.platform,
    syncStatus: q.syncStatus, keyword: q.keyword,
  });
  res.json(ok(result));
});

/** 商品映射统计 */
export const getProductMapStats = asyncHandler(async (req, res) => {
  const result = await fixService.getProductMapStats(tenant(req));
  res.json(ok(result));
});

/** 路由规则列表 */
export const listRoutingRules = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await fixService.listRoutingRules(tenant(req), { page: num(q.page), pageSize: num(q.pageSize), channelType: q.channelType });
  res.json(ok(result));
});

/** 创建路由规则 */
export const createRoutingRule = asyncHandler(async (req, res) => {
  const result = await fixService.createRoutingRule(tenant(req), req.body || {});
  res.json(ok(result));
});

/** 更新路由规则 */
export const updateRoutingRule = asyncHandler(async (req, res) => {
  const result = await fixService.updateRoutingRule(tenant(req), Number(req.params.id), req.body || {});
  res.json(ok(result));
});

/** 删除路由规则 */
export const deleteRoutingRule = asyncHandler(async (req, res) => {
  const result = await fixService.deleteRoutingRule(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 门店负载 */
export const getStoreLoad = asyncHandler(async (req, res) => {
  const result = await fixService.getStoreLoad(tenant(req));
  res.json(ok(result));
});

/** 异常列表 */
export const listExceptions = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await fixService.listExceptions(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), handleStatus: q.handleStatus,
    level: q.level, channelType: q.channelType, keyword: q.keyword,
  });
  res.json(ok(result));
});

/** 异常统计 */
export const getExceptionStats = asyncHandler(async (req, res) => {
  const result = await fixService.getExceptionStats(tenant(req));
  res.json(ok(result));
});

/** 处理异常 */
export const handleException = asyncHandler(async (req, res) => {
  const result = await fixService.handleException(
    tenant(req),
    Number(req.params.id),
    req.user?.id ?? 0,
    req.user?.realName || req.user?.username || "",
    req.body || {}
  );
  res.json(ok(result));
});

/** 异常处理日志 */
export const listExceptionLogs = asyncHandler(async (req, res) => {
  const result = await fixService.listExceptionLogs(tenant(req), Number(req.params.id));
  res.json(ok(result));
});
