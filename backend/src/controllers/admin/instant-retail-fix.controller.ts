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
