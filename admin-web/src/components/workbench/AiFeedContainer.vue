<template>
  <section class="afc" aria-label="AI 信息流">
    <header class="afc-head">
      <h2 class="afc-title">{{ title }}</h2>
      <span class="afc-badge">骨架</span>
    </header>

    <div class="afc-placeholder">
      <p class="afc-placeholder-title">AI 信息流容器（待 P2 接入）</p>
      <p class="afc-placeholder-desc">
        晨报、待办、异常提醒与执行记录将在 P2 接入；本骨架不展示任何模拟数据。
      </p>
    </div>

    <div v-if="items.length > 0" class="afc-items">
      <p class="afc-items-title">当前角色可见入口（{{ items.length }}）</p>
      <button
        v-for="entry in items"
        :key="entry.menuCode"
        type="button"
        class="afc-item"
        :data-menu-code="entry.menuCode"
        @click="$emit('open', entry)"
      >
        <span class="afc-item-title">{{ entry.title }}</span>
        <span class="afc-item-hint">人工操作台</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ManifestItem } from "../../shared/workbench/route-manifest";

defineProps<{
  title: string;
  items: ManifestItem[];
}>();

defineEmits<{
  (event: "open", entry: ManifestItem): void;
}>();

// 说明：容器只展示真实 manifest 中的可见入口，不伪造 AI 生成内容。
</script>

<style scoped>
.afc {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
  background: var(--bg-soft, #f7f8fa);
}

.afc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.afc-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.afc-badge {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--color-primary-soft, rgba(63, 111, 239, 0.16));
  color: var(--color-primary, #3f6fef);
  font-size: 11px;
}

.afc-placeholder {
  padding: 16px 18px;
  border: 1px dashed var(--border-normal, #c9ced6);
  border-radius: 10px;
  background: var(--gray-0, #fff);
  margin-bottom: 20px;
}

.afc-placeholder-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.afc-placeholder-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #595959;
}

.afc-items-title {
  margin: 0 0 10px;
  font-size: 13px;
  color: #595959;
}

.afc-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.afc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  background: var(--gray-0, #fff);
  font-size: 13px;
  color: var(--text-primary, #1f2937);
  text-align: left;
  cursor: pointer;
}

.afc-item:hover {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.afc-item-hint {
  font-size: 11px;
  color: #8c8c8c;
}
</style>
