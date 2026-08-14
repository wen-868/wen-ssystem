<template>
  <div class="page">
    <el-tabs v-model="activeTab" class="monitor-tabs">
      <el-tab-pane label="操作日志" name="audit">
        <AuditLogView />
      </el-tab-pane>
      <el-tab-pane label="错误日志" name="error">
        <ErrorLogView />
      </el-tab-pane>
      <el-tab-pane label="反馈管理" name="feedback">
        <FeedbackView />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AuditLogView from "./AuditLogView.vue";
import ErrorLogView from "./ErrorLogView.vue";
import FeedbackView from "./FeedbackView.vue";

const activeTab = ref("audit");
</script>

<style scoped>
.page {
  padding: 16px;
}
.monitor-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
</style>
