<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">即时零售同步</h2>
      <p class="page-desc">价格/库存/商品同步状态</p>
    </div>
  </div>
<!-- 同步状态概览 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">价格同步</div>
          <div class="stat-body">
            <el-tag size="small" type="success">{{ priceSyncedCount }} 条已同步</el-tag>
            <span class="stat-time">最近同步：{{ priceLastSync || '-' }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">商品同步</div>
          <div class="stat-body">
            <el-tag size="small" type="success">{{ productSyncedCount }} 条已同步</el-tag>
            <span class="stat-time">最近同步：{{ productLastSync || '-' }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">已对接平台</div>
          <div class="stat-body">
            <span class="stat-time">{{ configuredPlatforms.length }} 个平台已配置（{{ enabledPlatforms }} 个启用）</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 平台同步操作 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header">
          <span>平台同步</span>
          <el-button size="small" @click="loadPlatforms">刷新</el-button>
        </div>
      </template>
      <div class="table-card">
<el-table v-loading="platformLoading" :data="platforms" stripe>
        <el-table-column label="平台" width="140">
          <template #default="{ row }">
            <el-tag :type="getPlatformTagType(row.platform)" size="small">{{ getPlatformName(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '已启用' : '未启用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="storeId" label="门店ID" width="120">
          <template #default="{ row }">{{ row.storeId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="merchantId" label="商家ID" min-width="140">
          <template #default="{ row }">{{ row.merchantId || '-' }}</template>
        </el-table-column>
        <el-table-column label="同步操作" width="280" align="center">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :disabled="!row.enabled"
              :loading="row._syncingOrders"
              @click="handleSyncOrders(row)"
            >
              同步订单
            </el-button>
            <el-button
              size="small"
              type="success"
              :disabled="!row.enabled"
              :loading="row._syncingProducts"
              @click="handleSyncProducts(row)"
            >
              同步商品
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="最近同步结果" min-width="200">
          <template #default="{ row }">
            <span v-if="row._lastResult" class="sync-result">{{ row._lastResult }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无平台配置" />
        </template>
      </el-table>
</div>
    </el-card>

    <!-- 同步日志 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header">
          <span>同步日志</span>
        </div>
      </template>
      <div class="filter-bar">
        <div class="filter-left">
          <el-select v-model="statusFilter" placeholder="同步状态" clearable style="width: 140px; margin-right: 12px" @change="loadLogs">
            <el-option label="待同步" :value="0" />
            <el-option label="同步成功" :value="1" />
            <el-option label="同步失败" :value="2" />
          </el-select>
          <el-input
            v-model="keyword"
            placeholder="搜索订单号"
            clearable
            style="width: 220px; margin-right: 12px"
            @clear="loadLogs"
            @keyup.enter="loadLogs"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="loadLogs">搜索</el-button>
        </div>
      </div>

      <div class="table-card">
<el-table v-loading="logLoading" :data="syncLogs" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200">
          <template #default="{ row }">
            <span class="order-no-text">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="platformOrderNo" label="平台订单号" width="200">
          <template #default="{ row }">{{ row.platformOrderNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="同步状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="success" size="small">同步成功</el-tag>
            <el-tag v-else-if="row.status === 2" type="danger" size="small">同步失败</el-tag>
            <el-tag v-else type="warning" size="small">待同步</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步结果" min-width="220">
          <template #default="{ row }">
            <span v-if="row.response" class="response-text">{{ row.response }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="同步时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 1"
              size="small"
              link
              type="warning"
              :loading="row._retrying"
              @click="handleRetry(row)"
            >
              重试
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无同步记录" />
        </template>
      </el-table>

      <div class="table-card-footer">
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
</div>
    </el-card>
</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import {
  fetchInstantRetailConfigs,
  syncPlatformOrders,
  syncPlatformProducts,
  fetchSyncStatus,
  fetchSyncLastTime,
  fetchMiniappOrderSyncLogs,
  retryMiniappOrderSync,
  getErrorMessage
} from "../../api";

const platformLoading = ref(false);
const platforms = ref<any[]>([]);

const logLoading = ref(false);
const syncLogs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref<number | "">("");

const priceSyncedCount = ref(0);
const productSyncedCount = ref(0);
const priceLastSync = ref("");
const productLastSync = ref("");

const platformMap: Record<string, { name: string; type: string }> = {
  JD: { name: "京东到家", type: "success" },
  MEITUAN: { name: "美团外卖", type: "danger" },
  ELEME: { name: "饿了么", type: "primary" }
};

const configuredPlatforms = computed(() => platforms.value.filter(p => p.configured));
const enabledPlatforms = computed(() => platforms.value.filter(p => p.enabled).length);

function getPlatformName(platform: string) { return platformMap[platform]?.name || platform; }
function getPlatformTagType(platform: string) { return platformMap[platform]?.type || "info"; }

async function loadPlatforms() {
  platformLoading.value = true;
  try {
    const result = await fetchInstantRetailConfigs();
    const records = result?.records ?? result ?? [];
    platforms.value = records.map((p: any) => ({
      ...p,
      _syncingOrders: false,
      _syncingProducts: false,
      _lastResult: ""
    }));
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "加载平台配置失败"));
    platforms.value = [];
  } finally {
    platformLoading.value = false;
  }
}

async function loadSyncStatus() {
  try {
    const priceStatus = await fetchSyncStatus("price");
    const productStatus = await fetchSyncStatus("product");
    const priceLast = await fetchSyncLastTime("price");
    const productLast = await fetchSyncLastTime("product");
    priceSyncedCount.value = sumStatusCount(priceStatus);
    productSyncedCount.value = sumStatusCount(productStatus);
    priceLastSync.value = priceLast ? String(priceLast) : "";
    productLastSync.value = productLast ? String(productLast) : "";
  } catch (e) {
    // 状态概览失败不阻塞页面，保持空值
    priceSyncedCount.value = 0;
    productSyncedCount.value = 0;
  }
}

function sumStatusCount(rows: any) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum: number, r: any) => sum + Number(r.count || 0), 0);
}

async function handleSyncOrders(row: any) {
  row._syncingOrders = true;
  row._lastResult = "";
  try {
    const result = await syncPlatformOrders(row.platform);
    row._lastResult = `成功同步 ${result.synced ?? 0} 条订单${result.hasMore ? "（还有更多）" : ""}`;
    ElMessage.success(`订单同步完成：${result.synced ?? 0} 条`);
  } catch (e) {
    row._lastResult = `同步失败：${getErrorMessage(e, "未知错误")}`;
    ElMessage.error(getErrorMessage(e, "订单同步失败"));
  } finally {
    row._syncingOrders = false;
  }
}

async function handleSyncProducts(row: any) {
  row._syncingProducts = true;
  row._lastResult = "";
  try {
    const result = await syncPlatformProducts(row.platform);
    row._lastResult = `成功同步 ${result.synced ?? 0} 个商品${result.hasMore ? "（还有更多）" : ""}`;
    ElMessage.success(`商品同步完成：${result.synced ?? 0} 个`);
  } catch (e) {
    row._lastResult = `同步失败：${getErrorMessage(e, "未知错误")}`;
    ElMessage.error(getErrorMessage(e, "商品同步失败"));
  } finally {
    row._syncingProducts = false;
  }
}

async function loadLogs() {
  logLoading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    };
    if (keyword.value.trim()) params.orderNo = keyword.value.trim();
    if (statusFilter.value !== "") params.status = statusFilter.value;
    const result = await fetchMiniappOrderSyncLogs(params);
    syncLogs.value = (result?.records ?? []).map((row: any) => ({
      ...row,
      orderNo: row.orderNo ?? row.order_no,
      platformOrderNo: row.platformOrderNo ?? row.platform_order_no,
      status: Number(row.status ?? 0),
      createdAt: row.createdAt ?? row.created_at,
      _retrying: false
    }));
    total.value = Number(result?.total ?? 0);
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "加载同步日志失败"));
    syncLogs.value = [];
    total.value = 0;
  } finally {
    logLoading.value = false;
  }
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

async function handleRetry(row: any) {
  try {
    await ElMessageBox.confirm(`确定要重试同步订单「${row.orderNo}」吗？`, "确认重试", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  row._retrying = true;
  try {
    await retryMiniappOrderSync(row.orderNo);
    ElMessage.success("重试已提交");
    loadLogs();
  } catch (e) {
    ElMessage.error(getErrorMessage(e, "重试失败"));
  } finally {
    row._retrying = false;
  }
}

onMounted(() => {
  loadPlatforms();
  loadSyncStatus();
  loadLogs();
});
</script>

<style scoped>
.page { padding: 0;
}
.stats-row {
  margin-bottom: 16px;
}
.stat-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}
.stat-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.stat-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.table-card {
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.order-no-text {
  font-family: monospace;
  color: var(--el-color-primary);
}
.response-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  word-break: break-all;
  display: inline-block;
  max-width: 100%;
}
.sync-result {
  font-size: 12px;
  color: var(--el-color-success);
}
.text-muted {
  color: var(--el-text-color-secondary);
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
