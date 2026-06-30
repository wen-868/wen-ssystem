import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as tagService from "../../services/admin/customer-tag.service.js";

export const listTags = asyncHandler(async (req, res) => { res.json(ok(await tagService.listTags(req.tenantId!))); });
export const createTag = asyncHandler(async (req, res) => {
  const { tagName, tagType, tagGroup } = req.body;
  res.json(ok(await tagService.createTag({ tagName, tagType, tagGroup, tenantId: req.tenantId! })));
});
export const updateTag = asyncHandler(async (req, res) => {
  const { tagName, tagType, tagGroup } = req.body;
  res.json(ok(await tagService.updateTag(Number(req.params.id), { tagName, tagType, tagGroup, tenantId: req.tenantId! })));
});
export const deleteTag = asyncHandler(async (req, res) => { res.json(ok(await tagService.deleteTag(Number(req.params.id), req.tenantId!))); });
export const addCustomerTag = asyncHandler(async (req, res) => {
  const { tagId } = req.body;
  res.json(ok(await tagService.addCustomerTag(Number(req.params.id), tagId, req.tenantId!)));
});
export const removeCustomerTag = asyncHandler(async (req, res) => { res.json(ok(await tagService.removeCustomerTag(Number(req.params.id), Number(req.params.tagId), req.tenantId!))); });
export const getCustomerProfile = asyncHandler(async (req, res) => { res.json(ok(await tagService.getCustomerProfile(Number(req.params.id), req.tenantId!))); });