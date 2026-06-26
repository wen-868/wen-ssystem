import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as fulfillmentService from "../../services/instant-retail/fulfillment.service.js";

export const startDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await fulfillmentService.startDelivery(req.params.platformOrderId, req.body, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const completeDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await fulfillmentService.completeDelivery(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});
