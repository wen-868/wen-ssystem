import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { listCouponTemplates, getCouponTemplate } from "../../services/admin/marketing-coupon.service";
import { z } from "zod";

/** 门店优惠券列表（分页，复用优惠券模板数据源） */
export const listStoreCoupons = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
    keyword: z.string().optional(),
  }).parse(req.query);
  const result = await listCouponTemplates(
    params.page,
    params.pageSize,
    req.tenantId!,
    params.status,
    undefined,
    params.keyword
  );
  res.json(ok(result));
});

/** 门店优惠券详情 */
export const getStoreCoupon = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(ok(await getCouponTemplate(id, req.tenantId!)));
});
