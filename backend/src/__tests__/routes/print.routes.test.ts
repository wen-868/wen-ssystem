/**
 * 打印记录路由测试
 * 被测文件：src/routes/print.routes.ts
 *
 * 覆盖范围：
 *  - routeConfig 导出正确性（prefix / auth / router）
 *  - router 实例方法可用性
 *  - 路由注册不与现有路由冲突
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { describe, it, expect } from "vitest";
import { routeConfig, printRouter } from "../../routes/print.routes";

describe("routes/print", () => {
    it("应导出正确的 routeConfig", () => {
        expect(routeConfig).toBeDefined();
        expect(routeConfig.prefix).toBe("/api/admin/print");
        expect(routeConfig.router).toBeDefined();
    });

    it("应配置 requireAuthWithTenant 认证中间件（租户隔离）", () => {
        expect(routeConfig.auth).toBe("requireAuthWithTenant");
    });

    it("router 应该是一个 Router 实例（含 get/post/put/delete）", () => {
        expect(typeof routeConfig.router.get).toBe("function");
        expect(typeof routeConfig.router.post).toBe("function");
        expect(typeof routeConfig.router.put).toBe("function");
        expect(typeof routeConfig.router.delete).toBe("function");
    });

    it("应导出 printRouter（向后兼容命名导出）", () => {
        expect(printRouter).toBeDefined();
        expect(printRouter).toBe(routeConfig.router);
    });

    it("prefix 不与现有 admin 路由冲突（grep 关键字校验）", () => {
        // 简单校验 prefix 字符串结构
        expect(routeConfig.prefix.startsWith("/api/admin/")).toBe(true);
        expect(routeConfig.prefix).toBe("/api/admin/print");
        // 不能与其他已知 admin 路由前缀重名
        const knownPrefixes = [
            "/api/admin/products",
            "/api/admin/orders",
            "/api/admin/sales",
            "/api/admin/stock-check",
            "/api/admin/sync",
            "/api/admin/notifications",
        ];
        expect(knownPrefixes).not.toContain(routeConfig.prefix);
    });
});
