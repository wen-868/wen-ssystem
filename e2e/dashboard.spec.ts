import { test, expect } from "@playwright/test";

/**
 * 核心用户旅程 E2E：登录 → 工作台首页 → 快速收银
 * 前置：mock 后端（USE_MOCK_DB=true PORT=8080）+ admin-web dev（5173，/api 代理）
 */

async function login(page: any) {
  await page.goto("/");
  await page.getByPlaceholder("账号").fill("admin");
  await page.getByPlaceholder("密码").fill("admin123");
  await page.getByRole("button", { name: "立即登录" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test("工作台首页核心数据区渲染", async ({ page }) => {
  await login(page);
  await expect(page.getByText("工作台", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  // 核心数据区：今日销售额/今日订单/经营动态
  await expect(page.getByText("今日销售额", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("经营动态", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});

test("快速收银页面可访问", async ({ page }) => {
  await login(page);
  await page.goto("/pos/cashier");
  await page.waitForLoadState("networkidle").catch(() => {});
  // 收银台标题或商品搜索区出现
  await expect(page.getByText("快速收银", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});

test("商品管理页面可访问", async ({ page }) => {
  await login(page);
  await page.goto("/products");
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByText("商品中心", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});

test("客户管理页面可访问", async ({ page }) => {
  await login(page);
  await page.goto("/customers");
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByText("客户管理", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});
