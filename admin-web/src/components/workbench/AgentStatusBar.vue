<template>
  <div class="asb" role="status" aria-label="顶部待审阅" data-testid="agent-status-bar">
    <!--
      UI-PARITY-BASE §四.2.5 + DELTA-CONTRACT top_bar：
      顶栏仅保留原型业务要素，本组件收敛为「待审阅」徽标容器。
      已按合同移除：研发健康指标（探针灯）/ 数字员工数 / 无上下文步骤计数 / 能力台账入口 ——
      任务与员工明细由右侧任务中心承载，AI 就绪态由对话面自身故障态如实呈现。
      数据纪律不变：真实 /api/chat/confirmations；失败隐藏（null 不展示），不显示假 0。
    -->
    <span v-if="pendingReviewCount !== null" class="asb-item asb-review" data-testid="agent-pending-review">
      待审阅 {{ pendingReviewCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * 顶栏「待审阅」徽标（WORKBENCH-06F1 → UI-PARITY-BASE 收敛版）
 *
 * 历史口径保留（红线仍有效）：
 *   - 只接真实端点数据；pendingReviewCount=null（未取到/失败）⇒ 徽标整体隐藏，绝不显示 0 假装无待办；
 *   - 探针/员工/步骤格与能力台账入口已按 UI-PARITY-BASE 卡 §四.2.5 移除（合同 top_bar.forbidden）；
 *     ai-readiness / agent-metrics 模块保留在 shared 层供其余消费方使用。
 */
defineProps<{
  /** 待审阅数（null = 未取到，隐藏该徽标） */
  pendingReviewCount: number | null;
}>();
</script>

<style scoped>
.asb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wb-ink2, #737373);
  flex-wrap: wrap;
}
.asb-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--wb-hover, #f2f4fa);
  border: 1px solid var(--wb-line, #e5e5e5);
  white-space: nowrap;
}
.asb-review {
  color: #b45309;
  background: #fff7e6;
  border-color: #f5d9a8;
}
html[data-wb-theme="dark"] .asb-review {
  color: #e8b878;
  background: rgba(232, 184, 120, 0.14);
  border-color: rgba(232, 184, 120, 0.4);
}
</style>
