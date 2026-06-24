<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
          <div class="header-actions">
            <el-button @click="loadStatistics">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="4">
          <el-statistic title="今日操作" :value="statistics.todayCount || 0" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="新增操作" :value="statistics.createCount || 0" value-style="color: #67c23a" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="修改操作" :value="statistics.updateCount || 0" value-style="color: #409eff" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="删除操作" :value="statistics.deleteCount || 0" value-style="color: #f56c6c" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="查询操作" :value="statistics.queryCount || 0" value-style="color: #909399" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="操作用户" :value="statistics.userCount || 0" value-style="color: #e6a23c" />
        </el-col>
      </el-row>

      <div class="filter-bar">
        <el-select v-model="actionFilter" placeholder="操作类型" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadLogs">
          <el-option label="新增" value="CREATE" />
          <el-option label="修改" value="UPDATE" />
          <el-option label="删除" value="DELETE" />
          <el-option label="查询" value="QUERY" />
          <el-option label="登录" value="LOGIN" />
          <el-option label="导出" value="EXPORT" />
        </el-select>
        <el-select v-model="resourceType" placeholder="资源类型" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadLogs">
          <el-option label="商品" value="PRODUCT" />
          <el-option label="订单" value="ORDER" />
          <el-option label="客户" value="MEMBER" />
          <el-option label="员工" value="STAFF" />
          <el-option label="门店" value="STORE" />
          <el-option label="营销" value="MARKETING" />
          <el-option label="系统" value="SYSTEM" />
        </el-select>
        <el-input
          v-model="userIdFilter"
          placeholder="操作人ID"
          size="default"
          style="width: 140px; margin-right: 10px"
          clearable
          @clear="loadLogs"
          @keyup.enter="loadLogs"
        />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          size="default"
          style="width: 280px; margin-right: 10px"
          value-format="YYYY-MM-DD"
        />
        <el-button @click="loadLogs">搜索</el-button>
        <el-button @click="exportLogs">导出</el-button>
      </div>

      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="userId" label="操作人ID" width="100" />
        <el-table-column prop="userName" label="操作人" width="120" />
        <el-table-column prop="action" label="操作类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.action === 'CREATE'" type="success">新增</el-tag>
            <el-tag v-else-if="row.action === 'UPDATE'" type="primary">修改</el-tag>
            <el-tag v-else-if="row.action === 'DELETE'" type="danger">删除</el-tag>
            <el-tag v-else-if="row.action === 'QUERY'" type="info">查询</el-tag>
            <el-tag v-else-if="row.action === 'LOGIN'" type="warning">登录</el-tag>
            <el-tag v-else-if="row.action === 'EXPORT'" type="warning">导出</el-tag>
            <el-tag v-else>{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resourceType" label="资源类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.resourceType === 'PRODUCT'" type="primary">商品</el-tag>
            <el-tag v-else-if="row.resourceType === 'ORDER'" type="success">订单</el-tag>
            <el-tag v-else-if="row.resourceType === 'MEMBER'" type="warning">客户</el-tag>
            <el-tag v-else-if="row.resourceType === 'STAFF'" type="info">员工</el-tag>
            <el-tag v-else-if="row.resourceType === 'STORE'" type="danger">门店</el-tag>
            <el-tag v-else-if="row.resourceType === 'MARKETING'" type="success">营销</el-tag>
            <el-tag v-else-if="row.resourceType === 'SYSTEM'" type="info">系统</el-tag>
            <el-tag v-else>{{ row.resourceType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resourceId" label="资源ID" width="120" />
        <el-table-column prop="description" label="操作描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="140" />
        <el-table-column prop="userAgent" label="设备" min-width="160" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="操作时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="日志详情" size="560px">
      <template v-if="currentLog">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ currentLog.userName || '-' }} (ID: {{ currentLog.userId }})</el-descriptions-item>
          <el-descriptions-item label="操作类型">
            <el-tag v-if="currentLog.action === 'CREATE'" type="success">新增</el-tag>
            <el-tag v-else-if="currentLog.action === 'UPDATE'" type="primary">修改</el-tag>
            <el-tag v-else-if="currentLog.action === 'DELETE'" type="danger">删除</el-tag>
            <el-tag v-else-if="currentLog.action === 'QUERY'" type="info">查询</el-tag>
            <el-tag v-else-if="currentLog.action === 'LOGIN'" type="warning">登录</el-tag>
            <el-tag v-else>{{ currentLog.action }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="资源类型">{{ currentLog.resourceType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="资源ID">{{ currentLog.resourceId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作描述">{{ currentLog.description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="IP地址">{{ currentLog.ip || '-' }}</el-descriptions-item>
          <el-descriptions-item label="设备信息">{{ currentLog.userAgent || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作时间">{{ currentLog.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">请求参数</h4>
        <el-input
          v-if="currentLog.requestData"
          type="textarea"
          :model-value="formatJson(currentLog.requestData)"
          :rows="8"
          readonly
          resize="none"
        />
        <el-empty v-else description="无请求参数" :image-size="60" />

        <h4 style="margin: 20px 0 10px">变更数据</h4>
        <el-input
          v-if="currentLog.changeData"
          type="textarea"
          :model-value="formatJson(currentLog.changeData)"
          :rows="8"
          readonly
          resize="none"
        />
        <el-empty v-else description="无变更数据" :image-size="60" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchAuditLogs, fetchAuditLogStatistics, exportAuditLogsCsv } from "../api";

const loading = ref(false);
const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const actionFilter = ref("");
const resourceType = ref("");
const userIdFilter = ref("");
const dateRange = ref<string[]>([]);
const detailVisible = ref(false);
const currentLog = ref<any>(null);
const statistics = ref<any>({});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

function formatJson(data: any) {
  if (!data) return "";
  try {
    if (typeof data === "string") {
      return JSON.stringify(JSON.parse(data), null, 2);
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

async function loadStatistics() {
  try {
    const data = await fetchAuditLogStatistics();
    statistics.value = data || {};
  } catch (e) {
    // ignore
  }
}

async function loadLogs() {
  loading.value = true;
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (actionFilter.value) params.action = actionFilter.value;
    if (resourceType.value) params.resourceType = resourceType.value;
    if (userIdFilter.value) params.userId = Number(userIdFilter.value);
    if (dateRange.value && dateRange.value.length === 2) {
      params.dateStart = dateRange.value[0];
      params.dateEnd = dateRange.value[1];
    }
    const data = await fetchAuditLogs(params);
    logs.value = data.records || [];
    total.value = data.total || logs.value.length;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载日志失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadLogs();
}

function handlePageChange(p: number) {
  page.value = p;
  loadLogs();
}

function viewDetail(row: any) {
  currentLog.value = row;
  detailVisible.value = true;
}

async function exportLogs() {
  try {
    const params: any = {};
    if (actionFilter.value) params.action = actionFilter.value;
    if (resourceType.value) params.resourceType = resourceType.value;
    if (dateRange.value && dateRange.value.length === 2) {
      params.dateStart = dateRange.value[0];
      params.dateEnd = dateRange.value[1];
    }
    const blob = await exportAuditLogsCsv(params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success("导出成功");
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "导出失败"));
  }
}

onMounted(() => {
  loadStatistics();
  loadLogs();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
