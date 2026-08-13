<template>
  <div class="page">
    <el-tabs v-model="activeTab" class="approval-tabs">
      <el-tab-pane label="审批规则" name="rules">
        <ApprovalRules />
      </el-tab-pane>
      <el-tab-pane label="我的申请" name="my">
        <MyApprovals />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ApprovalRules from "./ApprovalRules.vue";
import MyApprovals from "./MyApprovals.vue";

const activeTab = ref("rules");
</script>

<style scoped>
.page {
  padding: 16px;
}
.approval-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
</style>
