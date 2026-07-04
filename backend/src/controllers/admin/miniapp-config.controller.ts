import { Request, Response } from "express";
import { MiniappConfigService } from "../../services/admin/miniapp-config.service.js";

export async function listConfigs(req: Request, res: Response) {
  const data = await MiniappConfigService.listConfigs(req.tenantId!);
  res.json({ code: "0", message: "成功", data });
}

export async function getConfig(req: Request, res: Response) {
  const data = await MiniappConfigService.getConfig(req.tenantId!, req.params.platform);
  res.json({ code: "0", message: "成功", data });
}

export async function saveConfig(req: Request, res: Response) {
  const data = await MiniappConfigService.saveConfig(req.tenantId!, req.params.platform, req.body);
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
  const data = await MiniappConfigService.publish(req.tenantId!, {
    ...req.body,
    operator: (req as any).user?.name || 'admin'
  });
  res.json({ code: "0", message: "发布成功", data });
}

export async function listPublishLogs(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const data = await MiniappConfigService.listPublishLogs(req.tenantId!, page, pageSize);
  res.json({ code: "0", message: "成功", data });
}