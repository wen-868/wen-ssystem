<template>
  <div class="acp" :class="{ 'has-fault': Boolean(faultMessage) }">
    <!-- AI 故障隔离：会话失败 / SSE 断开时给明确状态与一键回人工，不阻塞人工路由 -->
    <div v-if="faultMessage" class="acp-fault" role="alert" data-testid="ai-fault-banner">
      <p class="acp-fault-title">AI 会话不可用</p>
      <p class="acp-fault-desc">{{ faultMessage }}</p>
      <button type="button" class="acp-fault-btn" @click="emit('fallback')">
        切换人工操作台（业务页面不受影响）
      </button>
    </div>

    <AiSidePanel ref="panelRef" @status="handleStatus" @open-form="emit('open-form', $event)" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from "vue";
import type { AiNativeFormAction } from "../../shared/workbench/ai-form-bridge";

const emit = defineEmits<{
  (event: "status", payload: { state: "idle" | "streaming" | "error"; message?: string }): void;
  (event: "fallback"): void;
  (event: "open-form", action: AiNativeFormAction): void;
}>();

// 复用现有真实 AI 对话面板（SSE + 确认/撤销端点），不新建对话实现。
const AiSidePanel = defineAsyncComponent(() => import("../AiChat/AiSidePanel.vue"));
type PanelExposed = {
  sendText?: (text: string) => void;
  clearChat?: () => void;
  getConversationId?: () => string | null;
};

const panelRef = ref<PanelExposed | null>(null);
/** 面板为异步加载：未就绪时先入队，挂载后按原顺序交给同一会话（不丢上下文） */
const pendingCommands = ref<string[]>([]);
/** 故障文案：本地仅承载“会话失败/断开”的真实错误信息，不做自动重试 */
const faultMessage = ref("");

watch(panelRef, (panel) => {
  if (!panel) return;
  const queued = pendingCommands.value;
  pendingCommands.value = [];
  for (const text of queued) panel.sendText?.(text);
});

function handleStatus(payload: {
  state: "idle" | "streaming" | "error";
  message?: string;
}): void {
  if (payload.state === "error") {
    faultMessage.value = payload.message || "会话连接中断";
  } else {
    faultMessage.value = "";
  }
  emit("status", payload);
}

/** 供 AI 信息流快捷指令 / 页面代办调用：走同一套真实发送逻辑（POST /api/chat） */
function sendQuickCommand(text: string): void {
  if (panelRef.value?.sendText) {
    panelRef.value.sendText(text);
    return;
  }
  pendingCommands.value = [...pendingCommands.value, text];
}

/** 新对话：清空本地会话上下文（底座无独立新建会话端点），下一条消息即重开服务端会话 */
function newConversation(): void {
  panelRef.value?.clearChat?.();
}

defineExpose({ sendQuickCommand, newConversation });
</script>

<style scoped>
.acp {
  width: 360px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.acp-fault {
  flex-shrink: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #f0c2c2;
  background: #fdf2f2;
}

.acp-fault-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #b42318;
}

.acp-fault-desc {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #7a271a;
  word-break: break-all;
}

.acp-fault-btn {
  padding: 4px 10px;
  border: 1px solid #b42318;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #b42318;
  cursor: pointer;
}

.acp-fault-btn:hover {
  background: #b42318;
  color: #fff;
}

/* AiSidePanel 原为 MainLayout 的 grid 第 3 列整栏（min-height:100vh），
   嵌入 AI 模式的行内 flex 布局需覆盖定位与高度，不改其内部实现。 */
.acp :deep(.ai-side-panel) {
  grid-column: auto;
  grid-row: auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex: 1;
  border-left: 0;
}
</style>
