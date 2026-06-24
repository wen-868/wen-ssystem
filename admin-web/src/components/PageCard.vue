<template>
  <el-card shadow="never" class="page-card">
    <template v-if="title || $slots.extra" #header>
      <div class="card-header">
        <span v-if="title" class="card-title">{{ title }}</span>
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
}>();
</script>

<style scoped>
.page-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
}

.header-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
