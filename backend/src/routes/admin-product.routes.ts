import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import type { RouteConfig } from "../shared/auto-routes";

import { AUTHED_ROUTE_LIMIT } from "../config/rate-limit";
import { requirePermission } from "../middleware/rbac-auth";
import { PERM_GOODS_CREATE } from "../shared/goods-permission-codes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as productController from "../controllers/admin/product.controller";
import { uploadProductImage } from "../controllers/admin/product-image.controller";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";
import * as categoryController from "../controllers/admin/category.controller";

export const adminProductRouter = Router();

adminProductRouter.use(priceResponseFilter());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname || "")) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error("请上传 jpg/png/gif/webp 图片"), { statusCode: 400 }));
    }
  },
});

// ============ 商品管理 ============
// 注意：/products/categories 必须在 /products/:spuId 之前注册，否则 "categories" 会被当作 spuId 参数
adminProductRouter.get("/products/categories", categoryController.listCategories);
adminProductRouter.get("/products", productController.listProducts);
// S3-233-F1（返工，2026-10-16）：CodeQL `js/missing-rate-limiting` 新 high ——
//   本行经 S3-233 挂上 goods:create 权限门后，成为"已鉴权 + 处理链上有文件系统访问"的注册点
//   （`controllers/admin/product-image.controller.ts:21/49` 的 `fs.mkdirSync` / `fs.writeFileSync`）
//   ⇒ 必须在**注册点内联**限流调用（第 57 项形状；`config/rate-limit.ts` 头注释：包进 helper 后
//   CodeQL 识别不到，这是可见性硬要求）。
//   ⚠️ 顺序：限流 → 鉴权 → multer → 控制器 —— 与仓内**既有 14 处**同族接线一致
//   （wechat 5 / marketing-miniapp 7 / commerce-fix 3，全部把限流放在鉴权之前）。
//   ⚠️ 本注释**故意不写**鉴权中间件的字面调用形态（标识符 + 紧跟左括号）：`rbac-g0-wiring.test.ts`
//   的跨批计数用例按**原文**统计该形态、**不剥注释**，写进注释会让该文件计数 +1 并假红（本次实测踩中）。
adminProductRouter.post("/products/upload-image", rateLimit(AUTHED_ROUTE_LIMIT), requirePermission("goods:create"), upload.single("image"), uploadProductImage);
adminProductRouter.get("/products/:spuId(\\d+)", productController.getProductDetail);
// S3-142：手工建品补挂权限点（既有码 goods:create，079 权限矩阵 :201），未登录仍是 401、无权限 403
adminProductRouter.post("/products", requirePermission(PERM_GOODS_CREATE), productController.createProduct);
// S3-220（商品域接线 · B2 批 3）：以下 3 行按派单卡 §二 接线，挂**既有**码 `goods:edit`
// （`docs/migrations/079_权限矩阵.sql:202`）。逐条「真实使用者 ⊇ 码持有者」核对与
// 「其余 42 行为何不接」见 `docs/tasks/cards/R101-S3-220-阿坚-回传.md` 与缺口清单 §十二。
adminProductRouter.put("/products/:id/status", requirePermission("goods:edit"), productController.updateProductStatus);
// S3-233（B 类收编第一批 · 商品域）：以下 8 行按 permission-gates.ts 的两道门收编 ——
//   · `goods-detail-edit`（商品详情页底栏「修改/保存」按钮，门码 = goods:edit|price|create|delete 四码全持）
//   · `goods-batch-price-submit`（批量改价页「提交」按钮，门码 = goods:price）
// 逐条码选取：主数据/状态类 ⇒ `goods:edit`；改价 ⇒ `goods:price`（同文件 :41/:43 先例）；
// 新增 SKU 单位（生成新记录）⇒ `goods:create`；删除单位 ⇒ `goods:delete`（与 :37 建品 `goods:create`、S3-220 三行同族）。
// ⚠️ 报备项：桌面 `views/Products.vue`（`router/index.ts:165` 角色含 STORE_MANAGER）会因本次收编对店长返回 403 —— 
// 店长只持 `goods:price`（移动端批量改价页不受影响），该受众变化与 S3-230 裁定 §二.1「商品详情编辑 ⇒ 只剩超管」一致。
adminProductRouter.put("/products/:id", requirePermission("goods:edit"), productController.updateProduct);
adminProductRouter.put("/products/:id/disable", requirePermission("goods:edit"), productController.disableProduct);
adminProductRouter.get("/products/:skuId/price-history", productController.getProductPriceHistory);
adminProductRouter.put("/products/:skuId/price", requirePermission("goods:price"), productController.updateProductPrice);
// S3-237（接线批 10 · 组 2「商品 A 类」）：条码维护挂**既有**码 `goods:edit`（079:201）。
// 前端唯一调用点 = `admin-web/src/views/Products.vue:1156`，页面 `router/index.ts:165`
// （`meta.roles` = [SUPER_ADMIN, **STORE_MANAGER**]）⇒ 店长经 **D1**（迁移 204 补 `goods:create|edit`）持有
// ⇒ 无 403 回归（移动端无本端点调用点，`app-mobile` 只有 `libraryLookup` 扫码查询）。
adminProductRouter.put("/products/skus/:skuId/barcode", requirePermission("goods:edit"), productController.updateSkuBarcode);
adminProductRouter.put("/products/skus/:skuId", requirePermission("goods:edit"), productController.updateSku);
adminProductRouter.post("/products/skus/:skuId/units", requirePermission("goods:create"), productController.addSkuUnit);
adminProductRouter.put("/products/skus/:skuId/units/:unitId", requirePermission("goods:edit"), productController.updateSkuUnit);
adminProductRouter.delete("/products/skus/:skuId/units/:unitId", requirePermission("goods:delete"), productController.deleteSkuUnit);
adminProductRouter.post("/products/import", productController.importProducts);
adminProductRouter.put("/products/:spuId/marketing-tags", requirePermission("goods:edit"), productController.setMarketingTags);
adminProductRouter.put("/products/:id/warning-threshold", requirePermission("goods:edit"), stockWarningController.updateWarningThreshold);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminProductRouter,
  auth: "requireAuthWithTenant",
};
