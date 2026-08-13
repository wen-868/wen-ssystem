<template>
  <div class="page">
    <div class="approval-switch-bar">
      <el-switch v-model="approvalEnabled" @change="handleToggleApproval" />
      <span class="switch-label">启用审批</span>
      <span class="switch-tip">单店自管可关闭；关闭后采购/退货等业务不发起审批，保持原审核流程</span>
    </div>
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
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../../api";
import ApprovalRules from "./ApprovalRules.vue";
import MyApprovals from "./MyApprovals.vue";

const activeTab = ref("rules");
const approvalEnabled = ref(false);

async function loadApprovalSwitch() {
  try {
    const { data } = await api.get("/admin/sys-config/approval");
    const items = data.data || [];
    const row = items.find((i: any) => i.configKey === "approval_enabled");
    approvalEnabled.value = row?.configValue === "1";
  } catch {
    approvalEnabled.value = false;
  }
}

async function handleToggleApproval(val: string | number | boolean) {
  try {
    await api.put("/admin/sys-config/batch", [
      { config_key: "approval_enabled", config_value: val ? "1" : "0" },
    ]);
    ElMessage.success(val ? "审批已启用" : "审批已关闭");
  } catch (e: any) {
    approvalEnabled.value = !val;
    ElMessage.error(e?.response?.data?.msg || "保存失败");
  }
}

onMounted(loadApprovalSwitch);
</script>

<style scoped>
.page {
  padding: 16px;
}
.approval-switch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-soft, #f7f8fa);
  border-radius: 8px;
  margin-bottom: 12px;
}
.switch-label {
  font-weight: 600;
}
.switch-tip {
  color: var(--text-muted, #909399);
  font-size: 12px;
}
.approval-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
</style>
