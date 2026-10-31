import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ═══════════════════════════════════════════════════════════════
 * TOTAL-SAAS-UI-TOKENS-01 · 令牌与视觉契约测试（20 条）
 * ───────────────────────────────────────────────────────────────
 * 背景：R101-N1-freeze-scan §3.2 证实 saas-admin 曾存在三组端内重复
 *   定义（App.vue :root 三件套 / style.css 四件套 / --tag-padding 双值）。
 *   本卡 computed 定论：dev 注入顺序下 App.vue 旧值实际生效，
 *   tokens.css 的可达性修订值（S3-47/53/54）从未真正上场；
 *   层叠结果依赖注入顺序、本身脆弱 ⇒ 正确收口是删除重复定义。
 *
 * 六层防线：
 *   A. 真源唯一性 —— 曾出事的令牌逐一断言「全 src 仅定义一次」
 *   B. 防回归     —— App.vue 不得再出现 :root 重定义 / 自定义属性 / 硬编码色
 *   C. 全量唯一性 —— 任何自有令牌定义次数恒为 1（覆盖未来新增）
 *   D. 引用完整性 —— var() 引用必须可解析；曾出事令牌引用数 ≥1
 *   E. EP 覆盖契约 —— :root:root 对 Element Plus 的收口不得回退
 *   F. 对比度契约 —— 基线色按 WCAG 2.1 公式实测 ≥4.5
 *
 * 扫描口径：*.spec.ts / *.test.ts 自身不参与扫描（测试源码里的
 *   示例字符串不算运行时定义/引用）。
 *
 * mutation 验证（验收卡 §四.5，四类均已实测变红后还原，见回传卡）：
 *   M1 恢复重复定义 → A/B 红；M2 错误覆盖优先级（组件级再定义）→ A/C 红；
 *   M3 删除仍被引用 token → D 红；M4 改坏对比度 → F 红。
 * ═══════════════════════════════════════════════════════════════
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..");
const TOKENS_FILE = path.join(SRC, "styles", "tokens.css");
const APP_VUE = path.join(SRC, "App.vue");

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
    } else if (/\.(vue|css|scss|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
/** 测试源码自身不参与扫描：其字符串字面量不是运行时 CSS */
const allFiles = walk(SRC).filter((f) => !/\.(spec|test)\.[jt]s$/.test(f));

function defsIn(file: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  stripComments(fs.readFileSync(file, "utf8")).split("\n").forEach((line) => {
    for (const m of line.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)/g)) {
      if (!map.has(m[1])) map.set(m[1], []);
      map.get(m[1])!.push(m[2].trim());
    }
  });
  return map;
}

function injectedIn(file: string): Set<string> {
  const set = new Set<string>();
  for (const m of fs.readFileSync(file, "utf8").matchAll(
    /['"](--[A-Za-z0-9_-]+)['"]\s*:|setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g
  )) set.add(m[1] || m[2]);
  return set;
}

/** 模块级预计算：每文件定义 + 注入（避免逐断言全量重扫） */
const fileDefs = new Map<string, Map<string, string[]>>();
const fileInjected = new Map<string, Set<string>>();
for (const f of allFiles) {
  fileDefs.set(f, defsIn(f));
  fileInjected.set(f, injectedIn(f));
}
const tokensDefs = fileDefs.get(TOKENS_FILE)!;
const relOf = new Map<string, string>(allFiles.map((f) => [f, rel(f)]));

/** token → 全 src 定义位置（预计算，O(文件数)） */
function allDefSites(name: string): { file: string; value: string }[] {
  const sites: { file: string; value: string }[] = [];
  for (const [f, defs] of fileDefs) {
    if (defs.has(name)) for (const v of defs.get(name)!) sites.push({ file: relOf.get(f)!, value: v });
  }
  return sites;
}

function refCount(name: string): number {
  let n = 0;
  const re = new RegExp("var\\(\\s*" + name.replace(/-/g, "\\-") + "\\b", "g");
  for (const f of allFiles) n += (stripComments(fs.readFileSync(f, "utf8")).match(re) || []).length;
  return n;
}

/** WCAG 2.1 对比度（M4 的裁判） */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin(parseInt(h.slice(0, 2), 16)) +
    0.7152 * lin(parseInt(h.slice(2, 4), 16)) +
    0.0722 * lin(parseInt(h.slice(4, 6), 16))
  );
}
function contrast(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function tokenValue(name: string): string {
  const v = tokensDefs.get(name);
  if (!v || !v.length) throw new Error(`tokens.css 未定义 ${name}`);
  return v[0].replace(/!important$/, "").trim();
}

describe("A. 真源唯一性（freeze-scan §3.2 曾出事的令牌逐一验收）", () => {
  it.each([
    ["--text-primary", "#000000"],
    ["--text-secondary", "#444444"],
    ["--bg-page", "#f7f7f7"],
  ])("A 组. %s 全 src 仅在 tokens.css 定义一次，值为 %s", (name, value) => {
    const sites = allDefSites(name as string);
    expect(sites, `${name} 应只定义一次，实际: ${JSON.stringify(sites)}`).toHaveLength(1);
    expect(sites[0].file).toBe("styles/tokens.css");
    expect(sites[0].value.toLowerCase()).toBe((value as string).toLowerCase());
  });

  it("A4. --tag-padding 保持唯一定义（freeze-scan 曾双值 2px 10px / 3px 8px）", () => {
    const sites = allDefSites("--tag-padding");
    expect(sites).toHaveLength(1);
    expect(sites[0].file).toBe("styles/tokens.css");
  });
});

describe("B. 防回归：App.vue 不得再开第二真源", () => {
  it("B1. App.vue 不含 :root 重定义块", () => {
    expect(stripComments(fs.readFileSync(APP_VUE, "utf8"))).not.toMatch(/:root\s*\{/);
  });
  it("B2. App.vue 不定义任何 CSS 自定义属性", () => {
    const own = [...fileDefs.get(APP_VUE)!.keys()];
    expect(own, `App.vue 出现了自定义属性定义: ${own.join(",")}`).toHaveLength(0);
  });
  it("B3. App.vue 不含硬编码 hex 色值", () => {
    const body = stripComments(fs.readFileSync(APP_VUE, "utf8"));
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toHaveLength(0);
  });
});

describe("C. 全量唯一性：任何自有令牌不得端内重复定义", () => {
  it("C1. tokens.css 每个自有令牌（非 --el-*）在全 src 恰好定义一次", () => {
    const violations: string[] = [];
    for (const name of tokensDefs.keys()) {
      if (name.startsWith("--el-")) continue; // EP 命名空间覆盖属预期
      const sites = allDefSites(name);
      if (sites.length !== 1) {
        violations.push(`${name} ×${sites.length}: ${sites.map((s) => `${s.file}=${s.value}`).join(" | ")}`);
      }
    }
    expect(violations, `端内重复定义:\n${violations.join("\n")}`).toHaveLength(0);
  });
});

describe("D. 引用完整性：var() 引用必须可解析", () => {
  it("D1. src/** 全部 var() 引用都有定义（tokens.css / 组件内 / 运行时注入）", () => {
    const defined = new Set<string>();
    for (const [, defs] of fileDefs) for (const n of defs.keys()) defined.add(n);
    for (const [, inj] of fileInjected) for (const n of inj) defined.add(n);
    const missing = new Set<string>();
    for (const f of allFiles) {
      const src = stripComments(fs.readFileSync(f, "utf8"));
      for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
        if (!defined.has(m[1])) missing.add(`${m[1]} @ ${relOf.get(f)}`);
      }
    }
    expect([...missing], `未定义令牌引用:\n${[...missing].join("\n")}`).toHaveLength(0);
  });

  it.each([
    ["--text-primary"],
    ["--text-secondary"],
    ["--bg-page"],
  ])("D2. %s 至少被引用 1 次（删除重复定义前必须先迁移引用，验收卡 §四.2）", (name) => {
    expect(refCount(name as string)).toBeGreaterThanOrEqual(1);
  });
});

describe("E. Element Plus 覆盖契约（:root:root 收口不得回退）", () => {
  const tokensSrc = stripComments(fs.readFileSync(TOKENS_FILE, "utf8"));
  it("E1. 存在 :root:root 块将 --el-color-primary 接到 --color-primary", () => {
    expect(tokensSrc).toMatch(/:root:root\s*\{[^}]*--el-color-primary\s*:\s*var\(--color-primary\)/);
  });
  it("E2. :root:root 至少收口 3 个 --el-* 令牌（S3-137-F1 / S3-53 口径）", () => {
    const block = tokensSrc.match(/:root:root\s*\{([^}]*)\}/);
    expect(block).toBeTruthy();
    const n = [...block![1].matchAll(/--el-[A-Za-z0-9_-]+\s*:/g)].length;
    expect(n).toBeGreaterThanOrEqual(3);
  });
});

describe("F. 对比度契约（WCAG 2.1 AA 正文 4.5:1，实测计算）", () => {
  it.each([
    ["--text-primary", "#000000", "#f7f7f7"],
    ["--text-secondary", "#444444", "#f7f7f7"],
    ["--text-secondary", "#444444", "#FFFFFF"],
    ["--text-muted", "#6D6D6D", "#f0f0f0"],
    ["--text-placeholder", "#767676", "#FFFFFF"],
  ])("F1. %s = %s on %s ≥ 4.5", (name, fg, bg) => {
    expect(tokenValue(name as string).toLowerCase()).toBe((fg as string).toLowerCase());
    expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(4.5);
  });
  it("F2. 主色 #2563eb 承载白字 ≥ 4.5（按钮/链接实底）", () => {
    expect(tokenValue("--color-primary").toLowerCase()).toBe("#2563eb");
    expect(contrast("#FFFFFF", "#2563eb")).toBeGreaterThanOrEqual(4.5);
  });
});
