import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * 无障碍自动化扫描（WCAG 2.1 AA，axe-core）
 * 验收基线（2026-08-15 实测）：登录页与工作台 critical/serious 违规均已清零
 * （修复 button-name/color-contrast/label/scrollable-region-focusable 四类问题）。
 *
 * ⚠️ @a11y 标签（2026-09-19 凌舟裁定「甲：分层解堵」）
 *   本文件两个用例都在**漂移中**（S3-61：工作台 56 个 color-contrast 节点，
 *   根因是 App.vue 的 page-fade 淡入中间帧被 axe 采样，见 S3-61 卡 §4.1–4.3）。
 *   「漂移中的检查不得进 required」——否则每个 PR 被随机堵（PR #19 已实证）。
 *   因此：
 *   - required 的 `e2e` job 跑 `npx playwright test --grep-invert @a11y`（不含本文件）
 *   - 观察期 `a11y` job 跑 `npx playwright test --grep @a11y --retries=0`
 *   🔴 断言只有这一份，两处都不会改它的阈值或条件。分层是为了**放对位置**，
 *      不是为了让红变绿。稳定化（S3-61 修法落地 + 连续 10 次无漂移）后再并回 required。
 */

test.describe("无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规 @a11y", async ({ page }) => {
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
    if (criticalSerious.length > 0) {
      criticalSerious.forEach((v) => {
        const targets = v.nodes.slice(0, 5).map((n) => n.target.join(" ")).join(" | ");
        console.log(
          `[a11y] 登录页 nodes target: type=${v.id}, count=${v.nodes.length}, first5=${targets}`
        );
        console.log(`[a11y] axe data: ${JSON.stringify(v.nodes.slice(0, 3).map((n) => n.any?.[0]?.data ?? null))}`);
      });
    }

    expect(criticalSerious.length).toBe(0);
  });

  test("登录后工作台无 critical/serious 违规 @a11y", async ({ page }) => {
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
    if (criticalSerious.length > 0) {
      criticalSerious.forEach((v) => {
        const targets = v.nodes.slice(0, 5).map((n) => n.target.join(" ")).join(" | ");
        console.log(
          `[a11y] 工作台 nodes target: type=${v.id}, count=${v.nodes.length}, first5=${targets}`
        );
        console.log(`[a11y] axe data: ${JSON.stringify(v.nodes.slice(0, 3).map((n) => n.any?.[0]?.data ?? null))}`);
      });
    }

    expect(criticalSerious.length).toBe(0);
  });
});
