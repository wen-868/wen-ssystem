import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as calculationService from "../../services/admin/marketing-calculation.service";

export const calculatePromotion = asyncHandler(async (req, res) => {
  const body = z.object({
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      categoryId: z.number().int().optional(),
      brandId: z.number().int().optional()
    })).min(1),
    couponTemplateId: z.number().int().positive().optional(),
    flashSaleId: z.number().int().positive().optional(),
    groupBuyTeamId: z.number().int().positive().optional(),
    fullReductionIds: z.array(z.number().int().positive()).optional()
  }).parse(req.body);

  const result = await calculationService.calculatePromotion(body, req.tenantId!);
  res.json(ok(result));
});
