/**
 * S3-67 运行期 computed 矩阵探针（D2 派单卡交付物 4）
 *
 * 目的：把 `--border-normal` 族的**逐控件 computed 读数 + 比值 + 变量归因**落库，任何人可复跑复核。
 *
 * 取样口径（与 F-1 复核一致，写进矩阵表头）：
 *   - 边界：**inset box-shadow 首色优先**；否则取四边中任一有效边色（border-width>0 && border-style!=none）；
 *           四边都无效 ⇒ 记「无有效边界」。多条边界色时逐条给比值，判定值取**对比度最小**者（保守口径）。
 *   - 背景：vs 最近不透明祖先底 与 vs 控件自身底（alpha 合成到白），**取较小者为判定值**。
 *   - 比值：WCAG 相对亮度公式，**由脚本计算**（不肉眼填）。
 *   - 元素身份：每条实例记 sel / class / 尺寸 / 文本片段(≤20 字) / disabled 状态。
 *   - 变量归因：**哨兵实验**——在 document.documentElement 上把候选变量逐个写成 `#010203`，
 *     重读 computed，看哪些控件的边界同步变 `rgb(1, 2, 3)`（R8.1 唯一允许的定论方式）。
 *   - 反测前置：注入 `transition:none!important;animation:none!important`，避免读到过渡中间值。
 *
 * 🔴 本脚本**只读运行期状态**：不改任何源码/色值/token，哨兵只改内存里的 inline style，且每轮 removeProperty。
 *
 * 来源注明：取样方法（inset 首色优先 / 四边逐读 / 哨兵干预 / Firefox userPrefs 绕系统代理）
 *          复用并重写了苏然 F-1 的探针思路（`D:\Users\ZXQL\f1-verify\probe-computed-v2.cjs`，作者：苏然），
 *          按本卡 §四/§五 的覆盖面重写，非照抄。
 *
 * 用法：node docs/evidence/S3-67/tools/s3-67-computed-matrix.cjs [firefox|chromium] [--with-sentinel]
 *       （默认 firefox + 跑哨兵轮；`--no-sentinel` 可只跑基线）
 *
 * 连接方式：
 *   - 默认：`browserType.launch()`（正常机器用它即可）；
 *   - `--cdp=http://127.0.0.1:9222`：连接**已由外部启动**的 Chromium（本沙箱禁止 node spawn 子进程，
 *     浏览器必须由 PowerShell 侧启动，见 docs/evidence/S3-67/README.md 的复跑说明）。
 */
const fs = require("fs");
const path = require("path");
// worktree 根（本脚本位于 <wt>/docs/evidence/S3-67/tools/）
const WT = path.resolve(__dirname, "..", "..", "..", "..").replace(/\\/g, "/");
const { firefox, chromium } = require(path.join(WT, "node_modules/@playwright/test"));

const RAW = path.join(WT, "docs/evidence/S3-67/raw");
const SHOTS = path.join(RAW, "screenshots");
const BASE = "http://127.0.0.1:5173";
const ENGINE = (process.argv[2] || "firefox").toLowerCase();
const RUN_SENTINEL = !process.argv.includes("--no-sentinel");
const CDP = (process.argv.find((a) => a.startsWith("--cdp=")) || "").replace("--cdp=", "") || null;
const SENTINEL = "#010203";
const SENTINEL_RGB = "rgb(1, 2, 3)";

// ── 取样阶段（route + 前置交互）───────────────────────────────────────────────
const PHASES = [
  { key: "dashboard", route: "/dashboard", prep: "none" },
  { key: "customers", route: "/customers", prep: "none" },
  { key: "orders", route: "/orders", prep: "none" },
  { key: "retail-config", route: "/instant-retail/config", prep: "none" },
  { key: "system-config", route: "/system/config", prep: "none" },
  { key: "cashier", route: "/pos/cashier", prep: "addItem" },
  { key: "cashier-pay", route: "/pos/cashier", prep: "openPay" },
  { key: "cashier-trace", route: "/pos/cashier", prep: "openTrace" },
];

const ALL = PHASES.map((p) => p.key);
const CASHIER = ["cashier", "cashier-pay", "cashier-trace"];

// ── 控件清单（覆盖派单卡 §五.5：EP 组件 + CashierView 6 类）────────────────────
const TARGETS = [
  // EP 组件族（跨页面枚举，含 disabled 实例）
  { id: "EP-button", name: ".el-button（全体）", sel: ".el-button", phases: ALL },
  { id: "EP-button-default", name: ".el-button--default", sel: ".el-button--default", phases: ALL },
  { id: "EP-button-primary", name: ".el-button--primary", sel: ".el-button--primary", phases: ALL },
  { id: "EP-button-danger", name: ".el-button--danger", sel: ".el-button--danger", phases: ALL },
  { id: "EP-input", name: ".el-input__wrapper（通用）", sel: ".el-input__wrapper", phases: ["customers", "orders", "retail-config", "system-config"] },
  { id: "EP-select", name: ".el-select__wrapper", sel: ".el-select__wrapper", phases: ["customers", "orders", "retail-config", "system-config"] },
  { id: "EP-textarea", name: ".el-textarea__inner（通用）", sel: ".el-textarea__inner", phases: ["retail-config", "system-config"] },
  { id: "EP-table-th", name: ".el-table th.el-table__cell", sel: ".el-table th.el-table__cell", phases: ["customers", "orders"] },
  { id: "EP-table-td", name: ".el-table td.el-table__cell", sel: ".el-table td.el-table__cell", phases: ["customers", "orders"] },
  { id: "EP-table", name: ".el-table（表格外框）", sel: ".el-table", phases: ["customers", "orders"] },
  { id: "EP-pagination", name: ".el-pagination", sel: ".el-pagination", phases: ["customers", "orders"] },
  { id: "EP-card", name: ".el-card", sel: ".el-card", phases: ["dashboard", "customers", "orders"] },
  { id: "EP-dialog", name: ".el-dialog（追溯码弹窗）", sel: ".el-dialog", phases: ["cashier-trace"] },
  { id: "AI-textarea", name: "AiSidePanel .ai-input-box .el-textarea__inner", sel: ".ai-input-box .el-textarea__inner", phases: ["dashboard", "customers", "orders"] },

  // CashierView 6 类（立项卡 §3.1 明令必测；其中 3 类为 inset box-shadow）
  { id: "CS-product-search", name: "Cashier .product-search-input .el-input__wrapper", sel: ".product-search-input .el-input__wrapper", phases: CASHIER },
  { id: "CS-pay-code", name: "Cashier .pay-code-input .el-input__wrapper", sel: ".pay-code-input .el-input__wrapper", phases: ["cashier-pay", "cashier-trace"] },
  { id: "CS-trace-code", name: "Cashier .trace-code-input .el-input__wrapper", sel: ".trace-code-input .el-input__wrapper", phases: ["cashier-trace"] },
  { id: "CS-qty-btn", name: "Cashier .qty-btn", sel: ".qty-btn", phases: ["cashier", "cashier-pay", "cashier-trace"] },
  { id: "CS-numpad-key", name: "Cashier .numpad-key", sel: ".numpad-key", phases: ["cashier-pay"] },
  { id: "CS-pay-method-btn", name: "Cashier .pay-method-btn（未选中态）", sel: ".pay-method-btn:not(.active)", phases: ["cashier-pay"] },
  { id: "CS-pay-method-btn-active", name: "Cashier .pay-method-btn.active（选中态）", sel: ".pay-method-btn.active", phases: ["cashier-pay"] },
  { id: "CS-pay-method-card", name: "Cashier .pay-method-card（未选中态）", sel: ".pay-method-card:not(.active)", phases: ["cashier-pay"] },
  { id: "CS-pay-method-card-active", name: "Cashier .pay-method-card.active（选中态）", sel: ".pay-method-card.active", phases: ["cashier-pay"] },
  { id: "CS-cart-summary", name: "Cashier .cart-summary（虚线分隔线引用点 2148）", sel: ".cart-summary", phases: CASHIER },
];

const CANDIDATE_VARS = [
  "--border-normal",
  "--border-light",
  "--table-border",
  "--el-border-color",
  "--el-table-border-color",
  "--input-border",
];

// ── 采集函数（浏览器内执行；纯读取）──────────────────────────────────────────
const COLLECT_FN = ({ targets }) => {
  const firstRgb = (v) => { const m = String(v || "").match(/rgba?\([^)]+\)/); return m ? m[0] : null; };
  const alphaOf = (c) => {
    const m = String(c || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return p.length >= 4 ? p[3] : 1;
  };
  const nearestOpaqueAncestorBg = (el) => {
    let n = el.parentElement;
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (alphaOf(bg) === 1) return bg;
      n = n.parentElement;
    }
    return null;
  };
  const out = [];
  for (const t of targets) {
    let els = [];
    try { els = Array.prototype.slice.call(document.querySelectorAll(t.sel)); } catch { els = []; }
    const inst = [];
    // 去重：`.el-button` 与 `.el-button--default` 会命中同一元素，各自独立计数即可（不合并）
    for (let i = 0; i < els.length && i < 10; i++) {
      const el = els[i];
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // 不可见实例不计入
      const sides = ["Top", "Right", "Bottom", "Left"].map((s) => ({
        side: s,
        w: cs["border" + s + "Width"],
        st: cs["border" + s + "Style"],
        c: firstRgb(cs["border" + s + "Color"]),
      }));
      const effective = sides.filter((x) => (parseFloat(x.w) || 0) > 0 && x.st !== "none");
      const inset = /inset/.test(cs.boxShadow || "") ? firstRgb(cs.boxShadow) : null;
      inst.push({
        i,
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 160),
        text: String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20),
        disabled:
          el.disabled === true ||
          el.getAttribute("aria-disabled") === "true" ||
          /is-disabled/.test(String(el.className)),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        borderSides: sides.map((x) => `${x.side}:${x.w}/${x.st}/${x.c}`).join(" | "),
        effectiveBorderColors: [...new Set(effective.map((x) => x.c).filter(Boolean))],
        insetShadow: inset,
        insetShadowColor: inset,
        boxShadowRaw: cs.boxShadow,
        ownBg: cs.backgroundColor,
        ownBgAlpha: alphaOf(cs.backgroundColor),
        ancestorBg: nearestOpaqueAncestorBg(el),
        vars: {
          "--el-button-border-color": cs.getPropertyValue("--el-button-border-color").trim(),
          "--border-normal": cs.getPropertyValue("--border-normal").trim(),
          "--border-light": cs.getPropertyValue("--border-light").trim(),
          "--table-border": cs.getPropertyValue("--table-border").trim(),
          "--input-border": cs.getPropertyValue("--input-border").trim(),
          "--el-border-color": cs.getPropertyValue("--el-border-color").trim(),
          "--el-table-border-color": cs.getPropertyValue("--el-table-border-color").trim(),
        },
      });
    }
    out.push({ id: t.id, name: t.name, sel: t.sel, found: els.length, sampled: inst.length, instances: inst });
  }
  return out;
};

// ── WCAG 计算（Node 侧，脚本算；不肉眼填）────────────────────────────────────
function parseRgb(s) {
  const m = String(s || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length >= 4 ? p[3] : 1 };
}
function toHex(rgb) {
  const v = (x) => Math.round(x).toString(16).padStart(2, "0").toUpperCase();
  return "#" + v(rgb.r) + v(rgb.g) + v(rgb.b);
}
function compositeOver(rgb, bg) {
  const a = rgb.a;
  return { r: rgb.r * a + bg.r * (1 - a), g: rgb.g * a + bg.g * (1 - a), b: rgb.b * a + bg.b * (1 - a), a: 1 };
}
function lin(c) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
function lum(rgb) { return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b); }
function ratio(a, b) {
  if (!a || !b) return null;
  const la = lum(a), lb = lum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
const WHITE = { r: 255, g: 255, b: 255, a: 1 };

/** 边界候选：inset 首色优先；否则四边有效边色（去重） */
function boundaryCandidates(it) {
  if (it.insetShadow) return [{ color: it.insetShadow, src: "inset box-shadow 首色" }];
  const cols = (it.effectiveBorderColors || []).filter(Boolean);
  if (cols.length) return cols.map((c) => ({ color: c, src: "border 边色" }));
  return [{ color: null, src: "无有效边界" }];
}

function analyze(group) {
  return group.instances.map((it) => {
    const ownBg = parseRgb(it.ownBg);
    const ownSolid = ownBg && ownBg.a >= 1 ? ownBg : ownBg ? compositeOver(ownBg, WHITE) : null;
    const ancBg = parseRgb(it.ancestorBg);
    const cands = boundaryCandidates(it).map((b) => {
      const bc = parseRgb(b.color);
      const rAnc = bc && ancBg ? ratio(bc, ancBg) : null;
      const rOwn = bc && ownSolid ? ratio(bc, ownSolid) : null;
      const vals = [rAnc, rOwn].filter((x) => x !== null);
      return {
        boundary: b.color,
        boundaryHex: bc ? toHex(bc) : null,
        source: b.src,
        ratioVsAncestor: rAnc === null ? null : Number(rAnc.toFixed(2)),
        ratioVsOwnBg: rOwn === null ? null : Number(rOwn.toFixed(2)),
        minRatio: vals.length ? Number(Math.min(...vals).toFixed(2)) : null,
      };
    });
    const usable = cands.filter((c) => c.minRatio !== null);
    const judged = usable.length
      ? usable.reduce((a, b) => (b.minRatio < a.minRatio ? b : a))
      : cands[0];
    return {
      i: it.i, tag: it.tag, cls: it.cls, text: it.text, disabled: it.disabled, w: it.w, h: it.h,
      borderSides: it.borderSides,
      boxShadowRaw: it.boxShadowRaw,
      ownBg: it.ownBg, ownBgAlpha: it.ownBgAlpha, ancestorBg: it.ancestorBg,
      ownBgComposited: ownSolid ? toHex(ownSolid) : null,
      candidates: cands,
      judgedBoundary: judged.boundary,
      judgedBoundaryHex: judged.boundaryHex,
      judgedSource: judged.source,
      judgedRatio: judged.minRatio,
      verdict: judged.minRatio === null ? "无法判定（无有效边界/背景）" : judged.minRatio >= 3 ? "≥3:1" : "<3:1",
      vars: it.vars,
    };
  });
}

async function settle(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function prepPhase(page, ph, waitMs) {
  await page.goto(BASE + ph.route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(waitMs);
  if (ph.prep === "addItem" || ph.prep === "openPay" || ph.prep === "openTrace") {
    const prod = page.locator(".product-card, .product-item, [class*=product][class*=card]").first();
    if (await prod.count()) { try { await prod.click({ timeout: 4000 }); } catch { /* 忽略 */ } }
    await page.waitForTimeout(1200);
  }
  if (ph.prep === "openPay" || ph.prep === "openTrace") {
    const btn = page.locator("button", { hasText: "结算" }).first();
    if (await btn.count()) { try { await btn.click({ timeout: 4000 }); } catch { /* 忽略 */ } }
    await page.waitForTimeout(1800);
  }
  if (ph.prep === "openTrace") {
    const tb = page.locator(".cart-row-trace-btn").first();
    if (await tb.count()) { try { await tb.click({ timeout: 4000 }); } catch { /* 忽略 */ } }
    await page.waitForTimeout(1500);
  }
  await settle(page);
}

async function readPhase(page, phaseKey) {
  const ts = TARGETS.filter((t) => t.phases.includes(phaseKey));
  if (!ts.length) return [];
  const rows = await page.evaluate(COLLECT_FN, { targets: ts.map((t) => ({ id: t.id, name: t.name, sel: t.sel })) });
  return rows;
}

function boundariesOf(group) {
  return [...new Set(group.instances.map((it) => boundaryCandidates(it)[0].color).filter(Boolean))].sort();
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const launchOpts =
    ENGINE === "chromium" ? {} : {
      firefoxUserPrefs: {
        "network.proxy.type": 0,
        "network.proxy.no_proxies_on": "127.0.0.1,localhost",
        "network.http.http2.enabled": false,
        "network.http.accept-encoding": "identity",
        "network.dns.disablePrefetch": true,
        "dom.security.https_only_mode": false,
      },
    };
  let browser;
  let ctx;
  let page;
  if (CDP) {
    browser = await chromium.connectOverCDP(CDP);
    ctx = browser.contexts()[0] || (await browser.newContext({ viewport: { width: 1600, height: 1000 } }));
    page = await ctx.newPage();
    await page.setViewportSize({ width: 1600, height: 1000 });
  } else {
    browser = await (ENGINE === "chromium" ? chromium : firefox).launch(launchOpts);
    ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
    page = await ctx.newPage();
  }

  const report = {
    meta: {
      engine: ENGINE,
      connection: CDP ? `connectOverCDP(${CDP})` : "launch()",
      browserVersion: browser.version(),
      baseURL: BASE,
      collectedAt: new Date().toISOString(),
      sentinel: SENTINEL,
      script: "docs/evidence/S3-67/tools/s3-67-computed-matrix.cjs",
      samplingSpec: {
        boundary: "inset box-shadow 首色优先；否则四边中任一有效边色（w>0 && style!=none）；都无 ⇒ 无有效边界",
        background: "vs 最近不透明祖先底 与 vs 控件自身底（alpha 合成到白），取较小者为判定值",
        ratio: "WCAG 相对亮度，脚本计算；门槛 3:1（WCAG 1.4.11）",
        identity: "sel/class/尺寸/文本片段(≤20字)/disabled",
      },
      phases: PHASES.map((p) => ({ key: p.key, route: p.route, prep: p.prep })),
      envNote: "admin-web dev(5173) → vite proxy → 127.0.0.1:8081 mock 后端（USE_MOCK_DB=true）",
    },
    baseline: [],
    baselineAnalyzed: [],
    rootVars: {},
    sentinelRounds: [],
    notes: [],
  };

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  // 2026-09-25 凌舟加固：SPA 首屏挂载晚于 domcontentloaded，必须显式等表单出现再填，
  // 否则冷启动/首轮 vite transform 时 fill 会 30s 超时（实测：等待后同环境可跑通）。
  page.setDefaultTimeout(60000);
  await page.getByPlaceholder("账号").waitFor({ state: "visible", timeout: 90000 });
  await page.getByPlaceholder("账号").fill("admin");
  await page.getByPlaceholder("密码").fill("admin123");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForTimeout(4000);
  report.notes.push("登录后 url=" + page.url());

  const phaseLog = [];
  for (const ph of PHASES) {
    await prepPhase(page, ph, 3500);
    phaseLog.push({ phase: ph.key, prep: ph.prep, finalUrl: page.url() });
    try { await page.screenshot({ path: path.join(SHOTS, `baseline-${ph.key}.png`), fullPage: false }); } catch (e) { report.notes.push(`截图失败 ${ph.key}: ${e.message}`); }
    report.baseline.push(...(await readPhase(page, ph.key)));
  }
  report.baselineAnalyzed = report.baseline.map((g) => ({ id: g.id, name: g.name, sel: g.sel, found: g.found, sampled: g.sampled, instances: analyze(g) }));
  report.phasesObserved = phaseLog;

  // :root 上的候选变量现读值
  await prepPhase(page, PHASES[1], 3000);
  report.rootVars = await page.evaluate((vars) => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    for (const v of vars) o[v] = cs.getPropertyValue(v).trim();
    return o;
  }, CANDIDATE_VARS);

  if (RUN_SENTINEL) {
    for (const v of CANDIDATE_VARS) {
      const round = { variable: v, rootValueBaseline: report.rootVars[v], phases: [], perTarget: [] };
      for (const ph of PHASES) {
        await prepPhase(page, ph, 3000);
        await page.evaluate(({ n, c }) => document.documentElement.style.setProperty(n, c), { n: v, c: SENTINEL });
        await settle(page);
        const rows = await readPhase(page, ph.key);
        round.phases.push({ phase: ph.key, finalUrl: page.url(), rows });
        await page.evaluate(({ n }) => document.documentElement.style.removeProperty(n), { n: v });
      }
      const byId = new Map();
      for (const p of round.phases) for (const g of p.rows) {
        if (!byId.has(g.id)) byId.set(g.id, []);
        byId.get(g.id).push(...g.instances.map((it) => it));
      }
      for (const t of TARGETS) {
        const base = report.baseline.find((b) => b.id === t.id);
        const after = byId.get(t.id) || [];
        const bBounds = base ? [...new Set(base.instances.map((it) => boundaryCandidates(it)[0].color).filter(Boolean))].sort() : [];
        const aBounds = [...new Set(after.map((it) => boundaryCandidates(it)[0].color).filter(Boolean))].sort();
        round.perTarget.push({
          id: t.id, name: t.name,
          foundBaseline: base ? base.sampled : null, foundAfter: after.length,
          baselineBoundaries: bBounds, afterBoundaries: aBounds,
          changed: JSON.stringify(bBounds) !== JSON.stringify(aBounds),
          becameSentinel: aBounds.includes(SENTINEL_RGB),
          baselineVsSentinelOnly: bBounds.length > 0 && aBounds.length > 0 && !aBounds.includes(SENTINEL_RGB) && JSON.stringify(bBounds) === JSON.stringify(aBounds),
        });
      }
      report.sentinelRounds.push(round);
      console.log(`[sentinel] ${v} 完成：变化目标 ${round.perTarget.filter((x) => x.changed).length} 项`);
    }
  }

  fs.writeFileSync(path.join(RAW, `computed-baseline-${ENGINE}.json`), JSON.stringify({
    meta: report.meta, notes: report.notes, phasesObserved: report.phasesObserved,
    rootVars: report.rootVars, baselineRaw: report.baseline, baselineAnalyzed: report.baselineAnalyzed,
  }, null, 2), "utf8");
  if (RUN_SENTINEL) {
    fs.writeFileSync(path.join(RAW, `computed-sentinel-${ENGINE}.json`), JSON.stringify({
      meta: report.meta, rootVars: report.rootVars,
      rounds: report.sentinelRounds.map((r) => ({ variable: r.variable, rootValueBaseline: r.rootValueBaseline, perTarget: r.perTarget, phases: r.phases })),
    }, null, 2), "utf8");
  }

  // 人读摘要
  const L = [];
  L.push(`S3-67 运行期 computed 矩阵（引擎=${ENGINE} ${report.meta.browserVersion}）`);
  L.push(`取样时间=${report.meta.collectedAt}  baseURL=${BASE}`);
  L.push(`:root 候选变量现读值 = ${JSON.stringify(report.rootVars)}`);
  L.push(`阶段 = ${JSON.stringify(report.phasesObserved)}`);
  L.push("");
  L.push("【基线：逐实例 computed 边界 / 背景 / 比值】");
  for (const g of report.baselineAnalyzed) {
    L.push(`${g.id}  ${g.name}  found=${g.found} sampled=${g.sampled}  sel=${g.sel}`);
    if (!g.sampled) L.push("    ⚠ 本路由未渲染到该控件（未取得读数）");
    for (const it of g.instances) {
      L.push(`   [${it.i}] ${it.disabled ? "DISABLED " : ""}${it.tag}.${it.cls} ${it.w}x${it.h} "${it.text}"`);
      L.push(`       边界(${it.judgedSource})=${it.judgedBoundary}(${it.judgedBoundaryHex}) 自身底=${it.ownBg}(a=${it.ownBgAlpha}→${it.ownBgComposited}) 祖先底=${it.ancestorBg}`);
      for (const c of it.candidates) {
        L.push(`         · ${c.source} ${c.boundary} vs祖先=${c.ratioVsAncestor} vs自身=${c.ratioVsOwnBg} 判定=${c.minRatio} ${c.minRatio !== null && c.minRatio >= 3 ? "≥3:1" : "<3:1"}`);
      }
      L.push(`       ★判定值=${it.judgedRatio} ${it.verdict} 四边读数: ${it.borderSides}`);
      L.push(`       box-shadow=${it.boxShadowRaw}`);
    }
  }
  L.push("");
  if (RUN_SENTINEL) {
    L.push("【哨兵轮：把候选变量写为 #010203 后，各目标边界色集合的变化】");
    for (const r of report.sentinelRounds) {
      const ch = r.perTarget.filter((x) => x.changed);
      L.push(`\n◆ ${r.variable}（基线值=${r.rootValueBaseline}）：变化 ${ch.length} 项 / 未变化 ${r.perTarget.filter((x) => !x.changed && x.foundAfter > 0).length} 项（已渲染）`);
      for (const c of ch) {
        L.push(`   ${c.id} ${c.name}: ${JSON.stringify(c.baselineBoundaries)} → ${JSON.stringify(c.afterBoundaries)}${c.becameSentinel ? "  ★变为哨兵色 rgb(1, 2, 3)" : "  （变了但不是哨兵色）"}`);
      }
      const same = r.perTarget.filter((x) => !x.changed && x.foundAfter > 0).map((x) => x.id);
      L.push(`   未受影响（已渲染）：${same.join(", ") || "无"}`);
      const zero = r.perTarget.filter((x) => x.foundAfter === 0 && (x.foundBaseline || 0) > 0).map((x) => x.id);
      if (zero.length) L.push(`   ⚠ 哨兵轮未渲染到（基线有）：${zero.join(", ")}`);
    }
  }
  fs.writeFileSync(path.join(RAW, `computed-probe-${ENGINE}${RUN_SENTINEL ? "" : "-baseline"}.txt`), L.join("\n"), "utf8");
  console.log(L.join("\n"));
  await browser.close();
}

main().catch((e) => { console.error("PROBE_FAIL", e); process.exit(1); });
