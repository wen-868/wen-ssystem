import { describe, it, expect } from "vitest";

// 测试 re-export 文件，确保每个 re-export 路径都能正确导入
import { env } from "../../shared/env.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { errorHandler } from "../../shared/error-handler.js";
import { tenantMiddleware, getTenantId } from "../../shared/tenant.js";
import { responseTimeTracker } from "../../shared/response-time-tracker.js";
import { errorResponseInterceptor } from "../../shared/error-response-interceptor.js";

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
});
