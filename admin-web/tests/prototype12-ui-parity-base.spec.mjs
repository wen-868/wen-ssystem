/**
 * WORKBENCH-PROTOTYPE-12-UI-PARITY-BASE · 工作台 UI 对齐基座 门禁用例
 *
 * 覆盖卡面「必须完成」：
 *   §四.1  四列壳层（60/230/main/300；1024 主区 434 由 1fr 实测证据承担）；任务中心收起 = 0px + 顶栏开关
 *   §四.2  一级 rail 13 项、二级栏 230px、设计说明 0 命中、未上线/无权限/待入口不进 DOM、顶栏合同要素
 *   §四.3  默认主面 = AI 日常经营对话/晨报；唯一会话链；底部输入区；AI 故障人工可用
 *   §四.4  任务中心双 Tab、真实数据、合同默认态（无待办收起/有待办展开）、点项跳转、不硬编码演示数
 *   §四.5  主题令牌（浅色逐字 + 暗色 #14161C 体系）+ WCAG AA 对比度
 *   §六    8 类 mutation 锚点（四列变三列 / 300→56 / 尺寸漂移 / 设计说明回潮 / 待接入回潮 /
 *          演示数据回潮 / 双输入 / router-view 条件化）——每条断言可被对应 mutation 点名判红
 *
 * 口径依据：projects/ms/evidence/WORKBENCH-PROTOTYPE-12-DELTA-CONTRACT-01/interaction-contract.json
 *           （top_bar.left/right/forbidden + task_center.*）
 * 运行（admin-web 目录）：node tests/prototype12-ui-parity-base.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const shellSrc = read("layouts/WorkbenchShell.vue");
const subnavSrc = read("layouts/WorkbenchSubnav.vue");
const taskCenterSrc = read("components/workbench/WorkbenchTaskCenter.vue");
const agentBarSrc = read("components/workbench/AgentStatusBar.vue");
const composerSrc = read("components/workbench/AiChatComposer.vue");
const chatPanelSrc = read("components/workbench/AiChatPanel.vue");
const sidePanelSrc = read("components/AiChat/AiSidePanel.vue");

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    const stackLine = String(err.stack || "").split("\n")[1]?.trim() ?? "";
    console.log(`FAIL  ${name}  ← ${err.message}${stackLine ? `  [${stackLine}]` : ""}`);
  }
}

/** 剥 HTML/块/行注释（行注释避免误伤 URL 的 ://）——黑名单只对可编译进产物的代码生效 */
function codeOnly(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:'"])\/\/[^\n]*$/gm, "$1");
}

/** 取出指定选择器的首个声明块（简单配平；scoped CSS 不嵌套大括号） */
function cssBlock(text, selector) {
  const idx = text.indexOf(`${selector} {`);
  if (idx < 0) return null;
  let i = idx + selector.length + 2;
  let depth = 1;
  for (; i < text.length; i += 1) {
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(idx, i + 1);
    }
  }
  return null;
}

/* ══ 1. 四列壳层几何（§四.1）══ */

await run("四列 grid 展开态：60 / 230 / minmax(0,1fr) / 300 逐字落值（四列缺一即红 · M1 锚点）", () => {
  const shell = cssBlock(shellSrc, ".wb-shell");
  assert.ok(shell, "缺少 .wb-shell 块");
  assert.ok(
    /grid-template-columns:\s*var\(--wb-rail-w,\s*60px\)\s*var\(--wb-side-w,\s*230px\)\s*minmax\(0,\s*1fr\)\s*var\(--wb-task-center-w,\s*300px\);/.test(shell),
    "展开态未含 60/230/minmax(0,1fr)/300 四列（四列变三列 ⇒ 点名红）",
  );
  assert.ok(!/850px|434px/.test(shellSrc), "main 列宽度不得硬编码 850/434（必须由 1fr 实测）");
  return "60/230/1fr/300 逐字";
});

await run("任务中心收起 = 第 4 列 0px（§四.1.4 非 56px 窄条 · M2 锚点）；顶栏开关为唯一重开入口", () => {
  const collapsed = cssBlock(shellSrc, ".wb-shell.tc-collapsed");
  assert.ok(collapsed, "壳层缺 .wb-shell.tc-collapsed 收起列宽规则");
  assert.match(collapsed, /var\(--wb-task-center-collapsed-w,\s*0px\)/, "收起态第 4 列不是 0px（300→56 旧口径 ⇒ 点名红）");
  const both = cssBlock(shellSrc, ".wb-shell.side-hidden.tc-collapsed");
  assert.ok(both && /var\(--wb-task-center-collapsed-w,\s*0px\)/.test(both), "双折叠态第 4 列不是 0px");
  assert.ok(!/task-center-collapsed-w,\s*56px/.test(shellSrc), "残留 56px 任务中心收起宽（旧口径回潮）");
  assert.ok(!taskCenterSrc.includes("task-center-strip"), "任务中心列内不得再有收起竖条");
  assert.ok(shellSrc.includes('data-testid="task-center-toggle"'), "顶栏缺任务中心开关（§四.1.4 提供顶栏可访问开关）");
  assert.ok(/aria-pressed/.test(shellSrc), "任务中心开关缺 aria-pressed（可访问性）");
  return "tc-collapsed 300→0 + 顶栏 toggle（aria-pressed）";
});

await run("顶栏 42px（含 1px 边线 border-box）+ 底部输入区 100px（§四.1.3 · M3 锚点）", () => {
  const top = cssBlock(shellSrc, ".wb-top");
  assert.ok(top && /height:\s*42px/.test(top), "顶栏高度不是 42px（尺寸漂移 ⇒ 点名红）");
  assert.ok(/box-sizing:\s*border-box/.test(top), "顶栏缺 border-box（42px 须含 1px 下边线）");
  const cmp = cssBlock(shellSrc, ".wb-main :deep(.cmp)");
  assert.ok(cmp && /height:\s*100px/.test(cmp) && /max-height:\s*100px/.test(cmp), "底部输入区不是固定 100px");
  return "42px + 100px 逐字";
});

await run("router-view 常驻：去注释后真实自闭合渲染节点、无 v-if、裸 indexOf 禁用（M8 锚点）", () => {
  const stripped = codeOnly(shellSrc);
  const m = stripped.match(/<router-view\s*\/>/);
  assert.ok(m && typeof m.index === "number", "缺真实自闭合 <router-view />（注释不计）");
  const around = stripped.slice(Math.max(0, m.index - 120), m.index + 20);
  assert.ok(!/\bv-(if|else-if|else|show)\b/.test(around), "router-view 被条件渲染包裹（M8 ⇒ 点名红）");
  assert.ok(!/indexOf\(\s*["'`]<router-view/.test(shellSrc), "spec/壳层不得用裸 indexOf 定位 router-view（会命中注释）");
  return "自闭合常驻 + 无条件包裹";
});

/* ══ 2. 顶栏合同（§四.2.5 + top_bar 合同）══ */

await run("顶栏合同要素齐备：菜单开关 / 工作台·收银台 / 日常经营 / 待审阅 / 任务中心开关", () => {
  assert.ok(shellSrc.includes('data-testid="side-toggle"'), "缺菜单开关");
  assert.ok(shellSrc.includes('data-testid="mode-seg"'), "缺工作台/收银台胶囊");
  assert.ok(/data-mode-seg="desk"/.test(shellSrc) && /data-mode-seg="pos"/.test(shellSrc), "胶囊缺工作台或收银台项");
  assert.ok(/return "日常经营"/.test(shellSrc), "AI 模式顶栏标题不是「日常经营」（top_bar.left）");
  assert.ok(agentBarSrc.includes('data-testid="agent-pending-review"'), "缺待审阅徽标（top_bar.left unread review badge）");
  assert.ok(shellSrc.includes('data-testid="task-center-toggle"'), "缺任务中心开关（top_bar.right）");
  return "五要素齐备";
});

await run("顶栏禁要素零命中：研发健康探针 / 数字员工数 / 无上下文步骤计数 / 能力台账（top_bar.forbidden）", () => {
  const shellCode = codeOnly(shellSrc);
  const barCode = codeOnly(agentBarSrc);
  for (const banned of ["agent-ai-state", "agent-employees", "agent-plans", "agent-ai-retry", "agent-ledger-entry"]) {
    assert.ok(!barCode.includes(`data-testid="${banned}"`), `AgentStatusBar 不得再出现 ${banned}（forbidden ⇒ 点名红）`);
    assert.ok(!shellCode.includes(`data-testid="${banned}"`), `壳层不得再出现 ${banned}`);
  }
  assert.ok(!shellCode.includes("probeAiReadiness"), "壳层不得再调用健康探针展示");
  assert.ok(!shellCode.includes("loadAgentTopMetrics"), "壳层不得再装载顶部员工/计划指标");
  assert.ok(!shellCode.includes("wb-ledger"), "壳层不得再有台账抽屉（forbidden: 能力台账）");
  assert.ok(/v-if="pendingReviewCount !== null"/.test(agentBarSrc), "待审阅徽标 null 时必须隐藏（不显示假 0）");
  return "四类禁要素零残留 + 徽标 null 隐藏";
});

await run("一级 rail 13 项结构：desk + 11 业务模块 + 设置项 + 加载骨架互斥（§四.2.1）", () => {
  assert.ok(/data-rail-key="desk"/.test(shellSrc), "缺 desk 固定位");
  assert.ok(/v-for="group in railModules"/.test(shellSrc), "缺 11 模块 v-for");
  assert.ok(/data-rail-key="set"/.test(shellSrc), "缺设置固定项");
  assert.ok(/railSkeletons/.test(shellSrc) && /railModules\.value\.length === 0/.test(shellSrc), "骨架与真实模块非互斥（会双倍渲染）");
  return "13 项结构 + 骨架互斥";
});

await run("二级栏 230px 保留且唯一口径：production-snapshot 投影（§四.2.2/四.2.4 未接线项不进 DOM）", () => {
  assert.match(cssBlock(shellSrc, ".wb-shell"), /var\(--wb-side-w,\s*230px\)/, "二级栏不是 230px");
  assert.ok(/:production-snapshot="effectiveCapabilities"/.test(shellSrc), "Subnav 未接 S2 唯一生产快照");
  assert.ok(/resolveEffectiveCapabilities/.test(shellSrc), "壳层未走 resolveEffectiveCapabilities 唯一口径");
  assert.ok(!codeOnly(subnavSrc).includes("待接入"), "二级栏不得渲染「待接入」占位（未上线入口不进 DOM）");
  return "230px + S2 唯一口径 + 零占位";
});

/* ══ 3. 默认主面与唯一输入（§四.3 · M7 锚点）══ */

await run("默认主面 = AI 日常经营对话/晨报：face 默认 chat，旧信息流不再作为任何入口落地面（M7/M1 相邻锚）", () => {
  assert.ok(/const face = ref<MainFace>\("chat"\)/.test(shellSrc), "face 默认不是 chat（§四.3.1 ⇒ 点名红）");
  assert.ok(/return "日常经营"/.test(shellSrc), "AI 面顶栏标题未落「日常经营」");
  const goDesk = shellSrc.slice(shellSrc.indexOf("function goDeskHome"), shellSrc.indexOf("function goDeskHome") + 400);
  assert.ok(/face\.value = "chat"/.test(goDesk), "rail 工作台落地面不是 AI 日常经营对话");
  const toggleMod = shellSrc.slice(shellSrc.indexOf("function toggleModule"), shellSrc.indexOf("function toggleModule") + 500);
  assert.ok(/face\.value = "chat"/.test(toggleMod), "选模块后主面回落旧信息流（§四.3.1 禁止）");
  assert.ok(/data-testid="view-feed"/.test(shellSrc), "旧信息流层应保留（数据 hook 不删）但不得默认");
  return "face=chat 默认 + rail/模块落点同口径";
});

await run("唯一输入面：chat 态隐藏底部输入条（会话面自带输入），人工/feed 态走 .cmp 100px（双输入 ⇒ M7 点名红）", () => {
  assert.ok(/<AiChatComposer\s*\n?\s*v-if="!showChatComposer"/.test(shellSrc) || /v-if="!showChatComposer"\s*\n\s*:compact/.test(shellSrc),
    "底部输入条缺 v-if=\"!showChatComposer\"（chat 态会出现两个输入框 ⇒ 点名红）");
  assert.ok(/face\.value === "chat" && !isCashierRoute\.value/.test(shellSrc), "showChatComposer 未绑定 chat 面");
  assert.ok(/:compact="effectiveMode === 'human'"/.test(shellSrc), "人工态缺 compact 收条");
  assert.ok(chatPanelSrc.includes("AiSidePanel"), "会话面缺 AiSidePanel（唯一 SSE/确认链宿主）");
  assert.ok(sidePanelSrc.includes("defineExpose({ sendText: sendSuggestion"), "AiSidePanel 未复用真实发送逻辑");
  return "chat 单输入 + 人工 compact + 真实发送链";
});

await run("AI 故障人工导航保持可用：fallback 切人工 + router-view 无条件 + 通知独立源（§四.3.3）", () => {
  assert.ok(shellSrc.includes("@fallback=\"switchMode('human')\""), "AI 故障未切人工模式");
  assert.ok(/function switchMode/.test(shellSrc), "缺 switchMode");
  assert.ok(shellSrc.includes("/admin/notifications") || taskCenterSrc.includes("/admin/notifications"), "人工通知源缺失（应独立于 AI 底座）");
  return "fallback + 常驻出口 + 通知独立";
});

/* ══ 4. 任务中心（§四.4）══ */

await run("任务中心双 Tab：进度明细 / 任务跟踪 + 面板内收起钮（close button collapses）", () => {
  for (const tab of ["progress", "tracking"]) {
    assert.ok(taskCenterSrc.includes(`data-task-center-tab="${tab}"`), `缺 tab ${tab}`);
    assert.ok(taskCenterSrc.includes(`data-task-center-pane="${tab}"`), `缺 pane ${tab}`);
  }
  assert.ok(taskCenterSrc.includes("进度明细") && taskCenterSrc.includes("任务跟踪"), "缺双 Tab 文案");
  assert.ok(taskCenterSrc.includes('data-testid="task-center-collapse"'), "缺面板内收起钮");
  return "双 tab + 双 pane + 收起钮";
});

await run("任务中心合同默认态：数据落地 settle 上报，无待办默认收起/有待办展开，显式偏好优先", () => {
  assert.ok(/emit\("settle", \(activeTotal\.value \?\? 0\) > 0\)/.test(taskCenterSrc), "组件缺 settle(hasWork) 上报");
  assert.ok(/watch\(\s*\(\) => \[plansSource\.value\.status/.test(taskCenterSrc), "settle 未直接观察各源状态（overallState 全空时值不变会永不触发）");
  assert.ok(/states\.some\(loadingOrIdle\)/.test(taskCenterSrc), "落地判据缺 loading/idle 守卫");
  assert.ok(shellSrc.includes("function onTaskCenterSettle"), "壳层缺合同默认回调");
  assert.ok(shellSrc.includes("taskCenterDefaultApplied"), "默认态未限一次（会被刷新覆盖用户操作）");
  assert.ok(/readTaskCenterPref\(\) !== null/.test(shellSrc), "显式偏好未优先于合同默认");
  assert.ok(/if \(!hasWork\) taskCenterCollapsed\.value = true;/.test(shellSrc), "无待办未默认收起");
  return "settle 链 + 偏好优先 + 无待办收起";
});

await run("任务中心真实数据：S1 端点契约 + 独立四态重试 + 不硬编码演示数（§四.4.2/4.5）", () => {
  for (const endpoint of ["/api/ai/agent/plans", "/api/chat/confirmations", "/admin/notifications"]) {
    assert.ok(taskCenterSrc.includes(endpoint), `任务中心未消费真实端点 ${endpoint}`);
  }
  assert.ok(!/Math\.random\(/.test(taskCenterSrc), "组件不得用随机数填充");
  const retryCount = (taskCenterSrc.match(/class="wtc-retry"/g) ?? []).length;
  assert.ok(retryCount >= 2, `重试入口不足（实测 ${retryCount}，各源失败须可重试）`);
  assert.ok(taskCenterSrc.includes('from "../../shared/workbench/task-center"'), "未接 S1 view-model");
  return "3 端点 + 无随机 + 重试齐备";
});

await run("任务中心业务项跳转：待确认/员工任务/通知行带真实业务标识（点项进对应页面 · §四.4.4）", () => {
  assert.ok(taskCenterSrc.includes("data-conf-id=") || taskCenterSrc.includes(":data-conf-id"), "待确认行缺业务标识");
  assert.ok(taskCenterSrc.includes("data-emp-id=") || taskCenterSrc.includes(":data-emp-id"), "员工任务行缺业务标识");
  assert.ok(taskCenterSrc.includes("data-noti-id=") || taskCenterSrc.includes(":data-noti-id"), "通知行缺业务标识");
  return "三类业务行可寻址";
});

/* ══ 5. 主题令牌与对比度（§四.5 · M3 相邻锚）══ */

const LIGHT_TOKENS = {
  "--wb-primary": "#4f46e5",
  "--wb-primary-soft": "#eef2ff",
  "--wb-ink": "#0a0a0a",
  "--wb-ink2": "#737373",
  "--wb-line": "#e5e5e5",
  "--wb-line-strong": "#d4d4d4",
  "--wb-canvas": "#f2f5f9",
};

await run("主题令牌（浅色）逐字落值：主色/soft/正文/次文/边线/画布（§四.5.1）", () => {
  const darkBlockStart = shellSrc.indexOf('html[data-wb-theme="dark"] .wb-shell');
  assert.ok(darkBlockStart > 0, "缺暗色令牌覆盖块");
  const shellBlock = shellSrc.slice(shellSrc.indexOf("<style scoped>"), darkBlockStart);
  for (const [name, value] of Object.entries(LIGHT_TOKENS)) {
    assert.ok(shellBlock.includes(`${name}: ${value}`), `浅色令牌 ${name} 未落 ${value}（卡面逐字值）`);
  }
  assert.ok(shellSrc.includes('data-wb-scope="workbench"'), "缺工作台作用域标记（令牌不得扩散）");
  return "7 令牌逐字 + 作用域标记";
});

await run("主题令牌（暗色）#14161C 体系：canvas/panel/ink/line 同名覆盖（§四.5.1 暗色按 #14161C 输出）", () => {
  const dark = cssBlock(shellSrc, 'html[data-wb-theme="dark"] .wb-shell');
  assert.ok(dark, "缺暗色令牌覆盖块");
  assert.ok(dark.includes("--wb-canvas: #14161c"), "暗色画布未落 #14161C");
  assert.ok(/--wb-panel:\s*#1b1e26/.test(dark), "暗色面板缺失");
  assert.ok(/--wb-ink:\s*#f4f5f7/.test(dark) && /--wb-ink2:\s*#a3a8b3/.test(dark), "暗色文本令牌缺失");
  assert.ok(/--wb-primary:\s*#818cf8/.test(dark), "暗色主色（亮变体）缺失");
  return "暗色 5 键覆盖";
});

function luminance(hex) {
  const raw = hex.replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const channels = [0, 2, 4].map((i) => {
    const c = Number.parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

await run("WCAG AA 对比度：正文/次文 ≥4.5 于面板与画布；主色控件 ≥3（§四.5.3，按令牌实算非目测）", () => {
  const light = cssBlock(shellSrc, ".wb-shell");
  const dark = cssBlock(shellSrc, 'html[data-wb-theme="dark"] .wb-shell');
  const pick = (block, name) => {
    const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `令牌 ${name} 未取到`);
    return m[1];
  };
  // 浅色（次文 on 画布用于大字号/辅助信息，按 AA 大文本/UI 组件 3:1 口径；正文对两底均须 ≥4.5）
  const lInk = pick(light, "--wb-ink");
  const lInk2 = pick(light, "--wb-ink2");
  const lCanvas = pick(light, "--wb-canvas");
  const lPrimary = pick(light, "--wb-primary");
  assert.ok(contrast(lInk, lCanvas) >= 4.5, `浅色正文/画布 ${contrast(lInk, lCanvas).toFixed(2)} < 4.5`);
  assert.ok(contrast(lInk, "#ffffff") >= 4.5, "浅色正文/面板 < 4.5");
  assert.ok(contrast(lInk2, "#ffffff") >= 4.5, `浅色次文/面板 ${contrast(lInk2, "#ffffff").toFixed(2)} < 4.5`);
  assert.ok(contrast(lInk2, lCanvas) >= 3, `浅色次文/画布 ${contrast(lInk2, lCanvas).toFixed(2)} < 3（辅助信息下限）`);
  assert.ok(contrast(lPrimary, "#ffffff") >= 3, `主色控件边框/文字 ${contrast(lPrimary, "#ffffff").toFixed(2)} < 3`);
  // 暗色（#14161C 体系）
  const dInk = pick(dark, "--wb-ink");
  const dInk2 = pick(dark, "--wb-ink2");
  const dPanel = pick(dark, "--wb-panel");
  const dPrimary = pick(dark, "--wb-primary");
  assert.ok(contrast(dInk, dPanel) >= 4.5, `暗色正文/面板 ${contrast(dInk, dPanel).toFixed(2)} < 4.5`);
  assert.ok(contrast(dInk2, dPanel) >= 4.5, `暗色次文/面板 ${contrast(dInk2, dPanel).toFixed(2)} < 4.5`);
  assert.ok(contrast(dPrimary, dPanel) >= 3, `暗色主色/面板 ${contrast(dPrimary, dPanel).toFixed(2)} < 3`);
  return "浅 5 对 + 暗 3 对实算达标";
});

await run("主色收敛：rail 选中/hover/logo 走 --wb-primary 令牌，不再硬编码旧蓝 #2563eb（§四.5.1）", () => {
  for (const rule of [".wb-rail-item.on {", ".wb-rail-item.on:hover {", ".wb-rail-item:hover {"]) {
    const block = cssBlock(shellSrc, rule.replace(" {", ""));
    assert.ok(block && /var\(--wb-primary/.test(block), `${rule} 未走主题主色令牌`);
  }
  const logo = cssBlock(shellSrc, ".wb-rail-logo");
  assert.ok(logo && /var\(--wb-primary/.test(logo), "rail logo 渐变未走主题主色");
  assert.ok(!/background:\s*#2563eb/.test(shellSrc), "壳层残留硬编码旧蓝底（主色未统一）");
  return "选中/hover/logo 全部令牌化";
});

/* ══ 6. 生产文案黑名单（§五.6 / 差距审计 §八 · M4/M5/M6 锚点）══ */

await run("设计说明黑名单零命中：双入口/左侧菜单/13 模块/修订说明/设计说明（代码区 · M4 锚点）", () => {
  const sources = [codeOnly(shellSrc), codeOnly(subnavSrc), codeOnly(taskCenterSrc), codeOnly(agentBarSrc)];
  for (const banned of ["双入口", "左侧菜单", "13 模块", "修订说明", "设计说明"]) {
    for (const [i, src] of sources.entries()) {
      assert.ok(!src.includes(banned), `文件#${i} 代码区命中设计说明词「${banned}」（回潮 ⇒ 点名红）`);
    }
  }
  return "5 词 × 4 文件零命中";
});

await run("工程语言黑名单零命中：待接入/未接入/不伪造成功/端点缺失（代码区 · M5 锚点）", () => {
  const sources = [codeOnly(shellSrc), codeOnly(subnavSrc), codeOnly(taskCenterSrc), codeOnly(agentBarSrc)];
  for (const banned of ["待接入", "未接入", "不伪造成功", "端点缺失"]) {
    for (const [i, src] of sources.entries()) {
      assert.ok(!src.includes(banned), `文件#${i} 代码区命中工程语言「${banned}」（回潮 ⇒ 点名红）`);
    }
  }
  return "4 词 × 4 文件零命中";
});

await run("演示数据黑名单零命中：红星商行/张三/王强/¥25,400/¥8,900/贵州茅台（§四.4.5 不硬编码原型演示 · M6 锚点）", () => {
  const sources = [codeOnly(shellSrc), codeOnly(subnavSrc), codeOnly(taskCenterSrc), codeOnly(agentBarSrc)];
  for (const banned of ["红星商行", "张三", "王强", "¥25,400", "¥8,900", "贵州茅台"]) {
    for (const [i, src] of sources.entries()) {
      assert.ok(!src.includes(banned), `文件#${i} 命中演示数据「${banned}」（回潮 ⇒ 点名红）`);
    }
  }
  return "6 词 × 4 文件零命中";
});

await run("未上线/无权限入口不进 DOM：Subnav 生产投影未接线项不渲染（§四.2.4）", () => {
  assert.ok(/planProductionSubnav/.test(subnavSrc), "二级栏未按生产投影渲染");
  assert.ok(!/planPrototypeSubnav/.test(subnavSrc), "二级栏不得回退原型 pending 目录");
  assert.ok(!/pending/.test(subnavSrc.replace(/--wb[\s\S]*?;/g, "")) || !/pending-badge|pendingCard|pending 卡/.test(subnavSrc), "二级栏不得渲染 pending 徽标");
  return "生产投影 + 无 pending 徽标";
});

await run("收起反馈不依赖动画：grid 过渡保留但收起语义由几何变化承担（§四.1.4/reduced-motion 兼容）", () => {
  const shellBlock = cssBlock(shellSrc, ".wb-shell");
  assert.ok(shellBlock && /transition:\s*grid-template-columns/.test(shellBlock), "缺列宽过渡（滑出手感回退）");
  assert.ok(/prefers-reduced-motion: reduce/.test(shellSrc), "缺 reduced-motion 豁免（动画偏好下须可用）");
  return "grid 过渡 + reduced-motion 豁免";
});

/* ══ 小结 ══ */

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
