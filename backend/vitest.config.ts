import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    env: {
      NODE_ENV: "test",
      USE_MOCK_DB: "true"
    }
  }
});
