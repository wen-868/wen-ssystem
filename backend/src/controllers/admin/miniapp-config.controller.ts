import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { MiniappConfigService } from "../../services/admin/miniapp-config.service";

const saveConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  mchId: z.string().optional(),
  apiKey: z.string().optional(),
  certPath: z.string().optional(),
  notifyUrl: z.string().optional(),
  enabled: z.boolean().optional(),
});

const publishSchema = z.object({
  platform: z.string().min(1),
  templateId: z.number().int().positive(),
  version: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const listConfigs = asyncHandler(async (req: Request, res: Response) => {
  const data = await MiniappConfigService.listConfigs(req.tenantId!);
  res.json(ok(data));
});

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const data = await MiniappConfigService.getConfig(req.tenantId!, req.params.platform);
  res.json(ok(data));
});

export const saveConfig = asyncHandler(async (req: Request, res: Response) => {
  const body = saveConfigSchema.parse(req.body);
  const data = await MiniappConfigService.saveConfig(req.tenantId!, req.params.platform, body);
  res.json(ok(data));
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const data = await MiniappConfigService.listTemplates(req.tenantId!);
  res.json(ok(data));
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const data = await MiniappConfigService.getTemplate(req.tenantId!, Number(req.params.id));
  res.json(ok(data));
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const body = publishSchema.parse(req.body);
  const data = await MiniappConfigService.publish(req.tenantId!, {
    platform: body.platform,
    templateId: body.templateId,
    version: body.version,
    operator: (req as any).user?.name || 'admin'
  });
  res.json(ok(data));
});

export const listPublishLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const data = await MiniappConfigService.listPublishLogs(req.tenantId!, page, pageSize);
  res.json(ok(data));
});