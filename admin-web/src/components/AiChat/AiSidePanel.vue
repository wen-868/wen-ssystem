<template>
  <aside class="ai-side-panel" :class="{ 'is-collapsed': collapsed }">
    <!-- 头部（S4：主区收敛为「日常经营」AI 会话面，标题与其一致） -->
    <div class="ai-header">
      <div class="ai-header-title">
        <el-icon class="header-logo"><MagicStick /></el-icon>
        <span v-show="!collapsed" data-testid="daily-op-title">日常经营</span>
      </div>
      <div class="ai-header-actions">
        <el-button
          v-show="!collapsed && messages.length > 0"
          class="ai-clear-btn"
          aria-label="清空对话"
          :icon="Delete"
          size="small"
          text
          @click="clearChat"
        />
        <el-button
          class="ai-collapse-btn"
          aria-label="折叠或展开智能助手"
          :icon="collapsed ? Expand : Fold"
          size="small"
          text
          @click="collapsed = !collapsed"
        />
      </div>
    </div>

    <!-- 消息区 -->
    <div v-show="!collapsed" ref="listEl" class="ai-messages">
      <!-- 新对话空状态（原型 .empty-chat L547 / emptyHTML L1256：「新对话已开启」+「问我任何经营问题…」） -->
      <div v-if="messages.length === 0" class="ai-empty empty-chat" data-testid="chat-empty-state">
        <p class="empty-title">新对话已开启</p>
        <p class="empty-sub">问我任何经营问题，或直接说出经营诉求。本地推理、数据不出店。可以这样问我：</p>
        <div class="suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="suggestion-chip"
            @click="sendSuggestion(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <!-- 消息序列：连续的工具调用折叠进「工具调用时间线」块（SSE tool_start/tool_result 驱动） -->
      <template v-for="block in renderBlocks" :key="block.key">
        <div v-if="block.type === 'timeline'" class="tool-timeline" data-testid="chat-tool-timeline">
          <p class="tool-timeline-title">
            工具调用时间线
            <span class="tool-timeline-count">{{ block.msgs.length }} 步</span>
          </p>
          <AiMessageCard
            v-for="m in block.msgs"
            :key="m.id"
            :message="m"
            @confirm="handleConfirm"
            @cancel="handleCancel"
            @revoke="handleRevoke"
            @retry="retryMessage"
          />
        </div>
        <AiMessageCard
          v-else
          :message="block.msg"
          @confirm="handleConfirm"
          @cancel="handleCancel"
          @revoke="handleRevoke"
          @retry="retryMessage"
        />
      </template>
    </div>

    <!-- 输入区 -->
    <div v-show="!collapsed" class="ai-input-area">
      <!-- 第一段：文本输入 + 发送（发送按钮悬浮于输入框右下角） -->
      <div class="ai-input-box">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入问题，Enter 发送"
          :disabled="streaming"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <el-button
          type="primary"
          circle
          class="ai-send-btn"
          :loading="streaming"
          :disabled="!canSend"
          title="发送"
          @click="sendMessage"
        >
          <el-icon v-if="!streaming"><Promotion /></el-icon>
          <span v-else class="ai-send-dots">···</span>
        </el-button>
      </div>
      <!-- 第二段：操作栏（附件菜单 / 语音 / 提示；结构对齐原型 .input-zone L976 + mic-btn L981） -->
      <div class="ai-input-actions">
        <div v-if="pendingImage" class="ai-image-preview">
          <img :src="pendingImage" alt="待发送图片" />
          <el-button
            class="ai-image-remove"
            circle
            size="small"
            type="danger"
            @click="pendingImage = null"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <div class="ai-att-wrap">
          <el-button
            class="ai-att-btn"
            circle
            :disabled="streaming"
            title="添加附件（图片 / 文件）"
            data-testid="chat-att-btn"
            @click="attMenuOpen = !attMenuOpen"
          >
            <el-icon><Plus /></el-icon>
          </el-button>
          <div v-if="attMenuOpen" class="ai-att-menu" data-testid="chat-att-menu">
            <button
              type="button"
              data-testid="chat-att-image"
              @click="pickImageFromMenu"
            >
              图片（AI 识别后随消息发送）
            </button>
            <button
              type="button"
              class="is-pending"
              data-testid="chat-att-file"
              @click="attachFileUnsupported"
            >
              文件 · 待接入
            </button>
          </div>
        </div>
        <el-button
          class="ai-voice-btn"
          circle
          :type="listening ? 'danger' : 'default'"
          :disabled="streaming || !speechSupported"
          :title="
            speechSupported
              ? listening
                ? '点击停止录音'
                : '语音输入'
              : '当前浏览器不支持语音输入（请用 Chrome/Edge）'
          "
          data-testid="chat-mic-btn"
          @click="toggleVoice"
        >
          <el-icon><Microphone v-if="!listening" /><Loading v-else class="is-loading" /></el-icon>
        </el-button>
        <span class="ai-input-hint">{{ statusText || "Enter 发送 · Shift+Enter 换行 · 数据不出店" }}</span>
      </div>
      <!-- 附件回执行：文件项无端点 ⇒ 明示待接入，不做本地假附件 -->
      <p v-if="attNotice" class="ai-att-notice" role="status" data-testid="chat-att-notice">{{ attNotice }}</p>
      <!-- 语音录制态（原型 #micBtn「语音输入」的录制反馈：实时时长 + 完成 / 取消） -->
      <div v-if="listening" class="ai-voice-bar" role="status" data-testid="chat-voice-bar">
        <span class="rec-dot" />
        <span class="rec-text">语音录制中 {{ voiceElapsedText }}</span>
        <button type="button" data-testid="chat-voice-stop" @click="stopVoice">完成</button>
        <button type="button" data-testid="chat-voice-cancel" @click="cancelVoice">取消</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  MagicStick,
  Promotion,
  Microphone,
  Loading,
  Plus,
  Close,
  Delete,
  Expand,
  Fold,
} from "@element-plus/icons-vue";
import AiMessageCard from "./AiMessageCard.vue";
import { createMessageId, type AiChatMessage } from "./types";
import {
  cancelAiOperation,
  confirmAiOperation,
  revokeAiOperation,
  sendChatMessage,
} from "../../api/ai";

const input = ref("");
const streaming = ref(false);
const conversationId = ref<string | undefined>(undefined);
const messages = ref<AiChatMessage[]>([]);
const abortController = ref<AbortController | null>(null);
const listEl = ref<HTMLElement | null>(null);
/** 折叠状态：列表页可收起 AI 面板，给数据区腾空间 */
const collapsed = ref(false);

/** 会话状态上报：供 AI 主交互面显示故障横幅并一键切回人工（不改变内部对话逻辑） */
const emit = defineEmits<{
  (event: "status", payload: { state: "idle" | "streaming" | "error"; message?: string }): void;
  /** 服务端会话 ID 回传（POST /api/chat 的 done 事件）：会话列表据此显示真实当前会话 */
  (event: "conversation", conversationId: string): void;
}>();

/** 语音输入（Web Speech API：浏览器原生中文识别，Chrome/Edge 支持） */
const speechSupported =
  typeof window !== "undefined" &&
  Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition,
  );
const listening = ref(false);
/** 待发送图片（data URL，AI 视觉识别） */
const pendingImage = ref<string | null>(null);
/** 附件菜单开合 + 结果回执行（文件项无端点 ⇒ 明示待接入，不放回假附件） */
const attMenuOpen = ref(false);
const attNotice = ref("");

function pickImageFromMenu(): void {
  attMenuOpen.value = false;
  attNotice.value = "";
  pickImage();
}

function attachFileUnsupported(): void {
  attMenuOpen.value = false;
  attNotice.value = "文件解析待接入（缺少文件上传端点）；当前仅图片可随消息发送";
}

/** 语音录制态展示（原型 #micBtn 只画了按钮，这里补录制中时长 + 完成/取消的真实反馈） */
const voiceSeconds = ref(0);
let voiceTimer: ReturnType<typeof setInterval> | null = null;
/** 取消标记：丢弃本次识别结果，不回写输入框 */
let voiceCancelled = false;

function stopVoiceTimer(): void {
  if (voiceTimer) {
    clearInterval(voiceTimer);
    voiceTimer = null;
  }
}

function startVoiceTimer(): void {
  stopVoiceTimer();
  voiceSeconds.value = 0;
  voiceTimer = setInterval(() => {
    voiceSeconds.value += 1;
  }, 1000);
}

const voiceElapsedText = computed(() => {
  const s = voiceSeconds.value;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
});

function pickImage() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      ElMessage.warning("图片不能超过 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage.value = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}
let recognition: {
  start: () => void;
  stop: () => void;
  lang?: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
} | null = null;

function getRecognition() {
  if (recognition) return recognition;
  const w = window as unknown as {
    SpeechRecognition?: new () => NonNullable<typeof recognition>;
    webkitSpeechRecognition?: new () => NonNullable<typeof recognition>;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  recognition = new Ctor();
  recognition.lang = "zh-CN";
  return recognition;
}

/** 录音前草稿：识别结果追加在草稿之后，取消时整体还原 */
let voiceDraftBefore = "";

function toggleVoice() {
  if (listening.value) {
    stopVoice();
    return;
  }
  const rec = getRecognition();
  if (!rec) {
    ElMessage.warning("当前浏览器不支持语音输入，请使用 Chrome/Edge");
    return;
  }
  voiceCancelled = false;
  voiceDraftBefore = input.value;
  rec.onresult = (e) => {
    if (voiceCancelled) return;
    const text = e.results[0]?.[0]?.transcript ?? "";
    if (text) input.value = voiceDraftBefore ? `${voiceDraftBefore} ${text}` : text;
  };
  rec.onend = () => {
    listening.value = false;
    stopVoiceTimer();
  };
  rec.onerror = () => {
    listening.value = false;
    stopVoiceTimer();
    ElMessage.warning("语音识别失败，请重试或手动输入");
  };
  try {
    rec.start();
    listening.value = true;
    startVoiceTimer();
  } catch {
    listening.value = false;
    stopVoiceTimer();
    ElMessage.warning("无法启动语音识别，请重试");
  }
}

/** 完成录音：停止识别，保留已回写的文本 */
function stopVoice(): void {
  recognition?.stop();
  listening.value = false;
  stopVoiceTimer();
}

/** 取消录音：丢弃本次识别内容，还原录音前草稿（不留下半截转写） */
function cancelVoice(): void {
  voiceCancelled = true;
  recognition?.stop();
  input.value = voiceDraftBefore;
  listening.value = false;
  stopVoiceTimer();
}
// S4：建议芯片用中性经营话术（不含原型人名/客户/金额/订单号——卡面"不复制原型业务样例"）
const suggestions = [
  "查看今日晨报",
  "查询商品库存",
  "本月的销售报表",
];

const canSend = computed(() => (input.value.trim().length > 0 || Boolean(pendingImage.value)) && !streaming.value);

const statusText = computed(() => {
  if (streaming.value) return "AI 正在生成回复...";
  return "";
});

/** 渲染块：普通消息单条渲染；连续 tool 消息归组进「工具调用时间线」（SSE 事件驱动，非静态装饰） */
type RenderBlock =
  | { type: "msg"; key: string; msg: AiChatMessage }
  | { type: "timeline"; key: string; msgs: AiChatMessage[] };

const renderBlocks = computed<RenderBlock[]>(() => {
  const blocks: RenderBlock[] = [];
  for (const m of messages.value) {
    const last = blocks[blocks.length - 1];
    if (m.kind === "tool" && last && last.type === "timeline") {
      last.msgs.push(m);
      continue;
    }
    if (m.kind === "tool") {
      blocks.push({ type: "timeline", key: `tl-${m.id}`, msgs: [m] });
      continue;
    }
    blocks.push({ type: "msg", key: m.id, msg: m });
  }
  return blocks;
});

function clearChat(): void {
  if (streaming.value) abortCurrent();
  messages.value = [];
  conversationId.value = undefined;
}

function pushMessage(partial: Omit<AiChatMessage, "id" | "createdAt">): AiChatMessage {
  const msg: AiChatMessage = { ...partial, id: createMessageId(), createdAt: Date.now() };
  messages.value.push(msg);
  // 关键：返回数组中的响应式代理引用（直接返回原始对象会导致 onText 修改不触发渲染，
  // AI 回复一直显示"正在思考"）
  return messages.value[messages.value.length - 1];
}

function findMessage(id: string): AiChatMessage | undefined {
  return messages.value.find((m) => m.id === id);
}

function abortCurrent(): void {
  abortController.value?.abort();
  abortController.value = null;
}

function scrollToBottom(): void {
  nextTick(() => {
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight;
    }
  });
}

async function sendMessage(): Promise<void> {
  const text = input.value.trim();
  if ((!text && !pendingImage.value) || streaming.value) return;
  const image = pendingImage.value;
  pendingImage.value = null;
  input.value = "";
  attNotice.value = "";
  pushMessage({
    role: "user",
    kind: "text",
    content: text || (image ? "[图片]" : ""),
  });
  const assistant = pushMessage({ role: "assistant", kind: "text", content: "" });
  streaming.value = true;
  abortController.value = new AbortController();
  emit("status", { state: "streaming" });

  try {
    await sendChatMessage(
      text,
      conversationId.value,
      {
        onText: (content) => {
          assistant.content = (assistant.content || "") + content;
        },
        // 工具时间线：tool_start 先落一条「执行中」步骤，tool_result 就地更新其状态；
        // 写操作的确认卡片仍由 preview 单独生成（确认卡既有链路不动）
        onToolStart: (tool) => {
          pushMessage({ role: "assistant", kind: "tool", tool, toolStatus: "running" });
        },
        onToolResult: (payload) => {
          // 回填最近一条同名执行中步骤（找不到同名的取最后一条 running，宽容匹配 SSE 顺序）
          const running = [...messages.value].reverse().find(
            (m) => m.kind === "tool" && m.toolStatus === "running",
          );
          const matched =
            [...messages.value].reverse().find(
              (m) => m.kind === "tool" && m.toolStatus === "running" && m.tool === payload.tool,
            ) || running;
          if (matched) {
            matched.toolStatus = payload.success ? "success" : "error";
            matched.data = payload.data;
          }
          // 仅写操作预览（需人工确认）出确认卡片；只读结果由最终 AI 文本直接呈现
          if (payload.preview) {
            pushMessage({
              role: "assistant",
              kind: "preview",
              tool: payload.tool,
              toolStatus: payload.success ? "success" : "error",
              data: payload.data,
              preview: payload.preview,
              confirmationId: payload.confirmationId,
            });
          }
        },
        onDone: (cid) => {
          conversationId.value = cid;
          streaming.value = false;
          if (cid) emit("conversation", cid);
          emit("status", { state: "idle" });
        },
        onError: (message) => {
          reportStreamError(assistant, message, text);
        },
      },
      abortController.value.signal,
      undefined, // 模型参数：已移除模型选择，使用租户/平台默认
      image ?? undefined,
    );
  } catch (err) {
    streaming.value = false;
    const message = err instanceof Error ? err.message : "AI 服务调用失败";
    reportStreamError(assistant, message, text);
  } finally {
    scrollToBottom();
  }
}

/**
 * 失败恢复：发送/流式失败时把该条 AI 回复标记为 error 并保留原始提问（retryText）。
 * 展示口径与成功明确区分（红色失败气泡 +「重试」按钮），绝不显示成已回复。
 */
function reportStreamError(assistant: AiChatMessage, message: string, retryText?: string): void {
  if (!assistant.content) {
    assistant.kind = "error";
    assistant.error = message;
    assistant.retryText = retryText;
  } else {
    pushMessage({ role: "assistant", kind: "error", error: message, retryText });
  }
  streaming.value = false;
  emit("status", { state: "error", message });
}

/** 点「重试」：撤下失败气泡后走同一真实发送链（会新增用户消息，保留重试痕迹） */
function retryMessage(messageId: string): void {
  if (streaming.value) return;
  const idx = messages.value.findIndex((m) => m.id === messageId);
  if (idx < 0) return;
  const text = messages.value[idx].retryText;
  if (!text) return;
  messages.value.splice(idx, 1);
  input.value = text;
  void sendMessage();
}

function sendSuggestion(text: string): void {
  input.value = text;
  sendMessage();
}

/** 确认卡动作：入参为 (messageId, confirmationId/operationId)，与 AiMessageCard 事件对齐 */
async function handleConfirm(messageId: string, confirmationId: string): Promise<void> {
  try {
    const res = await confirmAiOperation(confirmationId);
    const target = findMessage(messageId);
    if (target) {
      target.preview = undefined;
      target.confirmationId = undefined;
      target.operationId = res;
      target.toolStatus = "success";
      target.data = res;
    }
    ElMessage.success("操作已确认执行");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "确认失败");
  }
}

async function handleCancel(messageId: string, confirmationId: string): Promise<void> {
  try {
    await cancelAiOperation(confirmationId);
    const target = findMessage(messageId);
    if (target) {
      target.preview = undefined;
      target.confirmationId = undefined;
      target.cancelled = true;
      target.toolStatus = "error";
    }
    ElMessage.info("操作已取消");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "取消失败");
  }
}

async function handleRevoke(messageId: string, operationId: string): Promise<void> {
  try {
    const res = await revokeAiOperation(operationId);
    const target = findMessage(messageId);
    if (target) {
      target.revoked = true;
      target.toolStatus = "success";
      target.data = res;
    }
    ElMessage.success("操作已撤销");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "撤销失败");
  }
}

/** 对外暴露：AI 主交互面的快捷指令与“新对话”复用同一套真实发送逻辑 */
defineExpose({ sendText: sendSuggestion, clearChat, getConversationId: () => conversationId.value ?? null });

watch(messages, () => scrollToBottom(), { deep: true });

/**
 * S4：晨报作为首条会话内容 —— 挂载且会话为空时自动发送「今日晨报」一次
 * （真实 POST /api/chat SSE 由 AI 生成晨报，不本地伪造；briefingSent 模块级
 * 一次性标志防重复提交——刷新/重开会话才重发，用户先行的输入优先）。
 * 发送失败由既有 error/status 链如实呈现（AI 不可用 → 故障横幅 → 人工回退）。
 */
const BRIEFING_PROMPT = "今日晨报";
let briefingSent = false;
onMounted(() => {
  if (briefingSent || messages.value.length > 0) return;
  briefingSent = true;
  void sendSuggestion(BRIEFING_PROMPT);
});

onBeforeUnmount(() => {
  abortCurrent();
  stopVoiceTimer();
});

</script>

<style scoped>
/* ─── 左侧固定整栏 AI 面板（Swiss 风格：白底 + hairline + 克制） ─── */
.ai-side-panel {
  grid-column: 3;
  grid-row: 2;
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--gray-0);
  border-left: 1px solid var(--border-light);
  min-height: 100vh;
}

.ai-side-panel.is-collapsed {
  width: 48px;
}
.ai-side-panel.is-collapsed .ai-header {
  justify-content: center;
  padding: 14px 0;
}
.ai-side-panel.is-collapsed .ai-collapse-btn {
  margin: 0;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
}

.ai-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ai-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-logo {
  color: var(--color-primary);
  font-size: 17px;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}

.ai-empty {
  padding: 8px 0;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.empty-sub {
  font-size: 13px;
  color: #595959; /* WCAG AA */
  margin: 0 0 14px;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-chip {
  text-align: left;
  border: 1px solid var(--border-normal);
  background: var(--gray-0);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #595959; /* WCAG AA */
  cursor: pointer;
  transition: all 150ms;
}

.suggestion-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ai-input-area {
  border-top: 1px solid var(--border-light);
  padding: 10px 12px 12px;
  background: var(--gray-0);
  flex-shrink: 0;
  margin-top: auto;
  position: sticky;
  bottom: 0;
  z-index: 5;
}

.ai-input-box {
  position: relative;
}

.ai-input-box :deep(.el-textarea__inner) {
  border-radius: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--border-light);
  padding: 10px 46px 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  transition: all 160ms ease;
  box-shadow: none;
}
.ai-input-box :deep(.el-textarea__inner:focus) {
  background: var(--gray-0);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.ai-send-btn {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 14px;
}

.ai-send-dots {
  font-size: 12px;
  line-height: 1;
}

.ai-input-hint {
  flex: 1;
  margin-left: 8px;
  font-size: 11px;
  color: #595959; /* WCAG AA */
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 第二段操作栏：图片预览 / 图片 / 语音 / 提示 一行排列 */
.ai-input-actions {
  display: flex;
  align-items: center;
  margin-top: 6px;
  padding-left: 2px;
  min-height: 30px;
}

.ai-input-actions .ai-att-btn,
.ai-input-actions .ai-voice-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  margin-right: 6px;
}

/* 附件菜单（原型 .up-menu 语义：⊕ 弹出「图片 / 文件」两项） */
.ai-att-wrap {
  position: relative;
}

.ai-att-menu {
  position: absolute;
  left: 0;
  bottom: 34px;
  z-index: 20;
  min-width: 172px;
  background: var(--gray-0, #fff);
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  padding: 4px;
}

.ai-att-menu button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary, #111827);
}

.ai-att-menu button:hover {
  background: var(--bg-soft, #f3f4f6);
}

.ai-att-menu button.is-pending {
  color: #92400e;
}

.ai-att-notice {
  margin: 6px 2px 0;
  font-size: 11px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 4px 8px;
}

/* 语音录制态（红点 + 实时时长 + 完成/取消） */
.ai-voice-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 5px 8px;
  border: 1px solid #fca5a5;
  background: #fdf2f2;
  border-radius: 8px;
  font-size: 12px;
  color: #b42318;
}

.ai-voice-bar .rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
  animation: recBlink 1s ease-in-out infinite;
}

@keyframes recBlink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.ai-voice-bar .rec-text {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.ai-voice-bar button {
  border: 1px solid #b42318;
  background: #fff;
  color: #b42318;
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 11px;
  cursor: pointer;
}

/* 工具调用时间线（SSE tool_start/tool_result 驱动的连续步骤） */
.tool-timeline {
  border-left: 2px solid var(--border-normal, #d1d5db);
  padding: 2px 0 2px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-timeline-title {
  margin: 0;
  font-size: 11px;
  color: #595959;
  font-weight: 600;
}

.tool-timeline-count {
  margin-left: 6px;
  font-weight: 400;
}

/* 待发送图片缩略图（内联小卡 + 移除角标） */
.ai-image-preview {
  position: relative;
  width: 44px;
  height: 44px;
  margin-right: 8px;
  border-radius: 8px;
  overflow: visible;
  flex-shrink: 0;
}
.ai-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}
.ai-image-preview .ai-image-remove {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 10px;
}
</style>
