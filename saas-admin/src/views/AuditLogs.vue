<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center;">
        <el-input v-model="searchForm.keyword" placeholder="搜索操作人/描述" clearable style="width: 200px;" @change="fetchList" />
        <el-select v-model="searchForm.action" placeholder="操作类型" clearable style="width: 160px;" @change="fetchList">
          <el-option label="新增" value="CREATE" />
          <el-option label="更新" value="UPDATE" />
          <el-option label="删除" value="DELETE" />
          <el-option label="审核" value="APPROVE" />
          <el-option label="登录" value="LOGIN" />
          <el-option label="其他" value="OTHER" />
        </el-select>
        <el-date-picker
          v-model="searchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 250px;"
          @change="fetchList"
        />
      </div>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="userName" label="操作人" width="120" />
        <el-table-column prop="action" label="操作类型" width="100">
          <template #default="{ row }">
            <el-tag :type="actionTag(row.action)" size="small">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="description" label="操作描述" min-width="220" show-overflow-tooltip />
        <el-table-column prop="targetName" label="操作对象" width="150" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="140" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ row.createdAt || "-" }}</template>
        </el-table-column>
        <el-table-column label="详情" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="日志详情" width="600px" :close-on-click-modal="false">
      <el-descriptions :column="2" border v-if="currentLog">
        <el-descriptions-item label="ID">{{ currentLog.id }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentLog.userName }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ actionLabel(currentLog.action) }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ currentLog.module }}</el-descriptions-item>
        <el-descriptions-item label="操作对象">{{ currentLog.targetName }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ currentLog.ip }}</el-descriptions-item>
        <el-descriptions-item label="操作时间">{{ currentLog.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="请求URL" :span="2">{{ currentLog.requestUrl }}</el-descriptions-item>
        <el-descriptions-item label="操作描述" :span="2">{{ currentLog.description }}</el-descriptions-item>
        <el-descriptions-item label="请求参数" :span="2">
          <pre style="max-height: 200px; overflow: auto; font-size: 12px; background: #f5f7fa; padding: 8px; border-radius: 4px;">{{ currentLog.requestParams || "-" }}</pre>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { getAuditLogs } from "../api";

const loading = ref(false);
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const searchForm = reactive({
  keyword: "",
  action: "",
  dateRange: [] as string[]
});

function actionLabel(action: string) {
  const map: Record<string, string> = {
    CREATE: "新增", UPDATE: "更新", DELETE: "删除",
    APPROVE: "审核", LOGIN: "登录", OTHER: "其他"
  };
  return map[action] || action;
}

function actionTag(action: string) {
  const map: Record<string, string> = {
    CREATE: "success", UPDATE: "warning", DELETE: "danger",
    APPROVE: "primary", LOGIN: "info", OTHER: ""
  };
  return map[action] || "";
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getAuditLogs({
      keyword: searchForm.keyword || undefined,
      action: searchForm.action || undefined,
      page: page.value,
      pageSize: pageSize.value
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

const detailVisible = ref(false);
const currentLog = ref<any>(null);

function showDetail(row: any) {
  currentLog.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  fetchList();
});
</script>