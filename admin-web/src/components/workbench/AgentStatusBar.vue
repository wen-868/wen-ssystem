<template>
  <div class="asb" role="status" aria-label="Agent 运行状态" data-testid="agent-status-bar">
    <!-- ① AI 可用性：**只有真实探针 ready 才绿**（state=ready）；其余一律非绿 -->
    <span class="asb-item" :data-state="readinessState" data-testid="agent-ai-state">
      <span class="asb-dot" />
      <span data-testid="agent-ai-state-label">{{ readinessLabel }}</span>
      <button
        v-if="readinessState === 'error' || readinessState === 'degraded'"
        type="button"
        class="asb-retry"
        data-testid="agent-ai-retry"
        :disabled="checking"
        title="重新探测 AI 底座就绪状态（60 秒冷却）"
        @click="$emit('retry-readiness')"
      >
        重试
      </button>
    </span>

    <!-- ② 数字员工：真实 GET /api/ai/employees；**只显示可证实的「N 人就绪」，绝不写 N/M** -->
    <span
      class="asb-item"
      :data-state="employeesAttr"
      data-testid="agent-employees"
      :title="employeesTitle"
    >
      <span>数字员工</span>
      <b data-testid="agent-employees-value">{{ employeesText }}</b>
    </span>

    <!-- ③ 任务进度：真实 GET /api/ai/agent/plans；口径写在文案里，不用原型演示数字 -->
    <span
      class="asb-item"
      :data-state="plansAttr"
      data-testid="agent-plans"
      :title="plansTitle"
    >
      <span>任务进度</span>
      <b data-testid="agent-plans-value">{{ plansText }}</b>
    </span>

    <!-- ④ 待审阅（真实 /api/chat/confirmations；失败隐藏，不显示假 0） -->
    <span v-if="pendingReviewCount !== null" class="asb-item asb-review" data-testid="agent-pending-review">
      待审阅 {{ pendingReviewCount }}
    </span>

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
 * 顶部 Agent 状态区（WORKBENCH-06F1）
 *
 * 与 WORKBENCH-06 版的**本质差别**（凌舟验收 B1/B2）：
 *   - 旧版把 `sessionState=idle` 映射成绿色「AI 在线待命」⇒ AI 真实不可达时假绿（已驳回）；
 *   - 新版一律以**真实探针**（GET /api/health/ready）判定，只有 `ready` 才绿，
 *     含 unchecked/checking/degraded/error 五种显式状态；
 *   - 旧版 D-2 以「无端点」省掉员工数/任务进度（前提被证伪）；新版接真实
 *     `GET /api/ai/employees` 与 `GET /api/ai/agent/plans`，各自独立降级。
 *
 * 文案纪律（红线）：
 *   - 员工：只显示「N 人就绪」；底座无 online 字段 ⇒ **永不出现 N/M 分母**；
 *   - 计划：显示「进行中计划 N」或「步骤 C/T」；两个都不可得 ⇒ 「进度未知」；
 *   - 任一数据源失败 ⇒ 该格单独显示「未知」，**不显示 0、不复用旧值**。
 */
import { computed } from "vue";
import type { MenuLoadState } from "../../shared/workbench/menu-access";
import {
  agentEmployees,
  agentPlans,
  type AgentMetricState,
} from "../../shared/workbench/agent-metrics";
import {
  readinessLabel as labelOf,
  type AiReadinessState,
} from "../../shared/workbench/ai-readiness";

const props = defineProps<{
  /** AI 底座真实就绪态（由壳层探针写入，**不再来自 sessionState**） */
  readinessState: AiReadinessState;
  /** 待审阅数（null = 未取到，隐藏该格） */
  pendingReviewCount: number | null;
  menuState: MenuLoadState;
}>();

defineEmits<{
  (event: "open-ledger"): void;
  (event: "retry-readiness"): void;
}>();

const readinessLabel = computed(() => labelOf(props.readinessState));
const checking = computed(() => props.readinessState === "checking");

/** 员工格：ready ⇒ 「N 人就绪」；loading ⇒ 「…」；unknown ⇒ 「未知」 */
const employeesText = computed(() => {
  const metric = agentEmployees.value;
  if (metric.state === "loading") return "读取中";
  if (metric.state !== "ready" || metric.count === null) return "未知";
  // 红线：底座无"在线"字段 ⇒ 不写分母 N/M；只写可证实的"就绪人数"
  return `${metric.count} 人就绪`;
});
const employeesAttr = computed<AgentMetricState | "degraded">(() =>
  agentEmployees.value.state === "unknown" ? "degraded" : agentEmployees.value.state,
);
const employeesTitle = computed(() => {
  const metric = agentEmployees.value;
  if (metric.state === "ready") return `GET /api/ai/employees 返回 ${metric.count ?? 0} 名启用员工`;
  if (metric.state === "loading") return "正在读取数字员工列表";
  return `数字员工数据不可得：${metric.error ?? "未知原因"}（不显示 0，避免冒充真实值）`;
});

/** 计划格：优先「步骤 C/T」，无步骤数据则「进行中计划 N」，都无 ⇒ 「进度未知」 */
const plansText = computed(() => {
  const metric = agentPlans.value;
  if (metric.state === "loading") return "读取中";
  if (metric.state !== "ready") return "未知";
  if (metric.stepsTotal !== null && metric.stepsDone !== null) {
    return `步骤 ${metric.stepsDone}/${metric.stepsTotal}`;
  }
  if (metric.runningPlans !== null) return `进行中计划 ${metric.runningPlans}`;
  return "进度未知";
});
const plansAttr = computed<AgentMetricState | "degraded">(() =>
  agentPlans.value.state === "unknown" ? "degraded" : agentPlans.value.state,
);
const plansTitle = computed(() => {
  const metric = agentPlans.value;
  if (metric.state === "ready") {
    const parts = [`GET /api/ai/agent/plans 返回 ${metric.totalPlans ?? 0} 个计划`];
    if (metric.runningPlans !== null) parts.push(`进行中 ${metric.runningPlans}`);
    if (metric.stepsTotal !== null) parts.push(`步骤完成 ${metric.stepsDone}/${metric.stepsTotal}`);
    return parts.join(" · ");
  }
  if (metric.state === "loading") return "正在读取 Agent 计划列表";
  return `任务进度不可得：${metric.error ?? "未知原因"}（不显示假 0）`;
});
</script>

<style scoped>
.asb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
  flex-wrap: wrap;
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
.asb-item b {
  font-weight: 600;
  color: var(--wb-ink, #16181d);
}
/* 只有 ready 是绿色（红线：任何非 ready 状态不得绿） */
.asb-item[data-state="ready"] .asb-dot {
  background: #16a34a;
}
.asb-item[data-state="checking"] .asb-dot {
  background: #2563eb;
  animation: asb-pulse 1s ease-in-out infinite;
}
.asb-item[data-state="unchecked"] .asb-dot {
  background: #94a3b8;
}
.asb-item[data-state="degraded"] .asb-dot,
.asb-item[data-state="error"] .asb-dot {
  background: #dc2626;
}
.asb-item[data-state="degraded"] {
  background: #fff7e6;
  border-color: #f5d9a8;
  color: #b45309;
}
.asb-item[data-state="error"] {
  background: #fdf2f2;
  border-color: #f0c2c2;
  color: #b42318;
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
.asb-retry {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0 0 0 2px;
  text-decoration: underline;
}
.asb-retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
