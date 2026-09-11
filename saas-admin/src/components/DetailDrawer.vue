<template>
  <!--
    详情抽屉 DetailDrawer — 对齐设计稿 v1.6 .drawer（宽度 436px）
    结构：标题头 + 可滚动内容区 + 底部操作区（无操作时不渲染底栏）
    说明：本组件只负责抽屉容器与分区骨架，内容由插槽传入，第 2 步再接真实数据。
  -->
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="drawerWidth"
    :direction="'rtl'"
    :close-on-click-modal="closeOnClickModal"
    :before-close="handleBeforeClose"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @closed="emit('closed')"
  >
    <div class="detail-drawer">
      <div class="detail-drawer__body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="detail-drawer__footer">
        <slot name="footer" />
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 双向绑定：抽屉开关 */
    modelValue: boolean
    /** 抽屉标题 */
    title?: string
    /** 宽度，默认取设计稿 436px */
    width?: string
    /** 点击遮罩是否关闭 */
    closeOnClickModal?: boolean
  }>(),
  { title: '详情', width: '', closeOnClickModal: true }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'closed'): void
}>()

const drawerWidth = computed(() => props.width || 'var(--drawer-width)')

function handleBeforeClose(done: () => void) {
  done()
}
</script>

<style scoped>
.detail-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.detail-drawer__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.detail-drawer__footer {
  flex: none;
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

<style>
/* 抽屉宽度与阴影按设计稿 .drawer 规格覆盖 Element Plus 默认 */
.el-drawer.rtl {
  box-shadow: var(--drawer-shadow);
}
</style>
