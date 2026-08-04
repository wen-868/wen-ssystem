<template>
  <aside class="ai-side-panel">
    <!-- 头部 -->
    <div class="ai-header">
      <div class="ai-header-title">
        <el-icon class="header-logo"><MagicStick /></el-icon>
        <span>经营助手</span>
      </div>
      <div class="ai-header-status">
        <span class="status-dot"></span>
        <span>本地模型</span>
      </div>
    </div>

    <!-- 消息区 -->
    <div ref="listEl" class="ai-messages">
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
    <div class="ai-input-area">
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        resize="none"
        placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
        :disabled="streaming"
        @keydown.enter.exact.prevent="sendMessage"
      />
      <div class="ai-input-footer">
        <span class="ai-status">{{ statusText }}</span>
        <el-button
          type="primary"
          size="small"
          :loading="streaming"
          :disabled="!canSend"
          @click="sendMessage"
        >
          {{ streaming ? "生成中" : "发送" }}
        </el-button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { MagicStick } from "@element-plus/icons-vue";
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
  return msg;
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
  if (!text || streaming.value) return;
  input.value = "";
  pushMessage({ role: "user", kind: "text", content: text });
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
        onToolStart: (tool) => {
          pushMessage({ role: "assistant", kind: "tool", tool, toolStatus: "running" });
        },
        onToolResult: (payload) => {
          const target = messages.value.find(
            (m) => m.kind === "tool" && m.tool === payload.tool && m.toolStatus === "running",
          );
          if (target) {
            target.toolStatus = payload.success ? "success" : "error";
            target.data = payload.data;
            if (!payload.success && payload.data && typeof payload.data === "object") {
              const errObj = payload.data as { error?: string; message?: string };
              target.error = errObj.error || errObj.message || undefined;
            }
            if (payload.preview) {
              target.preview = payload.preview;
              target.confirmationId = payload.confirmationId;
            }
          } else if (payload.preview) {
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
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid var(--border-light);
  min-height: 100vh;
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

.ai-header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-success);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-success);
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
  color: var(--text-secondary);
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
  background: #ffffff;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
}

.suggestion-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ai-input-area {
  border-top: 1px solid var(--border-light);
  padding: 12px 16px;
  background: var(--surface-neutral, #F7F7F8);
}

.ai-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.ai-status {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
