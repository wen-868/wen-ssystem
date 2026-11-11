<template>
  <footer class="cmp" :class="{ 'is-compact': compact }" data-testid="chat-composer">
    <!-- 语音录制态（原型 #micBtn L981「语音输入」的录制反馈；识别文本直接回写输入框，
         随既有真实链发出；不支持的浏览器如实提示，不装录了音） -->
    <div v-if="listening" class="cmp-voice-bar" role="status" data-testid="composer-voice-bar">
      <span class="cmp-rec-dot" />
      <span class="cmp-rec-text">语音录制中 {{ voiceElapsedText }}</span>
      <button type="button" data-testid="composer-voice-stop" @click="stopVoice">完成</button>
      <button type="button" data-testid="composer-voice-cancel" @click="cancelVoice">取消</button>
    </div>
    <form class="cmp-form" @submit.prevent="submit">
      <div class="cmp-att-wrap">
        <button
          type="button"
          class="cmp-att-btn"
          :disabled="streaming"
          title="附件（图片 / 文件）"
          data-testid="composer-att-btn"
          @click="attMenuOpen = !attMenuOpen"
        >
          ＋
        </button>
        <!-- 附件菜单（原型 .input-zone L976 的 add-btn/up-menu 语义）：
             图片随消息发送只在会话输入区有真实链（AiSidePanel→POST /api/chat image 参数），
             信息流入口不复制第二套发送，故如实标注去向；文件解析无端点 ⇒ 暂不支持 -->
        <div v-if="attMenuOpen" class="cmp-att-menu" data-testid="composer-att-menu">
          <button
            type="button"
            data-testid="composer-att-image"
            @click="noticeFor('image')"
          >
            图片 · 请进入会话后附图
          </button>
          <button
            type="button"
            class="is-pending"
            data-testid="composer-att-file"
            @click="noticeFor('file')"
          >
            文件 · 暂不支持
          </button>
        </div>
      </div>
      <textarea
        ref="txtEl"
        v-model="text"
        class="cmp-input"
        :placeholder="compact ? '问智享AI（回车发送）…' : '给智享AI发消息…'"
        rows="1"
        :disabled="streaming"
        data-testid="composer-input"
        @keydown.enter.exact.prevent="submit"
        @input="autoGrow"
      />
      <button
        type="button"
        class="cmp-mic-btn"
        :class="{ 'is-recording': listening }"
        :disabled="streaming || !speechSupported"
        :title="
          speechSupported
            ? listening
              ? '点击停止录音'
              : '语音输入'
            : '当前浏览器不支持语音输入（请用 Chrome/Edge）'
        "
        data-testid="composer-mic-btn"
        @click="toggleVoice"
      >
        🎤
      </button>
      <button
        type="submit"
        class="cmp-send"
        :disabled="!canSend"
        :title="streaming ? 'AI 正在回复' : '发送'"
        data-testid="composer-send"
      >
        <el-icon :size="16"><Promotion /></el-icon>
      </button>
    </form>
    <p v-if="attNotice" class="cmp-att-notice" role="status" data-testid="composer-att-notice">
      {{ attNotice }}
    </p>
    <p class="cmp-hint">读操作自动执行 · 写操作需你确认 · 数据不出域</p>
  </footer>
</template>

<script setup lang="ts">
/**
 * 底部固定 AI 输入区（WORKBENCH-06 · 原型 .input-zone L976）
 *
 * 原型口径（paintMain L2065）：信息流态也直接发消息，不先进会话 ⇒ 本组件只 emit send，
 * 由壳层切 chat 面并复用既有真实发送链（AiChatPanel.sendQuickCommand → POST /api/chat）。
 * 人工业务页态（compact）：收成一条入口（原型 openWB 时隐藏输入区，这里保留最小协同入口，
 * 满足卡 §一.5「人工页仍可保持 AI 协同入口」），不复制第二套对话实现。
 *
 * WORKBENCH-10 区域 C 增补（对齐原型 .input-zone 完整结构）：
 *   - 附件菜单（add-btn/up-menu 语义）：图片项如实指路会话输入区（唯一有 image 参数真实链的位置）、
 *     文件项显示「暂不支持」（api/ai.ts 无文件上传端点，不做假回显）；
 *   - 语音录制态（mic-btn 语义）：Web Speech 识别结果回写输入框后随同一 send 链发出，
 *     录制中显示实时时长，支持完成/取消（取消还原草稿）。
 */
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { Promotion } from "@element-plus/icons-vue";

const props = defineProps<{
  compact?: boolean;
  streaming?: boolean;
}>();

const emit = defineEmits<{
  (event: "send", prompt: string): void;
}>();

const text = ref("");
const txtEl = ref<HTMLTextAreaElement | null>(null);
const canSend = computed(() => text.value.trim().length > 0 && !props.streaming);

/** 附件菜单：本入口（信息流态）没有随消息附件的真实链，菜单只做诚实指路，不产生假附件 */
const attMenuOpen = ref(false);
const attNotice = ref("");

function noticeFor(kind: "image" | "file"): void {
  attMenuOpen.value = false;
  attNotice.value =
    kind === "image"
      ? "图片识别请在会话输入区使用（该入口已支持图片随消息发送）"
      : "文件解析暂不支持（缺少文件上传端点）";
}

/** 语音输入（与侧栏面板同一浏览器原生识别能力；不支持则禁用按钮并如实提示） */
const speechSupported =
  typeof window !== "undefined" &&
  Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );
const listening = ref(false);
const voiceSeconds = ref(0);
let voiceTimer: ReturnType<typeof setInterval> | null = null;
let voiceCancelled = false;
let voiceDraftBefore = "";
let recognition: {
  start: () => void;
  stop: () => void;
  lang?: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
} | null = null;

const voiceElapsedText = computed(() => {
  const s = voiceSeconds.value;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
});

function stopVoiceTimer(): void {
  if (voiceTimer) {
    clearInterval(voiceTimer);
    voiceTimer = null;
  }
}

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

function toggleVoice(): void {
  if (listening.value) {
    stopVoice();
    return;
  }
  const rec = getRecognition();
  if (!rec) {
    attNotice.value = "当前浏览器不支持语音输入（请用 Chrome/Edge），可手动输入";
    return;
  }
  voiceCancelled = false;
  voiceDraftBefore = text.value;
  rec.onresult = (e) => {
    if (voiceCancelled) return;
    const spoken = e.results[0]?.[0]?.transcript ?? "";
    if (spoken) text.value = voiceDraftBefore ? `${voiceDraftBefore} ${spoken}` : spoken;
  };
  rec.onend = () => {
    listening.value = false;
    stopVoiceTimer();
  };
  rec.onerror = () => {
    listening.value = false;
    stopVoiceTimer();
    attNotice.value = "语音识别中断，可重试或手动输入";
  };
  try {
    rec.start();
    listening.value = true;
    stopVoiceTimer();
    voiceSeconds.value = 0;
    voiceTimer = setInterval(() => {
      voiceSeconds.value += 1;
    }, 1000);
  } catch {
    listening.value = false;
    attNotice.value = "无法启动语音识别，请重试";
  }
}

function stopVoice(): void {
  recognition?.stop();
  listening.value = false;
  stopVoiceTimer();
}

function cancelVoice(): void {
  voiceCancelled = true;
  recognition?.stop();
  text.value = voiceDraftBefore;
  listening.value = false;
  stopVoiceTimer();
}

onBeforeUnmount(() => {
  stopVoiceTimer();
});

function autoGrow(): void {
  const el = txtEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function submit(): void {
  const value = text.value.trim();
  if (!value || props.streaming) return;
  text.value = "";
  attNotice.value = "";
  nextTick(autoGrow);
  emit("send", value);
}
</script>

<style scoped>
.cmp {
  flex-shrink: 0;
  padding: 10px 18px 12px;
  background: var(--wb-panel, #fff);
  border-top: 1px solid var(--wb-line, #eceef1);
}
.cmp-form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border: 1px solid var(--wb-line-strong, #dde2e9);
  border-radius: 12px;
  padding: 8px 10px;
  background: var(--wb-panel, #fff);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cmp-form:focus-within {
  border-color: var(--wb-primary, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.cmp-input {
  flex: 1;
  border: 0;
  outline: none;
  resize: none;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wb-ink, #16181d);
  background: transparent;
  max-height: 120px;
  font-family: inherit;
}
.cmp-send {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.cmp-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 附件菜单（原型 .input-zone add-btn + up-menu 语义） */
.cmp-att-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.cmp-att-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--wb-line-strong, #dde2e9);
  border-radius: 8px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
}

.cmp-att-btn:hover {
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}

.cmp-att-menu {
  position: absolute;
  left: 0;
  bottom: 34px;
  z-index: 30;
  min-width: 188px;
  background: var(--wb-panel, #fff);
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 4px;
}

.cmp-att-menu button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-ink, #16181d);
}

.cmp-att-menu button:hover {
  background: var(--wb-line, #f3f4f6);
}

.cmp-att-menu button.is-pending {
  color: #92400e;
}

.cmp-att-notice {
  margin: 6px 2px 0;
  padding: 4px 8px;
  font-size: 11px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
}

/* 语音按钮 + 录制态条（原型 #micBtn 语义的录制反馈） */
.cmp-mic-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--wb-line-strong, #dde2e9);
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
}

.cmp-mic-btn:hover {
  border-color: var(--wb-primary, #2563eb);
}

.cmp-mic-btn.is-recording {
  border-color: #dc2626;
  background: #fdf2f2;
}

.cmp-voice-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 5px 10px;
  border: 1px solid #fca5a5;
  background: #fdf2f2;
  border-radius: 8px;
  font-size: 12px;
  color: #b42318;
}

.cmp-rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
  animation: cmpRecBlink 1s ease-in-out infinite;
}

@keyframes cmpRecBlink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.cmp-rec-text {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.cmp-voice-bar button {
  border: 1px solid #b42318;
  background: #fff;
  color: #b42318;
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 11px;
  cursor: pointer;
}
.cmp-hint {
  margin: 6px 2px 0;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.cmp.is-compact {
  padding: 8px 18px 10px;
}
.cmp.is-compact .cmp-form {
  padding: 5px 10px;
}
.cmp.is-compact .cmp-input {
  min-height: 22px;
}
.cmp.is-compact .cmp-hint {
  display: none;
}
</style>
