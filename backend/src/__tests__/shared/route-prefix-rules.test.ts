/**
 * S3-189 ③：共享判据模块 `src/shared/route-prefix-rules.js` 的单测。
 *
 * 为什么要有：这份文件是**启动期（auto-routes.inspectRouteHygiene）与独立门禁脚本
 * （backend/scripts/guard-route-prefix.mjs）共用的同一份判据**，它一旦漂移，
 * 两边就会各说各话（"假门禁"的典型来源）。故用纯函数单测把判据的 6 个分支钉死。
 */
import { describe, it, expect } from "vitest";
import {
  DUPLICATE_PREFIX_ALLOWLIST,
  classifyRoutePrefixes,
  joinRoutePath,
} from "../../shared/route-prefix-rules";

describe("joinRoutePath（与启动期同一份实现）", () => {
  it("折叠重复斜杠、去尾斜杠", () => {
    expect(joinRoutePath("/api/x", "/")).toBe("/api/x");
    expect(joinRoutePath("/api/x", "")).toBe("/api/x");
    expect(joinRoutePath("/api//x", "/y")).toBe("/api/x/y");
  });

  it("参数名归一为 ':'（Express 同一批 URL 视为同一路径）", () => {
    expect(joinRoutePath("/api/p", "/:id")).toBe("/api/p/:");
    expect(joinRoutePath("/api/p", "/:userId")).toBe(joinRoutePath("/api/p", "/:id"));
  });
});

describe("classifyRoutePrefixes（纯函数判据）", () => {
  it("单文件前缀：无重复、无违规", () => {
    const report = classifyRoutePrefixes([
      { prefix: "/api/solo", file: "solo.routes.ts", endpoints: ["GET /api/solo/a"] },
    ]);
    expect(report.duplicatePrefixes).toEqual([]);
    expect(report.unlistedDuplicatePrefixes).toEqual([]);
    expect(report.duplicateEndpoints).toEqual([]);
  });

  it("白名单内的重复前缀：放行（不计入 unlisted）", () => {
    const allowlisted = Object.keys(DUPLICATE_PREFIX_ALLOWLIST)[0];
    const report = classifyRoutePrefixes([
      { prefix: allowlisted, file: "a.routes.ts", endpoints: [] },
      { prefix: allowlisted, file: "b.routes.ts", endpoints: [] },
    ]);
    expect(report.duplicatePrefixes.map((d) => d.prefix)).toEqual([allowlisted]);
    expect(report.unlistedDuplicatePrefixes).toEqual([]);
  });

  it("未登记的重复前缀：判违规（阻断项）", () => {
    const report = classifyRoutePrefixes([
      { prefix: "/api/not-registered", file: "a.routes.ts", endpoints: [] },
      { prefix: "/api/not-registered", file: "b.routes.ts", endpoints: [] },
    ]);
    expect(report.unlistedDuplicatePrefixes).toEqual([
      { prefix: "/api/not-registered", files: ["a.routes.ts", "b.routes.ts"] },
    ]);
  });

  it("真重复端点（同 method + 同完整路径）：即使前缀已登记也判违规", () => {
    const allowlisted = Object.keys(DUPLICATE_PREFIX_ALLOWLIST)[0];
    const report = classifyRoutePrefixes([
      { prefix: allowlisted, file: "a.routes.ts", endpoints: ["POST /api/dup/x"] },
      { prefix: allowlisted, file: "b.routes.ts", endpoints: ["POST /api/dup/x"] },
    ]);
    expect(report.duplicateEndpoints).toEqual([
      { endpoint: "POST /api/dup/x", files: ["a.routes.ts", "b.routes.ts"] },
    ]);
  });

  it("同路径不同 method 不算真重复端点", () => {
    const report = classifyRoutePrefixes([
      { prefix: "/api/same", file: "a.routes.ts", endpoints: ["GET /api/same/x"] },
      { prefix: "/api/same", file: "b.routes.ts", endpoints: ["POST /api/same/x"] },
    ]);
    expect(report.duplicateEndpoints).toEqual([]);
  });

  it("挂子路由的入口：端点不可知，但必须登记（不静默通过）", () => {
    const report = classifyRoutePrefixes([
      { prefix: "/api/nested", file: "nested.routes.ts", endpoints: [], nestedRouter: true },
    ]);
    expect(report.nestedRouterFiles).toEqual(["nested.routes.ts"]);
  });
});

describe("DUPLICATE_PREFIX_ALLOWLIST 台账质量", () => {
  it("每条放行都必须写明理由（禁止空/占位）", () => {
    for (const [prefix, reason] of Object.entries(DUPLICATE_PREFIX_ALLOWLIST)) {
      expect(reason.trim().length, `${prefix} 的理由过短/为空`).toBeGreaterThan(20);
    }
  });
});
