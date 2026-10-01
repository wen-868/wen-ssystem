import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/library.controller";
import {
  listLibrarySpus,
  getLibrarySpu,
  copyLibrarySpus,
  listMyCallLogs,
} from "../controllers/admin/library-copy.controller";
import { PERM_LIBRARY_VIEW, PERM_LIBRARY_COPY } from "../shared/library-permission-codes";

/**
 * 商户端商品库扫码查询路由
 *
 * POST /lookup 按条码查询商品库（SCAN＝查询，不写调取流水）
 * R101-C6-4-1 新增 4 条「商品库调取（COPY）」端点：COPY＝调取（写流水 + 扣商品配额）
 */
export const adminLibraryRouter = Router();

// 按条码查询商品库
adminLibraryRouter.post("/lookup", asyncHandler(controller.lookupByBarcode));

// ─── R101-C6-4-1：商品库调取（4 条，路径由派单卡/立项草案逐字钉死） ──────────
// 权限点代码常量见 shared/library-permission-codes.ts（Q8 ①：代码常量 + 授权另行落，迁移零预置）
// 检索/预览/我的记录 = library:view（只读，READONLY 角色的 *:view 自动命中）
adminLibraryRouter.get("/spus", requirePermission(PERM_LIBRARY_VIEW), asyncHandler(listLibrarySpus));
adminLibraryRouter.get("/spus/:id", requirePermission(PERM_LIBRARY_VIEW), asyncHandler(getLibrarySpu));
adminLibraryRouter.get("/copies", requirePermission(PERM_LIBRARY_VIEW), asyncHandler(listMyCallLogs));
// 执行调取 = library:copy（写：生成租户私有档案 + 写 t_library_call_log + 扣商品配额）
adminLibraryRouter.post("/copies", requirePermission(PERM_LIBRARY_COPY), asyncHandler(copyLibrarySpus));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/library",
  router: adminLibraryRouter,
  auth: "requireAuthWithTenant",
};
