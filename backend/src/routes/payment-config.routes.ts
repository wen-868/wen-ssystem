import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/payment-config.service.js";

const router = Router();

// ==================== 支付渠道配置 ====================

// 获取某个渠道的配置项列表
router.get("/configs/:provider", asyncHandler(async (req: any, res: any) => {
  const result = await service.getChannelConfig(req.tenantId!, req.params.provider);
  res.json(ok(result));
}));

// 保存渠道配置
router.put("/configs/:provider", asyncHandler(async (req: any, res: any) => {
  const result = await service.saveChannelConfig(req.tenantId!, req.params.provider, req.body);
  res.json(ok(result));
}));

// 检测渠道是否配置完整
router.get("/configs/:provider/ready", asyncHandler(async (req: any, res: any) => {
  const ready = await service.isProviderReady(req.tenantId!, req.params.provider);
  res.json(ok({ ready }));
}));

// 获取所有支付渠道的状态
router.get("/status", asyncHandler(async (req: any, res: any) => {
  const result = await service.getPaymentStatus(req.tenantId!);
  res.json(ok(result));
}));

// 测试连接
router.post("/configs/:provider/test", asyncHandler(async (req: any, res: any) => {
  const result = await service.testConnection(req.tenantId!, req.params.provider);
  res.json(ok(result));
}));

// ==================== 银行账号 CRUD ====================

// 列表
router.get("/bank-accounts", asyncHandler(async (req: any, res: any) => {
  const result = await service.listBankAccounts(req.tenantId!);
  res.json(ok(result));
}));

// 新增
router.post("/bank-accounts", asyncHandler(async (req: any, res: any) => {
  const result = await service.addBankAccount(req.tenantId!, req.body);
  res.json(ok(result));
}));

// 编辑
router.put("/bank-accounts/:id", asyncHandler(async (req: any, res: any) => {
  const result = await service.updateBankAccount(req.tenantId!, Number(req.params.id), req.body);
  res.json(ok(result));
}));

// 删除
router.delete("/bank-accounts/:id", asyncHandler(async (req: any, res: any) => {
  const result = await service.deleteBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
}));

// 设为默认
router.put("/bank-accounts/:id/default", asyncHandler(async (req: any, res: any) => {
  const result = await service.setDefaultBankAccount(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
}));

export default router;