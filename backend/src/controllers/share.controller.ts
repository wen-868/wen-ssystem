import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/share.service.js";

export const getCollectionLink = asyncHandler(async (req, res) => {
  const result = await service.getCollectionLink(req.params.token);
  res.json(ok(result));
});

export const payCollection = asyncHandler(async (req, res) => {
  const result = await service.payCollection(req.params.token);
  res.json(ok(result));
});