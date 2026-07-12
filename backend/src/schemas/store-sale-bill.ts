import { z } from "zod";

export const storeSaleBillItemSchema = z.object({
  skuId: z.number(),
  boxQty: z.number().optional(),
  bottleQty: z.number().optional(),
  quantity: z.number().optional(),
  totalBottleQty: z.number().optional(),
  unitPrice: z.number().optional(),
  priceType: z.enum(["RETAIL", "WHOLESALE", "STORE"]).optional()
}).transform((item: any, ctx: any) => {
  const totalBottleQty = item.totalBottleQty ?? item.quantity;
  if (totalBottleQty == null || totalBottleQty <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "totalBottleQty 或 quantity 必须大于 0" });
    return z.NEVER;
  }
  return { skuId: item.skuId, boxQty: item.boxQty ?? 0, bottleQty: item.bottleQty ?? item.quantity ?? totalBottleQty, totalBottleQty, unitPrice: item.unitPrice, priceType: item.priceType };
});

export function normalizeStoreSaleBillItem(input: unknown) {
  return storeSaleBillItemSchema.parse(input);
}
