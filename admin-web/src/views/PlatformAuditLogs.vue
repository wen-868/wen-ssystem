<template>
  <div class="platform-audit-logs-page">
    <!-- 筛选区域 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="操作类型">
          <el-select v-model="searchForm.operationType" placeholder="全部类型" clearable style="width: 140px">
            <el-option label="登录" value="LOGIN" />
            <el-option label="新增" value="CREATE" />
            <el-option label="修改" value="UPDATE" />
            <el-option label="删除" value="DELETE" />
            <el-option label="审核" value="AUDIT" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理员">
          <el-input
            v-model="searchForm.adminName"
            placeholder="请输入管理员名称"
            clearable
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="操作模块">
          <el-select v-model="searchForm.module" placeholder="全部模块" clearable style="width: 160px">
            <el-option label="租户管理" value="TENANT" />
            <el-option label="订阅管理" value="SUBSCRIPTION" />
            <el-option label="套餐管理" value="PLAN" />
            <el-option label="公告管理" value="ANNOUNCEMENT" />
            <el-option label="平台配置" value="CONFIG" />
            <el-option label="系统设置" value="SYSTEM" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 320px"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索操作内容"
            clearable
            style="width: 200px"
            @keyup.enter="fetchData"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 日志列表 -->
    <el-card class="table-card">
      <el-table :data="records" border v-loading="loading" stripe>
        <el-table-column prop="operationTime" label="操作时间" width="180" />
        <el-table-column prop="adminName" label="管理员" width="120" />
        <el-table-column prop="operationType" label="操作类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getOperationTypeTag(row.operationType)" size="small">
              {{ getOperationTypeLabel(row.operationType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="操作模块" width="120">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ getModuleLabel(row.module) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operationContent" label="操作内容" min-width="280" show-overflow-tooltip />
        <el-table-column prop="ipAddress" label="IP地址" width="140" />
        <el-table-column prop="result" label="操作结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.result === 'SUCCESS' ? 'success' : 'danger'" size="small">
              {{ row.result === 'SUCCESS' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无日志记录" :image-size="80" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 操作详情弹窗 -->
    <el-dialog title="操作详情" v-model="detailVisible" width="600px">
      <el-descriptions :column="2" border v-if="detail" class="detail-desc">
        <el-descriptions-item label="操作时间" :span="2">{{ detail.operationTime }}</el-descriptions-item>
        <el-descriptions-item label="管理员">{{ detail.adminName }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ detail.ipAddress }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="getOperationTypeTag(detail.operationType)" size="small">
            {{ getOperationTypeLabel(detail.operationType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作模块">
          <el-tag type="info" size="small">{{ getModuleLabel(detail.module) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作结果">
          <el-tag :type="detail.result === 'SUCCESS' ? 'success' : 'danger'" size="small">
            {{ detail.result === 'SUCCESS' ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="请求方式" v-if="detail.requestMethod">
          {{ detail.requestMethod }}
        </el-descriptions-item>
        <el-descriptions-item label="请求路径" v-if="detail.requestPath" :span="2">
          <code class="code-text">{{ detail.requestPath }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="操作内容" :span="2">
          <div class="content-text">{{ detail.operationContent }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="请求参数" v-if="detail.requestParams" :span="2">
          <pre class="params-pre">{{ detail.requestParams }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="失败原因" v-if="detail.result !== 'SUCCESS' && detail.failReason" :span="2">
          <span class="fail-reason">{{ detail.failReason }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="耗时" v-if="detail.duration">
          {{ detail.duration }}ms
        </el-descriptions-item>
        <el-descriptions-item label="操作ID" v-if="detail.id">
          {{ detail.id }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import { fetchPlatformAuditLogs, fetchPlatformAuditLogDetail } from "@/api";

const records = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const detailVisible = ref(false);
const detail = ref<any>(null);
const dateRange = ref<string[]>([]);

const searchForm = reactive({
  operationType: "" as string,
  adminName: "",
  module: "" as string,
  keyword: "",
});

const operationTypeMap: Record<string, { label: string; tag: string }> = {
  LOGIN: { label: "登录", tag: "primary" },
  CREATE: { label: "新增", tag: "success" },
  UPDATE: { label: "修改", tag: "warning" },
  DELETE: { label: "删除", tag: "danger" },
  AUDIT: { label: "审核", tag: "info" },
};

const moduleMap: Record<string, string> = {
  TENANT: "租户管理",
  SUBSCRIPTION: "订阅管理",
  PLAN: "套餐管理",
  ANNOUNCEMENT: "公告管理",
  CONFIG: "平台配置",
  SYSTEM: "系统设置",
};

const getOperationTypeLabel = (type: string) => operationTypeMap[type]?.label || type || "未知";
const getOperationTypeTag = (type: string) => operationTypeMap[type]?.tag || "info";
const getModuleLabel = (module: string) => moduleMap[module] || module || "未知";

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await fetchPlatformAuditLogs({
      page: currentPage.value,
      pageSize: pageSize.value,
      operationType: searchForm.operationType || undefined,
      adminName: searchForm.adminName || undefined,
      module: searchForm.module || undefined,
      keyword: searchForm.keyword || undefined,
      startTime: dateRange.value?.[0] || undefined,
      endTime: dateRange.value?.[1] || undefined,
    });
    const list = res.records || res.list || [];
    records.value = list;
    total.value = res.total || list.length;
  } catch {
    ElMessage.error("获取日志列表失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.operationType = "";
  searchForm.adminName = "";
  searchForm.module = "";
  searchForm.keyword = "";
  dateRange.value = [];
  currentPage.value = 1;
  fetchData();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const showDetail = async (row: any) => {
  try {
    const res = await fetchPlatformAuditLogDetail(row.id);
    detail.value = res;
    detailVisible.value = true;
  } catch {
    ElMessage.error("获取详情失败");
  }
};

const handleExport = () => {
  ElMessage.success("导出任务已提交，稍后请查收");
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.platform-audit-logs-page {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
  border-radius: 8px;
}
.table-card {
  border-radius: 8px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.detail-desc {
  margin-bottom: 10px;
}
.code-text {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  word-break: break-all;
}
.content-text {
  line-height: 1.6;
  color: #606266;
  word-break: break-all;
}
.params-pre {
  margin: 0;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #606266;
}
.fail-reason {
  color: #f56c6c;
}
</style>
