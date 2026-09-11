<template>
  <!--
    指标卡 StatCard — 对齐设计稿 v1.6 .kpi
    规格：白底 + 1px 浅灰描边 + 12px 圆角；标题 11.5px 灰；数值 19px 700；环比 10.5px（涨绿跌红）
  -->
  <div class="stat-card">
    <div class="stat-card__title">{{ title }}</div>
    <div class="stat-card__value">{{ formattedValue }}</div>
    <div v-if="deltaText" class="stat-card__delta" :class="deltaClass">
      {{ deltaText }}
    </div>
    <div v-else-if="$slots.extra" class="stat-card__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 指标名称 */
    title: string
    /** 指标数值 */
    value: number | string
    /** 环比数值（正=上升 绿，负=下降 红）。为空则不展示环比行 */
    delta?: number | null
    /** 环比单位，默认 % */
    deltaUnit?: string
    /** 数值前缀，如 ¥ */
    prefix?: string
    /** 数值后缀，如 家 / 次 */
    suffix?: string
    /** 千分位格式化，默认开启 */
    thousands?: boolean
  }>(),
  {
    delta: null,
    deltaUnit: '%',
    prefix: '',
    suffix: '',
    thousands: true,
  }
)

const formattedValue = computed(() => {
  const raw = props.value
  if (typeof raw === 'number' && props.thousands) {
    return `${props.prefix}${raw.toLocaleString('zh-CN')}${props.suffix}`
  }
  return `${props.prefix}${raw}${props.suffix}`
})

const deltaClass = computed(() => {
  if (props.delta === null || props.delta === undefined) return ''
  return props.delta >= 0 ? 'is-up' : 'is-down'
})

const deltaText = computed(() => {
  if (props.delta === null || props.delta === undefined) return ''
  const arrow = props.delta >= 0 ? '↑' : '↓'
  const abs = Math.abs(props.delta)
  return `环比 ${arrow} ${abs}${props.deltaUnit}`
})
</script>

<style scoped>
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--g2);
  border-radius: var(--card-radius);
  padding: var(--kpi-padding);
  min-width: 0;
}
.stat-card__title {
  font-size: var(--kpi-title-size);
  color: var(--g5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-card__value {
  font-size: var(--kpi-value-size);
  font-weight: var(--font-bold);
  margin-top: var(--space-1);
  letter-spacing: 0.2px;
  white-space: nowrap;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.stat-card__delta {
  font-size: var(--kpi-delta-size);
  margin-top: var(--space-1);
  white-space: nowrap;
  color: var(--g4);
}
.stat-card__delta.is-up {
  color: var(--color-success);
}
.stat-card__delta.is-down {
  color: var(--color-danger);
}
.stat-card__extra {
  font-size: var(--kpi-delta-size);
  margin-top: var(--space-1);
  color: var(--g4);
}
</style>
