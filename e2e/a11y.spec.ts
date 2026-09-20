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
/**
 * ─── 兜底留痕（凌舟 2026-09-20 最终裁定③-b：A-5 兜底不得静默放行）───
 * 原实现三处兜底（getAnimations 不存在 / 抛错 / 等待超时）都**静默 return true**，
 * 于是「稳定化到底生效了没有」在日志里完全不可见 —— 这是「静默降级假绿」的第四种变体。
 * 现在：走到兜底就打 `[a11y][降级]` 固定标记（CI 可 grep 计数），
 * 正常路径打 `[a11y][稳定化-正常]`，二者互斥 —— 据此能分辨「真等到了静止」还是「没等到就走了」。
 * 🔴 只留痕、不因此判红：红仍只由 axe 违规断言决定，不新增抖动源。
 */
type SettleStatus = { degraded: string | null };

async function waitForVisualSettled(page: Page): Promise<SettleStatus> {
  // 0) 先探环境能力，让「兜底触发」可区分、可留痕
  const cap = await page.evaluate(() => {
    const doc = document as Document & { getAnimations?: () => Animation[] };
    if (typeof doc.getAnimations !== "function") return "unsupported";
    try {
      const anims = doc.getAnimations();
      const n = anims.filter((a) => a.playState === "running").length;
      return n > 0 ? `running=${n}` : "idle";
    } catch {
      return "throw";
    }
  });

  let degraded: string | null = null;

  // 1) 等动画全部结束（无 running）
  if (cap === "unsupported" || cap === "throw") {
    degraded = cap === "unsupported" ? "getAnimations 在当前环境不可用" : "getAnimations 调用抛错";
  } else {
    try {
      await page.waitForFunction(
        () => {
          const doc = document as Document & { getAnimations?: () => Animation[] };
          const getAnims = doc.getAnimations;
          if (typeof getAnims !== "function") return true;
          try {
            const anims = getAnims.call(doc);
            return !anims.some((a) => a.playState === "running");
          } catch {
            return true;
          }
        },
        undefined,
        { timeout: 5_000, polling: 50 }
      );
    } catch {
      degraded = `等待动画静止超时（探测时 ${cap}）`;
    }
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

  return { degraded };
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

/**
 * ─── 非文本对比度守卫（S3-63 / 凌舟 2026-09-20 最终裁定③）───
 * WCAG 1.4.11 非文本对比度 ≥3:1：控件边界必须可识别。
 *
 * 🔴 R8.1（新规则）：层叠/覆盖问题**只用浏览器 computed 值定论**，
 *    禁止用源码声明值或打包产物里的规则先后顺序推理 —— 同题已三次翻车。
 *    ⇒ 本守卫读的是运行期 computed，不是 CSS 文件里的声明。
 *
 * 取样口径：
 *   - EP 用 **inset box-shadow** 画控件边框（不是 border），故取 box-shadow 首色；
 *     box-shadow:none 的（被业务样式接管的特例）才回读 borderTopColor。
 *   - 比值 = 边框色 vs **最近的不透明祖先背景**（WCAG 1.4.11 的相邻面对比）。
 *   - 门槛 ≥3:1；**每个控件必须至少命中一次**，0 命中按失败处理
 *     （否则就是「从未真正取到控件」的假门禁）。
 *
 * 范围与已知例外（如实登记）：
 *   - AI 侧边栏的 .el-textarea__inner 被 AiSidePanel.vue 用
 *     `border:1px solid var(--border-light)` 接管（box-shadow:none），
 *     不读 --el-border-color，属 --border-normal/--border-light 族 ⇒ 归 **S3-67**，
 *     不在本守卫范围，取样时排除 .ai-input-box 内的实例。
 *
 * 反测约定：把 admin-web/src/styles.css:36 改回 #E2E2E2 时，
 *   三控件 computed 应回到 rgb(226,226,226) → 比值约 1.30:1 → 本用例**必须红**。
 */
const NONTEXT_TARGETS = [
  { name: ".el-input__wrapper", selector: ".el-form-item__content .el-input__wrapper" },
  { name: ".el-select__wrapper", selector: ".el-select__wrapper" },
  { name: ".el-textarea__inner", selector: ".el-textarea__inner" },
] as const;

type NonTextRow = {
  name: string;
  border: string | null;
  bg: string | null;
  note: string;
};

async function collectNonTextContrast(page: Page): Promise<NonTextRow[]> {
  return page.evaluate((targets) => {
    const firstRgb = (v: string): string | null => {
      const m = String(v).match(/rgba?\([^)]+\)/);
      return m ? m[0] : null;
    };
    const nearestOpaqueBg = (el: Element): string | null => {
      let node: Element | null = el.parentElement;
      while (node) {
        const b = getComputedStyle(node).backgroundColor;
        const m = b.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const p = m[1].split(",").map((s) => parseFloat(s.trim()));
          const alpha = p.length >= 4 ? p[3] : 1;
          if (alpha >= 1) return b;
        }
        node = node.parentElement;
      }
      return null;
    };
    const out: Array<{ name: string; border: string | null; bg: string | null; note: string }> = [];
    for (const t of targets) {
      const els: HTMLElement[] = Array.prototype.slice.call(
        document.querySelectorAll(t.selector)
      );
      // 排除被 AiSidePanel 接管的实例（见上方「范围与已知例外」）
      const pool =
        t.name === ".el-textarea__inner"
          ? els.filter((e) => !e.closest(".ai-input-box"))
          : els;
      const el = pool[0];
      if (!el) {
        out.push({ name: t.name, border: null, bg: null, note: "未渲染：本路由无该控件" });
        continue;
      }
      const cs = getComputedStyle(el);
      const viaShadow = cs.boxShadow && cs.boxShadow !== "none";
      out.push({
        name: t.name,
        border: viaShadow ? firstRgb(cs.boxShadow) : firstRgb(cs.borderTopColor),
        bg: nearestOpaqueBg(el),
        note: viaShadow ? "box-shadow 首色" : "box-shadow:none → 回读 border 色",
      });
    }
    return out;
  }, NONTEXT_TARGETS as unknown as Array<{ name: string; selector: string }>);
}

test("非文本对比度守卫：三控件 computed 边框 ≥3:1（S3-63）@a11y", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("账号").fill("admin");
  await page.getByPlaceholder("密码").fill("admin123");
  await page.getByRole("button", { name: "立即登录" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  // 这两个路由实测可覆盖全部三控件：/customers 有 select，/instant-retail/config 有 input + textarea
  const routes = ["/customers", "/instant-retail/config"];
  const hits: Record<string, number> = {};
  const failures: string[] = [];

  for (const r of routes) {
    await page.goto(r);
    // SPA 路由切换后需等真实渲染，否则会取到"未渲染"的空结果（本机实测：不加等待三控件全落空）
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3_000);
    console.log(`[a11y-nontext] route=${r} url=${page.url()}`);
    const st = await waitForVisualSettled(page);
    if (st.degraded) {
      console.log(`[a11y][降级] 非文本守卫 ${r}：${st.degraded}`);
    }
    const rows = await collectNonTextContrast(page);
    for (const row of rows) {
      if (!row.border || !row.bg) {
        console.log(`[a11y-nontext] route=${r} control=${row.name} —— ${row.note}`);
        continue;
      }
      const ratio = wcagRatio(row.border, row.bg);
      const ratioStr = ratio === null ? "N/A" : `${ratio.toFixed(2)}:1`;
      console.log(
        `[a11y-nontext] route=${r} control=${row.name} border=${row.border} ` +
          `bg=${row.bg} ratio=${ratioStr} (${row.note})`
      );
      hits[row.name] = (hits[row.name] ?? 0) + 1;
      if (ratio !== null && ratio < 3) {
        failures.push(`${row.name} @ ${r}: ${ratioStr} < 3:1`);
      }
    }
  }

  // 防假门禁：任一控件一次都没取到 ⇒ 守卫从未真正跑到它
  for (const t of NONTEXT_TARGETS) {
    if (!hits[t.name]) {
      failures.push(`${t.name} 在所有取样路由均未渲染 —— 守卫从未真正取到该控件（假门禁）`);
    }
  }

  if (failures.length > 0) {
    console.log(`[a11y-nontext] ❌ 不达标/未命中：${failures.join(" | ")}`);
  } else {
    console.log("[a11y-nontext] ✅ 三控件均命中且比值 ≥3:1");
  }
  expect(failures).toEqual([]);
});

test.describe("无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规 @a11y", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("账号").waitFor();

    // S3-61 稳定化：采样前等页面静止并禁用过渡/动画
    const st1 = await waitForVisualSettled(page);
    console.log(
      st1.degraded
        ? `[a11y][降级] 登录页：${st1.degraded} —— 本次采样未取得「已静止」保证`
        : "[a11y][稳定化-正常] 登录页：已确认无 running 动画 + 过渡/动画已禁用"
    );
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
    const st2 = await waitForVisualSettled(page);
    console.log(
      st2.degraded
        ? `[a11y][降级] 工作台：${st2.degraded} —— 本次采样未取得「已静止」保证`
        : "[a11y][稳定化-正常] 工作台：已确认无 running 动画 + 过渡/动画已禁用"
    );
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
