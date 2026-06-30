import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/marketing-material.service.js";

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.createMaterial(req.body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const { material_type, category_id, tags, status, page, pageSize } = req.query as any;
  const result = await svc.listMaterials({ tenantId: req.tenantId!, material_type, category_id: category_id ? Number(category_id) : undefined, tags, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  res.json(ok(result));
});

export const getMaterialDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getMaterialDetail(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.updateMaterial(Number(req.params.id), req.body, req.tenantId!);
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
  const result = await svc.createMaterialCategory(req.body, req.tenantId!);
  res.json(ok(result));
});

export const updateMaterialCategory = asyncHandler(async (req: Request, res: Response) => {
  await svc.updateMaterialCategory(Number(req.params.id), req.body, req.tenantId!);
  res.json(ok(null));
});

export const deleteMaterialCategory = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteMaterialCategory(Number(req.params.id), req.tenantId!);
  res.json(ok(null));
});