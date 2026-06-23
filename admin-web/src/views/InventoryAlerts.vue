<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>库存预警</span>
          <div class="header-actions">
            <el-button @click="loadAlerts">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="alerts" v-loading="loading" stripe>
        <el-table-column prop="storeName" label="门店" width="160" />
        <el-table-column prop="productName" label="商品" min-width="200" />
        <el-table-column prop="skuCode" label="SKU编码" width="160" />
        <el-table-column prop="inventoryType" label="库存类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.inventoryType === 'NORMAL'" type="primary">正常库存</el-tag>
            <el-tag v-else-if="row.inventoryType === 'LOW'" type="warning">低库存</el-tag>
            <el-tag v-else-if="row.inventoryType === 'OUT'" type="danger">缺货</el-tag>
            <el-tag v-else>{{ row.inventoryType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="availableQty" label="可用库存" width="120">
          <template #default="{ row }">
            <span :class="{ 'low-stock': row.inventoryType === 'LOW' || row.inventoryType === 'OUT' }">
              {{ Number(row.availableQty || 0).toFixed(0) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="warningQty" label="预警阈值" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
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
import { Refresh } from "@element-plus/icons-vue";
import { fetchInventoryAlerts } from "../api";

const loading = ref(false);
const alerts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function loadAlerts() {
  loading.value = true;
  try {
    const data = await fetchInventoryAlerts();
    const list = Array.isArray(data) ? data : (data.records || []);
    total.value = list.length;
    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    alerts.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadAlerts();
}

function handlePageChange(p: number) {
  page.value = p;
  loadAlerts();
}

onMounted(() => {
  loadAlerts();
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
.low-stock {
  color: #f56c6c;
  font-weight: 600;
}
</style>
