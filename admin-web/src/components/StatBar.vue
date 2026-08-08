<template>
  <div class="stat-bar">
    <div
      v-for="item in stats"
      :key="item.label"
      class="stat-bar-item"
      :class="{ 'stat-bar-item--primary': item.primary }"
    >
      <span class="stat-bar-value" :class="{ 'stat-bar-value--primary': item.primary }">
        {{ item.value }}
      </span>
      <span class="stat-bar-label">{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** 统计项：{ label, value, primary? } */
  stats: Array<{ label: string; value: string | number; primary?: boolean }>
}>()
</script>

<style scoped>
.stat-bar {
  display: flex;
  background: var(--gray-0);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 14px 10px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}
.stat-bar-item {
  flex: 1;
  text-align: center;
  padding: 4px 0;
  border-right: 1px solid var(--border-light);
  position: relative;
}
.stat-bar-item:last-child {
  border-right: none;
}
.stat-bar-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.stat-bar-value--primary {
  color: var(--color-primary);
}
.stat-bar-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 5px;
}
</style>
