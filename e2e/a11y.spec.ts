import { test, expect, type Page } from "@playwright/test";
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
 *
 * ─── S3-61 采样稳定化（2026-09-19 墨，A-5 派单）───
 *   根因：<transition name="page-fade"> 180ms 淡入，元素中间帧 opacity∈(0,1)；
 *   Playwright 视 opacity:0 为「可见」，axe 在淡入窗口采样会读到
 *   中间帧前景/背景色（实测 fg #b0b2b7→#808185、bg #f6f8fd→#f8fafd，朝声明值收敛），
 *   偶发产生 color-contrast 伪影。
 *   修法：在 analyze() 之前，先等页面**完全静止**（无 running 动画），
 *   再注入 `*{transition:none!important;animation:none!important}` 把过渡/动画掐断，
 *   再等两帧让样式生效，最后才采样。这样 axe 永远读到**静止终态**，
 *   而不是过渡中间帧。本修法**不改变任何颜色声明值**，也**不放松任何断言/阈值**。
 */

/**
 * 等页面渲染静止后再采样，消除过渡/动画中间帧伪影（S3-61）。
 * 顺序（严格按 A-5 派单裁定）：
 *   1) waitForFunction：document.getAnimations() 中没有 playState==='running' 的项；
 *      document.getAnimations 可能不存在或抛错 → 兜底直接通过，后续靠第 3 步两帧。
 *   2) addStyleTag 注入 `*,*::before,*::after{transition:none!important;animation:none!important}`。
 *   3) 再等两帧（requestAnimationFrame），确保样式生效、布局稳定。
 *   之后调用方才执行 analyze()，保证只读静止终态。
 */
async function waitForVisualSettled(page: Page): Promise<void> {
  // 1) 等动画全部结束（无 running）
  try {
    await page.waitForFunction(
      () => {
        // getAnimations 较新 API：某些运行环境可能不存在或抛错 → 兜底放行
        const doc = document as Document & { getAnimations?: () => Animation[] };
        const getAnims = doc.getAnimations;
        if (typeof getAnims !== "function") return true; // 兜底：不支持就放行
        try {
          const anims = getAnims.call(doc);
          return !anims.some((a) => a.playState === "running");
        } catch {
          return true; // 兜底：抛错就放行
        }
      },
      undefined,
      { timeout: 5_000, polling: 50 }
    );
  } catch {
    // 兜底：等待超时（仍可能有 running）也继续；第 2 步注入会把它掐断
  }

  // 2) 注入：禁用一切过渡与动画，掐断中间帧
  await page.addStyleTag({
    content:
      "*,*::before,*::after{transition:none!important;animation:none!important}",
  });

  // 3) 再等两帧，确保样式落地、布局稳定
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const step = () => {
          frames += 1;
          if (frames >= 2) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      })
  );
}

/**
 * ─── [a11y-accent] 采集（追加项，A-8 / S3-64 收口用）───
 * 凌舟派单写的是「复用 scripts/contrast-metric.cjs 的算比函数」，但仓库实际只有
 * scripts/contrast-check.cjs，且其为 CLI（require 即执行并 process.exit，不导出 ratio）。
 * 故此处内联实现与 contrast-check.cjs 逐字一致的 WCAG 2.1 相对亮度公式，保证算法同源。
 * 每次取样打印 [a11y-accent] 行：.metric-num--accent 的 tagName / color /
 * 最近不透明祖先 backgroundColor / 由这两值算出的比值；取不到元素则打印「未取到该元素 + 原因」。
 */
function parseRgb(str: string): [number, number, number, number] | null {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s.trim()));
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p.length >= 4 ? p[3] : 1];
}
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLum([r, g, b]: [number, number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function wcagRatio(fg: string, bg: string): number | null {
  const f = parseRgb(fg);
  const b = parseRgb(bg);
  if (!f || !b) return null;
  const L1 = relLum(f);
  const L2 = relLum(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function logAccentContrast(page: Page): Promise<void> {
  const info = await page.evaluate(() => {
    const el = document.querySelector(".metric-num--accent") as HTMLElement | null;
    if (!el) return { found: false as const, reason: "页面无 .metric-num--accent 元素" };
    const cs = getComputedStyle(el);
    // 向上找最近的不透明（alpha>=1）祖先背景
    let node: Element | null = el.parentElement;
    let bg: string | null = null;
    while (node) {
      const b = getComputedStyle(node).backgroundColor;
      const m = b.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(",").map((s) => parseFloat(s.trim()));
        const alpha = p.length >= 4 ? p[3] : 1;
        if (alpha >= 1) { bg = b; break; }
      }
      node = node.parentElement;
    }
    return {
      found: true as const,
      tagName: el.tagName,
      color: cs.color,
      bg,
      text: (el.textContent ?? "").slice(0, 20),
    };
  });
  if (!info.found) {
    console.log(`[a11y-accent] 未取到该元素 + 原因：${info.reason}`);
    return;
  }
  const ratio = info.bg ? wcagRatio(info.color, info.bg) : null;
  const ratioStr = ratio === null ? "N/A(无不含透明背景)" : `${ratio.toFixed(2)}:1`;
  console.log(
    `[a11y-accent] tagName=${info.tagName}, color=${info.color}, ` +
    `nearestOpaqueBg=${info.bg ?? "无"}, ratio=${ratioStr}, text=${JSON.stringify(info.text)}`
  );
}

test.describe("无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规 @a11y", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("账号").waitFor();

    // S3-61 稳定化：采样前等页面静止并禁用过渡/动画
    await waitForVisualSettled(page);
    console.log("[a11y] 稳定化已生效（登录页）：静止等待 + 过渡/动画禁用");
    await logAccentContrast(page);

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

    // S3-61 稳定化：采样前等页面静止并禁用过渡/动画
    await waitForVisualSettled(page);
    console.log("[a11y] 稳定化已生效（工作台）：静止等待 + 过渡/动画禁用");
    await logAccentContrast(page);

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
