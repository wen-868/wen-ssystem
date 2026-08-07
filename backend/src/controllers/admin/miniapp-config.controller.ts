import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { MiniappConfigService } from "../../services/admin/miniapp-config.service";

const saveConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().optional(),
  appName: z.string().optional(),
  appVersion: z.string().optional(),
  templateId: z.number().int().positive().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

const generatePackageSchema = z.object({
  platform: z.string().min(1),
  templateId: z.number().int().positive(),
  appId: z.string().optional(),
  appName: z.string().optional(),
  version: z.string().optional(),
});

const publishSchema = z.object({
  platform: z.string().optional(),
  templateId: z.number().int().positive().optional(),
  appId: z.string().optional(),
  appName: z.string().optional(),
  version: z.string().optional(),
  remark: z.string().optional(),
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

// 生成代码包（zip）
export const generatePackage = asyncHandler(async (req: Request, res: Response) => {
  const body = generatePackageSchema.parse(req.body);
  const data = await MiniappConfigService.generatePackage(req.tenantId!, body);
  res.json(ok(data));
});

// 下载代码包（zip）
export const downloadPackage = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.json(fail("代码包 ID 无效"));
    return;
  }
  const { filePath, fileName } = await MiniappConfigService.getPackageFile(req.tenantId!, id);
  res.download(filePath, fileName);
});

export const listPublishLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const data = await MiniappConfigService.listPublishLogs(req.tenantId!, page, pageSize);
  res.json(ok(data));
});

// 一键生成并发布（生成代码包 + miniprogram-ci 上传体验版）
export const publish = asyncHandler(async (req: Request, res: Response) => {
  const body = publishSchema.parse(req.body);
  const data = await MiniappConfigService.publish(req.tenantId!, body);
  res.json(ok(data));
});

// 上传小程序上传密钥（.key，multer 已解析到 req.file）
export const uploadKey = asyncHandler(async (req: Request, res: Response) => {
  const platform = String(req.query.platform || req.body?.platform || "wechat");
  const file = req.file;
  if (!file) {
    res.json(fail("请选择 .key 上传密钥文件", "400"));
    return;
  }
  const privateKeyPassword =
    typeof req.body?.privateKeyPassword === "string" ? req.body.privateKeyPassword : undefined;
  const data = await MiniappConfigService.uploadKey(
    req.tenantId!,
    platform,
    { originalname: file.originalname, buffer: file.buffer, size: file.size },
    privateKeyPassword
  );
  res.json(ok(data));
});

// 查询上传密钥配置状态（脱敏）
export const getKeyStatus = asyncHandler(async (req: Request, res: Response) => {
  const platform = String(req.query.platform || "wechat");
  const data = await MiniappConfigService.getKeyStatus(req.tenantId!, platform);
  res.json(ok(data));
});
