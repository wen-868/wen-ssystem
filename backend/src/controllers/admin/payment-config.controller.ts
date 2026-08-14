import { z } from "zod";
import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { PaymentConfigService } from "../../services/admin/payment-config.service";

const saveChannelConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().optional(),
  mchId: z.string().optional(),
  apiKey: z.string().optional(),
  apiV3Key: z.string().optional(),
  privateKey: z.string().optional(),
  serialNo: z.string().optional(),
  alipayPublicKey: z.string().optional(),
  boxConfig: z.string().optional(),
  certPath: z.string().optional(),
  notifyUrl: z.string().optional(),
  enabled: z.union([z.boolean(), z.string(), z.number()]).optional(),
});

const createBankAccountSchema = z.object({
  bankName: z.string().min(1).max(100),
  accountName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(50),
  isDefault: z.boolean().optional(),
  remark: z.string().max(200).optional(),
});

const updateBankAccountSchema = z.object({
  bankName: z.string().min(1).max(100).optional(),
  accountName: z.string().min(1).max(100).optional(),
  accountNumber: z.string().min(1).max(50).optional(),
  isDefault: z.boolean().optional(),
  remark: z.string().max(200).optional(),
});

export const getChannelConfig = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.getChannelConfig(req.tenantId!, req.params.provider);
  res.json(ok(data));
});

export const saveChannelConfig = asyncHandler(async (req: Request, res: Response) => {
  const body = saveChannelConfigSchema.parse(req.body);
  const data = await PaymentConfigService.saveChannelConfig(req.tenantId!, req.params.provider, body);
  res.json(ok(data));
});

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.testConnection(req.tenantId!, req.params.provider);
  res.json(ok(data));
});

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.getStatus(req.tenantId!);
  res.json(ok(data));
});

export const listBankAccounts = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.listBankAccounts(req.tenantId!);
  res.json(ok(data));
});

export const createBankAccount = asyncHandler(async (req: Request, res: Response) => {
  const body = createBankAccountSchema.parse(req.body);
  const data = await PaymentConfigService.createBankAccount(req.tenantId!, body);
  res.json(ok(data));
});

export const updateBankAccount = asyncHandler(async (req: Request, res: Response) => {
  const body = updateBankAccountSchema.parse(req.body);
  const data = await PaymentConfigService.updateBankAccount(req.tenantId!, Number(req.params.id), body);
  res.json(ok(data));
});

export const deleteBankAccount = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.deleteBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(data));
});

export const setDefaultBankAccount = asyncHandler(async (req: Request, res: Response) => {
  const data = await PaymentConfigService.setDefaultBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(data));
});
