<template>
  <div class="form-footer">
    <slot name="left" />
    <div class="form-footer-right">
      <el-button v-if="showCancel" @click="$emit('cancel')">{{ cancelText }}</el-button>
      <el-button v-if="showSaveAndAdd" type="primary" plain :loading="loading" @click="$emit('save-add')">{{ saveAndAddText }}</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('save')">{{ saveText }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 统一表单底部操作栏（表单规范 v1）
 * - 新增/编辑弹窗默认：取消 / 保存并增加 / 保存
 * - 通过 showSaveAndAdd 控制连续录入；loading 统一保存中态
 */
withDefaults(
  defineProps<{
    showCancel?: boolean;
    showSaveAndAdd?: boolean;
    loading?: boolean;
    cancelText?: string;
    saveText?: string;
    saveAndAddText?: string;
  }>(),
  {
    showCancel: true,
    showSaveAndAdd: true,
    loading: false,
    cancelText: "取消",
    saveText: "保存",
    saveAndAddText: "保存并增加",
  }
);

defineEmits<{
  cancel: [];
  save: [];
  "save-add": [];
}>();
</script>

<style scoped>
.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.form-footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
