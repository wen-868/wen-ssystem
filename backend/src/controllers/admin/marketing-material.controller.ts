import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-material.service.js";

const createMaterialSchema = z.object({
  name: z.string().min(1).max(200),
  materialType: z.enum(["IMAGE", "VIDEO", "TEXT", "FILE"]),
  url: z.string().optional(),
  content: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  remark: z.string().max(500).optional(),
});

const updateMaterialSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().optional(),
  content: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  remark: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const createMaterialCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.number().int().positive().optional(),
  sortNo: z.number().int().default(0),
});

const updateMaterialCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.number().int().positive().optional(),
  sortNo: z.number().int().optional(),
});

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  const body = createMaterialSchema.parse(req.body);
  const result = await svc.createMaterial(body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const { material_type, category_id, tags, status, page, pageSize } = req.query as Record<string, string | undefined>;
  const result = await svc.listMaterials({ tenantId: req.tenantId!, material_type, category_id: category_id ? Number(category_id) : undefined, tags, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getMaterialDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getMaterialDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  const body = updateMaterialSchema.parse(req.body);
  const result = await svc.updateMaterial(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteMaterial = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteMaterial(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const publishMaterial = asyncHandler(async (req: Request, res: Response) => {
  await svc.publishMaterial(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const archiveMaterial = asyncHandler(async (req: Request, res: Response) => {
  await svc.archiveMaterial(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});

export const getMaterialCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getMaterialCategories(req.tenantId!);
  res.json(ok(result));
});

export const createMaterialCategory = asyncHandler(async (req: Request, res: Response) => {
  const body = createMaterialCategorySchema.parse(req.body);
  const result = await svc.createMaterialCategory(body, req.tenantId!);
  res.json(ok(result));
});

export const updateMaterialCategory = asyncHandler(async (req: Request, res: Response) => {
  const body = updateMaterialCategorySchema.parse(req.body);
  await svc.updateMaterialCategory(Number(req.params.id), body, req.tenantId!);
  res.json(ok(null));
});

export const deleteMaterialCategory = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteMaterialCategory(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});