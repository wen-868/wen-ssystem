/**
 * WORKBENCH-06 断言用例 —— 工作台原型结构对齐（结构清单 + 反测点名）
 *
 * 对应派单卡硬验收：
 *   §二.4 结构断言：一级 rail / 第二列导航 / Agent 状态区 / 底部输入区 / 工作台·收银台切换 / 旧壳回退；
 *   §三.5 反测：删除一级 rail / 第二列导航 / 底部输入区 / 回退分支 ⇒ 本用例必须点名变红。
 *
 * 权威原型：D:\Users\ZXQL\ZXQL-AI\docs\设计\智享全链_工作台电脑端_UI原型_融合版.html
 *   SHA256=6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51
 *   坐标对照：.rail(L921/renderRail L2293)、.side(L923/renderSubZone L2306)、
 *            .top+.mode-seg(L951/L1998)、.feed-wrap+.chat-col(L957-963/paintMain L2061)、
 *            .input-zone(L976)。
 *
 * 运行（admin-web 目录）：node tests/prototype-parity.spec.mjs（已串入 npm test）
 * 说明：纯源码文本结构断言（不 execSync / 不起浏览器），逐条点名缺失项，避免沙箱子进程限制。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

function read(...parts) {
  const file = path.join(SRC, ...parts);
  assert.ok(existsSync(file), `缺少文件：${parts.join("/")}`);
  return readFileSync(file, "utf8");
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

const shell = read("layouts", "WorkbenchShell.vue");
const subnav = read("layouts", "WorkbenchSubnav.vue");
const agentBar = read("components", "workbench", "AgentStatusBar.vue");
const feedView = read("components", "workbench", "AiFeedView.vue");
const composer = read("components", "workbench", "AiChatComposer.vue");

// ── 1. 一级模块图标 rail（最左常驻）＝原型 .rail + renderRail ───────────────
await run("一级 rail：常驻图标栏存在且含工作台项 + 模块项循环 + 设置固定底部", () => {
  const missing = [];
  if (!/data-testid="rail"/.test(shell)) missing.push("data-testid=\"rail\" 容器");
  if (!/aria-label="一级模块导航"/.test(shell)) missing.push("一级模块导航 aria-label");
  if (!/class="wb-rail-logo"/.test(shell)) missing.push("rail logo 位");
  if (!/data-rail-key="desk"/.test(shell)) missing.push("rail 工作台项（desk）");
  if (!/v-for="group in visibleGroups"[\s\S]*?:data-rail-key="group\.groupCode"/.test(shell)) {
    // 容忍 :data-rail-key="group.groupCode" 写法
    if (!/:data-rail-key="group\.groupCode"/.test(shell)) missing.push("rail 模块项 v-for + data-rail-key");
  }
  if (!/class="wb-rail-gap"/.test(shell)) missing.push("rail 底部留白（把设置压到底部）");
  if (!/data-rail-key="set"/.test(shell)) missing.push("rail 设置固定底部项");
  assert.equal(missing.length, 0, `一级 rail 结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "rail + desk/模块/设置三类项齐备";
});

// ── 2. 第二列上下文导航 ＝原型 .side（常用功能/二级/新对话/账户）─────────────
await run("第二列导航：Subnav 被装配 + 含新对话/二级目录/账户区/可收起", () => {
  const missing = [];
  if (!/WorkbenchSubnav/.test(shell)) missing.push("Shell 未装配 WorkbenchSubnav");
  if (!/<WorkbenchSubnav[\s\S]*?:mode="currentNavMode"/.test(shell)) {
    if (!/:mode="currentNavMode"/.test(shell)) missing.push("第二列未接 mode 上下文");
  }
  if (!/data-testid="second-nav"/.test(subnav)) missing.push("second-nav 容器");
  if (!/data-testid="second-nav-new-chat"/.test(subnav)) missing.push("新对话按钮");
  if (!/data-testid="second-nav-sub-zone"/.test(subnav)) missing.push("二级目录区 sub-zone");
  if (!/data-testid="second-nav-account"/.test(subnav)) missing.push("账户区");
  if (!/data-testid="second-nav-collapse"/.test(subnav)) missing.push("可收起按钮");
  assert.equal(missing.length, 0, `第二列导航结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "新对话 + 二级目录 + 账户 + 收起 齐备";
});

// ── 3. 顶栏待审阅徽标（UI-PARITY-BASE §四.2.5 收敛：健康探针/员工数/步骤计数/台账入口已移除）──
await run("顶栏徽标：装配于顶栏且含待审阅 + 台账入口已按合同移除", () => {
  const missing = [];
  if (!/AgentStatusBar/.test(shell)) missing.push("Shell 未装配 AgentStatusBar");
  if (!/:pending-review-count="pendingReviewCount"/.test(shell)) missing.push("未接待审阅数");
  if (!/data-testid="agent-status-bar"/.test(agentBar)) missing.push("agent-status-bar 容器");
  if (!/data-testid="agent-pending-review"/.test(agentBar)) missing.push("待审阅显示位");
  if (/data-testid="agent-ledger-entry"/.test(agentBar)) missing.push("台账入口应已移除（top_bar.forbidden）");
  assert.equal(missing.length, 0, `顶栏徽标结构异常：\n  - ${missing.join("\n  - ")}`);
  return "待审阅徽标齐备 + 台账入口零残留（口径变更已留痕）";
});

// ── 4. 主面：chat（AI 日常经营 · 默认）⇄ feed（退场保留层）⇄ 人工页，router-view 常驻 ──
await run("主面三层：chat 默认（AI 日常经营）+ feed 保留层 + manual（router-view 常驻）", () => {
  const missing = [];
  if (!/data-testid="view-feed"/.test(shell)) missing.push("view-feed 层");
  if (!/data-testid="view-chat"/.test(shell)) missing.push("view-chat 层");
  if (!/data-view="manual"/.test(shell)) missing.push("view-manual 层");
  if (!/const face = ref<MainFace>\("chat"\)/.test(shell)) missing.push("默认 face=chat（AI 日常经营主面 · UI-PARITY-BASE §四.3.1）");
  if (!/AiFeedView/.test(shell)) missing.push("信息流视图装配");
  if (!/<router-view\s*\/>/.test(shell)) missing.push("人工页 router-view 出口");
  // router-view 不得被条件渲染包裹（保持 ai-primary 断言同语义）
  if (/v-if=[^\n]*\n\s*<router-view/.test(shell)) missing.push("router-view 被条件渲染包裹（回退风险）");
  assert.equal(missing.length, 0, `主面三层结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "chat 默认 + feed 保留层 + manual 三层，router-view 常驻";
});

// ── 5. 底部固定 AI 输入区（人工页收为入口条）＝原型 .input-zone ──────────────
await run("底部输入区：Composer 常驻 + 人工态 compact + 发送经统一链", () => {
  const missing = [];
  if (!/AiChatComposer/.test(shell)) missing.push("Shell 未装配 AiChatComposer");
  if (!/:compact="effectiveMode === 'human'"/.test(shell)) missing.push("人工页 compact 收条");
  if (!/data-testid="chat-composer"/.test(composer)) missing.push("chat-composer 容器");
  if (!/data-testid="composer-input"/.test(composer)) missing.push("输入框");
  if (!/data-testid="composer-send"/.test(composer)) missing.push("发送按钮");
  assert.equal(missing.length, 0, `底部输入区结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "常驻输入区 + 人工态收条 + 真实发送链";
});

// ── 6. 工作台 / 收银台 顶部胶囊切换 ＝原型 renderModeSeg ────────────────────
await run("工作台/收银台胶囊：mode-seg 双向 + desk/pos 两项", () => {
  const missing = [];
  if (!/data-testid="mode-seg"/.test(shell)) missing.push("mode-seg 容器");
  if (!/data-mode-seg="desk"/.test(shell)) missing.push("工作台项");
  if (!/data-mode-seg="pos"/.test(shell)) missing.push("收银台项");
  assert.equal(missing.length, 0, `模式胶囊结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "工作台 ⇄ 收银台 双向胶囊";
});

// ── 7. 旧壳回退分支保留（灰度回滚不得为视觉被削弱）──────────────────────────
await run("旧壳回退：MainLayout v-if=!shellEnabled 分支保留且互斥", () => {
  const missing = [];
  if (!shell.includes('<MainLayout v-if="!shellEnabled"')) missing.push("旧壳回退分支 <MainLayout v-if=\"!shellEnabled\"");
  if (!/<div v-else class="wb-shell"/.test(shell)) missing.push("新壳 v-else 分支");
  if (!/const shellEnabled = isWorkbenchShellV2Enabled\(\);/.test(shell)) missing.push("装配期读取特征开关");
  assert.equal(missing.length, 0, `旧壳回退结构缺失：\n  - ${missing.join("\n  - ")}`);
  return "灰度回滚分支完整";
});

// ── 8. 信息流数据真实（禁 mock：不得引入原型 FEED/DATA/样例数字）─────────────
// 禁词只扫代码区（先剥注释）：避免「本组件不使用 mock」这类说明性注释误伤；
// 数据字面量只会写在代码里，剥注释不会放松真实检查。
function codeOnly(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"])\/\/.*$/gm, "$1");
}

await run("无 mock：新面组件零原型数据层/随机/示例数据（红线：不用原型 mock）", () => {
  const banned = [
    "Math.random", "mock", "Mock", "fake", "假数据", "示例数据", "随机",
    "__V15_DATA", "MAPPERS", "KCALC",
  ];
  const files = [
    ["components/workbench/AiFeedView.vue", feedView],
    ["components/workbench/AiChatComposer.vue", composer],
    ["components/workbench/AgentStatusBar.vue", agentBar],
    ["layouts/WorkbenchSubnav.vue", subnav],
    ["layouts/WorkbenchShell.vue", shell],
  ];
  // 原型 FEED 常量里的演示单号/金额一旦整段搬入即违规
  const demoTokens = ["五粮液 ×20", "SO-2093", "WS-118", "¥19,600", "红星便利店"];
  const hits = [];
  for (const [name, raw] of files) {
    const text = codeOnly(raw);
    for (const word of banned) if (text.includes(word)) hits.push(`${name}: ${word}`);
    for (const token of demoTokens) if (text.includes(token)) hits.push(`${name}: 演示数据「${token}」`);
  }
  assert.equal(hits.length, 0, `发现 mock/演示数据：\n  - ${hits.join("\n  - ")}`);
  return `${files.length} 文件代码区零 mock / 零原型演示数据`;
});

// ── 9. 真实端点接线（信息流/待审阅走真实接口，非本地伪造）───────────────────
await run("真实数据源：feed 走 /admin/wb-notifications，待审阅走 /api/chat/confirmations", () => {
  const missing = [];
  if (!feedView.includes("/admin/wb-notifications")) missing.push("feed 未接业务动态真实端点");
  if (!feedView.includes("connectAiPushSocket")) missing.push("feed 未接真实推送 socket");
  if (!feedView.includes("fetchAiConfirmations")) missing.push("feed 未接待审阅真实来源");
  if (!shell.includes("fetchAiConfirmations")) missing.push("顶栏待审阅未接真实来源");
  if (!/pendingReviewCount\.value = null/.test(shell)) missing.push("待审阅未取到时应置 null（不假装 0）");
  assert.equal(missing.length, 0, `真实数据源缺失：\n  - ${missing.join("\n  - ")}`);
  return "动态/推送/待审阅均有真实端点，失败诚实降级";
});

// ── 10. 结构守恒：既有壳层能力锚点未被重构破坏（权限/菜单/故障/收银）────────
await run("能力保留锚点：菜单 fail-closed / 角色裁剪 / AI 故障回退 / 收银保底未被破坏", () => {
  const missing = [];
  if (!shell.includes("data-testid=\"menu-fault\"")) missing.push("菜单故障横幅接线丢失");
  if (!shell.includes("data-testid=\"menu-retry\"")) missing.push("菜单重试丢失");
  if (!shell.includes("data-testid=\"menu-empty\"")) missing.push("空菜单态丢失");
  if (!shell.includes("fetchUserMenus")) missing.push("动态菜单装载丢失");
  if (!shell.includes("restrictManifestGroups")) missing.push("菜单白名单裁剪丢失");
  if (!shell.includes("userRoles: auth.userRoles")) missing.push("角色最终裁剪丢失");
  if (!shell.includes("filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles)")) {
    missing.push("收银 9 项 meta.roles 保底丢失");
  }
  if (!shell.includes("@fallback=\"switchMode('human')\"")) missing.push("AI 故障一键回人工丢失");
  assert.equal(missing.length, 0, `既有能力锚点被破坏：\n  - ${missing.join("\n  - ")}`);
  return "权限/菜单/故障/收银锚点全部保留";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
