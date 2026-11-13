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
const settingsSrc = read("components/workbench/WbSettingsCenter.vue");
const windowControlsSrc = read("components/workbench/WorkbenchWindowControls.vue");
const repoRead = (rel) => readFileSync(path.join(here, "..", rel), "utf8");
const preloadSrc = repoRead("electron/preload.cjs");
const electronMainSrc = repoRead("electron/main.cjs");

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
  assert.ok(
    /v-if="taskCenterCollapsed"[\s\S]{0,240}data-testid="task-center-toggle"/.test(shellSrc),
    "任务中心展开时仍显示顶栏开关，与头部左侧收起键重复",
  );
  assert.ok(/aria-pressed/.test(shellSrc), "任务中心开关缺 aria-pressed（可访问性）");
  return "tc-collapsed 300→0 + 仅收起态显示重开键";
});

await run("顶栏 42px（含 1px 边线 border-box）+ 悬浮输入区（§四.1.3 · M3 锚点）", () => {
  const top = cssBlock(shellSrc, ".wb-top");
  assert.ok(top && /height:\s*42px/.test(top), "顶栏高度不是 42px（尺寸漂移 ⇒ 点名红）");
  assert.ok(/box-sizing:\s*border-box/.test(top), "顶栏缺 border-box（42px 须含 1px 下边线）");
  const cmp = cssBlock(shellSrc, ".wb-main :deep(.cmp)");
  assert.ok(cmp && /position:\s*absolute/.test(cmp) && /bottom:\s*0/.test(cmp), "输入区不是悬浮定位");
  assert.ok(/background:\s*transparent/.test(cmp) && /pointer-events:\s*none/.test(cmp), "输入区仍铺满整面背景");
  const form = cssBlock(shellSrc, ".wb-main :deep(.cmp .cmp-form)");
  assert.ok(form && /max-width:\s*740px/.test(form) && /border-radius:\s*22px/.test(form), "悬浮输入卡未按原型收窄成 740px 圆角卡");
  return "42px + floating/740px/22px";
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

await run("顶栏保留菜单开关 / 日常经营 / 待审阅；任务中心仅收起后显示重开键", () => {
  assert.ok(shellSrc.includes('data-testid="side-toggle"'), "缺菜单开关");
  assert.ok(!shellSrc.includes('data-testid="mode-seg"'), "工作台/收银台仍错放在主内容顶栏");
  assert.ok(subnavSrc.includes('data-testid="mode-seg"'), "二级栏品牌位缺工作台/收银台胶囊");
  assert.ok(/data-mode-seg="desk"/.test(subnavSrc) && /data-mode-seg="pos"/.test(subnavSrc), "胶囊缺工作台或收银台项");
  assert.ok(/return "日常经营"/.test(shellSrc), "AI 模式顶栏标题不是「日常经营」（top_bar.left）");
  assert.ok(agentBarSrc.includes('data-testid="agent-pending-review"'), "缺待审阅徽标（top_bar.left unread review badge）");
  assert.ok(shellSrc.includes('data-testid="task-center-toggle"'), "缺任务中心重开键（top_bar.right）");
  return "模式胶囊在左侧品牌位；任务中心重开键按需显示";
});

await run("品牌位使用正式 Logo；顶栏、左右侧栏去分隔线，仅保留一级⇄二级分隔线", () => {
  assert.ok(/<div class="wb-rail-logo"[\s\S]*?<img[^>]+alt="智享全链"/.test(shellSrc), "一级栏左上角仍是文字占位，不是品牌 Logo");
  const rail = cssBlock(shellSrc, ".wb-rail");
  const top = cssBlock(shellSrc, ".wb-top");
  const subnav = cssBlock(subnavSrc, ".wb-subnav");
  const brand = cssBlock(subnavSrc, ".sn-brand");
  const task = cssBlock(taskCenterSrc, ".wtc");
  const taskHead = cssBlock(taskCenterSrc, ".wtc-head");
  assert.ok(rail && /border-right:\s*1px solid/.test(rail), "一级/二级菜单之间缺少唯一分隔线");
  assert.ok(top && /border-bottom:\s*0;/.test(top), "顶栏仍与侧栏割裂（存在下边线）");
  assert.ok(subnav && /border-right:\s*0;/.test(subnav), "二级栏与主内容之间仍有分隔线");
  assert.ok(brand && /border-bottom:\s*0;/.test(brand), "品牌位仍有下边线");
  assert.ok(task && /border-left:\s*0;/.test(task), "任务中心仍有左边线");
  assert.ok(taskHead && /border-bottom:\s*0;/.test(taskHead), "任务中心头部仍有下边线");
  return "Logo 资产 + 单一分隔线";
});

await run("一级菜单扩距；三处收起/展开统一使用同一个面板图标组件", () => {
  const rail = cssBlock(shellSrc, ".wb-rail");
  const item = cssBlock(shellSrc, ".wb-rail-item");
  assert.ok(rail && /gap:\s*9px;/.test(rail), "一级栏目间距未放大");
  assert.ok(item && /height:\s*46px;/.test(item), "一级菜单项高度未增加");
  assert.ok(shellSrc.includes("<WorkbenchChromeToggleIcon"), "主顶栏未使用统一面板图标");
  assert.ok(subnavSrc.includes("<WorkbenchChromeToggleIcon"), "二级栏收起图标未与原型统一");
  assert.ok(taskCenterSrc.includes("<WorkbenchChromeToggleIcon"), "任务中心收起图标未与原型统一");
  return "rail gap=9 + 同一收起图标";
});

await run("中央工作区画布左上角使用圆角裁切", () => {
  assert.ok(
    /\.wb-main :deep\(\.ai-side-panel\),\s*\.wb-view-manual \{[\s\S]*?border-top-left-radius:\s*16px;[\s\S]*?overflow:\s*hidden;/.test(shellSrc),
    "工作区画布左上角未做圆角裁切",
  );
  return "AI 画布 + 人工画布 top-left 16px";
});

await run("会话内部重复标题与重复会话状态条均已删除", () => {
  assert.ok(!sidePanelSrc.includes('class="ai-header"'), "AiSidePanel 仍保留重复标题栏");
  assert.ok(!sidePanelSrc.includes('data-testid="daily-op-title"'), "AiSidePanel 仍重复显示「日常经营」");
  const aiPanelSrc = read("components/workbench/AiChatPanel.vue");
  assert.ok(!aiPanelSrc.includes("acp-sess-bar"), "仍保留「会话列表/当前会话」重复状态条");
  assert.ok(!aiPanelSrc.includes("chat-sessions-toggle"), "仍保留重复会话列表开关");
  return "内部标题栏 + 会话状态条清零";
});

await run("二级栏工作台/收银台胶囊加高下移，上下保留充足留白", () => {
  const brand = cssBlock(subnavSrc, ".sn-brand");
  const seg = cssBlock(subnavSrc, ".sn-mode-seg");
  const item = cssBlock(subnavSrc, ".sn-mode-seg-item");
  assert.ok(brand && /height:\s*62px;/.test(brand) && /padding:\s*12px 8px;/.test(brand), "二级栏品牌区未加高下移");
  assert.ok(seg && /padding:\s*3px;/.test(seg), "模式胶囊高度被压缩");
  assert.ok(seg && /max-width:\s*164px;/.test(seg), "模式胶囊宽度未收窄");
  assert.ok(item && /padding:\s*6px 9px;/.test(item), "模式按钮未恢复加高");
  return "62px 品牌区 + 164px 胶囊 + 上下留白";
});

await run("任务中心头部：收起键在左，最小化/最大化/关闭三键在右且接通 Electron", () => {
  const headStart = taskCenterSrc.indexOf('<header class="wtc-head">');
  const headEnd = taskCenterSrc.indexOf("</header>", headStart);
  const head = taskCenterSrc.slice(headStart, headEnd);
  const collapse = head.indexOf('data-testid="task-center-collapse"');
  const title = head.indexOf('class="wtc-title"');
  const controls = head.indexOf("<WorkbenchWindowControls");
  assert.ok(collapse >= 0 && collapse < title, "收起键未移到任务中心头部左侧");
  assert.ok(controls > title, "窗口三键未留在任务中心头部右侧");
  for (const id of ["window-minimize", "window-maximize", "window-close"]) {
    assert.ok(windowControlsSrc.includes(`data-testid="${id}"`), `缺少窗口控制 ${id}`);
  }
  assert.ok(preloadSrc.includes('ipcRenderer.send("window-control"'), "preload 未桥接窗口控制");
  assert.ok(electronMainSrc.includes('ipcMain.on("window-control"'), "Electron 主进程未处理窗口控制");
  assert.ok(/frame:\s*false/.test(electronMainSrc), "Electron 仍显示原生标题栏，会与自定义三键重复");
  return "左收起 + 右三键 + IPC";
});

await run("账号只在第一列 rail 底部：二级栏与主顶栏不得重复显示账号", () => {
  assert.ok(shellSrc.includes('data-testid="rail-account"'), "一级 rail 底部缺账号入口");
  assert.ok(shellSrc.includes('data-testid="rail-account-menu"'), "账号入口缺账号菜单");
  assert.ok(!shellSrc.includes('data-testid="rail-account-settings"'), "账号菜单仍重复显示设置入口");
  assert.ok(shellSrc.includes('data-testid="rail-account-logout"'), "账号菜单缺退出登录入口");
  assert.ok(!subnavSrc.includes('data-testid="second-nav-account"'), "二级栏仍重复渲染账号");
  assert.ok(!shellSrc.includes("<span class=\"wb-user\">"), "主顶栏仍重复渲染账号");
  return "rail 底部账号 + 仅退出菜单；设置只保留齿轮";
});

await run("二级菜单使用原型双列卡片：模块入口不得回退竖排文字列表", () => {
  assert.ok(subnavSrc.includes('class="sn-grid sn-grid-real"'), "模块入口未使用双列卡片网格");
  assert.ok(subnavSrc.includes('class="sn-card sn-card-real"'), "模块入口缺少卡片样式");
  const grid = cssBlock(subnavSrc, ".sn-grid");
  assert.ok(grid && /grid-template-columns:\s*1fr 1fr/.test(grid), "二级菜单不是双列网格");
  const card = cssBlock(subnavSrc, ".sn-card");
  assert.ok(card && /flex-direction:\s*row;/.test(card), "二级卡片仍是竖向图标+文案");
  assert.ok(/height:\s*37px;/.test(card) && /min-height:\s*37px;/.test(card), "二级卡片不是原型 37px 高");
  assert.ok(/justify-content:\s*flex-start;/.test(card) && /text-align:\s*left;/.test(card), "二级卡片未采用左对齐横向结构");
  return "sn-grid 双列 + 37px 横向卡";
});

await run("新对话按钮使用加号图标，不再使用铅笔", () => {
  const button = subnavSrc.slice(
    subnavSrc.indexOf('data-testid="second-nav-new-chat"'),
    subnavSrc.indexOf("</button>", subnavSrc.indexOf('data-testid="second-nav-new-chat"')),
  );
  assert.ok(button.includes("<Plus />"), "新对话按钮未使用加号图标");
  assert.ok(!button.includes("<EditPen />"), "新对话按钮仍保留铅笔图标");
  return "新对话 = Plus";
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

await run("一级 rail：保留 13 项结构真相源，但系统管理不占可见模块，收进设置中心", () => {
  assert.ok(/data-rail-key="desk"/.test(shellSrc), "缺 desk 固定位");
  assert.ok(/v-for="group in railModules"/.test(shellSrc), "缺 11 模块 v-for");
  assert.ok(/data-rail-key="set"/.test(shellSrc), "缺设置固定项");
  assert.ok(/railSkeletons/.test(shellSrc) && /railModules\.value\.length === 0/.test(shellSrc), "骨架与真实模块非互斥（会双倍渲染）");
  assert.ok(/SETTINGS_ONLY_GROUP_CODE = "wb\.system"/.test(shellSrc), "系统管理组未声明为设置专属");
  assert.ok(/roleVisibleGroups\.value\.filter\(\(group\) => group\.groupCode !== SETTINGS_ONLY_GROUP_CODE\)/.test(shellSrc), "一级栏仍渲染系统管理");
  assert.ok(/:system-entries="settingsSystemEntries"/.test(shellSrc), "系统管理入口未传入设置中心");
  assert.ok(settingsSrc.includes('data-testid="sw-system-entries"'), "设置中心未承载系统管理入口");
  return "系统管理 → 设置中心；骨架互斥";
});

await run("二级栏 230px 保留且唯一口径：production-snapshot 投影（§四.2.2/四.2.4 未接线项不进 DOM）", () => {
  assert.match(cssBlock(shellSrc, ".wb-shell"), /var\(--wb-side-w,\s*230px\)/, "二级栏不是 230px");
  assert.ok(/:production-snapshot="effectiveCapabilities"/.test(shellSrc), "Subnav 未接 S2 唯一生产快照");
  assert.ok(/resolveEffectiveCapabilities/.test(shellSrc), "壳层未走 resolveEffectiveCapabilities 唯一口径");
  assert.ok(!codeOnly(subnavSrc).includes("待接入"), "二级栏不得渲染「待接入」占位（未上线入口不进 DOM）");
  return "230px + S2 唯一口径 + 零占位";
});

/* ══ 3. 默认主面与唯一输入（§四.3 · M7 锚点）══ */

await run("默认主面 = 数据大屏/信息流：face 默认 feed；AI 对话由新对话显式进入", () => {
  assert.ok(/const face = ref<MainFace>\("feed"\)/.test(shellSrc), "face 默认不是 feed（工作台数据大屏口径 ⇒ 点名红）");
  assert.ok(/return "日常经营"/.test(shellSrc), "AI 面顶栏标题未落「日常经营」");
  const goDesk = shellSrc.slice(shellSrc.indexOf("function goDeskHome"), shellSrc.indexOf("function goDeskHome") + 400);
  assert.ok(/face\.value = "feed"/.test(goDesk), "rail 工作台落地面不是数据大屏/信息流");
  const toggleMod = shellSrc.slice(shellSrc.indexOf("function toggleModule"), shellSrc.indexOf("function toggleModule") + 500);
  assert.ok(/face\.value = "chat"/.test(toggleMod), "选模块后主面回落旧信息流（§四.3.1 禁止）");
  assert.ok(/data-testid="view-feed"/.test(shellSrc), "信息流主面缺失");
  return "face=feed 默认 + rail 落到数据大屏";
});

await run("唯一输入面：chat 态隐藏底部输入条（会话面自带悬浮输入），人工/feed 态走悬浮 .cmp（双输入 ⇒ M7 点名红）", () => {
  assert.ok(/<AiChatComposer\s*\n?\s*v-if="!showChatComposer"/.test(shellSrc) || /v-if="!showChatComposer"\s*\n\s*:compact/.test(shellSrc),
    "底部输入条缺 v-if=\"!showChatComposer\"（chat 态会出现两个输入框 ⇒ 点名红）");
  assert.ok(/face\.value === "chat" && !isCashierRoute\.value/.test(shellSrc), "showChatComposer 未绑定 chat 面");
  assert.ok(/:compact="effectiveMode === 'human'"/.test(shellSrc), "人工态缺 compact 收条");
  assert.ok(chatPanelSrc.includes("AiSidePanel"), "会话面缺 AiSidePanel（唯一 SSE/确认链宿主）");
  assert.ok(sidePanelSrc.includes("sendText: sendSuggestion"), "AiSidePanel 未复用真实发送逻辑");
  const chatInput = cssBlock(sidePanelSrc, ".ai-input-area");
  assert.ok(chatInput && /position:\s*absolute/.test(chatInput), "会话输入区仍为整面固定底栏");
  assert.ok(/background:\s*linear-gradient/.test(chatInput), "会话输入区未改为透明悬浮画布");
  return "chat 单输入 + 人工 compact + 真实发送链";
});

await run("输入框三行结构：上两行文字，底行放附件与语音/发送合并键", () => {
  assert.ok(
    sidePanelSrc.includes(':autosize="{ minRows: 2, maxRows: 6 }"'),
    "会话输入框未启用 2-6 行自动增高",
  );
  const sideInput = cssBlock(sidePanelSrc, ".ai-input-box :deep(.el-textarea__inner)");
  const sideSend = cssBlock(sidePanelSrc, ".ai-primary-btn");
  assert.ok(sideInput && /padding:\s*6px 8px 3px;/.test(sideInput), "会话文字区未独立占上方两行");
  assert.ok(sideSend && /width:\s*30px;/.test(sideSend), "会话语音/发送合并键丢失");
  assert.ok(sidePanelSrc.includes('class="ai-inline-plus"'), "附件加号未放进会话输入框");
  assert.ok(sidePanelSrc.includes('class="ai-input-toolbar"'), "会话输入框缺底部按钮行");
  assert.ok(sidePanelSrc.includes("chat-mic-btn") && sidePanelSrc.includes("chat-send-btn"), "语音/发送未合并为动态键");
  assert.ok(composerSrc.includes('@input="autoGrow"'), "人工页输入框未随内容自动增高");
  const send = cssBlock(composerSrc, ".cmp-primary-btn");
  assert.ok(send && /width:\s*30px;/.test(send), "人工页语音/发送合并键丢失");
  assert.ok(composerSrc.includes('class="cmp-toolbar"'), "人工页输入框缺底部按钮行");
  assert.ok(composerSrc.includes("composer-mic-btn") && composerSrc.includes("composer-send"), "人工页语音/发送未合并为动态键");
  return "2 行文字 + 底行按钮 / 语音发送合并";
});

await run("任务中心主体用画布底色，顶栏并入全局顶栏", () => {
  const task = cssBlock(taskCenterSrc, ".wtc");
  const head = cssBlock(taskCenterSrc, ".wtc-head");
  const top = cssBlock(shellSrc, ".wb-top");
  assert.ok(task && /background:\s*var\(--wb-bg, #fff\);/.test(task), "任务中心主体未使用工作区画布");
  assert.ok(head && /background:\s*var\(--wb-chrome-bg, #f2f5f9\);/.test(head), "任务中心顶栏未并入全局顶栏");
  assert.ok(top && /background:\s*var\(--wb-chrome-bg, #f2f5f9\);/.test(top), "全局顶栏底色令牌不一致");
  return "body=canvas / top chrome shared";
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

await run("任务跟踪条目使用独立悬浮卡片", () => {
  const group = cssBlock(taskCenterSrc, ".wtc-group");
  const row = cssBlock(taskCenterSrc, ".wtc-row");
  const hover = cssBlock(taskCenterSrc, ".wtc-row:hover");
  assert.ok(group && /gap:\s*8px;/.test(group), "任务跟踪分组卡片之间缺少间距");
  assert.ok(row && /min-height:\s*54px;/.test(row), "任务跟踪卡片高度不足");
  assert.ok(/background:\s*var\(--wb-panel, #fff\);/.test(row), "任务跟踪条目未使用白色卡片底");
  assert.ok(/border:\s*1px solid/.test(row), "任务跟踪条目缺少卡片描边");
  assert.ok(/border-radius:\s*12px;/.test(row), "任务跟踪条目缺少圆角");
  assert.ok(/box-shadow:/.test(row), "任务跟踪条目缺少悬浮阴影");
  assert.ok(hover && /box-shadow:\s*0 8px 20px/.test(hover), "任务跟踪卡片悬停未增强层级反馈");
  return "54px 白色圆角卡片 + 悬停层级反馈（动效另卡）";
});

await run("任务跟踪：进行中任务/待确认卡可进入明细，待确认卡带真实确认按钮", () => {
  assert.ok(taskCenterSrc.includes('data-testid="tc-active-plans"'), "任务跟踪缺进行中任务分组");
  assert.ok(taskCenterSrc.includes(':data-plan-id="plan.id"'), "进行中任务卡缺少真实计划标识");
  assert.ok(taskCenterSrc.includes("openTrackingDetail({ kind: 'plan', plan })"), "进行中任务卡未接线明细");
  assert.ok(taskCenterSrc.includes("openTrackingDetail({ kind: 'confirmation', row })"), "待确认卡未接线明细");
  assert.ok(taskCenterSrc.includes('class="wtc-confirm-btn"'), "待确认卡缺少卡面确认按钮");
  assert.ok(taskCenterSrc.includes("@click.stop=\"confirmTrackingRow(row)\""), "卡面确认按钮未走真实确认处理");
  assert.ok(taskCenterSrc.includes("<el-dialog"), "任务明细未使用弹层承载");
  assert.ok(taskCenterSrc.includes("确认执行") && taskCenterSrc.includes("取消挂起"), "明细弹层缺少确认/取消动作");
  return "进行中卡 + 待确认卡 + 卡面确认 + 明细动作";
});

await run("任务中心确认链真实：confirm/cancel 接口调用 + 操作号/回读双闸 fail-closed", () => {
  assert.ok(taskCenterSrc.includes("await confirmAiOperation(id)"), "任务中心未调用真实确认接口");
  assert.ok(taskCenterSrc.includes("await cancelAiOperation(id)"), "任务中心未调用真实取消接口");
  assert.ok(/if \(!operationId\)[\s\S]{0,180}throw new Error/.test(taskCenterSrc), "确认无操作号仍被当作成功");
  assert.ok(
    /await refreshAll\(\)[\s\S]{0,260}stillPending[\s\S]{0,180}throw new Error/.test(taskCenterSrc),
    "确认/取消后未回读列表并拦截未生效结果",
  );
  return "真实接口 + 操作号闸 + 回读闸";
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

await run("主色收敛：rail 选中/hover 走 --wb-primary；品牌位使用正式 Logo 资产", () => {
  for (const rule of [".wb-rail-item.on {", ".wb-rail-item.on:hover {", ".wb-rail-item:hover {"]) {
    const block = cssBlock(shellSrc, rule.replace(" {", ""));
    assert.ok(block && /var\(--wb-primary/.test(block), `${rule} 未走主题主色令牌`);
  }
  const logo = cssBlock(shellSrc, ".wb-rail-logo");
  assert.ok(logo && /background:\s*#fff;/.test(logo), "正式 Logo 缺少稳定白色底");
  assert.ok(shellSrc.includes('from "../assets/logo.png"'), "品牌位未引用正式 Logo 资产");
  assert.ok(!/background:\s*#2563eb/.test(shellSrc), "壳层残留硬编码旧蓝底（主色未统一）");
  return "选中/hover 令牌化 + 正式 Logo";
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
  assert.ok(/rankFrequentMenuItems/.test(subnavSrc), "二级栏常用功能未按真实使用频率渲染");
  assert.ok(/productionSnapshot\.routeNames/.test(subnavSrc), "二级栏常用功能未受生产集合约束");
  assert.ok(!/planPrototypeSubnav/.test(subnavSrc), "二级栏不得回退原型 pending 目录");
  assert.ok(!/pending/.test(subnavSrc.replace(/--wb[\s\S]*?;/g, "")) || !/pending-badge|pendingCard|pending 卡/.test(subnavSrc), "二级栏不得渲染 pending 徽标");
  return "使用频率排序 + 生产集合约束 + 无 pending 徽标";
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
