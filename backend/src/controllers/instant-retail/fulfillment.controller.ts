import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as fulfillmentService from "../../services/instant-retail/fulfillment.service";

export const startDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await fulfillmentService.startDelivery(req.params.platformOrderId, req.body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const completeDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await fulfillmentService.completeDelivery(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});
