import { ok } from "../../shared/response";
import { AppError } from "../../shared/app-error";
import * as priceSyncSvc from "../../services/sync/price-sync.service";
import * as productSyncSvc from "../../services/sync/product-sync.service";
import * as deltaSyncSvc from "../../services/sync/delta-sync.service";

// ==================== ISO 8601 时间戳校验 ====================
// 允许 YYYY-MM-DDTHH:mm:ss(.sss)?Z 或带时区偏移的形式，也允许 YYYY-MM-DD 简写
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

/** 校验 since 参数，非法时抛出 AppError 由全局 errorHandler 处理 */
function validateSince(since: unknown): string {
  if (since === undefined || since === null || since === "") return "";
  const value = String(since);
  if (!ISO_8601_REGEX.test(value)) {
    throw new AppError("since 参数必须是 ISO 8601 格式（如 2026-07-19T00:00:00Z）", 400);
  }
  return value;
}

/** 解析分页参数，提供默认值（page=1, pageSize=100） */
function parsePaging(query: any): { page: number; pageSize: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Math.min(500, Number(query.pageSize) || 100));
  return { page, pageSize };
}

/** 价格变更列表（轮询接口） */
export async function getPriceChanges(req: any, res: any) {
  const since = req.query.since as string;
  const result = await priceSyncSvc.getChangesSince(req.tenantId, since);
  res.json(ok(result));
}

/** 最新价格（批量查询） */
export async function getPricesByIds(req: any, res: any) {
  const ids = (req.query.ids as string)?.split(",").map(Number) || [];
  const result = await priceSyncSvc.getPricesByIds(req.tenantId, ids);
  res.json(ok(result));
}

/** 全量同步价格 */
export async function syncPrices(req: any, res: any) {
  const skuIds = req.body.skuIds || undefined;
  const result = await priceSyncSvc.syncPrices(req.tenantId, skuIds);
  res.json(ok(result));
}

/** 价格同步状态 */
export async function getPriceSyncStatus(req: any, res: any) {
  const result = await priceSyncSvc.getSyncStatus(req.tenantId, "price");
  res.json(ok(result));
}

/** 价格最后同步时间 */
export async function getPriceLastSync(req: any, res: any) {
  const result = await priceSyncSvc.getLastSyncTime(req.tenantId, "price");
  res.json(ok(result));
}

/** 全量同步商品 */
export async function syncProducts(req: any, res: any) {
  const spuIds = req.body.spuIds || undefined;
  const result = await productSyncSvc.syncProducts(req.tenantId, spuIds);
  res.json(ok(result));
}

/** 商品同步状态 */
export async function getProductSyncStatus(req: any, res: any) {
  const result = await priceSyncSvc.getSyncStatus(req.tenantId, "product");
  res.json(ok(result));
}

/** 商品最后同步时间 */
export async function getProductLastSync(req: any, res: any) {
  const result = await priceSyncSvc.getLastSyncTime(req.tenantId, "product");
  res.json(ok(result));
}

// ==================== R51-04 增量同步端点 ====================

/** 增量商品变更 — GET /api/sync/products/delta?since=&page=1&pageSize=100 */
export async function getProductsDelta(req: any, res: any) {
  const since = validateSince(req.query.since);
  const { page, pageSize } = parsePaging(req.query);
  const result = await deltaSyncSvc.getProductDelta(since, req.tenantId, page, pageSize);
  res.json(ok(result));
}

/** 增量库存变更 — GET /api/sync/inventory/delta?since=&page=1&pageSize=100 */
export async function getInventoryDelta(req: any, res: any) {
  const since = validateSince(req.query.since);
  const { page, pageSize } = parsePaging(req.query);
  const result = await deltaSyncSvc.getInventoryDelta(since, req.tenantId, page, pageSize);
  res.json(ok(result));
}

/** 增量客户变更 — GET /api/sync/members/delta?since=&page=1&pageSize=100 */
export async function getMembersDelta(req: any, res: any) {
  const since = validateSince(req.query.since);
  const { page, pageSize } = parsePaging(req.query);
  const result = await deltaSyncSvc.getMemberDelta(since, req.tenantId, page, pageSize);
  res.json(ok(result));
}

/** 批量提交离线销售单 — POST /api/sync/offline-orders */
export async function submitOfflineOrders(req: any, res: any) {
  const operatorId = Number(req.user?.id);
  if (!operatorId || Number.isNaN(operatorId)) {
    throw new AppError("操作人信息缺失", 401);
  }
  const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
  if (orders.length === 0) {
    throw new AppError("orders 不能为空", 400);
  }
  const result = await deltaSyncSvc.submitOfflineOrders(orders, req.tenantId, operatorId);
  res.json(ok(result));
}
