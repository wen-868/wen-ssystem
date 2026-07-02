<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>消费者地址管理</span>
          <div class="header-actions">
            <el-input
              v-model="userId"
              placeholder="用户ID"
              size="default"
              style="width: 200px; margin-right: 10px"
              clearable
              @clear="loadData"
              @keyup.enter="loadData"
            />
            <el-button @click="loadData">搜索</el-button>
          </div>
        </div>
      </template>

      <el-table :data="records" v-loading="loading" stripe empty-text="暂无地址数据">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="userId" label="用户ID" width="100" />
        <el-table-column prop="name" label="收货人" min-width="120" />
        <el-table-column prop="mobile" label="手机" width="140" />
        <el-table-column label="省市区" min-width="200">
          <template #default="{ row }">
            <span>{{ row.province }}{{ row.city }}{{ row.district }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详细地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="isDefault" label="是否默认" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchConsumerAddresses } from "../api";

const loading = ref(false);
const records = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const userId = ref("");

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchConsumerAddresses({
      userId: userId.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    records.value = data.records || [];
    total.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载消费者地址列表失败"));
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

onMounted(() => {
  loadData();
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
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>