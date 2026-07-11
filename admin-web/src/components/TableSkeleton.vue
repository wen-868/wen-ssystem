<template>
  <el-skeleton :rows="rows" animated />
</template>

<script setup lang="ts">
defineProps<{
  rows?: number;
}>();
</script>