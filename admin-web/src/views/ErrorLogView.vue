<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>错误日志</span>
          <div class="header-actions">
            <el-button @click="loadLogs">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="4">
          <el-statistic title="总错误数" :value="totalStats.total || 0" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="FATAL" :value="totalStats.fatal || 0" value-style="color: #f56c6c" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="ERROR" :value="totalStats.error || 0" value-style="color: #e6a23c" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="WARN" :value="totalStats.warn || 0" value-style="color: #409eff" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="后端错误" :value="totalStats.backend || 0" value-style="color: #909399" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="前端错误" :value="totalStats.frontend || 0" value-style="color: #67c23a" />
        </el-col>
      </el-row>

      <div class="filter-bar">
        <el-select v-model="errorTypeFilter" placeholder="错误类型" size="default" style="width: 160px; margin-right: 10px" clearable @change="loadLogs">
          <el-option label="参数校验" value="validation" />
          <el-option label="业务错误" value="business" />
          <el-option label="未知错误" value="unknown" />
          <el-option label="未捕获异常" value="uncaughtException" />
          <el-option label="未处理拒绝" value="unhandledRejection" />
          <el-option label="前端Vue错误" value="vue" />
          <el-option label="前端运行时" value="window_error" />
          <el-option label="前端Promise" value="unhandled_rejection" />
        </el-select>
        <el-select v-model="severityFilter" placeholder="严重级别" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadLogs">
          <el-option label="WARN" value="WARN" />
          <el-option label="ERROR" value="ERROR" />
          <el-option label="FATAL" value="FATAL" />
        </el-select>
        <el-select v-model="sourceFilter" placeholder="来源" size="default" style="width: 120px; margin-right: 10px" clearable @change="loadLogs">
          <el-option label="后端" value="backend" />
          <el-option label="前端" value="frontend" />
        </el-select>
        <el-input
          v-model="keyword"
          placeholder="搜索关键词"
          size="default"
          style="width: 200px; margin-right: 10px"
          clearable
          @clear="loadLogs"
          @keyup.enter="loadLogs"
        />
        <el-button @click="loadLogs">搜索</el-button>
      </div>

      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="severity" label="级别" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.severity === 'FATAL'" type="danger" effect="dark">FATAL</el-tag>
            <el-tag v-else-if="row.severity === 'ERROR'" type="warning">ERROR</el-tag>
            <el-tag v-else-if="row.severity === 'WARN'" type="info">WARN</el-tag>
            <el-tag v-else>{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_type" label="类型" width="150" />
        <el-table-column prop="source" label="来源" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.source === 'backend'" type="primary">后端</el-tag>
            <el-tag v-else-if="row.source === 'frontend'" type="success">前端</el-tag>
            <el-tag v-else>{{ row.source }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="错误消息" min-width="240" show-overflow-tooltip />
        <el-table-column prop="request_url" label="请求URL" width="200" show-overflow-tooltip />
        <el-table-column prop="request_method" label="方法" width="80" />
        <el-table-column prop="status_code" label="状态码" width="90" />
        <el-table-column prop="user_id" label="用户ID" width="100" />
        <el-table-column prop="created_at" label="时间" width="170" />
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

    <el-drawer v-model="detailVisible" title="错误详情" size="640px">
      <template v-if="currentLog">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
          <el-descriptions-item label="严重级别">
            <el-tag v-if="currentLog.severity === 'FATAL'" type="danger" effect="dark">FATAL</el-tag>
            <el-tag v-else-if="currentLog.severity === 'ERROR'" type="warning">ERROR</el-tag>
            <el-tag v-else-if="currentLog.severity === 'WARN'" type="info">WARN</el-tag>
            <el-tag v-else>{{ currentLog.severity }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="错误类型">{{ currentLog.error_type || '-' }}</el-descriptions-item>
          <el-descriptions-item label="来源">
            <el-tag v-if="currentLog.source === 'backend'" type="primary">后端</el-tag>
            <el-tag v-else-if="currentLog.source === 'frontend'" type="success">前端</el-tag>
            <el-tag v-else>{{ currentLog.source }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="错误消息">{{ currentLog.message || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求URL">{{ currentLog.request_url || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求方法">{{ currentLog.request_method || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态码">{{ currentLog.status_code || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户ID">{{ currentLog.user_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="租户ID">{{ currentLog.tenant_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="发生时间">{{ currentLog.created_at || currentLog.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px">堆栈信息</h4>
        <el-input
          v-if="currentLog.stack"
          type="textarea"
          :model-value="currentLog.stack"
          :rows="16"
          readonly
          resize="none"
          style="font-family: monospace; font-size: 12px"
        />
        <el-empty v-else description="无堆栈信息" :image-size="60" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchErrorLogs } from "../api";

const loading = ref(false);
const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const errorTypeFilter = ref("");
const severityFilter = ref("");
const sourceFilter = ref("");
const keyword = ref("");
const detailVisible = ref(false);
const currentLog = ref<any>(null);
const totalStats = ref<any>({ total: 0, fatal: 0, error: 0, warn: 0, backend: 0, frontend: 0 });

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadLogs() {
  loading.value = true;
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (errorTypeFilter.value) params.error_type = errorTypeFilter.value;
    if (severityFilter.value) params.severity = severityFilter.value;
    if (sourceFilter.value) params.source = sourceFilter.value;
    if (keyword.value) params.keyword = keyword.value;
    const data = await fetchErrorLogs(params);
    logs.value = data.items || [];
    total.value = data.total || 0;
    updateStats();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载错误日志失败"));
  } finally {
    loading.value = false;
  }
}

function updateStats() {
  const all = logs.value || [];
  totalStats.value = {
    total: total.value,
    fatal: all.filter((e: any) => e.severity === "FATAL").length,
    error: all.filter((e: any) => e.severity === "ERROR").length,
    warn: all.filter((e: any) => e.severity === "WARN").length,
    backend: all.filter((e: any) => e.source === "backend").length,
    frontend: all.filter((e: any) => e.source === "frontend").length,
  };
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

onMounted(() => {
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
