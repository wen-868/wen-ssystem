import { z } from "zod";
import { Request, Response } from "express";
import { ok } from "../../shared/response.js";
import { PaymentConfigService } from "../../services/admin/payment-config.service.js";

const saveChannelConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  mchId: z.string().optional(),
  apiKey: z.string().optional(),
  certPath: z.string().optional(),
  notifyUrl: z.string().optional(),
  enabled: z.boolean().optional(),
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

export async function getChannelConfig(req: Request, res: Response) {
  const data = await PaymentConfigService.getChannelConfig(req.tenantId!, req.params.provider);
  res.json(ok(data));
}

export async function saveChannelConfig(req: Request, res: Response) {
  const body = saveChannelConfigSchema.parse(req.body);
  const data = await PaymentConfigService.saveChannelConfig(req.tenantId!, req.params.provider, body);
  res.json(ok(data));
}

export async function testConnection(req: Request, res: Response) {
  const data = await PaymentConfigService.testConnection(req.tenantId!, req.params.provider);
  res.json(ok(data));
}

export async function getStatus(req: Request, res: Response) {
  const data = await PaymentConfigService.getStatus(req.tenantId!);
  res.json(ok(data));
}

export async function listBankAccounts(req: Request, res: Response) {
  const data = await PaymentConfigService.listBankAccounts(req.tenantId!);
  res.json(ok(data));
}

export async function createBankAccount(req: Request, res: Response) {
  const body = createBankAccountSchema.parse(req.body);
  const data = await PaymentConfigService.createBankAccount(req.tenantId!, body);
  res.json(ok(data));
}

export async function updateBankAccount(req: Request, res: Response) {
  const body = updateBankAccountSchema.parse(req.body);
  const data = await PaymentConfigService.updateBankAccount(req.tenantId!, Number(req.params.id), body);
  res.json(ok(data));
}

export async function deleteBankAccount(req: Request, res: Response) {
  const data = await PaymentConfigService.deleteBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(data));
}

export async function setDefaultBankAccount(req: Request, res: Response) {
  const data = await PaymentConfigService.setDefaultBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(data));
}