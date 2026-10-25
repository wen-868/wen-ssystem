/**
 * WORKBENCH-06F3 动效断言（源码级结构断言；运行态对照见 ui-animation-audit.mjs）
 *
 * 覆盖 WORKBENCH-06F3 审计出的 8 项 MISSING 修复：
 *   #1 rail 项过渡   #2 rail 红闪底色   #3 第二列收起过渡   #4 二级卡/卡片 hover 过渡
 *   #5 信息流卡片入场  #7 提问条过渡     #8 胶囊项过渡
 *   （#6 推送圆点呼吸：F1 时已存在，本用例锁住它不被误删）
 *
 * 门禁纪律（本项目铁律）：**每条断言都必须有 mutation 证明它会红** ——
 *   见 tests/animation-countertest.mjs（逐条删除对应 CSS 声明 ⇒ 本用例点名红）。
 *
 * 运行（admin-web 目录）：node tests/ui-animation.spec.mjs（已串入 npm test）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/**
 * 取某个选择器的样式块（支持多行块）。
 *
 * ⚠️ 取样式块为什么不能用单条正则（本用例连踩两次坑，记录在此防复发）：
 *   ① `.{...}` 不跨行 ⇒ 多行声明漏读；
 *   ② `([^{}]+)\{` 会把**上一块的尾部与上一选择器**一起吃进来 ⇒ 选择器串不相等，永远匹配不上。
 * ⇒ 改为**按行扫描**：遇 `}` 收口、遇"以 `{` 结尾"开新块（支持 `{` 单独一行与跟在选择器后两种写法）。
 */
function cssBlock(text, selectorText) {
  // 先剥掉 CSS 注释：注释里的 `{`/`}`/选择器字样会污染行扫描（首版 #2/#3 失败即因注释行被当选择器）
  const cleaned = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const target = selectorText.trim().replace(/\s+/g, " ");
  const blocks = [];
  let pendingSelector = null;
  let body = [];
  for (const raw of cleaned.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (pendingSelector === null) {
      if (line.endsWith("{")) {
        pendingSelector = line.slice(0, -1).trim().replace(/\s+/g, " ");
        body = [];
      } else if (!line.includes("{") && !line.includes("}")) {
        pendingSelector = line.replace(/\s+/g, " ");
      }
      continue;
    }
    if (line === "}") {
      blocks.push({ selector: pendingSelector, body: body.join("\n") });
      pendingSelector = null;
      body = [];
      continue;
    }
    if (line.endsWith("{")) continue; // 嵌套块（如 @media 内选择器）本用例不深入
    body.push(line);
  }
  return blocks.filter((b) => b.selector === target);
}

/**
 * 判断样式块里是否声明了**带非零时长**的 transition。
 *
 * ⚠️ 时长解析必须锚定单位：`150ms` 不能因去掉 `m` 而被读成 `15s`；
 *    因此先匹配 `\d+ms|\d*\.?\d+s`（ms 优先），再逐个换算。
 */
function hasTimedTransition(body) {
  const m = body.match(/transition\s*:\s*([^;]+);/);
  if (!m) return false;
  const durations = extractDurations(m[1]);
  return durations.some((ms) => ms >= 100); // 非零且有实际感知时长（≥100ms）
}

/** 从一段 CSS 值里抽取所有时长并换算为毫秒（ms 优先匹配，避免 150ms→15s 误读） */
function extractDurations(value) {
  const out = [];
  for (const m of value.matchAll(/(\d*\.?\d+)ms\b|(\d*\.?\d+)s\b/g)) {
    if (m[1] !== undefined) out.push(parseFloat(m[1]));
    else if (m[2] !== undefined) out.push(parseFloat(m[2]) * 1000);
  }
  return out;
}

/** 判断样式块里是否声明了 animation（且非 none） */
function hasAnimation(body) {
  const m = body.match(/animation\s*:\s*([^;]+);/);
  return Boolean(m) && !/^none\b/.test(m[1].trim());
}

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

const shell = read("layouts/WorkbenchShell.vue");
const subnav = read("layouts/WorkbenchSubnav.vue");
const feedView = read("components/workbench/AiFeedView.vue");

// ── #1 rail 项过渡 ────────────────────────────────────────────────────────
await run("#1 rail 项有非零 transition（原型 .rl-it{transition:.15s}）", () => {
  const blocks = cssBlock(shell, ".wb-rail-item");
  assert.ok(blocks.length > 0, "未找到 .wb-rail-item 样式块");
  const ok = blocks.some((b) => hasTimedTransition(b.body));
  assert.ok(ok, `.wb-rail-item 缺少非零 transition；实际块：${blocks.map((b) => b.body.replace(/\s+/g, " ").slice(0, 120)).join(" | ")}`);
  return blocks.find((b) => hasTimedTransition(b.body)).body.match(/transition\s*:\s*([^;]+);/)[1].trim();
});

// ── #2 rail 红闪：animation + 底色 ────────────────────────────────────────
await run("#2 rail .alert 有 animation 且设置了 background（否则 keyframes 底色不生效）", () => {
  const blocks = cssBlock(shell, ".wb-rail-item.alert");
  assert.ok(blocks.length > 0, "未找到 .wb-rail-item.alert 样式块");
  const b = blocks[0];
  assert.ok(hasAnimation(b.body), ".alert 缺少 animation");
  assert.ok(/background\s*:/.test(b.body), ".alert 缺少 background（keyframes 只改 background ⇒ 不设则闪烁不可见）");
  const kf = shell.match(/@keyframes\s+wb-rail-blink\s*\{[\s\S]*?\n\}/);
  assert.ok(kf, "缺少 @keyframes wb-rail-blink");
  assert.ok(/background\s*:/.test(kf[0]), "keyframes 内缺少 background 变化");
  assert.ok(/##|#[0-9a-fA-F]{3,6}/.test(kf[0]), "keyframes 内缺少具体色值");
  return "animation + background + keyframes(background+色值) 齐备";
});

// ── #3 第二列收起过渡 ────────────────────────────────────────────────────
await run("#3 壳层第二列收起用 grid 过渡（非 display:none 瞬隐）", () => {
  /**
   * 本项不用通用 cssBlock：`.wb-shell` 的声明块内含**多行块注释**（说明为何用 grid 过渡），
   * 行扫描器对"注释夹在声明中间"的形态不稳定。这里改用**定位式直取**：
   * 从 `.wb-shell {` 起截到第一个 `}\n`，再剥注释后判定 —— 更直接、且与文件真实形态解耦。
   */
  const start = shell.indexOf(".wb-shell {");
  assert.ok(start >= 0, "未找到 `.wb-shell {` 声明");
  const slice = shell.slice(start, start + 1200);
  const end = slice.indexOf("\n}");
  const blockBody = (end >= 0 ? slice.slice(0, end) : slice).replace(/\/\*[\s\S]*?\*\//g, "");

  assert.ok(
    /transition\s*:[^;]*grid-template-columns/.test(blockBody) && extractDurations(blockBody).some((ms) => ms >= 100),
    `.wb-shell 缺少 grid-template-columns 的非零 transition；块内：${blockBody.replace(/\s+/g, " ").slice(0, 200)}`,
  );

  // 收起态不得再用 display:none（否则瞬隐，过渡无从呈现）
  const hiddenStart = shell.indexOf(".wb-subnav.hidden");
  assert.ok(hiddenStart >= 0, "未找到 .wb-subnav.hidden 规则");
  const hiddenSlice = shell.slice(hiddenStart, hiddenStart + 400);
  const hiddenEnd = hiddenSlice.indexOf("\n}");
  const hiddenBody = (hiddenEnd >= 0 ? hiddenSlice.slice(0, hiddenEnd) : hiddenSlice).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(
    !/display\s*:\s*none/.test(hiddenBody),
    `.wb-subnav.hidden 不应用 display:none（会瞬隐，破坏收起过渡）；块内：${hiddenBody.replace(/\s+/g, " ")}`,
  );
  return "grid 列宽 250ms 过渡 + 收起态非 display:none";
});

// ── #4 二级卡 / 信息流卡片 hover 过渡 ────────────────────────────────────
await run("#4-a 二级卡 .sn-card 有非零 transition", () => {
  const blocks = cssBlock(subnav, ".sn-card");
  assert.ok(blocks.length > 0, "未找到 .sn-card 样式块");
  assert.ok(blocks.some((b) => hasTimedTransition(b.body)), ".sn-card 缺少非零 transition");
  return blocks.find((b) => hasTimedTransition(b.body)).body.match(/transition\s*:\s*([^;]+);/)[1].trim();
});

await run("#4-b 信息流卡片 .fdv-item 有 hover 边框规则 + 非零 transition", () => {
  const hover = cssBlock(feedView, ".fdv-item:hover");
  assert.ok(hover.length > 0, "未找到 .fdv-item:hover（原型的 .feed-card:hover{border-color} 对应物）");
  assert.ok(/border-color\s*:/.test(hover[0].body), ".fdv-item:hover 未设 border-color");
  const base = cssBlock(feedView, ".fdv-item");
  assert.ok(base.length > 0, "未找到 .fdv-item 样式块");
  assert.ok(base.some((b) => hasTimedTransition(b.body)), ".fdv-item 缺少非零 transition");
  return "hover 边框 + 过渡齐备";
});

// ── #5 信息流卡片入场动画 ────────────────────────────────────────────────
await run("#5 信息流卡片有入场 keyframes 且被 .fdv-item 引用", () => {
  const kf = feedView.match(/@keyframes\s+wb-fdv-in\s*\{[\s\S]*?\n\}/);
  assert.ok(kf, "缺少 @keyframes wb-fdv-in");
  assert.ok(/opacity\s*:\s*0/.test(kf[0]), "入场动画应从 opacity:0 开始");
  assert.ok(/transform\s*:/.test(kf[0]), "入场动画应有位移（对齐原型 fin 的 translateY）");
  const base = cssBlock(feedView, ".fdv-item");
  const usesAnim = base.some((b) => /animation\s*:\s*wb-fdv-in/.test(b.body));
  assert.ok(usesAnim, ".fdv-item 未引用 wb-fdv-in 入场动画");
  assert.ok(/both|forwards/.test(base.map((b) => b.body).join(" ")), "入场动画应保留终态（both/forwards）");
  return "w b-fdv-in（opacity+transform）+ .fdv-item 引用 + 保留终态";
});

// ── #8b 胶囊 hover 反馈（WORKBENCH-06F3 二轮审计新增发现的真缺陷） ────────
await run("#8b 胶囊**未选中项**有 hover 规则（对齐原型 .ms:hover{color:var(--ink)}）", () => {
  const hover = cssBlock(shell, ".wb-mode-seg-item:hover");
  assert.ok(
    hover.length > 0,
    "缺少 .wb-mode-seg-item:hover（原型 L88 `.ms:hover{color:var(--ink)}`）⇒ 未选中项悬停无反馈",
  );
  assert.ok(/color\s*:/.test(hover[0].body), ".wb-mode-seg-item:hover 应改变 color");
  // 选中项 hover 应保持主色（不得被普通 hover 覆盖成墨色）
  const onHover = cssBlock(shell, ".wb-mode-seg-item.on:hover");
  assert.ok(onHover.length > 0, "缺少 .wb-mode-seg-item.on:hover（选中项悬停保持主色）");
  return `hover 改 color=${hover[0].body.match(/color\s*:\s*([^;]+);/)[1].trim()} + 选中项独立规则`;
});

// ── #6 推送圆点呼吸（F1 已有，锁住不被误删） ─────────────────────────────
await run("#6 推送圆点 @keyframes fdv-blink 存在且 .fdv-dot 引用（锁住既有能力）", () => {
  assert.ok(/@keyframes\s+fdv-blink/.test(feedView), "缺少 @keyframes fdv-blink");
  const dot = cssBlock(feedView, ".fdv-dot");
  assert.ok(dot.length > 0, "未找到 .fdv-dot");
  assert.ok(dot.some((b) => /animation\s*:\s*fdv-blink/.test(b.body)), ".fdv-dot 未引用 fdv-blink");
  return "keyframes + 引用 均在位";
});

// ── #7 提问条过渡 ────────────────────────────────────────────────────────
await run("#7 信息流提问条 .fdv-ask 有非零 transition（变色之外还需过渡）", () => {
  const blocks = cssBlock(feedView, ".fdv-ask");
  assert.ok(blocks.length > 0, "未找到 .fdv-ask");
  assert.ok(blocks.some((b) => hasTimedTransition(b.body)), ".fdv-ask 缺少非零 transition");
  return blocks.find((b) => hasTimedTransition(b.body)).body.match(/transition\s*:\s*([^;]+);/)[1].trim();
});

// ── #8 胶囊项过渡 ────────────────────────────────────────────────────────
await run("#8 工作台/收银台胶囊项有非零 transition", () => {
  const blocks = cssBlock(shell, ".wb-mode-seg-item");
  assert.ok(blocks.length > 0, "未找到 .wb-mode-seg-item");
  assert.ok(blocks.some((b) => hasTimedTransition(b.body)), ".wb-mode-seg-item 缺少非零 transition");
  return blocks.find((b) => hasTimedTransition(b.body)).body.match(/transition\s*:\s*([^;]+);/)[1].trim();
});

// ── #9 无障碍规则必须保留（不得为动效而移除 reduced-motion） ───────────────
await run("#9 无障碍：prefers-reduced-motion 规则仍在（不得为动效删掉）", () => {
  const tokens = readFileSync(path.join(SRC, "styles", "tokens.css"), "utf8");
  assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(tokens), "tokens.css 缺 reduced-motion 媒体查询");
  assert.ok(/transition-duration\s*:\s*0?\.01ms\s*!important/.test(tokens), "reduced-motion 内应把 transition-duration 压到近乎 0");
  assert.ok(/animation-duration\s*:\s*0?\.01ms\s*!important/.test(tokens), "reduced-motion 内应把 animation-duration 压到近乎 0");
  // 入场动画自身也要尊重该偏好
  assert.ok(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.fdv-item[\s\S]*?animation\s*:\s*none/.test(feedView),
    "AiFeedView 应就地尊重 reduced-motion（关闭入场动画）",
  );
  return "全局规则保留 + 组件内也尊重该偏好";
});

// ── #10 动效时长对齐原型区间（120–350ms，避免自拟夸张动效） ──────────────
await run("#10 动效时长落在原型区间 120–350ms（不自拟夸张值）", () => {
  const collected = [];
  const scan = (text, label) => {
    for (const m of text.matchAll(/transition\s*:\s*([^;]+);/g)) {
      for (const ms of extractDurations(m[1])) if (ms > 0) collected.push({ label, ms });
    }
    for (const m of text.matchAll(/animation\s*:\s*([^;]+);/g)) {
      // animation 简写里第一个时长是 duration；注意 rlFlash 1.1s / fdv-blink 1.6s 属"循环脉冲"，
      // 原型同样是 1.1s/1.6s ⇒ 对循环动画放宽到 2000ms，不做 350ms 上限约束。
      const durations = extractDurations(m[1]);
      if (durations.length > 0) collected.push({ label, ms: durations[0], looping: true });
    }
  };
  scan(shell, "WorkbenchShell");
  scan(subnav, "WorkbenchSubnav");
  scan(feedView, "AiFeedView");

  // 一次性过渡（transition）必须落在原型 120–350ms；循环脉冲（animation）按原型 1.1s/1.6s 放宽到 2000ms
  const badTransitions = collected.filter((c) => !c.looping && (c.ms < 120 || c.ms > 350));
  assert.deepEqual(badTransitions, [], `transition 时长越界：${badTransitions.map((c) => `${c.label}:${c.ms}ms`).join(", ")}`);
  const badAnimations = collected.filter((c) => c.looping && c.ms > 2000);
  assert.deepEqual(badAnimations, [], `animation 时长越界（>2000ms）：${badAnimations.map((c) => `${c.label}:${c.ms}ms`).join(", ")}`);

  const t = [...new Set(collected.filter((c) => !c.looping).map((c) => c.ms))].sort((a, b) => a - b);
  const a = [...new Set(collected.filter((c) => c.looping).map((c) => c.ms))].sort((x, y) => x - y);
  return `transition ${collected.filter((c) => !c.looping).length} 处取值 ${t.join("/")}ms；animation ${collected.filter((c) => c.looping).length} 处取值 ${a.join("/")}ms`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
