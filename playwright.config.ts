import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 配置（顶级商业软件验收-端到端测试/兼容测试）
 * 本地：先起 mock 后端（USE_MOCK_DB=true PORT=8080）与 admin-web dev（5173），再 npx playwright test
 * CI：见 .github/workflows/e2e.yml
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 本机验证可用系统 Edge（PLAYWRIGHT_CHANNEL=msedge），CI 用默认 chromium
        channel: process.env.PLAYWRIGHT_CHANNEL as "msedge" | undefined || undefined,
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
