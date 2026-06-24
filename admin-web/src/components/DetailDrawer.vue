<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="width"
    :close-on-click-modal="false"
    @update:model-value="handleUpdate"
  >
    <slot />
  </el-drawer>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    width?: string | number;
  }>(),
  {
    title: "",
    width: "600px"
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function handleUpdate(value: boolean) {
  emit("update:modelValue", value);
}
</script>

<style scoped>
</style>
