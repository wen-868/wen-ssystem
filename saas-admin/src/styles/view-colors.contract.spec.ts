import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ═══════════════════════════════════════════════════════════════
 * TOTAL-SAAS-VIEW-HARDCODED-COLORS-RECONSTRUCT-01 · 视图层色令牌契约（20 条）
 * ───────────────────────────────────────────────────────────────
 * 背景：23f19517 的 views 迁移被 revert 后，本卡从 4bbdcb22 基线重建。
 *   本 spec 锁定重建结果，防旧色回归 / 错 token / 第二真源。
 *
 * 豁免口径（与 color-remap.json 一致）：
 *   - tokens.css 真源定义处字面色
 *   - *.spec.ts / *.test.ts 自身（含本文件）不参与扫描
 *   - MobilePreview.vue 手机机身造型色（被模拟硬件，行 590~740 区段）
 *   - PlatformLogin.vue 登录品牌区装饰 SVG（白描边/透明度造型）
 *   - TenantUsage.vue CHART_TOKEN_FALLBACK（兜底值=令牌同名字面值，
 *     由 V6 逐值锁定等于 tokens.css，杜绝第二真源漂移）
 *   - stripComments 后注释不参与
 *
 * mutation 验证（验收卡 §四.6 四类均已实测变红后还原）：
 *   M1 恢复旧色 → V1 红；M2 错 token（文字用 --color-success）→ V5 红；
 *   M3 破坏对比度（改坏 --color-success-text 值）→ V7 红；
 *   M4 引入第二真源（App.vue 重定义 --color-star）→ V3 红。
 * ═══════════════════════════════════════════════════════════════
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..");
const TOKENS_FILE = path.join(SRC, "styles", "tokens.css");
const VIEWS = path.join(SRC, "views");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[\s;{(])(\/\/[^\n]*)/g, (_m, a: string, b: string) => a + b.replace(/./g, " "));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|dist/.test(e.name)) walk(p, out);
    } else if (/\.(vue|css|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
/** views 全域（stripComments 后的生效源码） */
const viewFiles = walk(VIEWS).filter((f) => !/\.(spec|test)\.[jt]s$/.test(f));
const viewBodies = viewFiles.map((f) => ({ file: rel(f), body: stripComments(fs.readFileSync(f, "utf8")) }));
const tokensSrc = stripComments(fs.readFileSync(TOKENS_FILE, "utf8"));

function tokenValue(name: string): string {
  const m = tokensSrc.match(new RegExp(name.replace(/-/g, "\\-") + "\\s*:\\s*([^;{}]+)"));
  if (!m) throw new Error(`tokens.css 未定义 ${name}`);
  return m[1].replace(/!important$/, "").trim();
}

/** WCAG 2.1 对比度 */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(parseInt(h.slice(0, 2), 16)) + 0.7152 * lin(parseInt(h.slice(2, 4), 16)) + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("V1. 旧色零残留（本卡整改的旧值不得在 views 生效源码中回归）", () => {
  it.each([
    ["#909399", "EP secondary 文本（3.07:1 违 AA）→ --text-muted"],
    ["#606266", "EP regular 文本 → --text-secondary"],
    ["#303133", "EP primary 文本 → --text-primary"],
    ["#F56C6C", "EP danger → --color-danger"],
    ["#C0C4CC", "EP placeholder 图标（1.75:1 违 1.4.11）→ --gray-300"],
    ["#409eff", "EP primary（白字 2.78:1 违 AA）→ --color-primary"],
    ["#f0f2f5", "EP/漂移灰蓝底 → --bg-page"],
    ["#EBEEF5", "EP border-light → --border-light"],
    ["#e4e7ed", "EP border → --border-normal"],
    ["#f5f7fa", "EP fill-light 盒底 → --bg-soft"],
    ["#ef4444", "Tailwind red-500 → --color-danger"],
    ["#10b981", "Tailwind emerald-500 → --chart-2 / --color-success-text"],
    ["#f59e0b", "Tailwind amber-500 → --chart-3"],
    ["#8b5cf6", "Tailwind violet-500 → --chart-5"],
    ["#ecfdf5", "Tailwind emerald-50 → --color-success-soft"],
    ["#fffbeb", "Tailwind amber-50 → --color-warning-soft"],
    ["#f5f3ff", "Tailwind violet-50 → --color-purple-soft"],
  ])("V1. %s 在 views 生效源码中出现 0 次（%s）", (oldColor) => {
    const hits = viewBodies.filter((v) => v.body.includes(oldColor as string));
    expect(hits.map((h) => h.file), `旧色 ${oldColor} 残留于: ${hits.map((h) => h.file).join(",")}`).toHaveLength(0);
  });
});

describe("V2. 新令牌与引用", () => {
  it("V3. --color-star 仅在 tokens.css 定义一次，值 #ff9900（全域扫描，App.vue 等第二真源即红）", () => {
    const allSrc = walk(SRC).filter((f) => !/\.(spec|test)\.[jt]s$/.test(f) && f !== TOKENS_FILE);
    const sites: { file: string; value: string }[] = [{ file: "styles/tokens.css", value: tokenValue("--color-star") }];
    for (const f of allSrc) {
      for (const m of stripComments(fs.readFileSync(f, "utf8")).matchAll(/--color-star\s*:\s*([^;{}]+)/g)) {
        sites.push({ file: rel(f), value: m[1].trim() });
      }
    }
    expect(sites, `--color-star 定义点: ${JSON.stringify(sites)}`).toHaveLength(1);
    expect(sites[0].file).toBe("styles/tokens.css");
    expect(sites[0].value.toLowerCase()).toBe("#ff9900");
  });

  it("V4. --color-star 被 PlatformReviews.vue 引用，且 #ff9900 在 views 无字面残留", () => {
    const reviews = viewBodies.find((v) => v.file === "views/PlatformReviews.vue");
    expect(reviews, "PlatformReviews.vue 应存在").toBeTruthy();
    expect(reviews!.body).toMatch(/var\(\s*--color-star\s*\)/);
    expect(reviews!.body.includes("#ff9900")).toBe(false);
  });
});

describe("V5. 分层令牌口径（文字不得用填充令牌）", () => {
  it("V5. TenantUsage .text-success 必须用 --color-success-text（--color-success 白底仅 3.30:1，S3-137-F1 禁用于文字）", () => {
    const tu = viewBodies.find((v) => v.file === "views/TenantUsage.vue");
    expect(tu, "TenantUsage.vue 应存在").toBeTruthy();
    const style = tu!.body.match(/\.text-success\s*\{[^}]*\}/);
    expect(style, ".text-success 规则应存在").toBeTruthy();
    expect(style![0]).toMatch(/color\s*:\s*var\(\s*--color-success-text\s*\)/);
    expect(style![0]).not.toMatch(/var\(\s*--color-success\s*\)/);
  });
});

describe("V6. 单一真源：CHART_TOKEN_FALLBACK 兜底值必须等于 tokens.css 同名令牌", () => {
  it("V6. TenantUsage 兜底表逐值与 tokens.css 一致（漂移即红）", () => {
    const tu = viewBodies.find((v) => v.file === "views/TenantUsage.vue");
    expect(tu, "TenantUsage.vue 应存在").toBeTruthy();
    const block = tu!.body.match(/CHART_TOKEN_FALLBACK[^=]*=\s*\{([^}]*)\}/);
    expect(block, "CHART_TOKEN_FALLBACK 应存在").toBeTruthy();
    const entries = [...block![1].matchAll(/("--[A-Za-z0-9_-]+")\s*:\s*"([^"]+)"/g)];
    expect(entries.length).toBeGreaterThanOrEqual(8);
    const drift: string[] = [];
    for (const [, rawName, value] of entries) {
      const name = rawName.replace(/"/g, "");
      let tv: string;
      try { tv = tokenValue(name); } catch { drift.push(`${name}: tokens.css 无定义`); continue; }
      if (tv.toLowerCase() !== value.toLowerCase()) drift.push(`${name}: fallback=${value} tokens.css=${tv}`);
    }
    expect(drift, `兜底值漂移:\n${drift.join("\n")}`).toHaveLength(0);
  });
});

describe("V7. 对比度契约（WCAG 2.1 AA，本卡新增令牌/映射实测）", () => {
  it("V7. --color-danger #dc2626 白底 ≥ 4.5（价格/涨跌/驳回文本）", () => {
    expect(tokenValue("--color-danger").toLowerCase()).toBe("#dc2626");
    expect(contrast("#dc2626", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("V7. --color-success-text #15803D 白底 ≥ 4.5（文字用途分层令牌）", () => {
    expect(tokenValue("--color-success-text").toLowerCase()).toBe("#15803d");
    expect(contrast("#15803d", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("V7. --color-primary #2563eb 白底 ≥ 4.5（激活按钮文本/描边文本）", () => {
    expect(tokenValue("--color-primary").toLowerCase()).toBe("#2563eb");
    expect(contrast("#2563eb", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
