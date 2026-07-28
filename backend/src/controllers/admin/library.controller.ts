import type { Request, Response } from "express";
import { ok, fail } from "../../shared/response";
import { asyncHandler } from "../../middleware/async-handler";
import { libraryLookupService } from "../../services/admin/library-lookup.service";

/**
 * 按条码查询商品库
 *
 * 请求体：{ barcode: string }
 * 响应：{ code, msg, data: { matched, spu?, sku?, brand? }, traceId }
 */
export const lookupByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.body;

  // 参数校验：条码不能为空
  if (!barcode) {
    return res.status(400).json(fail("条码不能为空"));
  }

  const result = await libraryLookupService.lookupByBarcode(String(barcode));
  res.json(ok(result));
});
