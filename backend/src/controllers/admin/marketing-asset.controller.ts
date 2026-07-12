import { ok } from "../../shared/response";
import * as marketingAssetService from "../../services/admin/marketing-asset.service";

/** 获取营销资产列表 */
export async function getMarketingAssets(req: any, res: any) {
  const data = await marketingAssetService.getMarketingAssets(req.tenantId, req.query);
  res.json(ok(data));
}

/** 创建营销资产 */
export async function createMarketingAsset(req: any, res: any) {
  const data = await marketingAssetService.createMarketingAsset(req.body);
  res.json(ok(data));
}

/** 更新营销资产 */
export async function updateMarketingAsset(req: any, res: any) {
  const data = await marketingAssetService.updateMarketingAsset(Number(req.params.id), req.body);
  res.json(ok(data));
}

/** 删除营销资产 */
export async function deleteMarketingAsset(req: any, res: any) {
  const data = await marketingAssetService.deleteMarketingAsset(Number(req.params.id));
  res.json(ok(data));
}
