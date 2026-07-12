import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { z } from "zod";
import * as transferExecutionService from "../../services/transfer-execution.service";

export const receiveTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    items: z.array(z.object({
      itemId: z.number().int().positive(),
      receivedQty: z.number().int().min(0)
    })).min(1)
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const result = await transferExecutionService.receiveTransferOrder(
    id,
    tenantId,
    userId ?? null,
    body.items
  );
  res.json(ok(result));
});

export const getInTransitOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId;

  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }

  const result = await transferExecutionService.getInTransitOrders(storeId, tenantId);
  res.json(ok(result));
});

export const getMyShipments = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId;

  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }

  const result = await transferExecutionService.getMyShipments(storeId, tenantId);
  res.json(ok(result));
});
