import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as tagService from "../../services/admin/product-marketing-tag.service";

// GET /api/admin/product-tags - 标签列表
export const listTags = asyncHandler(async (req, res) => {
  const status = req.query.status !== undefined ? Number(req.query.status) : undefined;
  const result = await tagService.listTags(req.tenantId!, status);
  res.json(ok(result));
});

// POST /api/admin/product-tags - 创建标签
export const createTag = asyncHandler(async (req, res) => {
  const body = z.object({
    tagCode: z.string().min(1).max(32),
    tagName: z.string().min(1).max(64),
    color: z.string().max(16).optional(),
    sortNo: z.number().int().min(0).default(0),
  }).parse(req.body);

  const result = await tagService.createTag({ ...body, tenantId: req.tenantId! });
  res.json(ok(result));
});

// PUT /api/admin/product-tags/:id - 更新标签
export const updateTag = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({
    tagName: z.string().min(1).max(64).optional(),
    color: z.string().max(16).optional(),
    sortNo: z.number().int().min(0).optional(),
    status: z.number().int().min(0).max(1).optional(),
  }).parse(req.body);

  const result = await tagService.updateTag(id, body, req.tenantId!);
  if (!result) {
    res.status(404).json(fail("标签不存在", "404"));
    return;
  }
  res.json(ok(result));
});

// DELETE /api/admin/product-tags/:id - 删除标签
export const deleteTag = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await tagService.deleteTag(id, req.tenantId!);
  if (!result) {
    res.status(404).json(fail("标签不存在", "404"));
    return;
  }
  res.json(ok(result));
});