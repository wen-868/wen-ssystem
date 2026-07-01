import { Request, Response } from "express";
import { PaymentConfigService } from "../../services/admin/payment-config.service.js";

export async function getChannelConfig(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.getChannelConfig(req.tenantId!, req.params.provider);
    res.json({ code: "0", message: "成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function saveChannelConfig(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.saveChannelConfig(req.tenantId!, req.params.provider, req.body);
    res.json({ code: "0", message: "保存成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.testConnection(req.tenantId!, req.params.provider);
    res.json({ code: "0", message: "测试成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function getStatus(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.getStatus(req.tenantId!);
    res.json({ code: "0", message: "成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function listBankAccounts(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.listBankAccounts(req.tenantId!);
    res.json({ code: "0", message: "成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function createBankAccount(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.createBankAccount(req.tenantId!, req.body);
    res.json({ code: "0", message: "创建成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function updateBankAccount(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.updateBankAccount(req.tenantId!, Number(req.params.id), req.body);
    res.json({ code: "0", message: "更新成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function deleteBankAccount(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.deleteBankAccount(req.tenantId!, Number(req.params.id));
    res.json({ code: "0", message: "删除成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}

export async function setDefaultBankAccount(req: Request, res: Response) {
  try {
    const data = await PaymentConfigService.setDefaultBankAccount(req.tenantId!, Number(req.params.id));
    res.json({ code: "0", message: "设置成功", data });
  } catch (e: any) { res.status(500).json({ code: "500", message: e.message }); }
}