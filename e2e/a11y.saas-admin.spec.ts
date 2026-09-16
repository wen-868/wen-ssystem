import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * saas-admin 无障碍扫描（WCAG 2.1 AA，axe-core）
 *
 * ⚠️ 当前状态（S3-53 裁定）：本文件是「待进场脚本就绪」的就绪件，**默认整体 skip**，
 * 不会在 CI 里假装跑通。原因：saas-admin 登录页带一次性图形验证码
 * （`GET /platform/auth/captcha`，见 saas-admin/src/views/login/PlatformLogin.vue），
 * 自动化无法绕过 → 浏览器 axe 无法自动进场到工作台。
 *
 * 因此 saas-admin 当前的 a11y 门禁是 **scripts/contrast-check.cjs 对比度矩阵**
 * （纯计算、覆盖 token×surface + canvas 图表色，见 e2e.yml 的 saas-admin 矩阵腿），
 * 本文件的浏览器 axe 作为补充、待验证码进场脚本就绪后启用（CI 设 `SAAS_ADMIN_AXE=1`）。
 *
 * 启用后断言强度与 admin-web 保持一致（criticalSerious.length).toBe(0)），**不降级**。
 */
const SAAS_ADMIN_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const ENABLED = !!process.env.SAAS_ADMIN_AXE;

// 默认整体 skip：CI 不跑、不假绿；本地联调时设 SAAS_ADMIN_AXE=1 运行。
test.skip(!ENABLED, "saas-admin 浏览器 axe 待登录图形验证码进场脚本就绪后启用（SAAS_ADMIN_AXE=1）");

test.describe("saas-admin 无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规", async ({ page }) => {
    await page.goto(SAAS_ADMIN_URL + "/");
    // 登录页为独立全屏页，无需登录即可扫描（不触发图形验证码墙）
    await page.getByText("欢迎登录总后台").first().waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""));
    console.log(
      `[a11y/saas-admin] 登录页违规: total=${results.violations.length}, critical/serious=${criticalSerious.length}, ` +
      `types=${criticalSerious.map((v) => v.id).join(",")}`
    );
    expect(criticalSerious.length).toBe(0);
  });

  test("工作台无 critical/serious 违规（需绕过图形验证码进场，待就绪）", async ({ page }) => {
    // 工作台必须登录后可达，而登录被一次性图形验证码阻断 → 当前无可用进场脚本。
    // 待进场脚本就绪（注入已登录态 / 可解验证码）后，移除本 skip 并复用上方断言。
    test.skip(true, "工作台需绕过一次性图形验证码才能进场；当前由 scripts/contrast-check.cjs 对比度矩阵兜底");
    await page.goto(SAAS_ADMIN_URL + "/");
    await page.getByText("工作台", { exact: false }).first().waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const criticalSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""));
    expect(criticalSerious.length).toBe(0);
  });
});
