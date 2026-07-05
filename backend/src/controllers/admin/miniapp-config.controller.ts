import { z } from "zod";
import { Request, Response } from "express";
import { MiniappConfigService } from "../../services/admin/miniapp-config.service.js";

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

export async function listConfigs(req: Request, res: Response) {
  const data = await MiniappConfigService.listConfigs(req.tenantId!);
  res.json({ code: "0", message: "成功", data });
}

export async function getConfig(req: Request, res: Response) {
  const data = await MiniappConfigService.getConfig(req.tenantId!, req.params.platform);
  res.json({ code: "0", message: "成功", data });
}

export async function saveConfig(req: Request, res: Response) {
  const body = saveConfigSchema.parse(req.body);
  const data = await MiniappConfigService.saveConfig(req.tenantId!, req.params.platform, body);
  res.json({ code: "0", message: "保存成功", data });
}

export async function listTemplates(req: Request, res: Response) {
  const data = await MiniappConfigService.listTemplates(req.tenantId!);
  res.json({ code: "0", message: "成功", data });
}

export async function getTemplate(req: Request, res: Response) {
  const data = await MiniappConfigService.getTemplate(req.tenantId!, Number(req.params.id));
  res.json({ code: "0", message: "成功", data });
}

export async function publish(req: Request, res: Response) {
  const body = publishSchema.parse(req.body);
  const data = await MiniappConfigService.publish(req.tenantId!, {
    platform: body.platform,
    templateId: body.templateId,
    version: body.version,
    operator: (req as { user?: { id: number } }).user?.name || 'admin'
  });
  res.json({ code: "0", message: "发布成功", data });
}

export async function listPublishLogs(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const data = await MiniappConfigService.listPublishLogs(req.tenantId!, page, pageSize);
  res.json({ code: "0", message: "成功", data });
}