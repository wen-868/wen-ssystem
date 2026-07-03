import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/share.service.js";

export const getCollectionLink = asyncHandler(async (req, res) => {
  try {
    const result = await service.getCollectionLink(req.params.token);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const payCollection = asyncHandler(async (req, res) => {
  try {
    const result = await service.payCollection(req.params.token);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});