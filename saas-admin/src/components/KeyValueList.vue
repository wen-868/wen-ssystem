<template>
  <!--
    键值对列表 KeyValueList — 用于详情抽屉 / 详情面板的基础信息区
    规格：label 11.5px 灰（--g5），value 13px 主文字（--ink）
    用法：<KeyValueList :items="[{ label: '所属渠道', value: '渠道码 QD-0107' }]" :columns="2" />
  -->
  <div class="kv-list" :style="{ '--kv-columns': columns }">
    <div v-for="(item, idx) in items" :key="`${item.label}-${idx}`" class="kv-list__item">
      <div class="kv-list__label">{{ item.label }}</div>
      <div class="kv-list__value">
        <slot :name="item.slot" :item="item">
          <template v-if="item.tone">
            <StatusTag :text="String(item.value ?? '')" :tone="item.tone" />
          </template>
          <template v-else>{{ item.value ?? '--' }}</template>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusTag from './StatusTag.vue'
import type { KeyValueItem } from './status'

withDefaults(
  defineProps<{
    items: KeyValueItem[]
    /** 每行展示的列数，默认 2 */
    columns?: number
  }>(),
  { columns: 2 }
)
</script>

<style scoped>
.kv-list {
  display: grid;
  grid-template-columns: repeat(var(--kv-columns, 2), minmax(0, 1fr));
  gap: var(--kv-gap) var(--space-4);
}
.kv-list__label {
  font-size: var(--kv-label-size);
  color: var(--g5);
  margin-bottom: 2px;
}
.kv-list__value {
  font-size: var(--kv-value-size);
  color: var(--ink);
  word-break: break-all;
}
</style>
