import { z } from "zod";

export const createAftersaleSchema = z.object({
  orderNo: z.string().min(1),
  aftersaleType: z.enum(["REFUND_ONLY", "RETURN_REFUND", "EXCHANGE", "REPAIR"]),
  reason: z.string().min(1),
  reasonDetail: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  items: z.array(z.object({
    skuId: z.number(),
    skuName: z.string(),
    qty: z.number().int().positive(),
    unitPrice: z.number(),
    subtotal: z.number()
  })).min(1),
  refundAmount: z.number().min(0).default(0),
  exchangeSkuId: z.number().optional(),
  exchangeQty: z.number().int().positive().optional()
});

export const returnLogisticsSchema = z.object({
  returnLogisticsNo: z.string().min(1),
  returnLogisticsCompany: z.string().min(1)
});

export const rateAftersaleSchema = z.object({
  satisfaction: z.number().int().min(1).max(5),
  customerComment: z.string().optional()
});

export const rejectAftersaleSchema = z.object({
  processRemark: z.string().min(1, "请填写拒绝原因"),
  version: z.number().default(1)
});

export const inspectAftersaleSchema = z.object({
  inspectResult: z.enum(["PASS", "PARTIAL_PASS", "FAIL"]),
  inspectImages: z.array(z.string()).optional(),
  processRemark: z.string().optional(),
  version: z.number().default(1)
});

export const completeAftersaleSchema = z.object({
  processRemark: z.string().optional(),
  version: z.number().default(1)
});
