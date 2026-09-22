import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-template.controller";

/**
 * C2-0 实现段：平台模板中心路由（prefix /api/platform/templates）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §三（12 个端点中的 #1~#10）。
 * 注册顺序：同一 router 内**先具体后通配**——
 *   /print/upload、/import-export/:id/download 一律写在任何 /:id 之前。
 * 鉴权：routeConfig.auth = "requirePlatformAuth"（与既有平台路由一致，由 auto-routes 挂载）。
 */

export const platformTemplatesRouter = Router();

// ─── 初始化模板：列表 / 新建 / 版本记录 / 编辑 ─────────────────
// GET /api/platform/templates/init - 初始化模板列表（含 copyConfigs）
platformTemplatesRouter.get("/init", asyncHandler(controller.listInitTemplates));
// POST /api/platform/templates/init - 新建初始化模板 + version=1 版本快照
platformTemplatesRouter.post("/init", asyncHandler(controller.createInitTemplate));
// GET /api/platform/templates/init/:id/versions - 版本记录（写出在 PUT /init/:id 之前）
platformTemplatesRouter.get("/init/:id/versions", asyncHandler(controller.listInitTemplateVersions));
// PUT /api/platform/templates/init/:id - 编辑 + version+1 + 版本快照
platformTemplatesRouter.put("/init/:id", asyncHandler(controller.updateInitTemplate));

// ─── 公共打印模板：列表 / 上传 / 设为公共 ──────────────────────
// GET /api/platform/templates/print?billType= - 公共打印模板列表（billType 可选）
platformTemplatesRouter.get("/print", asyncHandler(controller.listPrintTemplates));
// POST /api/platform/templates/print/upload - 上传模板（具体路径，放在 /print/:id/... 之前）
platformTemplatesRouter.post("/print/upload", asyncHandler(controller.uploadPrintTemplate));
// POST /api/platform/templates/print/:id/public - 设为公共模板
platformTemplatesRouter.post("/print/:id/public", asyncHandler(controller.setPrintTemplatePublic));

// ─── 导入 / 导出模板：列表 / 新增 / 下载 ───────────────────────
// GET /api/platform/templates/import-export?direction= - 模板清单
platformTemplatesRouter.get("/import-export", asyncHandler(controller.listIoTemplates));
// POST /api/platform/templates/import-export - 新增模板（列表/下载的数据来源）
platformTemplatesRouter.post("/import-export", asyncHandler(controller.createIoTemplate));
// GET /api/platform/templates/import-export/:id/download - 模板文件下载
platformTemplatesRouter.get(
  "/import-export/:id/download",
  asyncHandler(controller.downloadIoTemplate)
);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/templates",
  router: platformTemplatesRouter,
  auth: "requirePlatformAuth",
};
