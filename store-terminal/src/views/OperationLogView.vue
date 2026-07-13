<template>
  <div>
    <!-- 搜索条件 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>操作记录</span>
          <el-button size="small" type="primary" @click="loadOperationLogs">刷新</el-button>
        </div>
      </template>
      <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="filterOperatorName" placeholder="输入操作员姓名" style="width: 200px" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filterActionType" placeholder="请选择操作类型" style="width: 150px">
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
        <el-button type="primary" @click="loadOperationLogs">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <!-- 操作记录列表 -->
    <el-card>
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
            <span v-if="row.targetNo" style="color: #409eff; cursor: pointer" @click="handleViewDetail(row)">{{ row.targetNo }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作员" width="100" />
        <el-table-column prop="clientIp" label="操作IP" width="140" />
        <el-table-column prop="createdAt" label="操作时间" width="160" />
        <el-table-column label="详情" width="80">
          <template #default="{ row }">
            <el-button size="small" @click="handleViewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="margin-top: 16px; text-align: right">
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

      <div v-if="operationLogs.length === 0 && !loading" style="text-align: center; padding: 40px; color: #999">
        暂无操作记录
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="操作详情" width="500px">
      <div v-if="selectedLog">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="操作类型">
            <el-tag :type="getActionTypeTagType(selectedLog.actionType)" size="small">
              {{ getActionTypeName(selectedLog.actionType) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="关联单号">{{ selectedLog.targetNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作内容">{{ selectedLog.actionContent }}</el-descriptions-item>
          <el-descriptions-item label="操作员">{{ selectedLog.operatorName }}</el-descriptions-item>
          <el-descriptions-item label="操作IP">{{ selectedLog.clientIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作时间">{{ selectedLog.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="请求参数" :span="2">
            <pre style="max-height: 200px; overflow-y: auto; background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px">{{ selectedLog.requestParams ? JSON.stringify(selectedLog.requestParams, null, 2) : '-' }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="操作结果" :span="2">
            <pre style="max-height: 200px; overflow-y: auto; background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px">{{ selectedLog.responseResult ? JSON.stringify(selectedLog.responseResult, null, 2) : '-' }}</pre>
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
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchOperationLogs, fetchOperationLogDetail } from "../api";

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
    const data = await fetchOperationLogs(params);
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
    const data = await fetchOperationLogDetail(log.id);
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

// 页面加载时获取操作记录
loadOperationLogs();
</script>
