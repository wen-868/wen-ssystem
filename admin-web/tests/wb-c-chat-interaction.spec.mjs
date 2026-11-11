/**
 * WORKBENCH-10 区域 C 断言用例 —— AI 对话交互面（建议问题 / 发送与时间线 / 确认卡 / 失败恢复 / 附件与语音）
 *
 * 判据（派单卡 §C-1…§C-5）：
 *   ① 空状态对齐原型 emptyHTML(L1256)「新对话已开启」+「问我任何经营问题…」，建议问题真实可点发送；
 *   ② 发送走唯一真实链 sendChatMessage（POST /api/chat），输入中（思考指示）与工具时间线由 SSE 事件驱动；
 *   ③ 确认卡既有链路（preview→confirm/cancel/revoke）只扩展不回归；
 *   ④ 发送失败必须显式失败态 + 原文重试，绝不渲染成成功；
 *   ⑤ 附件菜单/语音录制态结构齐备：图片有真实链，文件无端点 ⇒ 暂不支持；语音不支持时如实禁用。
 *
 * 运行（admin-web 目录）：node tests/wb-c-chat-interaction.spec.mjs
 * 说明：纯源码文本断言（同 prototype-parity 风格），.vue 无需运行时。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

function read(rel) {
  const file = path.join(SRC, rel);
  assert.ok(existsSync(file), `缺少文件：${rel}`);
  return readFileSync(file, "utf8");
}

const side = read("components/AiChat/AiSidePanel.vue");
const win = read("components/AiChat/AiChatWindow.vue");
const card = read("components/AiChat/AiMessageCard.vue");
const preview = read("components/AiChat/AiPreviewCard.vue");
const composer = read("components/workbench/AiChatComposer.vue");
const types = read("components/AiChat/types.ts");

function codeOf(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"])\/\/.*$/gm, "$1");
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

// ═══ ① 新对话建议问题（原型 .empty-chat L547 / emptyHTML L1256） ═══

await run("空状态：「新对话已开启」+「问我任何经营问题」口径落地两个对话面", () => {
  for (const [name, text] of [["AiSidePanel", side], ["AiChatWindow", win]]) {
    assert.ok(text.includes("新对话已开启"), `${name} 缺少「新对话已开启」`);
    assert.ok(text.includes("问我任何经营问题"), `${name} 缺少「问我任何经营问题…」引导语`);
    assert.ok(/class="[^"]*empty-chat/.test(text), `${name} 未保留原型 .empty-chat 类名锚点`);
    assert.ok(text.includes("suggestion-chip") && text.includes("sendSuggestion("), `${name} 建议问题应可点击直发`);
  }
  return "两面板口径一致 + 建议问题走真实发送";
});

// ═══ ② 发送 / 输入中 / 工具时间线 ═══

await run("发送链唯一真实：sendChatMessage（POST /api/chat），信息流入口不复制第二套", () => {
  assert.ok(side.includes("await sendChatMessage("), "侧栏面板应调用真实对话接口");
  assert.ok(win.includes("await sendChatMessage("), "悬浮窗应调用真实对话接口");
  assert.ok(!composer.includes("sendChatMessage("), "底部输入条不得直连对话接口（走壳层统一链）");
  assert.ok(side.includes('emit("status", { state: "streaming" })'), "发送应上报 streaming 态");
  return "两处真实调用 + composer 零直连";
});

await run("输入中指示：空 assistant 消息即渲染「正在思考」脉冲点（非静态字符串堆砌）", () => {
  assert.ok(card.includes("正在思考"), "AiMessageCard 应显示输入中指示");
  assert.ok(card.includes('v-if="!message.content"'), "输入中指示应绑定空内容条件（SSE 增量到达即消失）");
  assert.ok(side.includes('pushMessage({ role: "assistant", kind: "text", content: "" })'), "发送后应先落占位回复");
  assert.ok(card.includes("dotPulse"), "指示应有动画类（原型 typing 语义）");
  return "占位消息 + 条件渲染 + 动画";
});

await run("工具时间线：onToolStart 落 running 步骤、onToolResult 回填状态、连续步骤归组", () => {
  for (const [name, text] of [["AiSidePanel", side], ["AiChatWindow", win]]) {
    assert.ok(text.includes('kind: "tool", tool, toolStatus: "running"'), `${name} onToolStart 应落「执行中」步骤`);
    assert.ok(text.includes('m.toolStatus === "running"'), `${name} onToolResult 应回填最近执行中步骤`);
    assert.ok(text.includes('type: "timeline"'), `${name} 应把连续 tool 消息归组为时间线块`);
    assert.ok(text.includes("工具调用时间线"), `${name} 时间线应有标题`);
  }
  assert.ok(side.includes("chat-tool-timeline"), "侧栏时间线缺 data-testid 锚点");
  return "SSE 事件驱动的执行中→结果回填→归组";
});

// ═══ ③ 确认卡：既有链路只扩展不回归 ═══

await run("确认卡保留：preview→确认卡 + confirm/cancel/revoke 真实调用未被动过", () => {
  assert.ok(side.includes("if (payload.preview)") && side.includes('kind: "preview"'), "写操作预览应生成确认卡片");
  assert.ok(win.includes("if (payload.preview)"), "悬浮窗确认卡链路保留");
  for (const fn of ["confirmAiOperation", "cancelAiOperation", "revokeAiOperation"]) {
    assert.ok(side.includes(`await ${fn}(`), `AiSidePanel 缺少 ${fn} 真实调用`);
  }
  assert.ok(card.includes("AiPreviewCard"), "消息卡应继续渲染确认卡组件");
  assert.ok(preview.includes("确认执行") && preview.includes("撤销（3分钟内）"), "确认卡动作文案保留");
  assert.ok(side.includes("defineExpose({ sendText: sendSuggestion"), "快捷指令暴露锚点保留（ai-primary 护栏）");
  return "确认/取消/撤销三链 + 组件 + 文案锚点齐全";
});

// ═══ ④ 失败恢复：显式失败 + 原文重试 ═══

await run("失败态与成功硬区分：kind=error 气泡 +「发送失败」标题（不冒充已回复）", () => {
  assert.ok(side.includes('assistant.kind = "error"'), "失败应把占位回复转为 error 气泡");
  assert.ok(card.includes("发送失败"), "错误气泡应明说「发送失败」");
  assert.ok(card.includes("本条未成功"), "错误气泡应否定成功语义");
  assert.ok(card.includes("error-bubble"), "错误应有独立失败样式类（非 AI 回复样式）");
  const sideCode = codeOf(side);
  assert.ok(!sideCode.includes('kind: "success"'), "失败路径不得伪造 success 消息类型");
  return "error 态 + 失败文案 + 独立样式";
});

await run("重试链：retryText 保留原文 →「重试」走同一真实发送链（含 AiChatWindow）", () => {
  assert.ok(types.includes("retryText?"), "消息模型应携带失败原文");
  for (const [name, text] of [["AiSidePanel", side], ["AiChatWindow", win]]) {
    assert.ok(text.includes("assistant.retryText = retryText"), `${name} 失败时应挂回原文`);
    assert.ok(text.includes("function retryMessage"), `${name} 应有重试处理（撤下失败气泡后重发）`);
    assert.ok(text.includes("@retry=\"retryMessage\""), `${name} 应接线卡片重试事件`);
  }
  assert.ok(card.includes("ai-error-retry") && card.includes("emit('retry'"), "错误卡应渲染重试按钮并上抛事件");
  assert.ok(side.includes('input.value = text') && side.includes("void sendMessage()"), "重试复用真实 sendMessage");
  return "原文保留 + 卡内按钮 + 同链重发";
});

// ═══ ⑤ 附件菜单与语音录制态（原型 .input-zone L976 / #micBtn L981） ═══

await run("附件菜单：图片走真实链（image 参数），文件无端点 ⇒ 明示暂不支持、不放回假附件", () => {
  assert.ok(side.includes("chat-att-btn") && side.includes("chat-att-menu"), "侧栏应有附件按钮 + 弹出菜单");
  assert.ok(side.includes("pickImageFromMenu"), "图片项应接真实文件选取");
  assert.ok(side.includes("image ?? undefined"), "图片应随 sendChatMessage 的 image 参数真实发出");
  assert.ok(side.includes("文件解析暂不支持（缺少文件上传端点）"), "文件项必须如实标注暂不支持");
  assert.ok(composer.includes("composer-att-menu"), "底部输入条应有附件菜单结构");
  assert.ok(composer.includes("暂不支持"), "底部输入条文件项应显示暂不支持");
  const composerCode = codeOf(composer);
  assert.ok(!/FileReader/.test(composerCode), "信息流入口无真实附件链，不得本地读取文件制造已附加假象");
  return "菜单结构 + 图片真实链 + 文件暂不支持（两处输入面）";
});

await run("语音录制态：录制条（时长 + 完成/取消），取消还原草稿；不支持时如实禁用", () => {
  assert.ok(side.includes("语音录制中") && side.includes("chat-voice-bar"), "侧栏应有录制态反馈条");
  assert.ok(side.includes("voiceElapsedText") && side.includes("setInterval"), "应有实时时长（录制反馈）");
  assert.ok(side.includes("cancelVoice") && side.includes("voiceDraftBefore"), "取消应还原录音前草稿");
  assert.ok(side.includes("!speechSupported"), "不支持的浏览器应禁用/提示，不装录音");
  assert.ok(composer.includes("composer-voice-bar") && composer.includes("语音录制中"), "底部输入条同有录制态");
  assert.ok(composer.includes("rec.onresult"), "识别结果应回写输入框（随同一真实 send 链发出，非摆设）");
  assert.ok(side.includes('recognition?.stop()'), "停止应调用真实识别 stop");
  return "两输入面录制态齐备 + 真实 Web Speech";
});

// ═══ ⑥ 全局守恒：无伪造成功 / 单一实现 / 原型演示名词不入库 ═══

await run("守恒红线：对话面无原型人名演示数据；成功 toast 仅存在于真实确认链", () => {
  for (const [name, text] of [["AiSidePanel", side], ["AiChatWindow", win], ["AiChatComposer", composer]]) {
    const code = codeOf(text);
    // 原型演示名词（任务红线点名的）不得出现在任何对话面代码区 ⇒ 三个文件一律扫描，不设例外
    for (const banned of ["王强", "小播", "红星便利店"]) {
      assert.ok(!code.includes(banned), `${name} 出现原型演示名「${banned}」（伪数据红线）`);
    }
    assert.ok(!code.includes("Math.random"), `${name} 代码区不得使用随机数造内容`);
  }
  // types.ts 的 Math.random 只允许用于消息 ID（createMessageId）：随机的是主键，不是业务内容
  for (let at = types.indexOf("Math.random"); at !== -1; at = types.indexOf("Math.random", at + 1)) {
    const decl = types.slice(0, at).split("\n").reverse().find((line) => /^(export )?(function|const) /.test(line)) || "";
    assert.match(decl, /Id\b/, `types.ts 随机数必须出自 ID 生成函数，实为：${decl.trim()}`);
  }
  assert.ok(side.includes("ElMessage.error"), "确认/取消/撤销失败应有 error 提示（非一律成功）");
  assert.ok(!side.includes("已归档") && !composer.includes("已发送成功"), "对话面不得出现伪成功 toast");
  return "零原型人名 + 零随机数内容（ID 除外）+ 失败提示在位 + 零伪成功";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
