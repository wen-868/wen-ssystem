<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">操作日志</h2>
      <p class="page-desc">收银操作日志查询</p>
    </div>
  </div>
<!-- 搜索条件 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div class="card-header">
          <span>操作记录</span>
          <el-button size="small" type="primary" @click="loadOperationLogs">刷新</el-button>
        </div>
      </template>
      <div class="filter-bar">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            size="small"
          />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="filterOperatorName" placeholder="输入操作员姓名" size="small" style="width: 200px" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filterActionType" placeholder="请选择操作类型" size="small" style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="销售" value="SALE" />
            <el-option label="退货" value="RETURN" />
            <el-option label="核销" value="VERIFY" />
            <el-option label="挂单" value="HOLD" />
            <el-option label="取单" value="RESTORE" />
            <el-option label="盘点" value="STOCK_CHECK" />
            <el-option label="库存调整" value="INVENTORY_ADJUST" />
            <el-option label="订单接单" value="ORDER_ACCEPT" />
            <el-option label="订单完成" value="ORDER_COMPLETE" />
            <el-option label="交接班" value="SHIFT" />
            <el-option label="日结" value="DAILY_SETTLE" />
          </el-select>
        </el-form-item>
        <el-button type="primary" size="small" @click="loadOperationLogs">查询</el-button>
        <el-button size="small" @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <!-- 操作记录列表 -->
    <el-card shadow="never">
      <div class="table-card">
<el-table :data="operationLogs" size="small" v-loading="loading">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column prop="actionType" label="操作类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionTypeTagType(row.actionType)" size="small">
              {{ getActionTypeName(row.actionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actionContent" label="操作内容" />
        <el-table-column prop="targetNo" label="关联单号" width="140">
          <template #default="{ row }">
            <span v-if="row.targetNo" class="link-text" @click="handleViewDetail(row)">{{ row.targetNo }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作员" width="100" />
        <el-table-column prop="clientIp" label="操作IP" width="140" />
        <el-table-column prop="createdAt" label="操作时间" width="160" />
        <el-table-column label="详情" width="80">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleViewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
</div>

      <!-- 分页 -->
      <div class="pagination-area">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 30, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadOperationLogs"
          @current-change="loadOperationLogs"
        />
      </div>

      <div v-if="operationLogs.length === 0 && !loading" class="empty-tip">暂无操作记录</div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="操作详情" width="480px">
      <div v-if="selectedLog">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="操作类型">
            <el-tag :type="getActionTypeTagType(selectedLog.actionType)" size="small">
              {{ getActionTypeName(selectedLog.actionType) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="关联单号">{{ selectedLog.targetNo || "-" }}</el-descriptions-item>
          <el-descriptions-item label="操作内容">{{ selectedLog.actionContent }}</el-descriptions-item>
          <el-descriptions-item label="操作员">{{ selectedLog.operatorName }}</el-descriptions-item>
          <el-descriptions-item label="操作IP">{{ selectedLog.clientIp || "-" }}</el-descriptions-item>
          <el-descriptions-item label="操作时间">{{ selectedLog.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="请求参数" :span="2">
            <pre class="json-block">{{ selectedLog.requestParams ? JSON.stringify(selectedLog.requestParams, null, 2) : "-" }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="操作结果" :span="2">
            <pre class="json-block">{{ selectedLog.responseResult ? JSON.stringify(selectedLog.responseResult, null, 2) : "-" }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchStoreOperationLogs, fetchStoreOperationLogDetail } from "../../api";

const dateRange = ref<string[]>([]);
const filterOperatorName = ref("");
const filterActionType = ref("");
const operationLogs = ref<any[]>([]);
const loading = ref(false);
const showDetailDialog = ref(false);
const selectedLog = ref<any>(null);

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

function getActionTypeName(type: string) {
  const map: Record<string, string> = {
    SALE: "销售",
    RETURN: "退货",
    VERIFY: "核销",
    HOLD: "挂单",
    RESTORE: "取单",
    STOCK_CHECK: "盘点",
    INVENTORY_ADJUST: "库存调整",
    ORDER_ACCEPT: "订单接单",
    ORDER_COMPLETE: "订单完成",
    SHIFT: "交接班",
    DAILY_SETTLE: "日结",
    LOGIN: "登录",
    LOGOUT: "退出",
    CREATE: "创建",
    UPDATE: "更新",
    DELETE: "删除"
  };
  return map[type] || type;
}

function getActionTypeTagType(type: string) {
  const map: Record<string, string> = {
    SALE: "success",
    RETURN: "danger",
    VERIFY: "warning",
    HOLD: "info",
    RESTORE: "success",
    STOCK_CHECK: "info",
    INVENTORY_ADJUST: "warning",
    ORDER_ACCEPT: "success",
    ORDER_COMPLETE: "success",
    SHIFT: "info",
    DAILY_SETTLE: "warning",
    LOGIN: "success",
    LOGOUT: "info",
    CREATE: "success",
    UPDATE: "warning",
    DELETE: "danger"
  };
  return map[type] || "";
}

async function loadOperationLogs() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };
    if (dateRange.value.length === 2) {
      params.startTime = dateRange.value[0];
      params.endTime = dateRange.value[1];
    }
    if (filterOperatorName.value.trim()) {
      params.operatorName = filterOperatorName.value.trim();
    }
    if (filterActionType.value) {
      params.actionType = filterActionType.value;
    }
    const data = await fetchStoreOperationLogs(params);
    operationLogs.value = data?.records || [];
    pagination.value.total = data?.total || 0;
  } catch {
    ElMessage.warning("加载操作记录失败");
  } finally {
    loading.value = false;
  }
}

async function handleViewDetail(log: any) {
  try {
    const data = await fetchStoreOperationLogDetail(log.id);
    selectedLog.value = data;
    showDetailDialog.value = true;
  } catch {
    ElMessage.warning("加载详情失败");
  }
}

function resetFilters() {
  dateRange.value = [];
  filterOperatorName.value = "";
  filterActionType.value = "";
  pagination.value.page = 1;
  loadOperationLogs();
}

onMounted(() => {
  loadOperationLogs();
});
</script>

<style scoped>
.pos-operation-log {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}
.link-text {
  color: var(--color-primary);
  cursor: pointer;
}
.link-text:hover {
  text-decoration: underline;
}
.pagination-area {
  margin-top: 16px;
  text-align: right;
}
.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}
.json-block {
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-page);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
}
</style>
