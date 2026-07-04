<template>
  <div>
    <h2 style="margin-bottom: 24px;">错误日志</h2>

    <!-- 筛选区域 -->
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索错误消息..."
          clearable
          style="width: 220px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.errorType"
          placeholder="错误类型"
          clearable
          style="width: 160px;"
          @change="handleSearch"
        >
          <el-option label="Vue 错误" value="vue" />
          <el-option label="Window 错误" value="window_error" />
          <el-option label="未捕获 Promise" value="unhandled_rejection" />
          <el-option label="HTTP 错误" value="http_error" />
          <el-option label="未知" value="unknown" />
        </el-select>
        <el-select
          v-model="searchForm.severity"
          placeholder="严重程度"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="WARN" value="WARN" />
          <el-option label="ERROR" value="ERROR" />
        </el-select>
        <el-select
          v-model="searchForm.source"
          placeholder="来源"
          clearable
          style="width: 160px;"
          @change="handleSearch"
        >
          <el-option label="admin-web" value="admin-web" />
          <el-option label="saas-admin" value="saas-admin" />
          <el-option label="backend" value="backend" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 错误日志表格 -->
    <el-card>
      <el-table
        :data="list"
        v-loading="loading"
        border
        stripe
        style="width: 100%;"
        @expand-change="handleExpand"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 12px 24px;">
              <el-descriptions :column="1" border size="small" v-if="row.stack">
                <el-descriptions-item label="堆栈信息">
                  <pre style="max-height: 300px; overflow: auto; font-size: 12px; background: #f5f7fa; padding: 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-all;">{{ row.stack }}</pre>
                </el-descriptions-item>
              </el-descriptions>
              <el-descriptions :column="2" border size="small" v-if="row.componentName || row.userAgent">
                <el-descriptions-item label="组件名称" v-if="row.componentName">{{ row.componentName }}</el-descriptions-item>
                <el-descriptions-item label="User-Agent" v-if="row.userAgent" :span="2">{{ row.userAgent }}</el-descriptions-item>
              </el-descriptions>
              <div v-if="!row.stack && !row.componentName && !row.userAgent" style="color: #909399; font-size: 13px;">暂无详细堆栈信息</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="errorType" label="错误类型" width="150">
          <template #default="{ row }">
            <el-tag :type="errorTypeTag(row.errorType)" size="small">{{ errorTypeLabel(row.errorType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="severityTag(row.severity)" size="small">{{ row.severity || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="错误消息" min-width="280" show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="120">
          <template #default="{ row }">
            <el-tag :type="sourceTag(row.source)" size="small" effect="plain">{{ row.source || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestUrl" label="请求URL" min-width="200" show-overflow-tooltip />
        <el-table-column label="发生时间" width="180">
          <template #default="{ row }">{{ row.createdAt || row.created_at || '-' }}</template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../api";

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchForm = reactive({
  keyword: "",
  errorType: "",
  severity: "",
  source: ""
});

function errorTypeLabel(type: string): string {
  const map: Record<string, string> = {
    vue: "Vue 错误",
    window_error: "Window 错误",
    unhandled_rejection: "未捕获 Promise",
    http_error: "HTTP 错误",
    unknown: "未知"
  };
  return map[type] || type || "-";
}

function errorTypeTag(type: string): string {
  const map: Record<string, string> = {
    vue: "primary",
    window_error: "warning",
    unhandled_rejection: "danger",
    http_error: "danger",
    unknown: "info"
  };
  return map[type] || "info";
}

function severityTag(severity: string): string {
  const map: Record<string, string> = {
    WARN: "warning",
    ERROR: "danger"
  };
  return map[severity] || "info";
}

function sourceTag(source: string): string {
  const map: Record<string, string> = {
    "admin-web": "",
    "saas-admin": "success",
    backend: "primary"
  };
  return map[source] || "";
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await api.get("/admin/error-logs", {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        error_type: searchForm.errorType || undefined,
        severity: searchForm.severity || undefined,
        source: searchForm.source || undefined,
        keyword: searchForm.keyword || undefined
      }
    });
    const data = res.data?.data || (res as any).data || res;
    list.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  fetchList();
}

function handleReset() {
  searchForm.keyword = "";
  searchForm.errorType = "";
  searchForm.severity = "";
  searchForm.source = "";
  page.value = 1;
  fetchList();
}

function handleExpand(row: any, expandedRows: any[]) {
  // 展开时不需要额外操作，数据已在 row 中
}

onMounted(() => {
  fetchList();
});
</script>