import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as priceReviewService from "../../services/admin/price-review.service";

const tenant = (req: any) => (req.tenantId || req.user?.tenantId) as string;

/** 价格异常列表（售价低于成本 / 售价为 0） */
export const listPriceAnomalies = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await priceReviewService.listPriceAnomalies(tenant(req), {
    page: q.page ? Number(q.page) : 1,
    pageSize: q.pageSize ? Number(q.pageSize) : 20,
    keyword: q.keyword,
    anomalyType: q.anomalyType,
  });
  res.json(ok(result));
});

/** 提交建议核价单 */
export const submitPriceReview = asyncHandler(async (req, res) => {
  const body = z.object({
    skuId: z.number(),
    suggestedPrice: z.number(),
    /** 核价价格档位（默认零售价）；缺失时按 RETAIL 兼容旧调用 */
    priceType: z.enum(["COST", "RETAIL", "WHOLESALE", "MINIAPP", "STORE"]).optional(),
    reason: z.string().max(500).optional(),
  }).parse(req.body);
  const result = await priceReviewService.submitPriceReview(
    tenant(req),
    { id: req.user?.id, name: req.user?.realName || req.user?.username || "" },
    body
  );
  res.json(ok(result));
});
