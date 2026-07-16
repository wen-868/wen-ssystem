<template>
  <div class="pos-store-control">
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div class="card-header">
          <span>门店状态</span>
          <el-button size="small" @click="loadStoreControlStatus">刷新</el-button>
        </div>
      </template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="门店名称">{{ storeControlStatusData?.storeName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag
            v-if="storeControlStatusData"
            :type="storeControlStatusData.status === 'OPEN' ? 'success' : storeControlStatusData.status === 'SUSPENDED' ? 'warning' : 'info'"
            size="small"
          >
            {{ getStatusName(storeControlStatusData.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="自动开门时间">{{ storeControlConfig?.autoOpenTime || "未设置" }}</el-descriptions-item>
        <el-descriptions-item label="自动关门时间">{{ storeControlConfig?.autoCloseTime || "未设置" }}</el-descriptions-item>
        <el-descriptions-item label="日订单上限">{{ storeControlConfig?.maxDailyOrders || "未设置" }}</el-descriptions-item>
        <el-descriptions-item label="日金额上限">{{ storeControlConfig?.maxOrderAmount || "未设置" }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>状态变更日志</span>
          <el-button size="small" @click="loadStoreControlMyLogs">刷新</el-button>
        </div>
      </template>
      <el-table :data="storeControlMyLogs" size="small" empty-text="暂无日志">
        <el-table-column prop="fromStatus" label="变更前" width="90">
          <template #default="{ row }">{{ getStatusName(row.fromStatus) }}</template>
        </el-table-column>
        <el-table-column prop="toStatus" label="变更后" width="90">
          <template #default="{ row }">{{ getStatusName(row.toStatus) }}</template>
        </el-table-column>
        <el-table-column prop="changeType" label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="getChangeTypeTagType(row.changeType)">
              {{ getChangeTypeName(row.changeType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
        <el-table-column prop="createdAt" label="时间" width="170" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchStoreControlStatus, fetchStoreControlMyLogs } from "../../api";

const storeControlStatusData = ref<any>(null);
const storeControlConfig = ref<any>(null);
const storeControlMyLogs = ref<any[]>([]);

function getStatusName(status: string) {
  const map: Record<string, string> = {
    OPEN: "营业中",
    SUSPENDED: "已暂停",
    CLOSED: "已关闭"
  };
  return map[status] || status || "-";
}

function getChangeTypeName(type: string) {
  const map: Record<string, string> = {
    MANUAL: "手动",
    SCHEDULED: "定时",
    AUTO: "自动"
  };
  return map[type] || type;
}

function getChangeTypeTagType(type: string) {
  const map: Record<string, string> = {
    MANUAL: "",
    SCHEDULED: "warning",
    AUTO: "danger"
  };
  return map[type] || "";
}

async function loadStoreControlStatus() {
  try {
    const data = await fetchStoreControlStatus();
    storeControlStatusData.value = data;
    storeControlConfig.value = data?.config || null;
  } catch {
    // 静默失败
  }
}

async function loadStoreControlMyLogs() {
  try {
    const data = await fetchStoreControlMyLogs();
    storeControlMyLogs.value = data.records || [];
  } catch {
    // 静默失败
  }
}

onMounted(() => {
  loadStoreControlStatus();
  loadStoreControlMyLogs();
});
</script>

<style scoped>
.pos-store-control {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
