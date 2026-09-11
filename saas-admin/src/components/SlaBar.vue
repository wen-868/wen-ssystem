<template>
  <!--
    SLA 剩余时间条 SlaBar — 对齐设计稿 v1.6 .sla
    规格：高 4px、底 --g1、胶囊圆角；剩余充足=绿，预警=橙，超时/紧急=红
    用法：<SlaBar label="首响" :remaining-minutes="72" :total-minutes="120" />
  -->
  <div class="sla-bar">
    <div v-if="label || remainingText" class="sla-bar__head">
      <span class="sla-bar__label">{{ label }}</span>
      <span class="sla-bar__text" :class="`is-${tone}`">{{ remainingText }}</span>
    </div>
    <div class="sla-bar__track" :class="`is-${tone}`">
      <i :style="{ width: percentText }"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 阶段名，如 首响 / 解决 */
    label?: string
    /** 剩余分钟数（负数表示已超时） */
    remainingMinutes?: number
    /** SLA 总时长（分钟），用于计算进度 */
    totalMinutes?: number
    /** 进度百分比（0-100）。与 remainingMinutes 二选一，优先使用本值 */
    percent?: number | null
  }>(),
  { label: '', remainingMinutes: 0, totalMinutes: 0, percent: null }
)

/** 剩余比例：0~100，越接近 0 越紧急 */
const remainRatio = computed(() => {
  if (props.percent !== null && props.percent !== undefined) {
    return Math.min(100, Math.max(0, props.percent))
  }
  if (!props.totalMinutes) return 0
  const r = (props.remainingMinutes / props.totalMinutes) * 100
  return Math.min(100, Math.max(0, r))
})

const percentText = computed(() => `${remainRatio.value}%`)

/** 绿=充足 · 橙=预警（≤50%）· 红=紧急（≤20% 或已超时） */
const tone = computed(() => {
  if (props.remainingMinutes < 0) return 'danger'
  if (remainRatio.value <= 20) return 'danger'
  if (remainRatio.value <= 50) return 'warning'
  return 'success'
})

/** 剩余文案：如「首响 SLA 剩 1h12m」 */
const remainingText = computed(() => {
  if (!props.label) return ''
  const m = Math.max(0, Math.round(props.remainingMinutes))
  if (props.remainingMinutes < 0) return `${props.label} SLA 已超时`
  const h = Math.floor(m / 60)
  const mm = m % 60
  const t = h > 0 ? `${h}h${mm}m` : `${mm}m`
  return `${props.label} SLA 剩 ${t}`
})
</script>

<style scoped>
.sla-bar {
  width: 100%;
}
.sla-bar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--tag-font-size);
  color: var(--g5);
}
.sla-bar__label {
  white-space: nowrap;
}
.sla-bar__text {
  white-space: nowrap;
}
.sla-bar__text.is-success {
  color: var(--color-success);
}
.sla-bar__text.is-warning {
  color: var(--color-warning);
}
.sla-bar__text.is-danger {
  color: var(--color-danger);
}
.sla-bar__track {
  height: var(--sla-height);
  background: var(--g1);
  border-radius: var(--radius-full);
  margin-top: var(--space-2);
  overflow: hidden;
}
.sla-bar__track i {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-success);
  transition: width var(--transition-normal);
}
.sla-bar__track.is-warning i {
  background: var(--color-warning);
}
.sla-bar__track.is-danger i {
  background: var(--color-danger);
}
</style>
