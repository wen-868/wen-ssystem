<template>
  <!--
    状态标签 StatusTag — 对齐设计稿 v1.6 .tag
    规格：10.5px / padding 3px 8px / 胶囊圆角 / 前置 5px 圆点（currentColor）
    色彩口径：绿=正常 · 橙=欠费/预警 · 红=冻结/故障 · 紫=自定义 · 蓝=进行中 · 灰=中性/草稿
  -->
  <span class="status-tag" :class="`status-tag--${tone}`">
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import type { StatusTone } from './status'

withDefaults(
  defineProps<{
    /** 标签文案 */
    text?: string
    /** 色板语义 */
    tone?: StatusTone
  }>(),
  { text: '', tone: 'neutral' }
)
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--tag-gap);
  font-size: var(--tag-font-size);
  line-height: 1;
  padding: var(--tag-padding);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  white-space: nowrap;
}
.status-tag::before {
  content: '';
  width: var(--tag-dot-size);
  height: var(--tag-dot-size);
  border-radius: var(--radius-full);
  background: currentColor;
  flex: none;
}

/* 绿=正常 */
.status-tag--success {
  background: var(--color-success-soft);
  color: var(--color-success);
}
/* 橙=欠费/预警 */
.status-tag--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
/* 红=冻结/故障 */
.status-tag--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
/* 紫=自定义 */
.status-tag--purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
/* 蓝=进行中/信息 */
.status-tag--info {
  background: var(--color-info-soft);
  color: var(--color-info);
}
/* 灰=中性/草稿 */
.status-tag--neutral {
  background: var(--g1);
  color: var(--g5);
}
</style>
