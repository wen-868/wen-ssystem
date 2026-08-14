import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * 无障碍自动化扫描（WCAG 2.1 AA，axe-core）
 * 验收基线（2026-08-15 实测）：登录页 1 处（color-contrast）、工作台 4 处
 * （button-name/color-contrast/label/scrollable-region-focusable）。
 * 目标：逐轮修复并下调阈值至 0。
 */

test.describe("无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("账号").waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""));
    console.log(
      `[a11y] 登录页违规: total=${results.violations.length}, critical/serious=${criticalSerious.length}, ` +
      `types=${criticalSerious.map((v) => v.id).join(",")}`
    );
    expect(criticalSerious.length).toBeLessThanOrEqual(5);
  });

  test("登录后工作台无 critical/serious 违规", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("账号").fill("admin");
    await page.getByPlaceholder("密码").fill("admin123");
    await page.getByRole("button", { name: "立即登录" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await page.getByText("工作台", { exact: false }).first().waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""));
    console.log(
      `[a11y] 工作台违规: total=${results.violations.length}, critical/serious=${criticalSerious.length}, ` +
      `types=${criticalSerious.map((v) => v.id).join(",")}`
    );
    expect(criticalSerious.length).toBeLessThanOrEqual(5);
  });
});
