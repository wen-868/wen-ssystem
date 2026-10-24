<template>
  <footer class="cmp" :class="{ 'is-compact': compact }" data-testid="chat-composer">
    <form class="cmp-form" @submit.prevent="submit">
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
        type="submit"
        class="cmp-send"
        :disabled="!canSend"
        :title="streaming ? 'AI 正在回复' : '发送'"
        data-testid="composer-send"
      >
        <el-icon :size="16"><Promotion /></el-icon>
      </button>
    </form>
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
 */
import { computed, nextTick, ref } from "vue";
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
