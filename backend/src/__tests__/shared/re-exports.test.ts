import { describe, it, expect } from "vitest";

// 测试 re-export 文件，确保每个 re-export 路径都能正确导入
import { env } from "../../shared/env.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { errorHandler } from "../../shared/error-handler.js";
import { tenantMiddleware, getTenantId } from "../../shared/tenant.js";
import { responseTimeTracker } from "../../shared/response-time-tracker.js";
import { errorResponseInterceptor } from "../../shared/error-response-interceptor.js";
// 补充 re-export 文件覆盖
import {
  pool,
  initDatabase,
  query,
  queryOne,
  queryWithTenant,
  queryOneWithTenant,
  executeWithTenant,
  transaction,
} from "../../shared/db.js";
import { cacheGet, cacheDel, cacheDelPattern, invalidateTenantCache, CacheKeys } from "../../shared/redis-cache.js";
import { WechatPay } from "../../shared/wechat-pay.js";
import * as priceGuardMiddleware from "../../shared/price-guard-middleware.js";

describe("shared re-exports", () => {
  it("env 应导出 env 对象", () => {
    expect(env).toBeDefined();
    expect(typeof env).toBe("object");
  });

  it("async-handler 应导出 asyncHandler 函数", () => {
    expect(typeof asyncHandler).toBe("function");
  });

  it("error-handler 应导出 errorHandler 函数", () => {
    expect(typeof errorHandler).toBe("function");
  });

  it("tenant 应导出 tenantMiddleware 函数", () => {
    expect(typeof tenantMiddleware).toBe("function");
  });

  it("tenant 应导出 getTenantId 函数", () => {
    expect(typeof getTenantId).toBe("function");
  });

  it("response-time-tracker 应导出 responseTimeTracker 函数", () => {
    expect(typeof responseTimeTracker).toBe("function");
  });

  it("error-response-interceptor 应导出 errorResponseInterceptor 函数", () => {
    expect(typeof errorResponseInterceptor).toBe("function");
  });

  it("db 应 re-export pool 与查询函数", () => {
    expect(pool).toBeDefined();
    expect(typeof initDatabase).toBe("function");
    expect(typeof query).toBe("function");
    expect(typeof queryOne).toBe("function");
    expect(typeof queryWithTenant).toBe("function");
    expect(typeof queryOneWithTenant).toBe("function");
    expect(typeof executeWithTenant).toBe("function");
    expect(typeof transaction).toBe("function");
  });

  it("redis-cache 应 re-export 缓存函数", () => {
    expect(typeof cacheGet).toBe("function");
    expect(typeof cacheDel).toBe("function");
    expect(typeof cacheDelPattern).toBe("function");
    expect(typeof invalidateTenantCache).toBe("function");
    expect(CacheKeys).toBeDefined();
  });

  it("wechat-pay 应 re-export WechatPay 类", () => {
    expect(typeof WechatPay).toBe("function");
  });

  it("price-guard-middleware 应 re-export 中间件", () => {
    expect(priceGuardMiddleware).toBeDefined();
    expect(Object.keys(priceGuardMiddleware).length).toBeGreaterThan(0);
  });
});
