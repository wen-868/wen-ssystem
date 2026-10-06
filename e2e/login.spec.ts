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

/**
 * C6-9（派单卡 docs/tasks/cards/R101-派单-20261003-C6-9.md）：
 *   点一次「演示登录（一键进入）」⇒ ① 自动把演示账号/口令填入两个输入框（用户零输入）
 *   ⇒ ② 自动提交**正常登录**（POST /api/admin/auth/login，不是免密 demo-login）
 *   ⇒ ③ 直达工作台（用户不需要第二次点击）。
 *
 * 判据分辨力说明（防后人把断言简化成"进了工作台就算过"）：
 *   本用例把登录接口延迟 600ms，目的就是**在跳转之前**读到两个输入框的值 —— 跳转后输入框被销毁，
 *   只断言"进入工作台"将**测不出"自动填入被删掉"**这个缺陷（免密通道照样能进）。
 */
test("演示登录：点一次即自动填入账号+口令、自动提交正常登录并进入工作台（零输入）", async ({ page }) => {
  let loginPostData = "";
  let demoFallbackCalls = 0;
  await page.route("**/api/admin/auth/login", async (route) => {
    loginPostData = route.request().postData() || "";
    await new Promise((r) => setTimeout(r, 600)); // 留出窗口读输入框（见上方"判据分辨力"）
    await route.continue();
  });
  page.on("request", (r) => {
    if (r.url().includes("/admin/auth/demo-login")) demoFallbackCalls += 1;
  });

  await page.goto("/");
  const account = page.getByPlaceholder("账号");
  const password = page.getByPlaceholder("密码");
  // 点之前两框为空 —— 证明后面的"有值"确实来自本次点击，而不是页面预填
  await expect(account).toHaveValue("");
  await expect(password).toHaveValue("");

  await page.getByRole("button", { name: "演示登录（一键进入）" }).click();

  // ① 用户零输入：两个框被自动填入演示凭据
  await expect(account).toHaveValue("demo");
  await expect(password).toHaveValue("Demo@2026");

  // ② 自动提交的是正常登录，且带的是演示凭据（不是空提交、也不是免密通道）
  expect(loginPostData).toContain('"username":"demo"');
  expect(loginPostData).toContain("Demo@2026");
  expect(demoFallbackCalls).toBe(0);

  // ③ 直达工作台
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.getByText("工作台", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
});
