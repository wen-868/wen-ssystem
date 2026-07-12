import { ok } from "../../shared/response";
import * as priceSyncSvc from "../../services/sync/price-sync.service";
import * as productSyncSvc from "../../services/sync/product-sync.service";

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
