<template>
  <div class="asb" role="status" aria-label="Agent 运行状态" data-testid="agent-status-bar">
    <span class="asb-item" :data-state="stateAttr">
      <span class="asb-dot" />
      <span>{{ sessionLabel }}</span>
    </span>
    <span v-if="pendingReviewCount !== null" class="asb-item asb-review" data-testid="agent-pending-review">
      待审阅 {{ pendingReviewCount }}
    </span>
    <!--
      原型顶部还有「数字员工在线数 / 任务进度」（融合版 L14537）：
      当前 AI 底座无「多员工在线」与「任务进度」真实端点（能力台账 ai-06 = PLANNED），
      按红线不得编造 ⇒ 不渲染，并在回传卡差异清单登记（WORKBENCH-06 §红线「不得用 mock」）。
    -->
    <button
      type="button"
      class="asb-link"
      data-testid="agent-ledger-entry"
      @click="$emit('open-ledger')"
    >
      能力台账
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * 顶部 Agent 状态区（WORKBENCH-06 · 原型 .top 的 Agent 状态/待审阅/进度位，L950-955 注入段）
 *
 * 数据源全部真实：
 *   - 会话通道 = AiChatPanel 上报的 SSE 连接状态（idle/streaming/error）；
 *   - 待审阅 = AI 底座 GET /api/chat/confirmations 长度（失败 ⇒ null 隐藏，不显示 0 假装）。
 */
import { computed } from "vue";
import type { MenuLoadState } from "../../shared/workbench/menu-access";

const props = defineProps<{
  sessionState: "idle" | "streaming" | "error";
  /** null = 未取到（底座不可达），不显示 */
  pendingReviewCount: number | null;
  menuState: MenuLoadState;
}>();

defineEmits<{
  (event: "open-ledger"): void;
}>();

const sessionLabel = computed(() => {
  switch (props.sessionState) {
    case "streaming":
      return "AI 对话进行中";
    case "error":
      return "AI 会话故障";
    default:
      return "AI 在线待命";
  }
});

const stateAttr = computed(() =>
  props.menuState === "error" ? "degraded" : props.sessionState,
);
</script>

<style scoped>
.asb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.asb-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--wb-hover, #f4f6f8);
  border: 1px solid var(--wb-line, #eceef1);
  white-space: nowrap;
}
.asb-item[data-state="idle"] .asb-dot {
  background: #16a34a;
}
.asb-item[data-state="streaming"] .asb-dot {
  background: #2563eb;
  animation: asb-pulse 1s ease-in-out infinite;
}
.asb-item[data-state="error"] .asb-dot,
.asb-item[data-state="degraded"] .asb-dot {
  background: #dc2626;
}
.asb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8a8f98;
  flex-shrink: 0;
}
@keyframes asb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.asb-review {
  color: #b45309;
  background: #fff7e6;
  border-color: #f5d9a8;
}
.asb-link {
  border: 0;
  background: transparent;
  color: var(--wb-primary, #2563eb);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.asb-link:hover {
  text-decoration: underline;
}
</style>
