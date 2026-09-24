import { Router } from "express";
import multer from "multer";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/library.controller";

/**
 * C6-1A #27：品牌授权书上传（复用既有上传范式，凌舟裁定 C6-0-R4 不引入 OSS）
 * 字段名兼容 file / letter 两种写法（前端 TODO 未锁字段名），单文件、10MB 上限。
 */
const authLetterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
}).fields([
  { name: "file", maxCount: 1 },
  { name: "letter", maxCount: 1 }
]);

export const platformLibraryRouter = Router();

// 所有商品库管理接口需要平台管理员认证
platformLibraryRouter.use(requirePlatformAuth);

// ─── SPU 路由 ──────────────────────────────────────────────────
// GET /api/platform/library/spus - SPU列表
platformLibraryRouter.get("/spus", asyncHandler(controller.listSpus));

// POST /api/platform/library/spus/import - 批量导入SPU（放在 /:id 之前，避免冲突）
platformLibraryRouter.post("/spus/import", asyncHandler(controller.importSpus));

// GET /api/platform/library/spus/:id - SPU详情
platformLibraryRouter.get("/spus/:id", asyncHandler(controller.getSpu));

// POST /api/platform/library/spus - 创建SPU
platformLibraryRouter.post("/spus", asyncHandler(controller.createSpu));

// PUT /api/platform/library/spus/:id - 更新SPU
platformLibraryRouter.put("/spus/:id", asyncHandler(controller.updateSpu));

// PUT /api/platform/library/spus/:id/status - 审核SPU
platformLibraryRouter.put("/spus/:id/status", asyncHandler(controller.reviewSpu));

// DELETE /api/platform/library/spus/:id - 删除SPU
platformLibraryRouter.delete("/spus/:id", asyncHandler(controller.deleteSpu));

// ─── SKU 路由 ──────────────────────────────────────────────────
// GET /api/platform/library/spus/:spuId/skus - SPU下SKU列表
platformLibraryRouter.get("/spus/:spuId/skus", asyncHandler(controller.listSkusBySpu));

// POST /api/platform/library/spus/:spuId/skus - 为SPU添加SKU
platformLibraryRouter.post("/spus/:spuId/skus", asyncHandler(controller.addSku));

// PUT /api/platform/library/skus/:id - 更新SKU
platformLibraryRouter.put("/skus/:id", asyncHandler(controller.updateSku));

// DELETE /api/platform/library/skus/:id - 删除SKU
platformLibraryRouter.delete("/skus/:id", asyncHandler(controller.deleteSku));

// ─── 品牌路由 ──────────────────────────────────────────────────
// GET /api/platform/library/brands - 品牌列表
platformLibraryRouter.get("/brands", asyncHandler(controller.listBrands));

// POST /api/platform/library/brands - 创建品牌
platformLibraryRouter.post("/brands", asyncHandler(controller.createBrand));

// PUT /api/platform/library/brands/:id - 更新品牌
platformLibraryRouter.put("/brands/:id", asyncHandler(controller.updateBrand));

// DELETE /api/platform/library/brands/:id - 删除品牌
platformLibraryRouter.delete("/brands/:id", asyncHandler(controller.deleteBrand));

// POST /api/platform/library/brands/:id/auth-letter - 上传品牌授权书（C6-1A #27）
// 注意：必须排在 /brands/:id 的其它方法之后无冲突（路径段更多、更具体）
platformLibraryRouter.post(
  "/brands/:id/auth-letter",
  authLetterUpload,
  controller.uploadBrandAuthLetter
);

// ─── API Key 路由 ──────────────────────────────────────────────
// GET /api/platform/library/api-keys - API Key列表
platformLibraryRouter.get("/api-keys", asyncHandler(controller.listApiKeys));

// POST /api/platform/library/api-keys - 创建API Key
platformLibraryRouter.post("/api-keys", asyncHandler(controller.createApiKey));

// PUT /api/platform/library/api-keys/:id - 更新API Key
platformLibraryRouter.put("/api-keys/:id", asyncHandler(controller.updateApiKey));

// DELETE /api/platform/library/api-keys/:id - 吊销API Key
platformLibraryRouter.delete("/api-keys/:id", asyncHandler(controller.deleteApiKey));

// GET /api/platform/library/api-keys/:id/stats - 调用统计
platformLibraryRouter.get("/api-keys/:id/stats", asyncHandler(controller.getApiKeyStats));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/library",
  router: platformLibraryRouter,
  auth: "requirePlatformAuth",
};
