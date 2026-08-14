import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    env: {
      NODE_ENV: "test",
      USE_MOCK_DB: "true",
      JWT_SECRET: "test-secret-key-for-vitest"
    },
    onConsoleLog(log: string, type: "stdout" | "stderr"): false | void {
      if (type === "stderr" && log.includes("ZodError")) return false;
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov", "json-summary"],
      include: [
        "src/controllers/**/*.ts",
        "src/routes/**/*.ts",
        "src/services/**/*.ts",
        "src/middleware/**/*.ts",
        "src/shared/**/*.ts",
      ],
      exclude: [
        "src/__tests__/**",
        "tests/**",
      ],
      thresholds: {
        // 全局阈值：以 2026-08-15 实测基线（statements 63.09 / branches 51.27 /
        // functions 61.87 / lines 64.72）为准并留 2~3 个点防抖动余量，确保
        // `vitest run --coverage` 在 CI 可真实通过；覆盖率提升按验收路线图
        // 逐轮向核心业务 ≥85% 推进，每提升一轮同步上调阈值。
        statements: 60,
        branches: 48,
        functions: 58,
        lines: 61,
        // 核心业务 services/admin 专项阈值：2026-08-15 实测基线
        // （statements 56.34 / branches 52.81 / functions 55.54 / lines 57.68），
        // 留 2 个点余量防回归，低于此值即 CI 失败。
        "src/services/admin/**": {
          statements: 54,
          branches: 50,
          functions: 53,
          lines: 55,
        },
      },
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@services": path.resolve(__dirname, "src/services"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@middleware": path.resolve(__dirname, "src/middleware"),
      "@controllers": path.resolve(__dirname, "src/controllers"),
    },
  },
});
