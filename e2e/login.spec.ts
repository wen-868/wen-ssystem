import { test, expect } from "@playwright/test";

/**
 * 核心用户旅程 E2E：工作台登录 → 进入系统
 * 前置：mock 后端（USE_MOCK_DB=true PORT=8080）+ admin-web dev（5173，/api 代理）
 */
test("工作台登录旅程（账号+密码 → 进入系统）", async ({ page }) => {
  await page.goto("/");

  // 登录表单渲染
  await expect(page.getByPlaceholder("账号")).toBeVisible();
  await expect(page.getByPlaceholder("密码")).toBeVisible();

  // 填写并提交
  await page.getByPlaceholder("账号").fill("admin");
  await page.getByPlaceholder("密码").fill("admin123");
  await page.getByRole("button", { name: "立即登录" }).click();

  // 登录成功：进入工作台（URL 离开登录页，导航或看板出现）
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByText("工作台", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});

test("登录失败给出可理解错误提示", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("账号").fill("admin");
  await page.getByPlaceholder("密码").fill("wrong-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  // 错误提示出现（ElMessage）
  await expect(page.locator(".el-message")).toBeVisible({ timeout: 15_000 });
});
