<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="width"
    :close-on-click-modal="false"
    @update:model-value="handleUpdate"
    @closed="handleClosed"
  >
    <!-- editing 通过作用域插槽透出，父组件据此切换控件只读/可编辑 -->
    <slot :editing="editing" />

    <!-- 查看/编辑双模式底部操作栏（表单规范 v1） -->
    <template v-if="editable" #footer>
      <div class="detail-footer">
        <span class="detail-footer-tip">{{ editing ? '编辑模式：修改后点保存' : '查看模式：点修改进入编辑' }}</span>
        <div class="detail-footer-btns">
          <el-button :type="editing ? 'default' : 'primary'" @click="toggleEdit">
            {{ editing ? '取消修改' : '修改' }}
          </el-button>
          <el-button type="primary" :disabled="!editing" :loading="saving" @click="emit('save')">保存</el-button>
          <el-button
            v-if="showSaveAndAdd"
            type="success"
            :disabled="!editing"
            :loading="saving"
            @click="emit('save-add')"
          >保存并增加</el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    width?: string | number;
    /** 是否启用 查看/编辑 双模式（默认 false，保持旧行为纯展示） */
    editable?: boolean;
    /** 是否显示「保存并增加」按钮 */
    showSaveAndAdd?: boolean;
    /** 保存中（按钮 loading） */
    saving?: boolean;
  }>(),
  {
    title: "",
    width: "600px",
    editable: false,
    showSaveAndAdd: true,
    saving: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "update:editing": [value: boolean];
  save: [];
  "save-add": [];
}>();

const editing = ref(false);

// 每次打开重置为查看模式
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.editable) {
      editing.value = false;
      emit("update:editing", false);
    }
  }
);

function handleUpdate(value: boolean) {
  emit("update:modelValue", value);
}

function handleClosed() {
  if (props.editable) {
    editing.value = false;
    emit("update:editing", false);
  }
}

function toggleEdit() {
  editing.value = !editing.value;
  emit("update:editing", editing.value);
}
</script>

<style scoped>
.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.detail-footer-tip {
  font-size: 12px;
  color: var(--gray-400, #909399);
}
.detail-footer-btns {
  display: flex;
  gap: 8px;
}
</style>
