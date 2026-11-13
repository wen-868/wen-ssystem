<template>
  <aside class="ai-side-panel">
    <!-- 对话主体：明确当前是与总台助手还是某位数字员工沟通 -->
    <header class="ai-agent-head" data-testid="chat-agent-identity">
      <span class="ai-agent-avatar">{{ activeEmployee ? activeEmployee.name.slice(0, 1) : "智" }}</span>
      <span class="ai-agent-copy">
        <strong>{{ activeEmployee?.name || "智享 AI 助手" }}</strong>
        <small v-if="activeEmployee">
          {{ activeEmployee.post }}<template v-if="activeEmployee.department"> · {{ activeEmployee.department }}</template>
        </small>
        <small v-else>总台协调助手 · 自动分派数字员工</small>
      </span>
      <span class="ai-agent-kind">{{ activeEmployee ? "数字员工" : "总台助手" }}</span>
      <span v-if="activeEmployee" class="ai-agent-collab">
        {{ activeEmployee.collaborators.length ? `可协同：${activeEmployee.collaborators.map((e) => e.name).join("、")}` : "独立执行" }}
      </span>
    </header>

    <!-- 消息区 -->
    <div ref="listEl" class="ai-messages">
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

      <!-- 工具调用属于内部执行细节，不进入消费者消息流；写操作预览仍由 preview 卡片承载。 -->
      <AiMessageCard
        v-for="m in visibleMessages"
        :key="m.id"
        :message="m"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @revoke="handleRevoke"
        @retry="retryMessage"
        @open-form="openNativeForm"
      />
    </div>

    <!-- 输入区 -->
    <div class="ai-input-area">
      <div v-if="pendingImage" class="ai-pending-row">
        <div class="ai-image-preview">
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
      </div>
      <div class="ai-input-box">
        <el-input
          v-model="input"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          resize="none"
          placeholder="输入问题，Enter 发送"
          :disabled="streaming"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="ai-input-toolbar">
          <div class="ai-inline-att">
            <button
              type="button"
              class="ai-inline-plus"
              :disabled="streaming"
              title="添加附件（图片 / 文件）"
              data-testid="chat-att-btn"
              @click="attMenuOpen = !attMenuOpen"
            >
              <el-icon :size="16"><Plus /></el-icon>
            </button>
            <div v-if="attMenuOpen" class="ai-att-menu" data-testid="chat-att-menu">
              <button type="button" data-testid="chat-att-image" @click="pickImageFromMenu">
                图片（AI 识别后随消息发送）
              </button>
              <button
                type="button"
                class="is-pending"
                data-testid="chat-att-file"
                @click="attachFileUnsupported"
              >
                文件 · 暂不支持
              </button>
            </div>
          </div>
          <el-button
            circle
            class="ai-primary-btn"
            :type="listening ? 'danger' : 'primary'"
            :disabled="streaming || (!hasInput && !speechSupported)"
            :title="primaryActionTitle"
            :data-testid="hasInput ? 'chat-send-btn' : 'chat-mic-btn'"
            @click="handlePrimaryAction"
          >
            <el-icon v-if="hasInput"><Promotion /></el-icon>
            <el-icon v-else><Microphone v-if="!listening" /><Loading v-else class="is-loading" /></el-icon>
          </el-button>
        </div>
      </div>
      <!-- 附件回执行：文件项无端点 ⇒ 明示暂不支持，不做本地假附件 -->
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
  Promotion,
  Microphone,
  Loading,
  Plus,
  Close,
} from "@element-plus/icons-vue";
import AiMessageCard from "./AiMessageCard.vue";
import { createMessageId, type AiChatMessage } from "./types";
import {
  stageAiSalesOrderDraft,
  type AiNativeFormAction,
} from "../../shared/workbench/ai-form-bridge";
import {
  createAiConversationId,
  cancelAiOperation,
  confirmAiOperation,
  fetchAiSessionArchive,
  revokeAiOperation,
  sendChatMessage,
} from "../../api/ai";

const input = ref("");
const streaming = ref(false);
const conversationId = ref<string | undefined>(undefined);
const messages = ref<AiChatMessage[]>([]);
const abortController = ref<AbortController | null>(null);
const listEl = ref<HTMLElement | null>(null);
type ActiveAiEmployee = {
  employeeUid: string;
  name: string;
  post: string;
  department?: string;
  collaborators: Array<{ employeeUid: string; name: string; post: string }>;
};
const activeEmployee = ref<ActiveAiEmployee | null>(null);

/** 会话状态上报：供 AI 主交互面显示故障横幅并一键切回人工（不改变内部对话逻辑） */
const emit = defineEmits<{
  (event: "status", payload: { state: "idle" | "streaming" | "error"; message?: string }): void;
  /** 服务端会话 ID 回传（POST /api/chat 的 done 事件）：会话列表据此显示真实当前会话 */
  (event: "conversation", conversationId: string): void;
  (event: "open-form", action: AiNativeFormAction): void;
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
/** 附件菜单开合 + 结果回执行（文件项无端点 ⇒ 明示暂不支持，不放回假附件） */
const attMenuOpen = ref(false);
const attNotice = ref("");

function pickImageFromMenu(): void {
  attMenuOpen.value = false;
  attNotice.value = "";
  pickImage();
}

function attachFileUnsupported(): void {
  attMenuOpen.value = false;
  attNotice.value = "文件解析暂不支持（缺少文件上传端点）；当前仅图片可随消息发送";
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
const hasInput = computed(() => input.value.trim().length > 0 || Boolean(pendingImage.value));
const primaryActionTitle = computed(() => {
  if (streaming.value) return "AI 正在回复";
  if (listening.value) return "点击停止录音";
  if (hasInput.value) return "发送";
  return speechSupported ? "语音输入" : "当前浏览器不支持语音输入";
});

function handlePrimaryAction(): void {
  if (listening.value) {
    stopVoice();
    return;
  }
  if (hasInput.value) {
    void sendMessage();
    return;
  }
  toggleVoice();
}

/** 消费者消息流不展示只读工具过程；工具消息只用于内部状态，不参与渲染。 */
const visibleMessages = computed(() => messages.value.filter((m) => m.kind !== "tool"));

function clearChat(): void {
  if (streaming.value) abortCurrent();
  messages.value = [];
  conversationId.value = activeEmployee.value?.employeeUid
    ? `emp_${activeEmployee.value.employeeUid}_${createAiConversationId().replace(/^sess_/, "")}`
    : createAiConversationId();
  emit("conversation", conversationId.value);
}

/** 从底座真实会话归档恢复一段对话；只恢复用户/助手文本，过滤工具执行过程。 */
async function loadConversation(sessionId: string, options?: { silentEmpty?: boolean }): Promise<void> {
  if (!sessionId) return;
  if (streaming.value) abortCurrent();
  try {
    const payload = await fetchAiSessionArchive({ sessionId, limit: 1 });
    const item = payload.items?.find(
      (row) => String(row.sessionId ?? row.session_id ?? "") === sessionId,
    );
    const rawMessages = item?.messagesJson ?? item?.messages_json;
    const history = Array.isArray(rawMessages)
      ? rawMessages
          .filter(
            (m): m is Record<string, unknown> =>
              Boolean(m) && typeof m === "object" && !Array.isArray(m),
          )
          .flatMap((m) => {
            const role = m.role;
            const content = m.content;
            if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
              return [];
            }
            return [{
              id: createMessageId(),
              role: role as "user" | "assistant",
              kind: "text" as const,
              content,
              createdAt: Date.now(),
            }];
          })
      : [];
    if (!item) {
      if (options?.silentEmpty) {
        conversationId.value = sessionId;
        messages.value = [];
        briefingSent = true;
        emit("conversation", sessionId);
        emit("status", { state: "idle" });
        return;
      }
      throw new Error("该会话没有可读取的归档记录");
    }
    conversationId.value = sessionId;
    messages.value = history;
    briefingSent = true;
    emit("conversation", sessionId);
    emit("status", { state: "idle" });
    scrollToBottom();
  } catch (err) {
    const message = err instanceof Error ? err.message : "历史会话加载失败";
    emit("status", { state: "error", message });
    ElMessage.error(message);
  }
}

/** 进入某位数字员工的独立对话框：显示身份、可调度下级，并恢复其历史会话。 */
async function selectEmployee(employee: ActiveAiEmployee): Promise<void> {
  activeEmployee.value = employee;
  const sessionId = `emp_${employee.employeeUid}`;
  await loadConversation(sessionId, { silentEmpty: true });
  emit("status", { state: "idle" });
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
  if (!conversationId.value) {
    conversationId.value = createAiConversationId();
    emit("conversation", conversationId.value);
  }
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
        // 只读工具调用属于内部执行细节，不生成消费者可见消息；
        // 写操作预览仍由 tool_result.preview 单独生成确认卡。
        onToolStart: () => {
          /* 静默：不展示工具过程 */
        },
        onToolResult: (payload) => {
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
      activeEmployee.value?.employeeUid,
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

/** 只打开系统原有业务页；销售开单预填通过本地一次性草稿传递，不改写 URL 数据。 */
async function openNativeForm(action: AiNativeFormAction): Promise<void> {
  if (action.kind === "sales-order-form" && action.draft) {
    const staged = stageAiSalesOrderDraft(action.draft);
    if (!staged) {
      ElMessage.error("无法打开销售开单预填草稿，请检查浏览器本地存储权限");
      return;
    }
    if (action.confirmationId) {
      try {
        await cancelAiOperation(action.confirmationId);
        const source = messages.value.find((message) => message.confirmationId === action.confirmationId);
        if (source) {
          source.cancelled = true;
          source.confirmationId = undefined;
          source.preview = undefined;
        }
      } catch (error) {
        ElMessage.error(`无法转交销售开单：${error instanceof Error ? error.message : "取消失败"}`);
        return;
      }
    }
  }
  emit("open-form", action);
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

/** 对外暴露：快捷指令、新建/恢复会话与当前会话 ID 共用同一套真实逻辑 */
defineExpose({
  sendText: sendSuggestion,
  clearChat,
  loadConversation,
  selectEmployee,
  getConversationId: () => conversationId.value ?? null,
});

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
  if (!conversationId.value) {
    conversationId.value = createAiConversationId();
    emit("conversation", conversationId.value);
  }
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
  position: relative;
  background: var(--gray-0);
  border-left: 1px solid var(--border-light);
  min-height: 100vh;
}

.ai-agent-head {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  grid-template-areas:
    "avatar copy kind"
    "avatar collab collab";
  align-items: center;
  gap: 2px 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light, #e5e7eb);
  background: #fafbff;
}

.ai-agent-avatar {
  grid-area: avatar;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--color-primary, #4f46e5);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.ai-agent-copy {
  grid-area: copy;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ai-agent-copy strong {
  font-size: 13px;
  color: var(--text-primary, #111827);
}

.ai-agent-copy small {
  overflow: hidden;
  color: var(--text-muted, #6b7280);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-agent-kind {
  grid-area: kind;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 10px;
  font-weight: 600;
}

.ai-agent-collab {
  grid-area: collab;
  overflow: hidden;
  color: var(--text-secondary, #4b5563);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px 220px;
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
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  padding: 10px 18px 16px;
  border-top: 0;
  background: linear-gradient(to bottom, transparent, var(--gray-0) 28%, var(--gray-0));
  flex-shrink: 0;
  pointer-events: none;
}

.ai-input-box {
  max-width: 740px;
  margin: 0 auto;
  padding: 5px 8px 7px;
  border: 1px solid var(--border-light);
  border-radius: 22px;
  background: var(--gray-0);
  box-shadow: 0 8px 30px rgba(22, 24, 29, 0.08);
  transition: border-color 160ms ease, box-shadow 160ms ease;
  pointer-events: auto;
}

.ai-input-box :deep(.el-textarea__inner) {
  min-height: 44px !important;
  border-radius: 0;
  background: transparent;
  border: 0;
  padding: 6px 8px 3px;
  font-size: 13px;
  line-height: 1.5;
  transition: none;
  box-shadow: none;
}
.ai-input-box :deep(.el-textarea__inner:focus) {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
.ai-input-box:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 8px 30px rgba(22, 24, 29, 0.12), var(--shadow-focus);
}

.ai-inline-att {
  position: relative;
}

.ai-inline-plus {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ai-inline-plus:hover {
  background: var(--bg-soft, #f3f4f6);
  color: var(--primary, #2563eb);
}

.ai-input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.ai-primary-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 14px;
}

.ai-pending-row {
  max-width: 740px;
  margin: 0 auto 6px;
  pointer-events: auto;
}

.ai-att-notice,
.ai-voice-bar {
  max-width: 740px;
  margin-left: auto;
  margin-right: auto;
  pointer-events: auto;
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
