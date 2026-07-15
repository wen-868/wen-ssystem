import LRUCache from "lru-cache";
import type { Request, Response, NextFunction } from "express";
import logger from "../shared/logger";

export interface CacheConfig {
  prefix?: string;
  ttl?: number;
  max?: number;
  onlyGet?: boolean;
  keyGenerator?: (req: Request) => string;
}

const sharedCache = new LRUCache<string, { data: any; timestamp: number; ttl: number }>({
  max: 500,
  maxAge: 300000,
  stale: false,
  updateAgeOnGet: true,
});

export function memoryCache(config: CacheConfig = {}) {
  const {
    prefix = "cache:",
    ttl = 60,
    onlyGet = true,
    keyGenerator,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    if (onlyGet && req.method !== "GET") {
      next();
      return;
    }

    const cacheKey = keyGenerator
      ? `${prefix}${keyGenerator(req)}`
      : `${prefix}${req.method}:${req.originalUrl}`;

    const cached = sharedCache.get(cacheKey);
    if (cached) {
      logger.debug(`[memory-cache] 命中缓存: ${cacheKey}`);
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Timestamp", String(cached.timestamp));
      res.json(cached.data);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      if (res.statusCode === 200) {
        sharedCache.set(cacheKey, { data, timestamp: Date.now(), ttl: ttl * 1000 });
        logger.debug(`[memory-cache] 缓存写入: ${cacheKey}`);
        res.setHeader("X-Cache", "MISS");
      }
      return originalJson(data);
    };

    next();
  };
}

export const cacheManager = {
  product: {
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/products`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  order: {
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/orders`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  report: {
    invalidateByTenant(tenantId: string): void {
      const keys = cacheManager.getAllKeys();
      keys.forEach((key) => {
        if (key.includes(`cache:/api/admin/reports`) && key.includes(`tenantId=${tenantId}`)) {
          cacheManager.delete(key);
        }
      });
    },
  },

  getAllKeys(): string[] {
    return Array.from(sharedCache.keys());
  },

  delete(key: string): void {
    sharedCache.del(key);
    logger.debug(`[memory-cache] 缓存删除: ${key}`);
  },

  clear(): void {
    sharedCache.reset();
    logger.info("[memory-cache] 所有缓存已清除");
  },

  getStats(): { size: number; max: number; hits: number; misses: number } {
    return {
      size: sharedCache.length,
      max: sharedCache.max,
      hits: (sharedCache as any).hits || 0,
      misses: (sharedCache as any).misses || 0,
    };
  },

  cache: sharedCache,
};

export default memoryCache;