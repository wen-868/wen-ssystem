import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["tests/**/*.test.ts", "src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    env: {
      NODE_ENV: "test",
      USE_MOCK_DB: "true",
      JWT_SECRET: "test-secret-key-for-vitest"
    },
    // 抑制 Zod 校验错误输出到 stderr（Edge Case 测试故意传入非法数据）
    onConsoleLog(log: string, type: "stdout" | "stderr"): false | void {
      if (type === "stderr" && log.includes("ZodError")) return false;
    },
    // 测试覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "tests/**", "src/shared/mock-db.ts"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  }
});
