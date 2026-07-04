import { asyncHandler } from "../../shared/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import { z } from "zod";
import * as transferExecutionService from "../../services/transfer-execution.service.js";

export const cancelTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;

  const result = await transferExecutionService.cancelTransferOrder(id, tenantId);
  res.json(ok(result));
});

export const shipTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const result = await transferExecutionService.shipTransferOrder(id, tenantId, userId ?? null);
  res.json(ok(result));
});
