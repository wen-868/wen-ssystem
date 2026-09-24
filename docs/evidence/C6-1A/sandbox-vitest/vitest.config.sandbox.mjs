import path from "node:path";
const BASE = "D:/Users/ZXQL/wt-agents/issue-108/backend";
export default {
  root: BASE,
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@services": path.resolve(BASE, "src/services"),
      "@shared": path.resolve(BASE, "src/shared"),
      "@middleware": path.resolve(BASE, "src/middleware"),
      "@controllers": path.resolve(BASE, "src/controllers")
    }
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    env: { NODE_ENV: "test", USE_MOCK_DB: "true", JWT_SECRET: "test-secret-key-for-vitest" }
  }
};
