<template>
  <div class="page">
    <PageCard title="库存预警">
      <template #extra>
        <el-button @click="loadAlerts">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>

      <DataTable
        :columns="columns"
        :data="alerts"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @update:page="loadAlerts"
        @update:page-size="loadAlerts"
      >
        <template #inventoryType="{ row }">
          <el-tag v-if="row.inventoryType === 'NORMAL'" type="primary">正常库存</el-tag>
          <el-tag v-else-if="row.inventoryType === 'LOW'" type="warning">低库存</el-tag>
          <el-tag v-else-if="row.inventoryType === 'OUT'" type="danger">缺货</el-tag>
          <el-tag v-else>{{ row.inventoryType }}</el-tag>
        </template>

        <template #availableQty="{ row }">
          <span :class="{ 'low-stock': row.inventoryType === 'LOW' || row.inventoryType === 'OUT' }">
            {{ Number(row.availableQty || 0).toFixed(0) }}
          </span>
        </template>
      </DataTable>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { fetchInventoryAlerts } from "../api";
import PageCard from "../components/PageCard.vue";
import DataTable from "../components/DataTable.vue";

const loading = ref(false);
const alerts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const columns = [
  { prop: "storeName", label: "门店", width: 160 },
  { prop: "productName", label: "商品", minWidth: 200 },
  { prop: "skuCode", label: "SKU编码", width: 160 },
  { prop: "inventoryType", label: "库存类型", width: 120, slot: "inventoryType" },
  { prop: "availableQty", label: "可用库存", width: 120, slot: "availableQty" },
  { prop: "warningQty", label: "预警阈值", width: 120 },
  { prop: "unit", label: "单位", width: 80 }
];

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

onMounted(() => {
  loadAlerts();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.low-stock {
  color: #f56c6c;
  font-weight: 600;
}
</style>
