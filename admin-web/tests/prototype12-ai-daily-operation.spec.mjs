/**
 * WORKBENCH-PROTOTYPE-12-S4-AI-DAILY-OPERATION-01 · 中央 AI 日常经营面
 *
 * 验收口径（卡 §三/§四）：
 * 1. 主区标题「日常经营」，晨报作为首条会话内容；
 * 2. 默认只有一套输入控件（计数=1）；
 * 3. 复用 /api/chat SSE 与 confirm/cancel/revoke —— 不新造聊天实现；
 * 4. 写操作必须确认，失败可恢复（fault banner → 人工回退），不重复提交；
 * 5. AI 不可用时人工页面和导航可用（router-view 无条件常驻）；
 * 6. 任务/通知数据只通过 S1 view-model（wb-feed-*）接入；
 * 7. 不复制原型人名、订单、金额、客户和开发说明。
 *
 * 运行（admin-web 目录）：node tests/prototype12-ai-daily-operation.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const chatPanel = read("components/workbench/AiChatPanel.vue");
const sidePanel = read("components/AiChat/AiSidePanel.vue");
const feedView = read("components/workbench/AiFeedView.vue");
const composer = read("components/workbench/AiChatComposer.vue");
const shell = read("layouts/WorkbenchShell.vue");

// ── 1. 主区标题「日常经营」 ──────────────────────────────────────────
// S4 标题落点：会话面本体 AiSidePanel（AiChat/ 允许路径内）+ feed 面标题（AiFeedView）
assert.ok(
  sidePanel.includes('data-testid="daily-op-title"') &&
    sidePanel.includes("日常经营"),
  "S4-1 AiSidePanel 缺少「日常经营」会话面标题（daily-op-title）",
);
assert.ok(
  feedView.includes('data-testid="daily-op-title"') &&
    feedView.includes("日常经营"),
  "S4-1 AiFeedView 缺少「日常经营」标题",
);

// ── 2. 晨报作为首条会话内容（真实 SSE 发送，一次性防重复） ──────────
// S4 晨报落点：AiSidePanel 挂载且会话为空时自动发送「今日晨报」（真实 SSE，一次性防重复）
assert.ok(
  sidePanel.includes('"今日晨报"') || sidePanel.includes("'今日晨报'"),
  "S4-2 AiSidePanel 缺少晨报首条发送（今日晨报）",
);
assert.ok(
  sidePanel.includes("briefingSent"),
  "S4-2 晨报自动发送缺少一次性防重复标志（briefingSent）",
);
assert.ok(
  sidePanel.includes("onMounted"),
  "S4-2 晨报自动发送未挂在挂载生命周期（onMounted）",
);
// 晨报必须走既有真实发送链（sendSuggestion → sendMessage → POST /api/chat SSE），不得本地伪造晨报内容
assert.ok(
  sidePanel.includes("sendSuggestion") && sidePanel.includes("sendChatMessage"),
  "S4-2 晨报未复用既有真实发送链",
);
assert.ok(
  !/晨报[^]{0,40}(GMV|环比|退款率|毛利异动)[^]{0,20}%\s*"/.test(sidePanel),
  "S4-2 禁止在面板内本地伪造晨报数据（晨报内容由 AI 真实回复生成）",
);

// ── 3. 默认只有一套输入控件（计数=1） ────────────────────────────────
// 会话主面输入 = AiSidePanel 的唯一文本输入（textarea）；面板内不得再出现第二文本输入。
assert.ok(
  sidePanel.includes('type="textarea"'),
  "S4-3 AiSidePanel 缺少文本输入",
);
assert.equal(
  (sidePanel.match(/type="textarea"/g) || []).length,
  1,
  "S4-3 AiSidePanel 文本输入框数量必须为 1（实测大于 1）",
);
// chat 态 Shell 不渲染底部 composer（v-if="!showChatComposer"）⇒ chat 面唯一输入在 AiSidePanel
assert.ok(
  shell.includes('v-if="!showChatComposer"'),
  "S4-3 Shell 底部 composer 缺少 chat 态隐藏开关（showChatComposer）",
);
// AiChatPanel 自身不得新增输入控件（输入只属于 AiSidePanel 一套）
assert.ok(
  !/<el-input|<input\s/.test(chatPanel),
  "S4-3 AiChatPanel 出现了第二套输入控件（输入必须单源于 AiSidePanel）",
);

// ── 4. 复用 /api/chat SSE 与 confirm/cancel/revoke（不新造聊天实现） ──
assert.ok(
  sidePanel.includes("sendChatMessage"),
  "S4-4 AiSidePanel 未复用 sendChatMessage（/api/chat SSE）",
);
for (const fn of [
  "confirmAiOperation",
  "cancelAiOperation",
  "revokeAiOperation",
]) {
  assert.ok(
    sidePanel.includes(fn),
    `S4-4 AiSidePanel 缺少确认链 ${fn}`,
  );
}
// AiChatPanel 不得自建 fetch/EventSource/SSE（会话实现单源于 AiSidePanel）
assert.ok(
  !/fetch\(|EventSource|new WebSocket/.test(chatPanel),
  "S4-4 AiChatPanel 出现自建网络调用（聊天实现必须单源于 AiSidePanel）",
);

// ── 5. AI 不可用时人工页面和导航可用 ────────────────────────────────
assert.ok(
  chatPanel.includes('data-testid="ai-fault-banner"') &&
    chatPanel.includes("fallback"),
  "S4-5 AiChatPanel 缺少故障横幅与人工回退事件",
);
assert.ok(
  shell.includes("switchMode") && shell.includes("<router-view"),
  "S4-5 Shell 缺少人工回退或 router-view 常驻",
);

// ── 6. 任务/通知数据只通过 S1 view-model 接入 ───────────────────────
for (const vm of [
  "wb-feed-kpi",
  "wb-feed-approvals",
  "wb-feed-broadcast",
  "wb-feed-taskboard",
  "wb-feed-taskflow",
]) {
  assert.ok(
    feedView.includes(`wb-feed-${vm.replace("wb-feed-", "")}`) ||
      feedView.includes(vm),
    `S4-6 AiFeedView 未通过 S1 view-model 接入：${vm}`,
  );
}
for (const vmFile of [
  "wb-feed-approvals",
  "wb-feed-broadcast",
  "wb-feed-taskboard",
  "wb-feed-taskflow",
]) {
  assert.ok(
    read(`shared/workbench/${vmFile}.ts`).includes("export"),
    `S4-6 S1 view-model ${vmFile} 缺少导出`,
  );
}

// ── 7. 不复制原型人名、订单、金额、客户和开发说明 ────────────────────
const PROTOTYPE_LEAKS = ["红星商行", "五粮液", "10箱", "10 箱"];
for (const [name, src] of [
  ["AiChatPanel", chatPanel],
  ["AiSidePanel", sidePanel],
  ["AiFeedView", feedView],
  ["AiChatComposer", composer],
]) {
  for (const leak of PROTOTYPE_LEAKS) {
    assert.ok(
      !src.includes(leak),
      `S4-7 ${name} 含原型演示数据：${leak}`,
    );
  }
}
// 建议芯片（suggestions）不得含人名/客户/金额
const suggestionBlock = sidePanel.match(
  /const suggestions = \[[\s\S]*?\];/,
)?.[0];
assert.ok(suggestionBlock, "S4-7 AiSidePanel 缺少建议芯片定义");
for (const leak of PROTOTYPE_LEAKS) {
  assert.ok(
    !suggestionBlock.includes(leak),
    `S4-7 建议芯片含原型演示数据：${leak}`,
  );
}

// ── 8. unavailable 文案面向生产，不展示工程诊断词 ─────────────────────
const visibleTemplate = feedView
  .match(/<template>([\s\S]*)<\/template>/)?.[1]
  .replace(/<!--[\s\S]*?-->/g, "");
assert.ok(visibleTemplate, "S4-8 AiFeedView 模板不可定位");
const COPY_BLACKLIST = [
  "双入口左侧菜单",
  "待接入",
  "未接入",
  "不伪造成功",
  "端点缺失",
  "设计说明",
];
for (const term of COPY_BLACKLIST) {
  assert.ok(
    !visibleTemplate.includes(term),
    `S4-8 AiFeedView 产品可见模板命中工程诊断词：${term}`,
  );
}
assert.ok(
  feedView.includes("wb-feed-broadcast") &&
    feedView.includes('data-state="broadcastBlock.state"') &&
    feedView.includes("暂不可用"),
  "S4-8 播报块缺少可辨的诚实降级态（暂不可用）",
);

// ── 9. AI 会话面生产文案收口（WORKBENCH-PROTOTYPE-12-AI-PRODUCTION-COPY-01） ──
// 工程词（待接入/未接入/端点缺失/不伪造成功）不得出现在 AI 会话面任何可见文案（注释一并清零）；
// 原型演示词（红星商行/五粮液/张三/10箱）不得出现在会话面组件、快捷提示台账与会话适配器。
const sessionListSrc = read("components/AiChat/AiSessionList.vue");
const chatWindowSrc = read("components/AiChat/AiChatWindow.vue");
const sessionsAdapterSrc = read("shared/workbench/wb-chat-sessions.ts");
const capabilityRegistrySrc = read("shared/workbench/capability-registry.ts");
const feedContainerSrc = read("components/workbench/AiFeedContainer.vue");
const feedTypesSrc = read("shared/workbench/wb-feed-types.ts");
const feedKpiSrc = read("shared/workbench/wb-feed-kpi.ts");
const feedApprovalsSrc = read("shared/workbench/wb-feed-approvals.ts");
const feedBroadcastSrc = read("shared/workbench/wb-feed-broadcast.ts");
const feedTaskboardSrc = read("shared/workbench/wb-feed-taskboard.ts");
const feedTaskflowSrc = read("shared/workbench/wb-feed-taskflow.ts");
const stripAllComments = (src) =>
  src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const sessionCopyFiles = {
  AiSessionList: sessionListSrc,
  AiSidePanel: sidePanel,
  AiChatWindow: chatWindowSrc,
  AiChatComposer: composer,
  "wb-chat-sessions.ts": sessionsAdapterSrc,
  "capability-registry.ts": capabilityRegistrySrc,
  "AiFeedContainer.vue": feedContainerSrc,
  "wb-feed-types.ts": feedTypesSrc,
  "wb-feed-kpi.ts": feedKpiSrc,
  "wb-feed-approvals.ts": feedApprovalsSrc,
  "wb-feed-broadcast.ts": feedBroadcastSrc,
  "wb-feed-taskboard.ts": feedTaskboardSrc,
  "wb-feed-taskflow.ts": feedTaskflowSrc,
};
const SESSION_COPY_BLACKLIST = ["待接入", "未接入", "端点缺失", "不伪造成功"];
for (const [name, src] of Object.entries(sessionCopyFiles)) {
  const visible = stripAllComments(src);
  for (const term of SESSION_COPY_BLACKLIST) {
    assert.ok(!visible.includes(term), `S4-9 ${name} 生产文案命中工程词：${term}`);
  }
}
const DEMO_LEAKS = ["红星商行", "五粮液", "10箱", "10 箱", "张三"];
for (const [name, src] of Object.entries(sessionCopyFiles)) {
  for (const leak of DEMO_LEAKS) {
    assert.ok(!src.includes(leak), `S4-9 ${name} 含原型演示词：${leak}`);
  }
}
// 快捷提示（QUICK_COMMANDS.prompt 与 AiChatWindow suggestions）必须同源且不含演示词
const windowSuggestions = chatWindowSrc.match(/const suggestions = \[[\s\S]*?\];/)?.[0] ?? "";
assert.ok(windowSuggestions, "S4-9 AiChatWindow 缺少建议芯片定义");
const registryPrompts = [...capabilityRegistrySrc.matchAll(/prompt: "([^"]+)"/g)].map((m) => m[1]);
for (const prompt of registryPrompts) {
  assert.ok(
    windowSuggestions.includes(`"${prompt}"`),
    `S4-9 快捷提示与 AiChatWindow 建议芯片不同源：${prompt}`,
  );
}
assert.equal(registryPrompts.length, 3, "S4-9 QUICK_COMMANDS 应为 3 条（与 ai-primary 守恒）");

console.log(
  [
    "",
    "S4 中央 AI 日常经营面 · 结构断言全部通过",
    "- 主区标题「日常经营」：AiSidePanel（会话面本体）+ AiFeedView（feed 面）双落点",
    "- 晨报首条：AiSidePanel 挂载自动发送（briefingSent 一次性）+ 真实 SSE，不本地伪造",
    "- 输入计数=1：AiSidePanel textarea 唯一；AiChatPanel 无第二输入；chat 态 composer 不渲染",
    "- 链复用：sendChatMessage(SSE) + confirm/cancel/revoke；AiChatPanel 无自建网络调用",
    "- 原型样例零泄漏：红星商行/五粮液/10箱 未出现在四组件",
    "- 生产可见文案：unavailable 使用「暂不可用」，工程诊断词黑名单零命中",
    "- S4-9 会话面文案收口：工程词/演示词在 AiSessionList/AiSidePanel/AiChatWindow/AiChatComposer/适配器/台账零命中",
    "",
  ].join("\n"),
);
