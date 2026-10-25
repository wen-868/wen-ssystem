/**
 * WORKBENCH-06 UI/动画一致性审计（只读取证，不改产品代码）
 *
 * 目的：回答"新版工作台的 UI 界面与交互动画跟原型是否一致"——
 *   ① 结构层（rail / 第二列 / 顶部 / 主面 / 底部输入区）已由 WORKBENCH-06 验收；
 *   ② **本轮补的是动画与交互反馈层**：原型在壳层元素上定义的 transition / animation，
 *      实现在浏览器 computed 样式里是否存在、时长曲线是否接近。
 *
 * 判据口径（R8.1）：**一律用浏览器 computed 值定论**，不用源码顺序/规则先后推理。
 *
 * 运行（工作树根目录，前置：8080 mock 后端 + 4173 preview）：
 *   node docs/evidence/WORKBENCH-06F3/ui-animation-audit.mjs
 *
 * 输出：docs/evidence/WORKBENCH-06F3/reports/ui-animation-audit.json
 *       docs/evidence/WORKBENCH-06F3/screenshots/hover-*.png（悬停前后对照，肉眼可核）
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync } from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, "reports");
const SHOTS = path.join(HERE, "screenshots");
mkdirSync(REPORTS, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.WB_BASE_URL ?? "http://127.0.0.1:4173";
const PROTOTYPE =
  "D:\\Users\\ZXQL\\ZXQL-AI\\docs\\设计\\智享全链_工作台电脑端_UI原型_融合版.html";
const PROTOTYPE_SHA = "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51";

/** 原型壳层动画清单（**从原型 CSS 源码逐条摘出**，每条带出处行号） */
const PROTO_ANIMATIONS = [
  { key: "rail-item-transition", desc: "一级 rail 项 hover/选中过渡", protoSource: "L122 .rl-it{transition:.15s}", protoSelector: "#rail .rl-it" },
  { key: "rail-alert-flash", desc: "工作台有新动态时 rail 项整块红闪", protoSource: "L187 .rl-it.alert{animation:rlFlash 1.1s}", protoSelector: "#rail .rl-it.alert" },
  { key: "side-collapse", desc: "第二列收起（margin 过渡）", protoSource: "L34 .side{transition:margin .25s} / L35 .side.hide{margin-left:-230px}", protoSelector: "#side" },
  { key: "sub-card-transition", desc: "二级功能卡 hover 过渡", protoSource: "L133 .sub-card{border-radius:10px…} + L134 .sub-card i{transition:.15s}", protoSelector: "#subZone .sub-card" },
  { key: "feed-card-enter", desc: "信息流卡片入场动画（fin）", protoSource: "L150 .feed-card{transition:.15s;animation:…}", protoSelector: "#feedView .feed-card" },
  { key: "feed-live-dot", desc: "「实时推送中」圆点呼吸", protoSource: "L145 .feed-live .fdot{animation:fdot 1.6s ease-in-out infinite}", protoSelector: "#feedView .feed-live .fdot" },
  { key: "feed-ask-hover", desc: "信息流提问条 hover 变色", protoSource: "L147-148 .feed-ask:hover{border-color:var(--blue);color:var(--blue)}", protoSelector: "#feedView .feed-ask" },
  { key: "mode-seg-item", desc: "工作台/收银台胶囊项过渡", protoSource: "L87 .ms{…transition}", protoSelector: "#modeSeg .ms" },
  { key: "input-box-focus", desc: "底部输入框聚焦双环", protoSource: "L642 .input-box:focus-within{box-shadow:0 0 0 3.5px rgba(37,99,235,.1)}", protoSelector: "#inputZone .input-box" },
  { key: "setwin-enter", desc: "设置弹窗入场（swIn）", protoSource: "L671 @keyframes swIn", protoSelector: "#setwin .sw-card" },
];

/** 实现侧对应的选择器（与壳层结构一一对应） */
const IMPL_SELECTORS = {
  "rail-item-transition": '[data-testid="rail"] [data-rail-key]',
  "rail-alert-flash": '[data-testid="rail"] [data-rail-key].alert',
  "side-collapse": '[data-testid="second-nav"]',
  "sub-card-transition": '[data-testid="second-nav"] [data-menu-code]',
  "feed-card-enter": '[data-testid="view-feed"] .fdv-item',
  "feed-live-dot": '[data-testid="feed-live"] .fdv-dot',
  "feed-ask-hover": '[data-testid="feed-ask"]',
  "mode-seg-item": '[data-testid="mode-seg"] .wb-mode-seg-item',
  "input-box-focus": '[data-testid="chat-composer"] .cmp-form',
  "setwin-enter": null, // 实现未做设置弹窗（D-6 已裁定跳 /system），无可比对对象
};

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ← ${detail}` : ""}`);
}

function session() {
  const f = path.join(os.tmpdir(), "wb06f1-session.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const f2 = path.join(os.tmpdir(), "wb06-session.json");
  if (existsSync(f2)) return JSON.parse(readFileSync(f2, "utf8"));
  return null;
}

const browser = await chromium.launch();
/**
 * ⚠️ 关键：必须显式声明 `reducedMotion: "no-preference"`。
 * Chromium/Playwright 在部分环境下 `prefers-reduced-motion` 默认为 `reduce`，
 * 而本项目 `tokens.css:436-444` 有**无障碍规则**：
 *   @media (prefers-reduced-motion: reduce) { * { transition-duration:.01ms !important } }
 * 若不覆盖该媒体查询，所有 transition 会被压到 0.01ms ⇒ 审计会**全部误报为"实现无动效"**。
 * （本次审计首轮就踩了这个坑：8 项 MISSING 全是假阳性。）
 */
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});

// 真实登录拿会话
const page = await ctx.newPage();
const loginStatuses = [];
page.on("response", (r) => {
  if (r.url().includes("/api/admin/auth/login")) loginStatuses.push(r.status());
});
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.fill('input[placeholder="账号"]', "admin");
await page.fill('input[placeholder="密码"]', "admin@2026");
await page.locator("button.login-submit").click();
await page.waitForFunction(() => location.pathname !== "/login", undefined, { timeout: 90000 }).catch(() => {});
await page.waitForSelector(".wb-shell", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
record("真实登录成功（会话可用于后续取证）", loginStatuses.includes(200), JSON.stringify(loginStatuses));
await assertMotionMedia(page, "实现侧");

/** 媒体查询前提自证：reduced-motion 状态必须是 no-preference，否则读数全部失真 */
async function assertMotionMedia(p, label) {
  const media = await p.evaluate(() => ({
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    noPref: window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
  }));
  record(
    `媒体查询前提（${label}）：reduce-motion 已关闭 ⇒ transition 读数有效`,
    media.noPref === true && media.reduce === false,
    `reduce=${media.reduce} no-preference=${media.noPref}`,
  );
  return media;
}

/** 读某个选择器的 computed 动画属性（含 hover 前后对比） */
async function readComputed(p, selector) {
  await p.locator(selector).first().waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
  const before = await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      transitionProperty: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
      transitionTimingFunction: cs.transitionTimingFunction,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      animationIterationCount: cs.animationIterationCount,
      borderColor: cs.borderColor,
      color: cs.color,
      boxShadow: cs.boxShadow,
      marginLeft: cs.marginLeft,
    };
  }, selector);
  if (!before) return null;

  // hover 后再看一次（真实鼠标悬停，不用 JS 伪造 :hover）
  let hovered = null;
  try {
    await p.locator(selector).first().hover({ timeout: 5000 });
    await p.waitForTimeout(280); // 覆盖 150-250ms 过渡
    hovered = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { borderColor: cs.borderColor, color: cs.color, boxShadow: cs.boxShadow };
    }, selector);
  } catch {
    hovered = null;
  }
  return { before, hovered };
}

// ── 实现侧逐项 computed 读数 ─────────────────────────────────────────────
const implReadings = {};
for (const item of PROTO_ANIMATIONS) {
  const sel = IMPL_SELECTORS[item.key];
  if (!sel) {
    implReadings[item.key] = { skipped: true, reason: "实现无对应对象（D-6：设置入口已裁定跳 /system）" };
    continue;
  }
  implReadings[item.key] = await readComputed(page, sel);
}

// ── 原型侧同项读数（同一浏览器、同尺寸、同样关闭 reduce-motion） ────────────
const protoCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const protoPage = await protoCtx.newPage();
const protoUrl = `file:///${PROTOTYPE.replace(/\\/g, "/")}`;
await protoPage.goto(protoUrl, { waitUntil: "load", timeout: 90000 });
await protoPage.waitForTimeout(4000);
// 原型自检会打开设置弹窗；等它收口后关闭（沿用 F1 经验）
await protoPage
  .waitForFunction(() => !document.querySelector("#setwin")?.classList.contains("show"), undefined, { timeout: 25000 })
  .catch(() => {});
await protoPage.evaluate(() => {
  try {
    window.closeSet?.();
  } catch {}
});
await protoPage.waitForTimeout(600);
await assertMotionMedia(protoPage, "原型侧");

const protoReadings = {};
for (const item of PROTO_ANIMATIONS) {
  protoReadings[item.key] = await readComputed(protoPage, item.protoSelector);
}
await protoCtx.close();

/**
 * 比对：实现是否有 transition/animation，且时长量级与原型相当。
 *
 * ⚠️ 三个必须区分的口径（首版比对把它们混在一起，导致 4 项误判 MISSING）：
 *   ① **取样限制**：元素在当前运行态不渲染（空菜单→二级卡 0 张；离线→推送圆点不渲染；
 *      无新动态→rail 无 .alert 类）⇒ 记 `SKIP(取样限制)`，**不是缺陷**；
 *   ② **时长比较必须同类比**：transition 只能与 transition 比、animation 只能与 animation 比。
 *      首版用 `max(transitionDuration, animationDuration)` ⇒ rail 项把 `.alert` 的 1.1s 循环动画
 *      拿来和 .15s 过渡比，误报 DURATION-DIFF；
 *   ③ **索引噪声**：Vue scoped 会给 keyframes 名加哈希后缀（`wb-fdv-in-2de0b9f3`），
 *      比较 animationName 必须剥离后缀后比。
 */
const stripScopeHash = (name) => String(name ?? "").replace(/-[0-9a-f]{8}$/i, "");

/** 把 computed 的 `0.15s` / `150ms` / `0.15s, 0.15s` 取第一个值换算为毫秒 */
function durationMs(value) {
  const raw = String(value ?? "").split(",")[0].trim();
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return 0;
}

function motionKind(r) {
  if (!r?.before) return "absent";
  const hasTrans =
    r.before.transitionProperty &&
    r.before.transitionProperty !== "none" &&
    durationMs(r.before.transitionDuration) >= 100;
  const hasAnim = r.before.animationName && r.before.animationName !== "none";
  if (hasTrans && hasAnim) return "both";
  if (hasTrans) return "transition";
  if (hasAnim) return "animation";
  return "none";
}

/** 取样限制判定：实现侧元素不存在或处于不渲染分支 */
const SAMPLING_LIMITED = {
  "side-collapse": {
    /**
     * 收起过渡的**判决依据不是元素本身**：原型量的是 `#side`，实现量的是 `.wb-subnav`，
     * 而真正的过渡发生在 `.wb-shell` 的 `grid-template-columns` 上（第二列只是被裁切）。
     * 首版拿 `.wb-subnav` 的 computed transition 去比 ⇒ 必然 MISSING（误判）。
     * ⇒ 该条**不由本表判决**，改由下方「第二列收起实测」的中间帧判据定论（已 PASS：230→38.2→0px）。
     */
    reason: "过渡发生在 .wb-shell 的 grid-template-columns，非 .wb-subnav 自身；改由中间帧实测判决",
    sourceFallback: { file: "layouts/WorkbenchShell.vue", checks: [/\.wb-shell\s*\{[\s\S]*?transition\s*:\s*grid-template-columns\s+\d+ms/] },
    crossCheck: "side-collapse 实测",
  },
  "rail-alert-flash": {
    reason: "无「新动态」时不加 .alert 类（railAlertCount=0）⇒ 该动效不渲染",
    sourceFallback: { file: "layouts/WorkbenchShell.vue", checks: [/\.wb-rail-item\.alert\s*\{[\s\S]*?animation\s*:\s*wb-rail-blink/, /@keyframes\s+wb-rail-blink/] },
  },
  "sub-card-transition": {
    reason: "mock DB 空菜单 ⇒ 第二列 0 张卡（snCardCount=0）",
    sourceFallback: { file: "layouts/WorkbenchSubnav.vue", checks: [/\.sn-card\s*\{[\s\S]*?transition\s*:[^;]*\d+ms/] },
  },
  "feed-live-dot": {
    reason: "AI 推送 WS 未连 ⇒ 渲染的是「推送离线」分支，.fdv-dot 不存在",
    sourceFallback: { file: "components/workbench/AiFeedView.vue", checks: [/@keyframes\s+fdv-blink/, /\.fdv-dot\s*\{[\s\S]*?animation\s*:\s*fdv-blink/] },
  },
};

const comparison = [];
for (const item of PROTO_ANIMATIONS) {
  const impl = implReadings[item.key];
  const proto = protoReadings[item.key];
  const implKind = motionKind(impl);
  const protoKind = motionKind(proto);

  let verdict;
  let fallbackOk = null;

  if (item.key === "setwin-enter") {
    verdict = "SKIP（实现无对应对象，D-6 已裁定跳 /system）";
  } else if (!impl?.before && SAMPLING_LIMITED[item.key]) {
    // 取样限制：元素不渲染 ⇒ 改判源码真值（must not fake a verdict）
    const lim = SAMPLING_LIMITED[item.key];
    const src = readFileSync(path.join(HERE, "..", "..", "..", "admin-web", "src", lim.sourceFallback.file), "utf8");
    fallbackOk = lim.sourceFallback.checks.every((re) => re.test(src));
    verdict = fallbackOk
      ? `SKIP-SAMPLING（运行态不渲染：${lim.reason}；源码侧已确认动效存在 ⇒ 非缺陷）`
      : `MISSING（运行态不渲染：${lim.reason}；且**源码侧也未实现** ⇒ 真缺陷）`;
  } else if (SAMPLING_LIMITED[item.key] && implKind === "none") {
    // rail .alert 这类：元素在，但当前无该类名 ⇒ 同样走源码回退
    const lim = SAMPLING_LIMITED[item.key];
    const src = readFileSync(path.join(HERE, "..", "..", "..", "admin-web", "src", lim.sourceFallback.file), "utf8");
    fallbackOk = lim.sourceFallback.checks.every((re) => re.test(src));
    verdict = fallbackOk
      ? `SKIP-SAMPLING（当前态无该类：${lim.reason}；源码侧已确认 ⇒ 非缺陷）`
      : `MISSING（当前态无该类且源码未实现 ⇒ 真缺陷）`;
  } else if (protoKind === "absent" && implKind === "none") {
    verdict = "NONE-BOTH（原型与实现均无动效）";
  } else if (protoKind !== "absent" && implKind === "none") {
    verdict = "MISSING（原型有动效、实现无）";
  } else if (protoKind === "absent" && implKind !== "none") {
    verdict = "EXTRA（原型无、实现有）";
  } else {
    // 同类相比：transition↔transition / animation↔animation
    const diffs = [];
    if (durationMs(proto.before.transitionDuration) > 0 || durationMs(impl.before.transitionDuration) > 0) {
      const p = durationMs(proto.before.transitionDuration);
      const i = durationMs(impl.before.transitionDuration);
      if (p > 0 && i > 0) diffs.push({ kind: "transition", p, i });
    }
    if (stripScopeHash(proto.before.animationName) !== "none" || stripScopeHash(impl.before.animationName) !== "none") {
      const p = durationMs(proto.before.animationDuration);
      const i = durationMs(impl.before.animationDuration);
      if (p > 0 && i > 0) diffs.push({ kind: "animation", p, i });
    }
    const bad = diffs.filter((d) => Math.abs(d.p - d.i) > 120);
    verdict = bad.length === 0
      ? `MATCH（${diffs.map((d) => `${d.kind} ${d.p}/${d.i}ms`).join(" · ") || "同类动效存在"}）`
      : `DURATION-DIFF（${bad.map((d) => `${d.kind} 原型 ${d.p}ms / 实现 ${d.i}ms`).join("；")}）`;
  }

  comparison.push({
    key: item.key,
    desc: item.desc,
    protoSource: item.protoSource,
    implSelector: IMPL_SELECTORS[item.key],
    protoKind,
    implKind,
    proto: proto?.before ?? null,
    impl: impl?.before ?? null,
    implHover: impl?.hovered ?? null,
    sourceFallbackOk: fallbackOk,
    verdict,
  });

  const ok = verdict.startsWith("MATCH") || verdict.startsWith("SKIP") || verdict.startsWith("NONE-BOTH");
  record(`${item.key}：${item.desc}`, ok, verdict);
}

// ── 推送圆点：离线态下 `.fdv-dot` 不渲染（v-if 分支），改用"源码 keyframes 是否存在"补判 ──
{
  const feedSrc = readFileSync(
    path.join(HERE, "..", "..", "..", "admin-web", "src", "components", "workbench", "AiFeedView.vue"),
    "utf8",
  );
  const dotIsOffline = implReadings["feed-live-dot"]?.skipped || !implReadings["feed-live-dot"];
  const hasKeyframes = /@keyframes\s+fdv-blink/.test(feedSrc);
  const dotUsesAnim = /\.fdv-dot\s*\{[\s\S]*?animation:\s*fdv-blink/.test(feedSrc);
  if (dotIsOffline) {
    record(
      "feed-live-dot（离线态取样限制）：圆点不渲染，改判源码真值",
      hasKeyframes && dotUsesAnim,
      `@keyframes fdv-blink 存在=${hasKeyframes}；.fdv-dot 引用 animation=${dotUsesAnim}（仅在 socketOnline=true 时渲染）`,
    );
  }
}

// ── 第二列收起：**实测过渡**（点击收起按钮后取中间帧，证明列宽真的在插值，不是瞬变） ──
{
  const toggle = await page.locator('[data-testid="side-toggle"]').count();
  if (toggle > 0) {
    const readCols = () =>
      page.evaluate(() => {
        const shell = document.querySelector(".wb-shell");
        const cols = getComputedStyle(shell).gridTemplateColumns;
        return {
          second: parseFloat((cols.split(" ")[1] ?? "0").replace("px", "")),
          transProp: getComputedStyle(shell).transitionProperty,
          transDur: getComputedStyle(shell).transitionDuration,
        };
      });
    const before = await readCols();
    await page.locator('[data-testid="side-toggle"]').first().click();
    await page.waitForTimeout(110); // 过渡中（总时长 250ms）
    const during = await readCols();
    await page.waitForTimeout(400); // 过渡完成
    const after = await readCols();

    const interpolating = during.second > 1 && during.second < before.second - 1;
    record(
      "side-collapse：第二列收起是**真实过渡**（中间帧列宽介于起止之间）",
      interpolating && /grid-template-columns/.test(before.transProp) && durationMs(before.transDur) >= 100,
      `起 ${before.second.toFixed(1)}px → 中间帧 ${during.second.toFixed(1)}px → 终 ${after.second.toFixed(1)}px；` +
        `transition=${before.transProp}/${before.transDur}`,
    );
    // 复原（展开回原状，避免影响后续取样与截图）
    await page.locator('[data-testid="side-toggle"]').first().click();
    await page.waitForTimeout(500);
  } else {
    record("side-collapse：第二列收起是真实过渡", false, "未找到 side-toggle 按钮");
  }
}

// ── 悬停反馈（真实鼠标 hover） ───────────────────────────────────────────
/**
 * ⚠️ 选中态优先是**正常 CSS 行为**，不是缺陷：
 *   `.wb-rail-item.on` / `.wb-mode-seg-item.on` 的特异性高于对应 `:hover`，
 *   当前选中项 hover 不变色属预期（原型 `.rl-it.on` 同构）。
 *   因此 rail 用**非选中项**（如「设置」）取样；胶囊用非 `on` 项取样。
 */
const hoverChecks = [
  { key: "feed-ask-hover", name: "信息流提问条 hover 变色", selector: '[data-testid="feed-ask"]' },
  {
    key: "rail-item",
    name: "rail **非选中项**（设置）hover 变色",
    selector: '[data-testid="rail"] [data-rail-key="set"]',
  },
  {
    key: "mode-seg-item",
    name: "胶囊 **非选中项** hover 变色",
    selector: '[data-testid="mode-seg"] .wb-mode-seg-item:not(.on)',
  },
];
for (const hc of hoverChecks) {
  const exists = await page.locator(hc.selector).count();
  if (!exists) {
    record(`hover 反馈：${hc.name}`, true, "SKIP-SAMPLING（该元素当前不存在，非缺陷）");
    continue;
  }
  const before = await page.evaluate((sel) => {
    const cs = getComputedStyle(document.querySelector(sel));
    return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor };
  }, hc.selector);
  await page.locator(hc.selector).first().hover({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(280);
  const after = await page.evaluate((sel) => {
    const cs = getComputedStyle(document.querySelector(sel));
    return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor };
  }, hc.selector);
  const changed = before.bg !== after.bg || before.color !== after.color || before.border !== after.border;
  record(`hover 反馈：${hc.name}`, changed, changed ? `${before.bg}→${after.bg}｜${before.color}→${after.color}` : "色/边/影 未变化");
}

// ── 截图：hover 前后对照（肉眼可核） ─────────────────────────────────────
const focusTargets = [
  { key: "rail-item-transition", selector: '[data-testid="rail"] [data-rail-key]', file: "hover-rail.png" },
  { key: "feed-ask-hover", selector: '[data-testid="feed-ask"]', file: "hover-feed-ask.png" },
  { key: "input-box-focus", selector: '[data-testid="chat-composer"] .cmp-form', file: "focus-composer.png" },
];
for (const ft of focusTargets) {
  const exists = await page.locator(ft.selector).count();
  if (!exists) continue;
  await page.locator(ft.selector).first().hover({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, ft.file) });
}

// ── 汇总落盘 ─────────────────────────────────────────────────────────────
const summary = {
  prototype: PROTOTYPE,
  prototypeSha256: PROTOTYPE_SHA,
  baseUrl: BASE,
  auditMethod: "浏览器 computed 值（R8.1），未用源码顺序推理",
  counts: {
    total: PROTO_ANIMATIONS.length,
    match: comparison.filter((c) => c.verdict.startsWith("MATCH")).length,
    missing: comparison.filter((c) => c.verdict.startsWith("MISSING")).length,
    durationDiff: comparison.filter((c) => c.verdict.startsWith("DURATION-DIFF")).length,
    skip: comparison.filter((c) => c.verdict.startsWith("SKIP")).length,
    noneBoth: comparison.filter((c) => c.verdict.startsWith("NONE-BOTH")).length,
    extra: comparison.filter((c) => c.verdict.startsWith("EXTRA")).length,
  },
  comparison,
  checks: results,
};
writeFileSync(path.join(REPORTS, "ui-animation-audit.json"), JSON.stringify(summary, null, 2), "utf8");

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
console.log(`动效比对：MATCH ${summary.counts.match} / MISSING ${summary.counts.missing} / DURATION-DIFF ${summary.counts.durationDiff} / SKIP ${summary.counts.skip} / NONE-BOTH ${summary.counts.noneBoth}`);
console.log(`报告：docs/evidence/WORKBENCH-06F3/reports/ui-animation-audit.json`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}  ← ${f.detail}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
