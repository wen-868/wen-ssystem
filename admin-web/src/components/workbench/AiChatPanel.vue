<template>
  <div class="acp">
    <AiSidePanel />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";

// 复用现有真实 AI 对话面板（SSE + 确认/撤销端点），不新建对话实现。
const AiSidePanel = defineAsyncComponent(() => import("../AiChat/AiSidePanel.vue"));
</script>

<style scoped>
.acp {
  width: 360px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  display: flex;
}

/* AiSidePanel 原为 MainLayout 的 grid 第 3 列整栏（min-height:100vh），
   嵌入 AI 模式的行内 flex 布局需覆盖定位与高度，不改其内部实现。 */
.acp :deep(.ai-side-panel) {
  grid-column: auto;
  grid-row: auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  border-left: 1px solid var(--border-light, #e5e7eb);
}
</style>
