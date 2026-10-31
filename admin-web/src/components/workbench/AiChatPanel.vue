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

    <!-- 会话管理条（原型 L1229 会话列表语义）：新对话=真实 clearChat；
         历史/归档/删除走 wb-chat-sessions 适配器，端点缺失时显示「待接入」+重试，不做本地伪成功 -->
    <div class="acp-sess-bar">
      <button
        type="button"
        class="acp-sess-toggle"
        data-testid="chat-sessions-toggle"
        :aria-expanded="sessionsOpen"
        @click="sessionsOpen = !sessionsOpen"
      >
        会话列表
      </button>
      <span class="acp-sess-current" data-testid="chat-sessions-current">
        {{ conversationId ? `当前会话 ${conversationId}` : "当前会话未建立" }}
      </span>
    </div>
    <AiSessionList
      v-if="sessionsOpen"
      class="acp-sessions"
      :conversation-id="conversationId"
      @new-conversation="onNewConversation"
    />

    <AiSidePanel ref="panelRef" @status="handleStatus" @conversation="handleConversation" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from "vue";

const emit = defineEmits<{
  (event: "status", payload: { state: "idle" | "streaming" | "error"; message?: string }): void;
  (event: "fallback"): void;
}>();

// 复用现有真实 AI 对话面板（SSE + 确认/撤销端点），不新建对话实现。
const AiSidePanel = defineAsyncComponent(() => import("../AiChat/AiSidePanel.vue"));
// 会话列表（区域 C 第 6 项）：数据驱动自 wb-chat-sessions 适配器（当前全部诚实降级为待接入）。
const AiSessionList = defineAsyncComponent(() => import("../AiChat/AiSessionList.vue"));

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
/** 会话列表开合 + 当前真实会话 ID（AiSidePanel done 事件回传，未回传如实为空） */
const sessionsOpen = ref(false);
const conversationId = ref<string | null>(null);

watch(panelRef, (panel) => {
  if (!panel) return;
  conversationId.value = panel.getConversationId?.() ?? null;
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

/** 会话 ID 回传（真实 done 事件）：同步给会话列表显示 */
function handleConversation(cid: string): void {
  if (cid) conversationId.value = cid;
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
  conversationId.value = null;
}

/** 会话列表「新对话」入口：与快捷指令/副导航同一真实链（不另起对话实现） */
function onNewConversation(): void {
  newConversation();
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

/* 会话管理条 + 会话列表容器（不改 AiSidePanel 内部实现） */
.acp-sess-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-light, #e5e7eb);
  background: var(--gray-0, #fff);
}

.acp-sess-toggle {
  border: 1px solid var(--border-normal, #d1d5db);
  background: #fff;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
}

.acp-sess-toggle:hover {
  border-color: var(--color-primary, #2563eb);
  color: var(--color-primary, #2563eb);
}

.acp-sess-current {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acp-sessions {
  flex-shrink: 0;
  margin: 8px 12px 0;
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
  border-left: 1px solid var(--border-light, #e5e7eb);
}
</style>
