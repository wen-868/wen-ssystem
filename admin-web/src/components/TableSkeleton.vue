<template>
  <div class="table-skeleton">
    <el-skeleton :rows="rows" animated />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number;
  }>(),
  {
    rows: 8
  }
);
</script>

<style scoped>
.table-skeleton {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
  padding: 20px 16px;
  min-height: 240px;
}
</style>
