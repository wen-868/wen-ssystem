import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { verifyTraceCode } from "../../services/admin/trace-records.service";

/** 从请求中提取操作人信息 */
function getOperator(req: any) {
  return {
    id: req.user!.id ?? 0,
    name: req.user!.username ?? "系统用户",
  };
}

/** 收银台扫追溯码验证：返回商品 SKU 信息，命中后自动加入购物车 */
export const verifyStoreTraceCode = asyncHandler(async (req, res) => {
  const body = z.object({
    traceCode: z.string().trim().min(1).max(64),
  }).parse(req.body);
  const { id } = getOperator(req);
  const result = await verifyTraceCode(
    body.traceCode,
    "PDA",
    id,
    req.ip || "127.0.0.1",
    req.tenantId!
  );
  res.json(ok(result));
});
