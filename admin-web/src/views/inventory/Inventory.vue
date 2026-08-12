<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">库存管理</h2>
        <p class="page-desc">库存总览与出入库流水查询</p>
      </div>
      <div class="page-header-actions">
        <el-button @click="loadData">
          <el-icon><Refresh /></el-icon>&nbsp;刷新
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="库存总览" name="balances">
        <StatBar :stats="inventoryStats" />
        <div class="filter-bar">
          <el-input
            v-model="balanceKeyword"
            placeholder="搜索商品/SKU"
            clearable
            @clear="loadBalances"
            @keyup.enter="loadBalances"
          />
          <el-select v-model="storeId" placeholder="全部门店" clearable @change="loadBalances">
            <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
          </el-select>
          <el-button type="primary" @click="loadBalances">查询</el-button>
          <div class="filter-bar-spacer" />
        </div>

        <TableSkeleton v-if="loading" />
        <div v-else class="table-card">
          <el-table :data="balances" stripe>
            <el-table-column prop="storeName" label="门店" width="140" />
            <el-table-column prop="barcode" label="条码" width="160" />
            <el-table-column prop="skuName" label="商品名称" min-width="180" />
            <el-table-column label="库存类型" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.stockType === 'ONLINE' ? 'primary' : 'info'">
                  {{ row.stockType === 'ONLINE' ? '线上' : '线下' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="physicalQty" label="实物库存" width="100" />
            <el-table-column prop="availableQty" label="可用库存" width="110">
              <template #default="{ row }">
                <span :class="{ 'low-stock': row.availableQty < row.warningQty && row.availableQty > 0, 'out-stock': row.availableQty <= 0 }">
                  {{ Number(row.availableQty || 0).toFixed(0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="lockedQty" label="锁定库存" width="100" />
            <template #empty>
              <el-empty description="暂无库存数据" :image-size="80" />
            </template>
          </el-table>

          <div class="table-card-footer">
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
        </div>
      </el-tab-pane>

      <el-tab-pane label="库存流水" name="logs">
        <div class="filter-bar">
          <el-input
            v-model="logKeyword"
            placeholder="搜索商品/SKU"
            clearable
            @clear="loadLogs"
            @keyup.enter="loadLogs"
          />
          <el-select v-model="logType" placeholder="全部类型" clearable @change="loadLogs">
            <el-option label="采购入库" value="PURCHASE_IN" />
            <el-option label="销售出库" value="SALE_OUT" />
            <el-option label="销售退货" value="SALE_RETURN" />
            <el-option label="调拨入库" value="TRANSFER_IN" />
            <el-option label="调拨出库" value="TRANSFER_OUT" />
            <el-option label="盘点调整" value="INVENTORY_ADJUST" />
          </el-select>
          <el-button type="primary" @click="loadLogs">查询</el-button>
          <div class="filter-bar-spacer" />
        </div>

        <TableSkeleton v-if="loading" />
        <div v-else class="table-card">
          <el-table :data="logs" stripe>
            <el-table-column prop="logNo" label="流水单号" width="200" />
            <el-table-column prop="skuName" label="商品名称" min-width="160" />
            <el-table-column prop="reason" label="原因" min-width="120" />
            <el-table-column prop="changeQty" label="变动数量" width="100">
              <template #default="{ row }">
                <span :class="{ 'qty-in': row.changeQty > 0, 'qty-out': row.changeQty < 0 }">
                  {{ row.changeQty > 0 ? '+' : '' }}{{ Number(row.changeQty || 0).toFixed(0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="afterQty" label="变动后库存" width="110" />
            <el-table-column prop="createdAt" label="操作时间" width="170" />
            <template #empty>
              <el-empty description="暂无流水数据" :image-size="80" />
            </template>
          </el-table>

          <div class="table-card-footer">
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
        </div>
      </el-tab-pane>
    </el-tabs>
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
        (item.skuName && item.skuName.toLowerCase().includes(kw)) ||
        (item.barcode && item.barcode.toLowerCase().includes(kw))
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
.low-stock {
  color: var(--color-warning);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.out-stock {
  color: var(--color-danger);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.qty-in {
  color: var(--color-success);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.qty-out {
  color: var(--color-danger);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
