import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as tagService from "../../services/admin/tag.service.js";

// ==================== 标签组管理 ====================

export const listGroups = asyncHandler(async (req, res) => {
  const rows = await tagService.listGroups(req.tenantId!);
  res.json(ok(rows));
});

export const createGroup = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64),
    code: z.string().min(1).max(64),
    sortNo: z.number().int().default(0),
    isMultiple: z.boolean().default(true),
  }).parse(req.body);
  const result = await tagService.createGroup(body, req.tenantId!);
  res.json(ok(result));
});

export const updateGroup = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64).optional(),
    code: z.string().min(1).max(64).optional(),
    sortNo: z.number().int().optional(),
    isMultiple: z.boolean().optional(),
  }).parse(req.body);
  const result = await tagService.updateGroup(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const result = await tagService.deleteGroup(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

// ==================== 标签值管理 ====================

export const listTags = asyncHandler(async (req, res) => {
  const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
  const rows = await tagService.listTags(groupId, req.tenantId!);
  res.json(ok(rows));
});

export const createTag = asyncHandler(async (req, res) => {
  const body = z.object({
    groupId: z.number().int().positive(),
    name: z.string().min(1).max(64),
    sortNo: z.number().int().default(0),
  }).parse(req.body);
  const result = await tagService.createTag(body, req.tenantId!);
  res.json(ok(result));
});

export const updateTag = asyncHandler(async (req, res) => {
  const body = z.object({
    groupId: z.number().int().positive().optional(),
    name: z.string().min(1).max(64).optional(),
    sortNo: z.number().int().optional(),
  }).parse(req.body);
  const result = await tagService.updateTag(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteTag = asyncHandler(async (req, res) => {
  const result = await tagService.deleteTag(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

// ==================== 商品标签关联 ====================

export const getProductTags = asyncHandler(async (req, res) => {
  const rows = await tagService.getProductTags(Number(req.params.spuId), req.tenantId!);
  res.json(ok(rows));
});

export const setProductTags = asyncHandler(async (req, res) => {
  const body = z.object({
    tagIds: z.array(z.number().int().positive()),
  }).parse(req.body);
  const result = await tagService.setProductTags(Number(req.params.spuId), body.tagIds, req.tenantId!);
  res.json(ok(result));
});