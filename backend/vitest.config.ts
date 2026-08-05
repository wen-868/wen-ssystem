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
        // 全局阈值：以 2026-08-06 R76-02 实测基线（statements 65.67 /
        // branches 54.01 / functions 66.42 / lines 67.22）为准，确保
        // `vitest run --coverage` 可真实通过；后续轮次按项目统一标准
        // 第十一章 11.2 逐层向 100% 推进。
        statements: 65,
        branches: 54,
        functions: 66,
        lines: 67,
        // 核心业务 services/admin 专项阈值：锁定 R76-02 补齐后的成果
        // （含 admin/report 子目录，精确值为 statements 59.18 / branches
        // 56.88 / functions 58.4 / lines 60.07），低于此值即回归失败。
        "src/services/admin/**": {
          statements: 59,
          branches: 56,
          functions: 58,
          lines: 60,
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
