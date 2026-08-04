<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>库存管理</span>
          <div class="header-actions">
            <el-button @click="loadData">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="库存总览" name="balances">
          <div class="filter-bar">
            <el-input
              v-model="balanceKeyword"
              placeholder="搜索商品/SKU"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadBalances"
              @keyup.enter="loadBalances"
            />
            <el-select v-model="storeId" placeholder="全部门店" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadBalances">
              <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
            </el-select>
            <el-button type="primary" @click="loadBalances">查询</el-button>
          </div>

          <StatBar :stats="inventoryStats" />
          <TableSkeleton v-if="loading" />
          <el-table v-else :data="balances" stripe>
            <el-table-column prop="storeName" label="门店" width="140" />
            <el-table-column prop="skuCode" label="SKU编码" width="160" />
            <el-table-column prop="productName" label="商品名称" min-width="180" />
            <el-table-column prop="spec" label="规格" width="100" />
            <el-table-column prop="openingQty" label="期初库存" width="100" />
            <el-table-column prop="inQty" label="入库数量" width="100" />
            <el-table-column prop="outQty" label="出库数量" width="100" />
            <el-table-column prop="availableQty" label="可用库存" width="110">
              <template #default="{ row }">
                <span :class="{ 'low-stock': row.availableQty < row.warningQty && row.availableQty > 0, 'out-stock': row.availableQty <= 0 }">
                  {{ Number(row.availableQty || 0).toFixed(0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="warningQty" label="预警阈值" width="100" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column prop="updateTime" label="更新时间" width="160" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="balanceTotal"
              :page-size="balancePageSize"
              :current-page="balancePage"
              @size-change="handleBalanceSizeChange"
              @current-change="handleBalancePageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="库存流水" name="logs">
          <div class="filter-bar">
            <el-input
              v-model="logKeyword"
              placeholder="搜索商品/SKU"
              size="default"
              style="width: 220px; margin-right: 10px"
              clearable
              @clear="loadLogs"
              @keyup.enter="loadLogs"
            />
            <el-select v-model="logType" placeholder="全部类型" size="default" style="width: 140px; margin-right: 10px" clearable @change="loadLogs">
              <el-option label="采购入库" value="PURCHASE_IN" />
              <el-option label="销售出库" value="SALE_OUT" />
              <el-option label="销售退货" value="SALE_RETURN" />
              <el-option label="调拨入库" value="TRANSFER_IN" />
              <el-option label="调拨出库" value="TRANSFER_OUT" />
              <el-option label="盘点调整" value="INVENTORY_ADJUST" />
            </el-select>
            <el-button type="primary" @click="loadLogs">查询</el-button>
          </div>

          <TableSkeleton v-if="loading" />
          <el-table v-else :data="logs" stripe>
            <el-table-column prop="logNo" label="流水单号" width="200" />
            <el-table-column prop="storeName" label="门店" width="120" />
            <el-table-column prop="skuCode" label="SKU编码" width="160" />
            <el-table-column prop="productName" label="商品名称" min-width="160" />
            <el-table-column prop="logType" label="类型" width="110">
              <template #default="{ row }">
                <el-tag v-if="row.logType === 'PURCHASE_IN'" type="success">采购入库</el-tag>
                <el-tag v-else-if="row.logType === 'SALE_OUT'" type="danger">销售出库</el-tag>
                <el-tag v-else-if="row.logType === 'SALE_RETURN'" type="warning">销售退货</el-tag>
                <el-tag v-else-if="row.logType === 'TRANSFER_IN'" type="primary">调拨入库</el-tag>
                <el-tag v-else-if="row.logType === 'TRANSFER_OUT'" type="info">调拨出库</el-tag>
                <el-tag v-else-if="row.logType === 'INVENTORY_ADJUST'" type="primary">盘点调整</el-tag>
                <el-tag v-else>{{ row.logType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="changeQty" label="变动数量" width="100">
              <template #default="{ row }">
                <span :class="{ 'qty-in': row.changeQty > 0, 'qty-out': row.changeQty < 0 }">
                  {{ row.changeQty > 0 ? '+' : '' }}{{ Number(row.changeQty || 0).toFixed(0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="balanceAfter" label="变动后库存" width="110" />
            <el-table-column prop="relatedNo" label="关联单号" width="180" />
            <el-table-column prop="operatorName" label="操作人" width="100" />
            <el-table-column prop="createTime" label="操作时间" width="160" />
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="logTotal"
              :page-size="logPageSize"
              :current-page="logPage"
              @size-change="handleLogSizeChange"
              @current-change="handleLogPageChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import TableSkeleton from "../../components/TableSkeleton.vue";
import StatBar from "../../components/StatBar.vue";
import { fetchInventoryBalances, fetchInventoryLogs, fetchStores } from "../../api";

const loading = ref(false);
const activeTab = ref("balances");
const stores = ref<any[]>([]);

const balances = ref<any[]>([]);

/** 库存统计条（对标设计稿 p06） */
const inventoryStats = computed(() => {
  const list = balances.value;
  const low = list.filter(
    (b) => Number(b.availableQty || 0) > 0 && Number(b.availableQty) < Number(b.warningQty || 0)
  ).length;
  const out = list.filter((b) => Number(b.availableQty || 0) <= 0).length;
  return [
    { label: "库存条目", value: list.length, primary: true },
    { label: "低库存", value: low },
    { label: "缺货", value: out },
  ];
});
const balanceTotal = ref(0);
const balancePage = ref(1);
const balancePageSize = ref(20);
const balanceKeyword = ref("");
const storeId = ref<number | null>(null);

const logs = ref<any[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const logPageSize = ref(20);
const logKeyword = ref("");
const logType = ref("");

async function loadStores() {
  try {
    const data = await fetchStores();
    stores.value = Array.isArray(data) ? data : (data.records || data || []);
  } catch (e) {
    console.error("加载门店失败", e);
  }
}

async function loadBalances() {
  loading.value = true;
  try {
    const data = await fetchInventoryBalances();
    let list = Array.isArray(data) ? data : (data.records || []);
    if (balanceKeyword.value) {
      const kw = balanceKeyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.productName && item.productName.toLowerCase().includes(kw)) ||
        (item.skuCode && item.skuCode.toLowerCase().includes(kw))
      );
    }
    if (storeId.value) {
      list = list.filter((item: any) => item.storeId === storeId.value);
    }
    balanceTotal.value = list.length;
    const start = (balancePage.value - 1) * balancePageSize.value;
    const end = start + balancePageSize.value;
    balances.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  loading.value = true;
  try {
    const data = await fetchInventoryLogs();
    let list = Array.isArray(data) ? data : (data.records || []);
    if (logKeyword.value) {
      const kw = logKeyword.value.toLowerCase();
      list = list.filter((item: any) =>
        (item.productName && item.productName.toLowerCase().includes(kw)) ||
        (item.skuCode && item.skuCode.toLowerCase().includes(kw))
      );
    }
    if (logType.value) {
      list = list.filter((item: any) => item.logType === logType.value);
    }
    logTotal.value = list.length;
    const start = (logPage.value - 1) * logPageSize.value;
    const end = start + logPageSize.value;
    logs.value = list.slice(start, end);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleTabChange(tab: string) {
  if (tab === "balances") {
    loadBalances();
  } else {
    loadLogs();
  }
}

function loadData() {
  if (activeTab.value === "balances") {
    loadBalances();
  } else {
    loadLogs();
  }
}

function handleBalanceSizeChange(size: number) {
  balancePageSize.value = size;
  balancePage.value = 1;
  loadBalances();
}

function handleBalancePageChange(p: number) {
  balancePage.value = p;
  loadBalances();
}

function handleLogSizeChange(size: number) {
  logPageSize.value = size;
  logPage.value = 1;
  loadLogs();
}

function handleLogPageChange(p: number) {
  logPage.value = p;
  loadLogs();
}

onMounted(() => {
  loadStores();
  loadBalances();
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
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.low-stock {
  color: #e6a23c;
  font-weight: 600;
}
.out-stock {
  color: #f56c6c;
  font-weight: 600;
}
.qty-in {
  color: #67c23a;
  font-weight: 600;
}
.qty-out {
  color: #f56c6c;
  font-weight: 600;
}
</style>
