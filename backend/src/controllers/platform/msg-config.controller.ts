import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import {
  getMsgConfig,
  updateMsgConfig,
  listPlatformSmsTemplates,
  createPlatformSmsTemplate,
  updatePlatformSmsTemplate,
  deletePlatformSmsTemplate,
} from "../../services/platform/msg-config.service";

export const getMsgConfigHandler = asyncHandler(async (_req, res) => {
  const cfg = await getMsgConfig();
  res.json(ok(cfg));
});

export const updateMsgConfigHandler = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  await updateMsgConfig(items);
  res.json(ok({ updated: items.length }));
});

export const listSmsTemplatesHandler = asyncHandler(async (_req, res) => {
  const items = await listPlatformSmsTemplates();
  res.json(ok(items));
});

export const createSmsTemplateHandler = asyncHandler(async (req, res) => {
  const result = await createPlatformSmsTemplate(req.body || {});
  res.json(ok(result));
});

export const updateSmsTemplateHandler = asyncHandler(async (req, res) => {
  await updatePlatformSmsTemplate(Number(req.params.id), req.body || {});
  res.json(ok({ id: Number(req.params.id) }));
});

export const deleteSmsTemplateHandler = asyncHandler(async (req, res) => {
  await deletePlatformSmsTemplate(Number(req.params.id));
  res.json(ok({ id: Number(req.params.id) }));
});
