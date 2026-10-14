import type { Express, Router, RequestHandler } from "express";
import { readdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { requireAuth, requireAuthWithTenant, requirePlatformAuth } from "../middleware/auth";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import logger from "./logger";
import {
  DUPLICATE_PREFIX_ALLOWLIST,
  classifyRoutePrefixes,
  joinRoutePath,
  type RoutePrefixEntry,
} from "./route-prefix-rules";

/**
 * 白名单与判据的**唯一来源**是 `./route-prefix-rules`（S3-189 ③）：
 *   · 启动期（本文件）与独立门禁脚本 `backend/scripts/guard-route-prefix.mjs` 同调那一份 —— 不再有第二套；
 *   · 此处 re-export 只为兼容既有引用方（`import { DUPLICATE_PREFIX_ALLOWLIST } from "./auto-routes"`）。
 */
export { DUPLICATE_PREFIX_ALLOWLIST };

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
   *  - "requireAuthWithTenant"（默认）：认证 + 租户隔离 + CSRF 防护
   *  - "requireAuth"：仅认证 + CSRF 防护
   *  - "requirePlatformAuth"：平台总后台认证 + CSRF 防护
   *  - "requireConsumerAuthWithTenant"：消费者端（/api/miniapp/**）认证 + 租户隔离 + CSRF 防护 ——
   *    接受商家端 JWT 或微信令牌（微信令牌按绑定会员解析消费者身份，S3-196 / 总清单第 52 项）
   *  - "none"：不添加中间件（路由内部自行处理）
   */
  auth?:
    | "requireAuthWithTenant"
    | "requireAuth"
    | "requirePlatformAuth"
    | "requireConsumerAuthWithTenant"
    | "none";
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
      return [requireAuth, csrfMiddleware];
    case "requireAuthWithTenant":
      return [...requireAuthWithTenant, csrfMiddleware];
    case "requirePlatformAuth":
      return [requirePlatformAuth, csrfMiddleware];
    case "requireConsumerAuthWithTenant":
      return [...requireConsumerAuthWithTenant, csrfMiddleware];
    case "none":
      return [];
    default:
      return [...requireAuthWithTenant, csrfMiddleware];
  }
}

/**
 * ── S3-179 ③：重复前缀「显式白名单 + 阻断」───────────────────────────────────
 *
 * 【为什么升阻断】原实现只是 `logger.warn`（实测启动日志恒有 11 个重复前缀），
 *   告警无人看＝等价于没有检查（本项目已三次踩到"假门禁"，见 AGENTS.md 门禁铁律）。
 *
 * 【判据拆成两类，避免把合法写法一起打死】
 *   ① **真重复端点**：同 method + 同完整路径被多个路由文件注册 ⇒ 后者永不执行（死代码）
 *      ⇒ **一律阻断，无白名单**（见 inspectRouteHygiene.duplicateEndpoints）。
 *   ② **重复前缀**：多个路由文件共用同一 prefix。多数是合法的（如 19 个文件共用
 *      `/api/admin`，路径段互不重叠）⇒ 必须**逐条登记理由**后才能放行；
 *      未登记的重复前缀一律阻断（见 inspectRouteHygiene.unlistedDuplicatePrefixes）。
 *
 * 【白名单可见性】启动日志会**逐条打印**在用的白名单条目（前缀 + 次数 + 理由），
 *   CI 日志可直接看到，不是只在源码里躺着。真重复端点检测为 0 是每条放行条目的机器证据。
 *
 * 【维护约定】新增/下线共用同一前缀的路由文件时无需改本表（理由按前缀登记，不按文件快照）；
 *   新增**未登记**的重复前缀 ⇒ 启动即失败，报错里给出"请登记理由或改名"的处置指引。
 *
 * 【S3-189 ③】上述白名单与判据**已抽到共享模块 `./route-prefix-rules`**（普通 ESM `.js`，随 `dist/` 上生产）：
 *   启动期（本文件）与独立门禁脚本 `backend/scripts/guard-route-prefix.mjs` **同调那一份**，不存在第二套判据；
 *   `DUPLICATE_PREFIX_ALLOWLIST` 仍从本文件 re-export，兼容既有引用方。
 */
/** 路由卫生检查结果（S3-179 ③） */
export interface RouteHygieneReport {
  /** 重复前缀 → 声明该前缀的路由文件（文件名已排序） */
  duplicatePrefixes: Array<{ prefix: string; files: string[] }>;
  /** 未登记的重复前缀（阻断项） */
  unlistedDuplicatePrefixes: Array<{ prefix: string; files: string[] }>;
  /** 真重复端点（阻断项）：`METHOD /完整路径` 被多个文件注册 */
  duplicateEndpoints: Array<{ endpoint: string; files: string[] }>;
  /** 用 router.use 挂了子路由的文件（子树的端点不参与检测，登记而不静默） */
  nestedRouterFiles: string[];
  /**
   * S3-195 ③：**根前缀**（形如 `/api/xxx`）被多文件共享 —— **只出声、不判红**。
   * 以根前缀注册的文件会把整段 `/api/xxx/**` 前置套上认证 + CSRF（含兄弟文件的公开端点与不存在的子路径），
   * 既有的「重复前缀 / 真重复端点」判据抓不到它，故单列告警（判据见 `./route-prefix-rules`）。
   */
  sharedRootPrefixes: Array<{ prefix: string; files: string[] }>;
}

/**
 * 启动期硬化失败：**必须显式 exit**，不能只 throw。
 *
 * 【为什么不能只抛错】server.ts 在模块顶层注册了全局 `uncaughtException` 处理器
 *   （只记日志 + 发飞书告警，**不退出进程**）；而 `await setupRoutes(app)` 也在模块顶层执行，
 *   抛错会变成 uncaughtException ⇒ 进程**继续存活但不监听端口**（实测：日志已报错，
 *   20s 后端口仍未监听、进程仍在）。编排层（pm2 / systemd / 容器）看到的是"在运行"、
 *   实际不服务任何请求 ⇒ 比直接崩掉更危险。故此处显式 `process.exit(1)`。
 */
function failStartup(message: string): never {
  logger.error(message);
  process.exit(1);
}

/** Express 认得的 HTTP 方法（layer.route.methods 的键） */
const ROUTE_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

/**
 * 检查所有路由配置的「重复前缀 / 真重复端点」。
 *
 * 纯函数：只读 configs 与 router.stack，不注册路由、不抛异常（判定与阻断在 setupRoutes 里做），
 * 便于单测与复用。
 *
 * S3-189 ③：**判定与白名单不再在本文件**——这里只负责把「运行期的 router 栈」翻译成共享模块的
 * 入口数组（`RoutePrefixEntry[]`），随后交给 `classifyRoutePrefixes`（同一份判据与白名单，
 * 门禁脚本 `guard-route-prefix.mjs` 走的是同一个函数）。路径拼接（含参数名归一）亦改用共享实现。
 *
 * @param configs   auto-routes 收集到的全部路由配置
 * @param declaredBy 配置 → 声明它的路由文件名（用于报错定位）
 */
export function inspectRouteHygiene(
  configs: RouteConfig[],
  declaredBy: ReadonlyMap<RouteConfig, string>
): RouteHygieneReport {
  const entries: RoutePrefixEntry[] = [];

  for (const config of configs) {
    const file = declaredBy.get(config) ?? "(未知文件)";
    const endpoints: string[] = [];
    let nestedRouter = false;

    const stack = (config.router as unknown as { stack?: unknown[] } | undefined)?.stack;
    if (Array.isArray(stack)) {
      for (const layer of stack as Array<{
        route?: { path?: string; methods?: Record<string, boolean> };
        handle?: { stack?: unknown[] };
      }>) {
        if (layer?.route) {
          const routePath = layer.route.path ?? "";
          for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
            if (!enabled || !ROUTE_METHODS.includes(method)) continue;
            endpoints.push(`${method.toUpperCase()} ${joinRoutePath(config.prefix, routePath)}`);
          }
        } else if (Array.isArray(layer?.handle?.stack)) {
          // 子路由子树：Express 4 不暴露挂载 scope 字符串，无法拼完整路径 ⇒ 只登记（共享模块报 nestedRouterFiles）
          nestedRouter = true;
        }
      }
    }

    entries.push({ prefix: config.prefix, file, endpoints, nestedRouter });
  }

  return classifyRoutePrefixes(entries);
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
  // 配置 → 声明它的路由文件（供重复前缀/真重复端点的报错定位，S3-179 ③）
  const declaredBy = new Map<RouteConfig, string>();

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
          declaredBy.set(cfg, file);
        }
      }
      continue;
    }

    // ---------- 优先级 2：routeConfig（单个对象） ----------
    const routeConfig = mod.routeConfig as RouteConfig | undefined;
    if (routeConfig && routeConfig.prefix) {
      configs.push(routeConfig);
      declaredBy.set(routeConfig, file);
      continue;
    }

    // ---------- 优先级 3：向后兼容 —— 收集所有 Router 导出 ----------
    const routerEntries = Object.entries(mod).filter(([, v]) => v && (typeof v === "function" || typeof v === "object") && "use" in v && "get" in v);

    if (routerEntries.length === 1) {
      const [[name, router]] = routerEntries;
      const prefix = inferPrefix(file);
      logger.warn(
        `[auto-routes] ${file}: 未找到 routeConfig，从文件名推断 prefix="${prefix}"（导出: ${name}）。` +
        ` 建议添加 routeConfig 导出以明确配置。`
      );
      const inferredConfig: RouteConfig = {
        prefix,
        router: router as unknown as Router,
        auth: "requireAuthWithTenant",
      };
      configs.push(inferredConfig);
      declaredBy.set(inferredConfig, file);
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

  // ---------- 重复前缀 / 真重复端点：白名单放行 + 未登记即阻断（S3-179 ③） ----------
  // 判据与白名单的唯一来源见 ./route-prefix-rules（启动期与 guard-route-prefix.mjs 共用同一份）。
  const hygiene = inspectRouteHygiene(configs, declaredBy);

  // ① 真重复端点（同 method 同完整路径）⇒ 后者永不执行，一律阻断
  if (hygiene.duplicateEndpoints.length > 0) {
    const detail = hygiene.duplicateEndpoints
      .map((d) => `${d.endpoint}（${d.files.join(" + ")}）`)
      .join("；");
    failStartup(
      `[auto-routes] 真重复端点 ${hygiene.duplicateEndpoints.length} 个：${detail}。` +
        ` 同一 method + 同一完整路径只能由一个路由文件注册（后者永不执行），请删除重复注册。`
    );
  }

  // ② 未登记的重复前缀 ⇒ 阻断（登记入口 = ./route-prefix-rules 的 DUPLICATE_PREFIX_ALLOWLIST）
  if (hygiene.unlistedDuplicatePrefixes.length > 0) {
    const detail = hygiene.unlistedDuplicatePrefixes
      .map((d) => `${d.prefix} (${d.files.length}次: ${d.files.join(", ")})`)
      .join("；");
    failStartup(
      `[auto-routes] 未登记的重复前缀 ${hygiene.unlistedDuplicatePrefixes.length} 个：${detail}。` +
        ` 若属「多文件共用同一前缀、路径段互不重叠」的合法写法，请在 backend/src/shared/route-prefix-rules.js` +
        ` 的 DUPLICATE_PREFIX_ALLOWLIST 中逐条登记理由；否则请合并或改名。`
    );
  }

  // ③ 白名单内的重复前缀 ⇒ 放行，但逐条打印（理由在 CI 日志里可见）
  if (hygiene.duplicatePrefixes.length > 0) {
    logger.info(
      `[auto-routes] 重复前缀 ${hygiene.duplicatePrefixes.length} 个（均已登记放行，真重复端点 0 项）：` +
        hygiene.duplicatePrefixes.map((d) => `${d.prefix} (${d.files.length}次)`).join(", ")
    );
    for (const d of hygiene.duplicatePrefixes) {
      logger.info(`[auto-routes]  · 白名单 ${d.prefix} (${d.files.length}次) ← ${DUPLICATE_PREFIX_ALLOWLIST[d.prefix]}`);
    }
    logger.info(
      `[auto-routes]  · 以上 ${hygiene.duplicatePrefixes.length} 条放行的机器证据：同一 method + 同一完整路径的重复注册为 0 项。`
    );
  }

  // ③.5 S3-195 ③：**根前缀被多文件共享** ⇒ 只出声、不判红
  //   为什么只告警：以根前缀注册并不违反既有判据（路径段互不重叠就是"合法共享前缀"，如 `/api/admin`），
  //   但它会让 `app.use(前缀, 认证+CSRF, router)` 覆盖**整段** `/api/xxx/**` —— 兄弟文件的
  //   `auth:"none"` 公开端点会被拦成 401、不存在的子路径回 401 而不是 404（S3-187/S3-195 的病灶）。
  //   真正的修法是"只声明自己拥有的路径段"（收窄前缀），故此处把"靠人记得核"改成"机器每次出声"。
  if (hygiene.sharedRootPrefixes.length > 0) {
    logger.warn(
      `[auto-routes][根前缀共享告警] ${hygiene.sharedRootPrefixes.length} 个**根前缀**被多文件共用：` +
        hygiene.sharedRootPrefixes.map((d) => `${d.prefix} (${d.files.length}次: ${d.files.join(", ")})`).join("；") +
        `。根前缀的 routeConfig.auth 会按**前缀级**前置套认证 + CSRF（覆盖整段 /api/**，含兄弟文件的公开端点与` +
        `不存在的子路径）⇒ 请核对各文件是否已按「只声明自己拥有的路径段」收窄（S3-187 commerce-fix、` +
        `S3-195 门店 9 文件的做法）；本条**只告警不阻断**（详见 src/shared/route-prefix-rules.js）。`
    );
  }

  // ④ 已知边界：挂子路由的文件其子树不参与端点检测（登记而不静默）
  if (hygiene.nestedRouterFiles.length > 0) {
    logger.warn(
      `[auto-routes] 以下文件用 router.use 挂载了子路由，其子树不参与真重复端点检测（已知边界，非静默通过）：` +
        hygiene.nestedRouterFiles.join(", ")
    );
  }

  // ---------- 注册所有路由 ----------
  for (const config of configs) {
    // 防御性检查：跳过 router 为 undefined 的配置
    if (!config.router) {
      logger.warn(`[auto-routes] 跳过前缀 ${config.prefix}：router 为 undefined`);
      continue;
    }
    const middlewares = getAuthMiddlewares(config.auth);
    app.use(config.prefix, ...middlewares, config.router);
  }

  logger.info(`[auto-routes] 已自动注册 ${configs.length} 个路由`);
}
