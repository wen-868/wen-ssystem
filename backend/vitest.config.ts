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
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
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
