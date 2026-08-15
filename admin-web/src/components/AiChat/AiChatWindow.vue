<template>
  <div class="ai-chat-window">
    <!-- 右下角悬浮入口 -->
    <button
      type="button"
      class="ai-fab"
      :class="{ 'is-open': open }"
      :title="open ? '收起 AI 助手' : '打开 AI 助手'"
      @click="toggle"
    >
      <el-icon v-if="!open" class="fab-icon"><MagicStick /></el-icon>
      <el-icon v-else class="fab-icon"><Close /></el-icon>
      <span v-if="!open && unreadCount > 0" class="fab-badge">{{ unreadCount }}</span>
    </button>

    <!-- 对话窗口 -->
    <transition name="ai-pop">
      <div v-if="open" class="ai-panel">
        <div class="ai-header">
          <div class="ai-header-title">
            <el-icon class="header-logo"><MagicStick /></el-icon>
            <span>智享AI助手</span>
            <span
              class="push-indicator"
              :class="{ connected: pushConnected }"
              :title="pushConnected ? '实时推送已连接' : '实时推送未连接'"
            />
          </div>
          <div class="ai-header-actions">
            <el-tooltip content="清空对话" placement="bottom">
              <el-button :icon="Delete" size="small" text @click="clearChat" />
            </el-tooltip>
            <el-button :icon="Close" size="small" text @click="toggle" />
          </div>
        </div>

        <div ref="listEl" class="ai-messages">
          <!-- 空状态引导 -->
          <div v-if="messages.length === 0" class="ai-empty">
            <el-icon class="empty-icon"><MagicStick /></el-icon>
            <p class="empty-title">你好，我是智享AI助手</p>
            <p class="empty-sub">可以这样问我：</p>
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

        <div class="ai-input-area">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入你的问题，Enter 发送 / Shift+Enter 换行"
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
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage, ElNotification } from "element-plus";
import { Close, Delete, MagicStick } from "@element-plus/icons-vue";
import AiMessageCard from "./AiMessageCard.vue";
import { createMessageId, type AiChatMessage } from "./types";
import {
  cancelAiOperation,
  confirmAiOperation,
  connectAiPushSocket,
  revokeAiOperation,
  sendChatMessage,
  type AiProactivePayload,
} from "../../api/ai";

const open = ref(false);
const input = ref("");
const streaming = ref(false);
const conversationId = ref<string | undefined>(undefined);
const messages = ref<AiChatMessage[]>([]);
const abortController = ref<AbortController | null>(null);
const unreadCount = ref(0);
const listEl = ref<HTMLElement | null>(null);
const pushConnected = ref(false);
let disconnectPush: (() => void) | null = null;

/** 空状态引导示例（点击直接发送） */
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

function toggle(): void {
  open.value = !open.value;
  if (open.value) unreadCount.value = 0;
  scrollToBottom();
}

function clearChat(): void {
  if (streaming.value) abortCurrent();
  messages.value = [];
  conversationId.value = undefined;
  unreadCount.value = 0;
}

/** 新建一条消息并加入列表 */
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
        // 流式增量文本：持续追加到当前 AI 回复
        onText: (content) => {
          assistant.content = (assistant.content || "") + content;
        },
        onToolStart: () => {
          // 不展示工具执行过程（用户只看最终结果）；
          // 写操作的确认卡片由 onToolResult 的 preview 单独生成
        },
        onToolResult: (payload) => {
          // 只读工具结果不展示过程卡片（最终总结由 AI 文本输出）；
          // 写操作（preview）单独生成确认卡片，供用户确认/取消
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
          if (!open.value) unreadCount.value += 1;
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
  }
}

/** 流式过程中的错误：优先追加到当前回复，否则新建错误消息 */
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

async function handleConfirm(messageId: string, confirmationId: string): Promise<void> {
  const msg = findMessage(messageId);
  if (!msg) return;
  msg.pending = true;
  try {
    const operationId = await confirmAiOperation(confirmationId);
    msg.operationId = operationId;
    msg.pending = false;
    ElMessage.success("操作已确认执行，3 分钟内可撤销");
  } catch (err) {
    msg.pending = false;
    ElMessage.error(err instanceof Error ? err.message : "确认执行失败");
  }
}

async function handleCancel(messageId: string, confirmationId: string): Promise<void> {
  const msg = findMessage(messageId);
  if (!msg) return;
  msg.pending = true;
  try {
    await cancelAiOperation(confirmationId);
    msg.cancelled = true;
    msg.pending = false;
    ElMessage.info("已取消该操作");
  } catch (err) {
    msg.pending = false;
    ElMessage.error(err instanceof Error ? err.message : "取消失败");
  }
}

async function handleRevoke(messageId: string, operationId: string): Promise<void> {
  const msg = findMessage(messageId);
  if (!msg) return;
  msg.pending = true;
  try {
    await revokeAiOperation(operationId);
    msg.revoked = true;
    msg.pending = false;
    ElMessage.success("操作已撤销");
  } catch (err) {
    msg.pending = false;
    ElMessage.error(err instanceof Error ? err.message : "撤销失败，可能已超过 3 分钟");
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  const el = listEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

/** 收到 AI 主动推送：窗口打开直接入列，未打开计数 + 桌面通知 */
function handleProactivePush(payload: AiProactivePayload): void {
  pushMessage({
    role: "assistant",
    kind: "proactive",
    content: payload.content,
    title: payload.title,
    priority: payload.priority,
    proactiveType: payload.type,
  });

  if (!open.value) {
    unreadCount.value += 1;
    ElNotification({
      title: payload.title,
      message: payload.content.slice(0, 80),
      type: "info",
      position: "bottom-right",
      duration: 6000,
      onClick: () => {
        open.value = true;
        unreadCount.value = 0;
      },
    });
  }
}

onMounted(() => {
  // 连接 AI 主动推送实时通道（断线自动重连，卸载时断开）
  disconnectPush = connectAiPushSocket({
    onMessage: handleProactivePush,
    onStatusChange: (connected) => {
      pushConnected.value = connected;
    },
  });
});

watch(messages, () => {
  if (open.value) scrollToBottom();
}, { deep: true });

onBeforeUnmount(() => {
  abortCurrent();
  disconnectPush?.();
  disconnectPush = null;
});
</script>

<style scoped>
.ai-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-primary);
  color: var(--text-inverse);
  box-shadow: var(--shadow-xl);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: all var(--transition-normal);
}

.ai-fab:hover {
  background: var(--color-primary-hover);
  transform: scale(1.05);
}

.ai-fab.is-open {
  background: var(--gray-700);
}

.fab-icon {
  font-size: 22px;
}

.fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: var(--color-danger);
  color: var(--text-inverse);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  padding: 0 4px;
}

.ai-panel {
  position: fixed;
  right: 24px;
  bottom: 84px;
  width: 400px;
  height: 560px;
  max-height: calc(100vh - 140px);
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2000;
}

.ai-header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-light);
}

.ai-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.push-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gray-300, #d1d5db);
  display: inline-block;
  transition: background-color 0.3s;
}

.push-indicator.connected {
  background: #22c55e;
}

.header-logo {
  color: var(--color-primary);
  font-size: 18px;
}

.ai-header-actions {
  display: flex;
  align-items: center;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-page);
}

.ai-empty {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  padding: 24px 8px;
}

.empty-icon {
  font-size: 40px;
  color: var(--color-primary);
  margin-bottom: 8px;
}

.empty-title {
  font-size: var(--text-lg);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  margin: 0 0 6px;
}

.empty-sub {
  font-size: var(--text-sm);
  margin: 0 0 10px;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.suggestion-chip {
  border: 1px solid var(--border-normal);
  background: var(--bg-card);
  border-radius: var(--radius-pill);
  padding: 5px 12px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  max-width: 90%;
}

.suggestion-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.ai-input-area {
  flex-shrink: 0;
  border-top: 1px solid var(--border-light);
  padding: 10px 12px;
  background: var(--bg-card);
}

.ai-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.ai-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* 弹窗动画 */
.ai-pop-enter-active,
.ai-pop-leave-active {
  transition: all var(--transition-slow);
  transform-origin: bottom right;
}

.ai-pop-enter-from,
.ai-pop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(12px);
}
</style>
