<template>
  <el-card shadow="never" class="page-card">
    <template v-if="title || $slots.extra" #header>
      <div class="card-header">
        <div class="card-title-wrap">
          <span v-if="title" class="card-title">{{ title }}</span>
          <span v-if="description" class="card-desc">{{ description }}</span>
        </div>
        <div v-if="$slots.extra" class="header-extra">
          <slot name="extra" />
        </div>
      </div>
    </template>
    <slot />
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<style scoped>
.page-card {
  margin-bottom: 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.card-desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
