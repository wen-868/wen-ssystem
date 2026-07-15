import LRUCache from "lru-cache";
import type { Request, Response, NextFunction } from "express";
import logger from "../shared/logger";

/**
 * 内存缓存中间件配置
 */
export interface CacheConfig {
  /** 缓存键前缀 */
  prefix?: string;
  /** 缓存过期时间（秒），默认 60 秒 */
  ttl?: number;
  /** 最大缓存条数，默认 100 */
  max?: number;
  /** 仅缓存 GET 请求 */
  onlyGet?: boolean;
  /** 自定义缓存键生成函数 */
  keyGenerator?: (req: Request) => string;
}

/**
 * 创建内存缓存中间件
 * 
 * 用于热点接口的响应缓存，如商品列表、订单列表、报表查询等。
 * 使用 LRU 策略，缓存满时自动淘汰最久未使用的条目。
 * 
 * @example
 * // 在路由中使用
 * router.get("/products", memoryCache({ ttl: 60, max: 50 }), productController.listProducts);
 * 
 * @example
 * // 全局使用（仅缓存 GET 请求）
 * app.use(memoryCache({ ttl: 30, onlyGet: true }));
 */
export function memoryCache(config: CacheConfig = {}) {
  const {
    prefix = "cache:",
    ttl = 60,
    max = 100,
    onlyGet = true,
    keyGenerator,
  } = config;

  const cache = new LRUCache<string, { data: any; timestamp: number }>({
    max,
    maxAge: ttl * 1000, // 转换为毫秒（lru-cache 5.x 使用 maxAge）
    stale: false, // lru-cache 5.x 使用 stale 而非 allowStale
    updateAgeOnGet: true, // lru-cache 5.x 支持此选项
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // 仅缓存 GET 请求（可选）
    if (onlyGet && req.method !== "GET") {
      next();
      return;
    }

    // 生成缓存键
    const cacheKey = keyGenerator
      ? `${prefix}${keyGenerator(req)}`
      : `${prefix}${req.method}:${req.originalUrl}`;

    // 尝试从缓存获取
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug(`[memory-cache] 命中缓存: ${cacheKey}`);
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Timestamp", String(cached.timestamp));
      res.json(cached.data);
      return;
    }

    // 缓存未命中，拦截 res.json 方法，将响应存入缓存
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      // 仅缓存成功响应（状态码 200）
      if (res.statusCode === 200) {
        cache.set(cacheKey, { data, timestamp: Date.now() });
        logger.debug(`[memory-cache] 缓存写入: ${cacheKey}`);
        res.setHeader("X-Cache", "MISS");
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * 缓存管理工具
 */
export const cacheManager = {
  /** 商品列表缓存 */
  product: {
    /** 清除指定租户的商品列表缓存 */
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/products`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  /** 订单列表缓存 */
  order: {
    /** 清除指定租户的订单列表缓存 */
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/orders`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  /** 报表缓存 */
  report: {
    /** 清除指定租户的报表缓存 */
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/reports`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  /** 获取所有缓存键 */
  getAllKeys(): string[] {
    // LRUCache 的 keys() 方法返回迭代器
    return Array.from(cacheManager.cache.keys());
  },

  /** 删除指定缓存键 */
  delete(key: string): void {
    cacheManager.cache.del(key); // lru-cache 5.x 使用 del 方法
    logger.debug(`[memory-cache] 缓存删除: ${key}`);
  },

  /** 清除所有缓存 */
  clear(): void {
    cacheManager.cache.reset(); // lru-cache 5.x 使用 reset 方法
    logger.info("[memory-cache] 所有缓存已清除");
  },

  /** 获取缓存统计信息 */
  getStats(): { size: number; max: number; hits: number; misses: number } {
    return {
      size: cacheManager.cache.length, // lru-cache 5.x 使用 length 属性
      max: cacheManager.cache.max,
      hits: (cacheManager.cache as any).hits || 0,
      misses: (cacheManager.cache as any).misses || 0,
    };
  },

  /** 默认缓存实例（用于全局缓存管理） */
  cache: new LRUCache<string, { data: any; timestamp: number }>({
    max: 500,
    maxAge: 300000, // 5 分钟（lru-cache 5.x 使用 maxAge）
  }),
};

export default memoryCache;