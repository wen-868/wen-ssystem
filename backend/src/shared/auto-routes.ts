import type { Express, Router, RequestHandler } from "express";
import { readdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { requireAuth, requireAuthWithTenant } from "../middleware/auth.js";
import logger from "./logger.js";

/**
 * 路由配置项
 *
 * 路由文件通过导出 routeConfig（单路由）或 routeConfigs（多路由）来声明配置。
 * 若两者均未导出，auto-routes 会尝试从文件名推断前缀（向后兼容）。
 */
export interface RouteConfig {
  /** 挂载路径前缀，如 "/api/admin/reports" */
  prefix: string;
  /** Express Router 实例 */
  router: Router;
  /** 认证方式：
   *  - "requireAuthWithTenant"（默认）：认证 + 租户隔离
   *  - "requireAuth"：仅认证
   *  - "none"：不添加中间件（路由内部自行处理）
   */
  auth?: "requireAuthWithTenant" | "requireAuth" | "none";
}

/**
 * 从文件名推断路由前缀（向后兼容）
 * 例：admin.routes.ts → /api/admin
 */
export function inferPrefix(filename: string): string {
  const base = filename.replace(/\.routes\.ts$/, "").replace(/\.routes\.js$/, "");
  return `/api/${base}`;
}

/**
 * 根据 auth 配置获取中间件数组
 */
export function getAuthMiddlewares(auth?: RouteConfig["auth"]): RequestHandler[] {
  switch (auth) {
    case "requireAuth":
      return [requireAuth];
    case "requireAuthWithTenant":
      return requireAuthWithTenant; // auth.ts 中已导出为数组 [requireAuth, tenantMiddleware]
    case "none":
      return [];
    default:
      return requireAuthWithTenant;
  }
}

/**
 * 自动扫描 routes/ 目录并注册所有路由
 *
 * 优先级：
 *  1. 文件导出 routeConfigs（数组）→ 按数组顺序注册
 *  2. 文件导出 routeConfig（单个对象）→ 注册
 *  3. 文件只有一个 Router 导出 → 从文件名推断前缀，默认 auth = requireAuthWithTenant
 *  4. 文件有多个 Router 导出但无 routeConfigs → 打印警告，跳过
 *
 * 使用方式（在 server.ts 中）：
 *   import { setupRoutes } from "./shared/auto-routes.js";
 *   await setupRoutes(app);
 *
 * @param app Express 应用实例
 * @param options 可选配置：routesDir 自定义路由目录（用于测试）
 */
export async function setupRoutes(
  app: Express,
  options?: { routesDir?: string }
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const routesDir = options?.routesDir ?? join(__dirname, "..", "routes");

  let files: string[];
  try {
    files = readdirSync(routesDir).filter((f) => f.endsWith(".routes.ts") || f.endsWith(".routes.js"));
  } catch {
    logger.warn("[auto-routes] routes/ 目录不存在，跳过路由自动发现");
    return;
  }

  // 按文件名排序，保证注册顺序可预测
  files.sort();

  const configs: RouteConfig[] = [];

  for (const file of files) {
    // 使用绝对路径 + file:// URL，确保动态 import 可移植（含自定义 routesDir）
    const modulePath = pathToFileURL(join(routesDir, file)).href;
    let mod: Record<string, unknown>;

    try {
      mod = await import(modulePath);
    } catch (err: any) {
      logger.error(`[auto-routes] 无法加载路由模块 ${file}:`, err.message);
      continue;
    }

    // ---------- 优先级 1：routeConfigs（数组） ----------
    if (Array.isArray(mod.routeConfigs)) {
      for (const cfg of mod.routeConfigs as RouteConfig[]) {
        if (cfg && cfg.prefix) {
          configs.push(cfg);
        }
      }
      continue;
    }

    // ---------- 优先级 2：routeConfig（单个对象） ----------
    const routeConfig = mod.routeConfig as RouteConfig | undefined;
    if (routeConfig && routeConfig.prefix) {
      configs.push(routeConfig);
      continue;
    }

    // ---------- 优先级 3：向后兼容 —— 收集所有 Router 导出 ----------
    const routerEntries = Object.entries(mod).filter(([, v]) => v && (typeof v === "function" || typeof v === "object") && "use" in v && "get" in v);

    if (routerEntries.length === 1) {
      const [name, router] = routerEntries;
      const prefix = inferPrefix(file);
      logger.warn(
        `[auto-routes] ${file}: 未找到 routeConfig，从文件名推断 prefix="${prefix}"（导出: ${name}）。` +
          ` 建议添加 routeConfig 导出以明确配置。`
      );
      configs.push({
        prefix,
        router: router as unknown as Router,
        auth: "requireAuthWithTenant",
      });
    } else if (routerEntries.length > 1) {
      logger.warn(
        `[auto-routes] ${file}: 检测到 ${routerEntries.length} 个 Router 导出但无 routeConfigs。` +
          ` 请添加 routeConfigs 导出以启用自动注册。导出列表: ${routerEntries.map(([k]) => k).join(", ")}`
      );
    } else {
      const keys = Object.keys(mod).slice(0, 5);
      logger.warn(`[auto-routes] ${file}: 无 Router 导出，keys=${keys.join(",")}`);
    }
    // routerEntries.length === 0 → 无 Router 导出，跳过（可能只导出工具函数）
  }

  // ---------- 注册所有路由 ----------
  for (const config of configs) {
    const middlewares = getAuthMiddlewares(config.auth);
    app.use(config.prefix, ...middlewares, config.router);
  }

  logger.info(`[auto-routes] 已自动注册 ${configs.length} 个路由`);
}