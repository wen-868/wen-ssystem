import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { query, queryOne } from "../shared/db.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";

export const platformRouter = Router();

// GET /api/platform/overview - 平台总览（租户数、用户数、订单数等）
platformRouter.get("/overview", asyncHandler(async (req, res) => {
  try {
    const tenantCount = await queryOne<any>("SELECT COUNT(*) AS count FROM tenant WHERE status = 'ACTIVE'");
    const userCount = await queryOne<any>("SELECT COUNT(*) AS count FROM sys_user WHERE status = 1");
    const storeCount = await queryOne<any>("SELECT COUNT(*) AS count FROM store WHERE status = 1");
    const orderCount = await queryOne<any>("SELECT COUNT(*) AS count FROM sale_order WHERE deleted = 0");

    res.json(ok({
      tenantCount: tenantCount?.count ?? 0,
      userCount: userCount?.count ?? 0,
      storeCount: storeCount?.count ?? 0,
      orderCount: orderCount?.count ?? 0
    }));
  } catch (err: any) {
    res.status(500).json(fail(err.message || "服务器错误"));
  }
}));

// GET /api/platform/tenants - 平台租户列表
platformRouter.get("/tenants", asyncHandler(async (req, res) => {
  try {
    const tenants = await query<any>(
      "SELECT id, tenant_name, status, created_at FROM tenant ORDER BY id DESC LIMIT 100"
    );
    res.json(ok(tenants ?? []));
  } catch (err: any) {
    res.status(500).json(fail(err.message || "服务器错误"));
  }
}));

// 健康检查已移至 server.ts 公开路由（无需认证）
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requireAuthWithTenant",
};
