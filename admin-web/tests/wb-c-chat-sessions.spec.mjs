/**
 * WORKBENCH-10 区域 C 断言用例 —— AI 会话管理数据适配 + 会话列表 UI（诚实侧）
 *
 * 判据（派单卡 §C-6/§C-7 + 仓内既有 agent-directory.ts 口径）：
 *   ① api/ai.ts 没有「历史会话列表 / 归档 / 删除 / 恢复 / 重命名」端点
 *      ⇒ wb-chat-sessions 适配器全部动作必须返回 unavailable/ok:false，绝不伪造条目或伪成功；
 *   ② UI（AiSessionList.vue）必须显示「暂不可用」并给重试入口，不得出现成功口径（已归档/删除成功 toast）；
 *   ③ 不得冒用登录会话端点（getUserSessions）冒充 AI 会话；
 *   ④ AiChatPanel 装配会话列表且保留故障隔离锚点（回退到 AiChatPanel 既有语义）。
 *
 * 运行（admin-web 目录）：node tests/wb-c-chat-sessions.spec.mjs
 * 说明：沿用 ai-primary.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子方案，不依赖 vitest/esbuild。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS =
  "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const chat = await import("../src/shared/workbench/wb-chat-sessions.ts");

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
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

// ═══ 一、适配器：列表（不可用即空，绝不造条目） ═══

await run("会话列表：无端点 ⇒ unavailable + sessions=[]（不返回任何伪造会话）", async () => {
  const res = await chat.loadChatSessions();
  assert.equal(res.state, "unavailable", "缺端点必须 unavailable");
  assert.deepEqual(res.sessions, [], "不可用不得附带任何条目（对齐 agent-directory 口径）");
  assert.match(res.message, /暂不可用/, `message 应写明暂不可用：${res.message}`);
  assert.match(res.message, /缺少/, `message 应写明缺什么端点：${res.message}`);
  return `unavailable / sessions=0 / ${res.message}`;
});

await run("归档区列表：同样 unavailable + 空（归档区不画假存档）", async () => {
  const res = await chat.loadArchivedChatSessions();
  assert.equal(res.state, "unavailable");
  assert.deepEqual(res.sessions, []);
  assert.match(res.message, /归档/);
  assert.match(res.message, /暂不可用（缺少[^）]*端点）/);
  return res.message;
});

// ═══ 二、适配器：管理动作（恒 ok:false，不做本地伪成功） ═══

await run("归档动作：ok:false + unavailable（绝不返回 ok:true 冒充归档成功）", async () => {
  const res = await chat.archiveChatSession("sess-1");
  assert.equal(res.ok, false, "无端点时 ok 必须为 false");
  assert.equal(res.state, "unavailable");
  assert.match(res.message, /归档会话暂不可用/);
  return res.message;
});

await run("删除 / 恢复 / 重命名动作：全部诚实失败（含入参缺失的 fail-closed）", async () => {
  const del = await chat.deleteChatSession("sess-1");
  assert.equal(del.ok, false);
  assert.match(del.message, /删除会话暂不可用/);
  const restore = await chat.restoreChatSession("sess-1");
  assert.equal(restore.ok, false);
  assert.match(restore.message, /恢复会话暂不可用/);
  const rename = await chat.renameChatSession("sess-1", "新标题");
  assert.equal(rename.ok, false);
  assert.match(rename.message, /重命名会话暂不可用/);
  // fail-closed：空 ID / 空标题 ⇒ error 且 ok:false（不是抛错、更不是成功）
  const emptyId = await chat.archiveChatSession("");
  assert.equal(emptyId.ok, false);
  assert.equal(emptyId.state, "error");
  const emptyTitle = await chat.renameChatSession("sess-1", "   ");
  assert.equal(emptyTitle.ok, false);
  assert.equal(emptyTitle.state, "error");
  return "4 动作 ok=false + 2 fail-closed";
});

await run("守恒：适配器当前不存在任何可达的成功分支（全部 mutation 恒 ok:false）", async () => {
  const calls = await Promise.all([
    chat.archiveChatSession("s1"),
    chat.deleteChatSession("s1"),
    chat.restoreChatSession("s1"),
    chat.renameChatSession("s1", "t"),
  ]);
  assert.ok(calls.every((res) => res.ok === false), "任一 ok:true 即为伪成功（红线）");
  assert.ok(calls.every((res) => res.state !== "ready"), "管理动作不得宣称 ready");
  return `${calls.length} 个动作全部 ok:false`;
});

// ═══ 三、UI 结构：暂不可用 + 重试（不出现成功口径） ═══

await run("会话列表 UI：暂不可用标记 + 双重试入口（列表级 + 动作级）", () => {
  const ui = read("components/AiChat/AiSessionList.vue");
  assert.ok(ui.includes("暂不可用"), "会话列表必须显示「暂不可用」");
  assert.ok(ui.includes("chat-session-pending-retry"), "缺少列表级重试入口");
  assert.ok(ui.includes("chat-session-action-retry"), "缺少动作级重试入口（归档/删除未生效后可重试）");
  assert.ok(ui.includes("未生效："), "动作失败回执必须明说「未生效」，不得静默");
  assert.ok(ui.includes('data-testid="chat-arch-bar"'), "缺少归档区 bar（原型 L2213 结构锚点）");
  return "暂不可用 + 2 处重试 + 未生效回执 + 归档区 bar";
});

await run("会话列表 UI 红线：无成功 toast / 无已归档口径 / 不冒用登录会话端点", () => {
  const ui = read("components/AiChat/AiSessionList.vue");
  const code = ui.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!code.includes("ElMessage.success"), "会话管理不得弹成功 toast（端点不存在）");
  assert.ok(!code.includes("已归档"), "不得出现原型式的「已归档」成功文案（伪成功红线）");
  assert.ok(!code.includes("getUserSessions"), "不得冒用登录会话端点冒充 AI 会话");
  assert.ok(ui.includes("wb-chat-sessions"), "数据必须来自 wb-chat-sessions 适配器");
  assert.ok(ui.includes('data-a="arch"') && ui.includes('data-a="del"'), "更多菜单应保留原型 data-a 锚点（arch/del）");
  return "零成功 toast / 零伪「已归档」/ 零冒用 + 适配器数据源 + arch/del 锚点";
});

await run("重复会话条已移除；新对话仍复用 clearChat，故障锚点未回退", () => {
  const panel = read("components/workbench/AiChatPanel.vue");
  assert.ok(!panel.includes("AiSessionList"), "重复会话列表仍装配进 AiChatPanel");
  assert.ok(!panel.includes("acp-sess-bar"), "重复会话管理条仍存在");
  assert.ok(!panel.includes("chat-sessions-toggle"), "重复会话列表开关仍存在");
  assert.ok(panel.includes("clearChat"), "新对话必须复用面板真实 clearChat（不另起会话实现）");
  // 回归护栏：WORKBENCH-03 故障隔离锚点不得被我方改动破坏
  assert.ok(panel.includes("切换人工操作台"), "故障横幅回人工入口丢失");
  assert.ok(panel.includes('role="alert"'), "故障 alert 语义丢失");
  assert.ok(!panel.includes("sendChatMessage("), "主交互面不得直接调用对话接口（单一实现约束）");
  assert.ok(!panel.includes("confirmAiOperation("), "面板不得新增写动作确认链调用");
  return "重复条清零 + 真实新对话 + 故障/单一实现锚点齐全";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
