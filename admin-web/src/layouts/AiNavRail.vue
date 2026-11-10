<template>
  <nav class="anr" aria-label="AI 数字员工导航">
    <div class="anr-brand">AI 员工</div>
    <button
      v-for="group in groups"
      :key="group.groupCode"
      type="button"
      class="anr-item"
      :class="{ active: group.groupCode === activeGroupCode }"
      :data-group-code="group.groupCode"
      @click="$emit('select', group.groupCode)"
    >
      <span class="anr-title">{{ group.title }}</span>
      <span class="anr-count">{{ group.items.length }}</span>
    </button>
    <p v-if="groups.length === 0" class="anr-empty">暂无可访问模块</p>
  </nav>
</template>

<script setup lang="ts">
import type { ManifestGroup } from "../shared/workbench/route-manifest";

defineProps<{
  groups: ManifestGroup[];
  activeGroupCode: string;
}>();

defineEmits<{
  (event: "select", groupCode: string): void;
}>();

// 说明：rail 只做一级模块导航，不承载业务动作；二级入口在信息流容器内以“打开人工操作台”方式跳转。
</script>

<style scoped>
.anr {
  width: 88px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 6px;
  background: var(--frost-sidebar, #1f2937);
  border-right: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  overflow-y: auto;
}

.anr-brand {
  height: var(--topbar-height, 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--sidebar-text-primary, #f9fafb);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  margin-bottom: 4px;
}

.anr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sidebar-text-secondary, #d1d5db);
  font-size: 12px;
  cursor: pointer;
}

.anr-item:hover,
.anr-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text-primary, #f9fafb);
}

.anr-item.active {
  box-shadow: inset 2px 0 0 var(--color-primary, #3f6fef);
}

.anr-count {
  font-size: 11px;
  opacity: 0.6;
}

.anr-empty {
  margin: 8px 0;
  font-size: 11px;
  color: var(--sidebar-text-secondary, #d1d5db);
  text-align: center;
}
</style>
