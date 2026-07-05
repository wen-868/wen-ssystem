import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as priceSyncSvc from "../services/sync/price-sync.service.js";
import * as productSyncSvc from "../services/sync/product-sync.service.js";

const router = Router();

// ==================== 价格同步 ====================

// 价格变更列表（轮询接口）
router.get("/check", asyncHandler(async (req: any, res: any) => {
  const since = req.query.since as string;
  const result = await priceSyncSvc.getChangesSince(req.tenantId!, since);
  res.json(ok(result));
}));

// 最新价格（批量查询）
router.get("/prices", asyncHandler(async (req: any, res: any) => {
  const ids = (req.query.ids as string)?.split(",").map(Number) || [];
  const result = await priceSyncSvc.getPricesByIds(req.tenantId!, ids);
  res.json(ok(result));
}));

// 全量同步价格
router.post("/price", asyncHandler(async (req: any, res: any) => {
  const skuIds = req.body.skuIds || undefined;
  const result = await priceSyncSvc.syncPrices(req.tenantId!, skuIds);
  res.json(ok(result));
}));

// 价格同步状态
router.get("/price/status", asyncHandler(async (req: any, res: any) => {
  const result = await priceSyncSvc.getSyncStatus(req.tenantId!, "price");
  res.json(ok(result));
}));

// 价格最后同步时间
router.get("/price/last", asyncHandler(async (req: any, res: any) => {
  const result = await priceSyncSvc.getLastSyncTime(req.tenantId!, "price");
  res.json(ok(result));
}));

// ==================== 商品同步 ====================

// 全量同步商品
router.post("/product", asyncHandler(async (req: any, res: any) => {
  const spuIds = req.body.spuIds || undefined;
  const result = await productSyncSvc.syncProducts(req.tenantId!, spuIds);
  res.json(ok(result));
}));

// 商品同步状态
router.get("/product/status", asyncHandler(async (req: any, res: any) => {
  const result = await priceSyncSvc.getSyncStatus(req.tenantId!, "product");
  res.json(ok(result));
}));

// 商品最后同步时间
router.get("/product/last", asyncHandler(async (req: any, res: any) => {
  const result = await priceSyncSvc.getLastSyncTime(req.tenantId!, "product");
  res.json(ok(result));
}));

export default router;