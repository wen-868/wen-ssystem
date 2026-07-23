<template>
  <div class="page">
    <el-card>
      <div class="filter-bar">
        <div class="filter-left">
          <el-select v-model="platformFilter" placeholder="同步平台" clearable style="width: 140px; margin-right: 12px" @change="loadData">
            <el-option label="美团外卖" value="MEITUAN" />
            <el-option label="饿了么" value="ELEME" />
            <el-option label="京东到家" value="JD" />
            <el-option label="自有小程序" value="MINIAPP" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="同步状态" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="同步成功" value="SUCCESS" />
            <el-option label="同步失败" value="FAILED" />
            <el-option label="部分成功" value="PARTIAL" />
            <el-option label="同步中" value="SYNCING" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 360px; margin-right: 12px"
            @change="loadData"
          />
        </div>
        <div class="filter-right">
          <el-input
            v-model="keyword"
            placeholder="搜索批次号"
            clearable
            style="width: 200px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="loadData">
            <el-icon style="margin-right: 4px"><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" @click="handleSyncAll">
            <el-icon style="margin-right: 4px"><Refresh /></el-icon>
            全量同步
          </el-button>
        </div>
      </div>

      <el-table :data="syncLogs" v-loading="loading" stripe>
        <el-table-column prop="batchNo" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no-text">{{ row.batchNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="110">
          <template #default="{ row }">
            <el-tag :type="getPlatformTagType(row.platform)" size="small">{{ getPlatformName(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.syncType === 'FULL'" type="primary" size="small">全量同步</el-tag>
            <el-tag v-else-if="row.syncType === 'INCREMENTAL'" type="success" size="small">增量同步</el-tag>
            <el-tag v-else-if="row.syncType === 'PRICE'" type="warning" size="small">价格同步</el-tag>
            <el-tag v-else-if="row.syncType === 'STOCK'" type="info" size="small">库存同步</el-tag>
            <el-tag v-else size="small">{{ row.syncType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SKU数" width="80" align="center">
          <template #default="{ row }">{{ row.totalCount }}</template>
        </el-table-column>
        <el-table-column label="成功数" width="80" align="center">
          <template #default="{ row }">
            <span class="success-count">{{ row.successCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="失败数" width="80" align="center">
          <template #default="{ row }">
            <span :class="row.failCount > 0 ? 'fail-count' : ''">{{ row.failCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="同步状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'SUCCESS'" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="row.status === 'FAILED'" type="danger" size="small">失败</el-tag>
            <el-tag v-else-if="row.status === 'PARTIAL'" type="warning" size="small">部分成功</el-tag>
            <el-tag v-else-if="row.status === 'SYNCING'" type="primary" size="small">
              <el-icon class="is-loading"><Loading /></el-icon>
              同步中
            </el-tag>
            <el-tag v-else size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="syncTime" label="同步时间" width="170" />
        <el-table-column prop="duration" label="耗时" width="80" align="center" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="['FAILED', 'PARTIAL'].includes(row.status)"
              size="small"
              link
              type="warning"
              :loading="row._retrying"
              @click="handleRetry(row)"
            >重试</el-button>
            <el-button
              v-if="row.status === 'FAILED'"
              size="small"
              link
              type="warning"
              :loading="row._retrying"
              @click="handleRetryFailed(row)"
            >仅重试失败</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无同步记录" />
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

    <!-- 同步详情对话框 -->
    <el-dialog v-model="detailVisible" title="同步详情" width="720px">
      <div v-if="currentDetail" class="detail-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="批次号">{{ currentDetail.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="平台">{{ getPlatformName(currentDetail.platform) }}</el-descriptions-item>
          <el-descriptions-item label="同步类型">{{ currentDetail.syncType }}</el-descriptions-item>
          <el-descriptions-item label="同步状态">
            <el-tag v-if="currentDetail.status === 'SUCCESS'" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="currentDetail.status === 'FAILED'" type="danger" size="small">失败</el-tag>
            <el-tag v-else-if="currentDetail.status === 'PARTIAL'" type="warning" size="small">部分成功</el-tag>
            <el-tag v-else size="small">{{ currentDetail.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="同步时间">{{ currentDetail.syncTime }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentDetail.duration }}</el-descriptions-item>
          <el-descriptions-item label="总SKU数">{{ currentDetail.totalCount }}</el-descriptions-item>
          <el-descriptions-item label="成功数">{{ currentDetail.successCount }}</el-descriptions-item>
          <el-descriptions-item label="失败数">{{ currentDetail.failCount }}</el-descriptions-item>
          <el-descriptions-item label="跳过数">{{ currentDetail.skipCount || 0 }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentDetail.failDetails?.length > 0" class="fail-section">
          <div class="section-title">失败明细</div>
          <el-table :data="currentDetail.failDetails" size="small" max-height="300">
            <el-table-column prop="sku" label="SKU" width="140" />
            <el-table-column prop="productName" label="商品名称" min-width="150" />
            <el-table-column prop="reason" label="失败原因" min-width="200" />
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="currentDetail && ['FAILED', 'PARTIAL'].includes(currentDetail.status)"
          type="primary"
          @click="handleRetry(currentDetail); detailVisible = false"
        >重试同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Refresh, Loading } from "@element-plus/icons-vue";

const loading = ref(false);
const syncLogs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const platformFilter = ref("");
const statusFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const platformMap: Record<string, { name: string; type: string }> = {
  MEITUAN: { name: "美团外卖", type: "danger" },
  ELEME: { name: "饿了么", type: "primary" },
  JD: { name: "京东到家", type: "success" },
  MINIAPP: { name: "自有小程序", type: "warning" }
};

function getPlatformName(platform: string) { return platformMap[platform]?.name || platform; }
function getPlatformTagType(platform: string) { return platformMap[platform]?.type || "info"; }

// ==================== 详情 ====================
const detailVisible = ref(false);
const currentDetail = ref<any>(null);

const mockSyncLogs = Array.from({ length: 25 }, (_, i) => {
  const platforms = ["MEITUAN", "ELEME", "JD", "MINIAPP"];
  const syncTypes = ["FULL", "INCREMENTAL", "PRICE", "STOCK"];
  const statuses = ["SUCCESS", "SUCCESS", "SUCCESS", "PARTIAL", "FAILED", "SYNCING"];
  const totalCount = Math.floor(Math.random() * 200) + 50;
  const status = statuses[i % 6];
  const failCount = status === "FAILED" ? Math.floor(Math.random() * 10) + 1 : (status === "PARTIAL" ? Math.floor(Math.random() * 5) + 1 : 0);
  
  const failDetails = failCount > 0 ? Array.from({ length: failCount }, (_, j) => ({
    sku: `SKU${String(1000 + i * 10 + j).padStart(6, "0")}`,
    productName: ["有机西红柿 500g", "富士苹果 约1kg", "伊利纯牛奶 250ml*12盒", "农夫山泉 550ml*24瓶", "金龙鱼调和油 5L"][j % 5],
    reason: ["库存不足", "价格异常", "平台接口超时", "商品已下架", "SKU编码不匹配"][j % 5]
  })) : [];

  return {
    id: i + 1,
    batchNo: `SYNC${String(20260706).padStart(8, "0")}${String(i + 1).padStart(4, "0")}`,
    platform: platforms[i % 4],
    syncType: syncTypes[i % 4],
    totalCount,
    successCount: totalCount - failCount,
    failCount,
    skipCount: status === "PARTIAL" ? Math.floor(Math.random() * 3) : 0,
    status,
    syncTime: `2026-07-${String(6 - Math.floor(i / 4)).padStart(2, "0")} ${String(8 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}`,
    duration: `${Math.floor(Math.random() * 120) + 5}s`,
    failDetails,
    _retrying: false
  };
});

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockSyncLogs];
    
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(l => l.batchNo.toLowerCase().includes(kw));
    }
    if (platformFilter.value) {
      filtered = filtered.filter(l => l.platform === platformFilter.value);
    }
    if (statusFilter.value) {
      filtered = filtered.filter(l => l.status === statusFilter.value);
    }
    if (dateRange.value?.[0] && dateRange.value?.[1]) {
      filtered = filtered.filter(l =>
        l.syncTime >= dateRange.value![0] && l.syncTime <= dateRange.value![1]
      );
    }
    
    const start = (page.value - 1) * pageSize.value;
    syncLogs.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function resetFilters() {
  keyword.value = "";
  platformFilter.value = "";
  statusFilter.value = "";
  dateRange.value = null;
  page.value = 1;
  loadData();
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

function viewDetail(row: any) {
  currentDetail.value = row;
  detailVisible.value = true;
}

async function handleRetry(row: any) {
  const confirmed = await ElMessageBox.confirm(
    `确定要重新同步批次「${row.batchNo}」吗？`,
    "确认重试",
    { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;

  row._retrying = true;
  setTimeout(() => {
    row.status = "SYNCING";
    setTimeout(() => {
      row.status = "SUCCESS";
      row.failCount = 0;
      row.successCount = row.totalCount;
      row.failDetails = [];
      row._retrying = false;
      ElMessage.success(`批次 ${row.batchNo} 重试同步成功`);
    }, 1500);
  }, 500);
}

async function handleRetryFailed(row: any) {
  const confirmed = await ElMessageBox.confirm(
    `确定仅重试批次「${row.batchNo}」中失败的 ${row.failCount} 个SKU吗？`,
    "确认重试失败项",
    { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;

  row._retrying = true;
  setTimeout(() => {
    row.status = row.failCount === row.totalCount ? "FAILED" : "PARTIAL";
    const successRetry = Math.floor(Math.random() * row.failCount) + 1;
    row.successCount += successRetry;
    row.failCount -= successRetry;
    if (row.failCount === 0) row.status = "SUCCESS";
    row.failDetails = row.failDetails?.slice(successRetry);
    row._retrying = false;
    if (row.failCount === 0) {
      ElMessage.success("失败项全部重试成功");
    } else {
      ElMessage.warning(`重试完成，${successRetry} 项成功，${row.failCount} 项仍失败`);
    }
  }, 1500);
}

async function handleSyncAll() {
  const confirmed = await ElMessageBox.confirm(
    "全量同步会将所有商品的价格和库存推送到已对接平台，确认执行？",
    "全量同步确认",
    { confirmButtonText: "确认同步", cancelButtonText: "取消", type: "warning" }
  ).catch(() => null);
  if (!confirmed) return;

  const newBatch = {
    id: Math.max(...mockSyncLogs.map(l => l.id), 0) + 1,
    batchNo: `SYNC${String(20260706).padStart(8, "0")}${String(Math.floor(Math.random() * 9000) + 1000)}`,
    platform: "MINIAPP",
    syncType: "FULL",
    totalCount: 320,
    successCount: 0,
    failCount: 0,
    skipCount: 0,
    status: "SYNCING",
    syncTime: new Date().toLocaleString("zh-CN"),
    duration: "-",
    failDetails: [],
    _retrying: false
  };
  mockSyncLogs.unshift(newBatch);
  ElMessage.success("全量同步任务已提交，请稍后刷新查看结果");
  loadData();

  setTimeout(() => {
    newBatch.status = "SUCCESS";
    newBatch.successCount = 320;
    newBatch.duration = "45s";
    loadData();
  }, 3000);
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-left, .filter-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.batch-no-text {
  font-family: monospace;
  color: var(--el-color-primary);
  cursor: pointer;
}
.success-count {
  color: var(--el-color-success);
  font-weight: 500;
}
.fail-count {
  color: var(--el-color-danger);
  font-weight: 500;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-content {
  padding: 0 4px;
}
.fail-section {
  margin-top: 20px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
</style>