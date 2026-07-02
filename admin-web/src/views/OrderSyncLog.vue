<template>
  <div class="order-sync-log-page">
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="初始化" :value="0" />
            <el-option label="同步成功" :value="1" />
            <el-option label="同步失败" :value="2" />
            <el-option label="已推送" :value="3" />
            <el-option label="推送失败" :value="4" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="records" border v-loading="loading">
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="platformOrderNo" label="平台订单号" width="200" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="response" label="响应信息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleRetry(row)" :loading="retrying === row.orderNo">
              重试
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { fetchOrderSyncLogs, retryOrderSync } from "@/api";

const records = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const retrying = ref<string | null>(null);
const searchForm = reactive({
  orderNo: "",
  status: undefined as number | undefined,
});

const statusMap: Record<number, { label: string; type: string }> = {
  0: { label: "初始化", type: "info" },
  1: { label: "同步成功", type: "success" },
  2: { label: "同步失败", type: "danger" },
  3: { label: "已推送", type: "warning" },
  4: { label: "推送失败", type: "danger" },
};

const getStatusType = (status: number) => statusMap[status]?.type || "info";
const getStatusLabel = (status: number) => statusMap[status]?.label || "未知";

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await fetchOrderSyncLogs({
      page: currentPage.value,
      pageSize: pageSize.value,
      orderNo: searchForm.orderNo || undefined,
      status: searchForm.status,
    });
    records.value = res.records || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error("获取同步日志失败");
  } finally {
    loading.value = false;
  }
};

const resetSearch = () => {
  searchForm.orderNo = "";
  searchForm.status = undefined;
  currentPage.value = 1;
  fetchData();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const handleRetry = async (row: any) => {
  retrying.value = row.orderNo;
  try {
    await retryOrderSync(row.orderNo);
    ElMessage.success("已重新加入同步队列");
    fetchData();
  } catch (e: any) {
    ElMessage.error("重试失败");
  } finally {
    retrying.value = null;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.order-sync-log-page {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
}
.table-card {
  margin-bottom: 20px;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>