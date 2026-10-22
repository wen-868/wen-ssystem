<template>
  <aside class="ms-sidebar" aria-label="人工操作台导航">
    <div class="ms-title">人工操作台</div>
    <nav class="ms-nav">
      <div v-for="group in groups" :key="group.groupCode" class="ms-group">
        <button
          type="button"
          class="ms-group-head"
          :class="{ open: isOpen(group.groupCode) }"
          :aria-expanded="isOpen(group.groupCode)"
          @click="toggle(group.groupCode)"
        >
          <span class="ms-group-title">{{ group.title }}</span>
          <span class="ms-group-count">{{ group.items.length }}</span>
        </button>
        <div v-show="isOpen(group.groupCode)" class="ms-items">
          <button
            v-for="entry in group.items"
            :key="entry.menuCode"
            type="button"
            class="ms-item"
            :class="{ active: entry.path === activePath }"
            :data-menu-code="entry.menuCode"
            @click="$emit('open', entry)"
          >
            {{ entry.title }}
          </button>
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { ManifestGroup, ManifestItem } from "../shared/workbench/route-manifest";

const props = defineProps<{
  groups: ManifestGroup[];
  activePath: string;
}>();

defineEmits<{
  (event: "open", entry: ManifestItem): void;
}>();

const openGroups = ref<Record<string, boolean>>({});

function isOpen(groupCode: string): boolean {
  return openGroups.value[groupCode] === true;
}

function toggle(groupCode: string): void {
  openGroups.value[groupCode] = !isOpen(groupCode);
}

function openGroupOfActivePath(): void {
  const group = props.groups.find((entry) => entry.items.some((item) => item.path === props.activePath));
  if (group) openGroups.value[group.groupCode] = true;
}

onMounted(openGroupOfActivePath);
watch(() => props.activePath, openGroupOfActivePath);
</script>

<style scoped>
.ms-sidebar {
  width: 208px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--frost-sidebar, #1f2937);
  border-right: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.ms-title {
  height: var(--topbar-height, 56px);
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--sidebar-text-primary, #f9fafb);
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
}

.ms-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.ms-group {
  margin-bottom: 4px;
}

.ms-group-head {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text-secondary, #d1d5db);
  font-size: 13px;
  cursor: pointer;
}

.ms-group-head:hover,
.ms-group-head.open {
  background: rgba(255, 255, 255, 0.06);
  color: var(--sidebar-text-primary, #f9fafb);
}

.ms-group-count {
  font-size: 11px;
  opacity: 0.6;
}

.ms-items {
  padding: 2px 0 2px 10px;
}

.ms-item {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text-secondary, #d1d5db);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--sidebar-text-primary, #f9fafb);
}

.ms-item.active {
  background: var(--color-primary-soft, rgba(63, 111, 239, 0.18));
  color: var(--sidebar-text-active, #93b4ff);
  font-weight: 500;
}
</style>
