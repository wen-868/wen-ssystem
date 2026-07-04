import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as tagService from "../../services/admin/customer-tag.service.js";

const createTagSchema = z.object({
  tagName: z.string().min(1).max(100),
  tagType: z.string().max(50).default(""),
  tagGroup: z.string().max(50).optional(),
});

const updateTagSchema = z.object({
  tagName: z.string().min(1).max(100).optional(),
  tagType: z.string().max(50).optional(),
  tagGroup: z.string().max(50).optional(),
});

const addCustomerTagSchema = z.object({
  tagId: z.number().int().positive(),
});

export const listTags = asyncHandler(async (req, res) => { res.json(ok(await tagService.listTags(req.tenantId!))); });
export const createTag = asyncHandler(async (req, res) => {
  const body = createTagSchema.parse(req.body);
  const { tagName, tagType, tagGroup } = body;
  res.json(ok(await tagService.createTag({ tagName, tagType, tagGroup, tenantId: req.tenantId! })));
});
export const updateTag = asyncHandler(async (req, res) => {
  const body = updateTagSchema.parse(req.body);
  const { tagName, tagType, tagGroup } = body;
  res.json(ok(await tagService.updateTag(Number(req.params.id), { tagName, tagType, tagGroup, tenantId: req.tenantId! })));
});
export const deleteTag = asyncHandler(async (req, res) => { res.json(ok(await tagService.deleteTag(Number(req.params.id), req.tenantId!))); });
export const addCustomerTag = asyncHandler(async (req, res) => {
  const body = addCustomerTagSchema.parse(req.body);
  const { tagId } = body;
  res.json(ok(await tagService.addCustomerTag(Number(req.params.id), tagId, req.tenantId!)));
});
export const removeCustomerTag = asyncHandler(async (req, res) => { res.json(ok(await tagService.removeCustomerTag(Number(req.params.id), Number(req.params.tagId), req.tenantId!))); });
export const getCustomerProfile = asyncHandler(async (req, res) => { res.json(ok(await tagService.getCustomerProfile(Number(req.params.id), req.tenantId!))); });