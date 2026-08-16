<template>
  <aside class="ai-side-panel" :class="{ 'is-collapsed': collapsed }">
    <!-- 头部 -->
    <div class="ai-header">
      <div class="ai-header-title">
        <el-icon class="header-logo"><MagicStick /></el-icon>
        <span v-show="!collapsed">经营助手</span>
      </div>
      <el-button
        class="ai-collapse-btn"
        aria-label="折叠或展开智能助手"
        :icon="collapsed ? 'Expand' : 'Fold'"
        size="small"
        text
        @click="collapsed = !collapsed"
      />
    </div>

    <!-- 消息区 -->
    <div v-show="!collapsed" ref="listEl" class="ai-messages">
      <div v-if="messages.length === 0" class="ai-empty">
        <p class="empty-title">你好，我是智享经营助手</p>
        <p class="empty-sub">本地推理、数据不出店。可以这样问我：</p>
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

      <AiMessageCard
        v-for="m in messages"
        :key="m.id"
        :message="m"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @revoke="handleRevoke"
      />
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
      <!-- 第二段：操作栏（图片预览 / 图片 / 语音 / 提示） -->
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
        <el-button
          class="ai-image-btn"
          circle
          :disabled="streaming"
          title="上传图片（AI 识别）"
          @click="pickImage"
        >
          <el-icon><Picture /></el-icon>
        </el-button>
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
          @click="toggleVoice"
        >
          <el-icon><Microphone v-if="!listening" /><Loading v-else class="is-loading" /></el-icon>
        </el-button>
        <span class="ai-input-hint">{{ statusText || "Enter 发送 · Shift+Enter 换行 · 数据不出店" }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { MagicStick, Promotion, Microphone, Loading, Picture, Close } from "@element-plus/icons-vue";
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
    SpeechRecognition?: new () => typeof recognition;
    webkitSpeechRecognition?: new () => typeof recognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  recognition = new Ctor();
  recognition.lang = "zh-CN";
  return recognition;
}

function toggleVoice() {
  if (listening.value) {
    recognition?.stop();
    listening.value = false;
    return;
  }
  const rec = getRecognition();
  if (!rec) {
    ElMessage.warning("当前浏览器不支持语音输入，请使用 Chrome/Edge");
    return;
  }
  rec.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript ?? "";
    if (text) input.value = text;
  };
  rec.onend = () => {
    listening.value = false;
  };
  rec.onerror = () => {
    listening.value = false;
    ElMessage.warning("语音识别失败，请重试或手动输入");
  };
  try {
    rec.start();
    listening.value = true;
  } catch {
    listening.value = false;
    ElMessage.warning("无法启动语音识别，请重试");
  }
}
const suggestions = [
  "创建销售单：给红星商行送10箱五粮液",
  "查询一下五粮液的库存",
  "本月的销售报表",
];

const canSend = computed(() => input.value.trim().length > 0 && !streaming.value);

const statusText = computed(() => {
  if (streaming.value) return "AI 正在生成回复...";
  return "";
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
  pushMessage({
    role: "user",
    kind: "text",
    content: text || (image ? "[图片]" : ""),
  });
  const assistant = pushMessage({ role: "assistant", kind: "text", content: "" });
  streaming.value = true;
  abortController.value = new AbortController();

  try {
    await sendChatMessage(
      text,
      conversationId.value,
      {
        onText: (content) => {
          assistant.content = (assistant.content || "") + content;
        },
        // 只读工具过程不展示（用户只需最终结果），写操作预览仍出确认卡
        onToolStart: () => {
          /* 静默：不展示工具过程卡片 */
        },
        onToolResult: (payload) => {
          // 仅写操作预览（需人工确认）出卡片；只读结果由最终 AI 文本直接呈现
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
        },
        onError: (message) => {
          reportStreamError(assistant, message);
        },
      },
      abortController.value.signal,
      undefined, // 模型参数：已移除模型选择，使用租户/平台默认
      image ?? undefined,
    );
  } catch (err) {
    streaming.value = false;
    const message = err instanceof Error ? err.message : "AI 服务调用失败";
    reportStreamError(assistant, message);
  } finally {
    scrollToBottom();
  }
}

function reportStreamError(assistant: AiChatMessage, message: string): void {
  if (!assistant.content) {
    assistant.kind = "error";
    assistant.error = message;
  } else {
    pushMessage({ role: "assistant", kind: "error", error: message });
  }
  streaming.value = false;
}

function sendSuggestion(text: string): void {
  input.value = text;
  sendMessage();
}

async function handleConfirm(id: string): Promise<void> {
  try {
    const res = await confirmAiOperation(id);
    const target = findMessage(id);
    if (target) {
      target.preview = undefined;
      target.confirmationId = undefined;
      target.toolStatus = "success";
      target.data = res;
    }
    ElMessage.success("操作已确认执行");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "确认失败");
  }
}

async function handleCancel(id: string): Promise<void> {
  try {
    await cancelAiOperation(id);
    const target = findMessage(id);
    if (target) {
      target.preview = undefined;
      target.confirmationId = undefined;
      target.toolStatus = "error";
    }
    ElMessage.info("操作已取消");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "取消失败");
  }
}

async function handleRevoke(id: string): Promise<void> {
  try {
    const res = await revokeAiOperation(id);
    const target = findMessage(id);
    if (target) {
      target.toolStatus = "success";
      target.data = res;
    }
    ElMessage.success("操作已撤销");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "撤销失败");
  }
}

watch(messages, () => scrollToBottom(), { deep: true });

onBeforeUnmount(() => {
  abortCurrent();
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

.ai-input-actions .ai-image-btn,
.ai-input-actions .ai-voice-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  margin-right: 6px;
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
