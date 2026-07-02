import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as configSvc from "../services/admin/miniapp-config.service.js";
import * as templateSvc from "../services/admin/miniapp-template.service.js";
import * as publishSvc from "../services/admin/miniapp-publish.service.js";

const router = Router();

// ==================== Phase B: 小程序配置 ====================

// 所有平台配置列表
router.get("/configs", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.listConfigs(req.tenantId!);
  res.json(ok(result));
}));

// 获取指定平台配置
router.get("/configs/:platform", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.getConfig(req.tenantId!, req.params.platform);
  if (!result) { res.status(404).json({ code: "404", message: "平台配置不存在" }); return; }
  res.json(ok(result));
}));

// 保存指定平台配置
router.put("/configs/:platform", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.saveConfig(req.tenantId!, req.params.platform, req.body);
  res.json(ok(result));
}));

// 获取隐私设置
router.get("/privacy", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.getPrivacySettings(req.tenantId!);
  res.json(ok(result));
}));

// 保存隐私设置
router.put("/privacy", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.savePrivacySettings(req.tenantId!, req.body);
  res.json(ok(result));
}));

// 获取域名设置
router.get("/domain", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.getDomainSettings(req.tenantId!);
  res.json(ok(result));
}));

// 保存域名设置
router.put("/domain", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.saveDomainSettings(req.tenantId!, req.body);
  res.json(ok(result));
}));

// 获取功能开关
router.get("/features", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.getFeatures(req.tenantId!);
  res.json(ok(result));
}));

// 保存功能开关
router.put("/features", asyncHandler(async (req: any, res: any) => {
  const result = await configSvc.saveFeatures(req.tenantId!, req.body);
  res.json(ok(result));
}));

// ==================== Phase C: 模板系统 ====================

// 模板列表
router.get("/templates", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.listTemplates(req.tenantId!);
  res.json(ok(result));
}));

// 模板详情
router.get("/templates/:id", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.getTemplateDetail(req.tenantId!, Number(req.params.id));
  if (!result) { res.status(404).json({ code: "404", message: "模板不存在" }); return; }
  res.json(ok(result));
}));

// 创建模板
router.post("/templates", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.createTemplate(req.tenantId!, req.body);
  res.json(ok(result));
}));

// 编辑模板
router.put("/templates/:id", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.updateTemplate(req.tenantId!, Number(req.params.id), req.body);
  res.json(ok(result));
}));

// 删除模板
router.delete("/templates/:id", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.deleteTemplate(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
}));

// 应用模板到小程序
router.post("/templates/:id/apply", asyncHandler(async (req: any, res: any) => {
  try {
    const result = await templateSvc.applyTemplate(req.tenantId!, Number(req.params.id));
    res.json(ok(result));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// 获取预览配置
router.get("/preview", asyncHandler(async (req: any, res: any) => {
  const result = await templateSvc.getPreviewConfig(req.tenantId!);
  res.json(ok(result));
}));

// ==================== Phase D: 一键发布 ====================

// 发布
router.post("/publish", asyncHandler(async (req: any, res: any) => {
  try {
    const result = await publishSvc.publish(req.tenantId!, req.body);
    res.json(ok(result));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// 回滚
router.post("/publish/rollback", asyncHandler(async (req: any, res: any) => {
  try {
    const result = await publishSvc.rollback(req.tenantId!, req.body.version);
    res.json(ok(result));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// 提交审核
router.post("/publish/audit", asyncHandler(async (req: any, res: any) => {
  const result = await publishSvc.submitAudit(req.tenantId!, req.body);
  res.json(ok(result));
}));

// 发布历史
router.get("/publish-logs", asyncHandler(async (req: any, res: any) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await publishSvc.getPublishHistory(req.tenantId!, page, pageSize);
  res.json(ok(result));
}));

// 当前版本
router.get("/publish/version", asyncHandler(async (req: any, res: any) => {
  const result = await publishSvc.getCurrentVersion(req.tenantId!);
  res.json(ok(result));
}));

export default router;