<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">采购报表</h2>
      <p class="page-desc">采购金额/品类/供应商分析</p>
    </div>
  </div>
<!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="12" align="middle">
        <el-col :span="6">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="5">
          <el-select v-model="filterSupplierId" placeholder="选择供应商" clearable style="width: 100%" filterable>
            <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-select v-model="filterStoreId" placeholder="选择门店" clearable style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-button type="primary" @click="refreshAll">
            <el-icon><Search /></el-icon> 查询
          </el-button>
          <el-button @click="resetFilter">
            <el-icon><Refresh /></el-icon> 重置
          </el-button>
          <el-button type="success" @click="exportData">
            <el-icon><Download /></el-icon> 导出
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 汇总卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">¥{{ Number(summary.purchaseAmount || 0).toFixed(2) }}</div>
        <div class="stat-label">采购总金额</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{ summary.orderCount || 0 }}</div>
        <div class="stat-label">采购单数量</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">{{ summary.productCount || 0 }}</div>
        <div class="stat-label">采购商品数</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{ summary.supplierCount || 0 }}</div>
        <div class="stat-label">供应商数</div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" type="border-card">
      <!-- Tab 1: 采购趋势 -->
      <el-tab-pane label="采购趋势" name="trend">
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="6">
            <el-radio-group v-model="trendGranularity" size="small" @change="loadTrend">
              <el-radio-button value="day">日</el-radio-button>
              <el-radio-button value="week">周</el-radio-button>
              <el-radio-button value="month">月</el-radio-button>
            </el-radio-group>
          </el-col>
        </el-row>
        <div ref="trendChart" class="chart-box chart-tall"></div>
      </el-tab-pane>

      <!-- Tab 2: 供应商排行 -->
      <el-tab-pane label="供应商排行" name="supplierRank">
        <div ref="supplierChart" class="chart-box chart-tall"></div>
        <div class="table-card">
<el-table :data="supplierRankingList" stripe border style="width: 100%; margin-top: 16px" v-loading="loading">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="supplierName" label="供应商名称" min-width="160" />
          <el-table-column prop="orderCount" label="采购单数" sortable width="100" />
          <el-table-column prop="totalAmount" label="采购金额" sortable width="140">
            <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="inStockCount" label="入库次数" sortable width="100" />
          <el-table-column prop="returnCount" label="退货次数" sortable width="100" />
        </el-table>
</div>
      </el-tab-pane>

      <!-- Tab 3: 采购明细 -->
      <el-tab-pane label="采购明细" name="detail">
        <div class="table-card">
<el-table :data="purchaseDetailList" stripe border style="width: 100%" v-loading="loading">
          <el-table-column prop="orderNo" label="采购单号" width="180" />
          <el-table-column prop="supplierName" label="供应商" min-width="140" />
          <el-table-column prop="storeName" label="门店" width="120" />
          <el-table-column prop="productName" label="商品名称" min-width="140" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column prop="quantity" label="数量" width="80" align="right" />
          <el-table-column prop="unitPrice" label="单价" width="100" align="right">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotal" label="合计金额" width="120" align="right">
            <template #default="{ row }">¥{{ Number(row.subtotal || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="expectedDate" label="预计到货" width="110" />
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'APPROVED'" type="success" size="small">已确认</el-tag>
              <el-tag v-else-if="row.status === 'PENDING'" type="warning" size="small">待确认</el-tag>
              <el-tag v-else-if="row.status === 'PARTIAL'" type="warning" size="small">部分入库</el-tag>
              <el-tag v-else-if="row.status === 'CANCELLED'" type="danger" size="small">已取消</el-tag>
              <el-tag v-else size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
</div>
        <el-pagination
          v-if="purchaseDetailList.length > 0"
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, sizes, prev, pager, next, jumper"
          :total="detailTotal"
          :page-size="detailPageSize"
          :current-page="detailPage"
          @size-change="handleDetailSizeChange"
          @current-change="handleDetailPageChange"
        />
      </el-tab-pane>

      <!-- Tab 4: 品类占比 -->
      <el-tab-pane label="品类占比" name="category">
        <div ref="categoryChart" class="chart-box chart-tall"></div>
      </el-tab-pane>
    </el-tabs>
</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, nextTick } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from "element-plus";
import { Search, Refresh, Download } from "@element-plus/icons-vue";
import echarts from '@/utils/echarts'
import {
  fetchReportPurchaseSummary,
  fetchReportSupplierRanking,
  fetchReportPurchaseTrend,
  fetchSuppliers,
  fetchStores
} from "../../api";
import { fetchPurchaseOrders } from "../../api/purchase";

const loading = ref(false);
const activeTab = ref("trend");
const dateRange = ref<string[]>([]);
const filterSupplierId = ref<number | null>(null);
const filterStoreId = ref<number | null>(null);
const supplierOptions = ref<any[]>([]);
const storeOptions = ref<any[]>([]);

const trendChart = ref<HTMLDivElement>();
const supplierChart = ref<HTMLDivElement>();
const categoryChart = ref<HTMLDivElement>();
const trendGranularity = ref("month");

const summary = ref({ purchaseAmount: 0, orderCount: 0, productCount: 0, supplierCount: 0 });
const supplierRankingList = ref<any[]>([]);

const purchaseDetailList = ref<any[]>([]);
const detailTotal = ref(0);
const detailPage = ref(1);
const detailPageSize = ref(20);

let trendInstance: echarts.ECharts | null = null;
let supplierInstance: echarts.ECharts | null = null;
let categoryInstance: echarts.ECharts | null = null;

function getFilterParams() {
  const params: any = {};
  if (dateRange.value && dateRange.value.length === 2) {
    params.dateStart = dateRange.value[0];
    params.dateEnd = dateRange.value[1];
  }
  if (filterSupplierId.value) params.supplierId = filterSupplierId.value;
  if (filterStoreId.value) params.storeId = filterStoreId.value;
  return params;
}

async function loadSupplierOptions() {
  try {
    const data = await fetchSuppliers({ page: 1, pageSize: 100 });
    supplierOptions.value = data.records || data || [];
  } catch { /* ignore */ }
}

async function loadStoreOptions() {
  try {
    const data = await fetchStores();
    storeOptions.value = data.records || data || [];
  } catch { /* ignore */ }
}

async function loadSummary() {
  try {
    const params = getFilterParams();
    const data = await fetchReportPurchaseSummary(params);
    summary.value = {
      purchaseAmount: data.purchaseAmount || data.totalAmount || 0,
      orderCount: data.orderCount || 0,
      productCount: data.productCount || 0,
      supplierCount: data.supplierCount || 0
    };
  } catch { /* ignore */ }
}

async function loadTrend() {
  try {
    const params = getFilterParams();
    params.granularity = trendGranularity.value;
    const data = await fetchReportPurchaseTrend(params);
    const labels = data.labels || [];
    const amounts = data.amounts || [];
    if (!trendInstance) {
      trendInstance = echarts.init(trendChart.value!);
    }
    trendInstance.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 12 ? 45 : 0 } },
      yAxis: { type: "value" },
      series: [{
        type: "line",
        data: amounts,
        smooth: true,
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(63,111,239,0.3)" }, { offset: 1, color: "rgba(63,111,239,0.05)" }
        ])},
        lineStyle: { color: CHART_COLORS.primary, width: 2 },
        itemStyle: { color: CHART_COLORS.primary }
      }]
    });
  } catch { /* ignore */ }
}

async function loadSupplierRanking() {
  try {
    const params = getFilterParams();
    const data = await fetchReportSupplierRanking(params);
    const items = (data.ranking || data || []).slice(0, 10);
    supplierRankingList.value = items;
    const names = items.map((i: any) => i.supplierName || i.name);
    const values = items.map((i: any) => Number(i.totalAmount || i.amount || 0));
    if (!supplierInstance) {
      supplierInstance = echarts.init(supplierChart.value!);
    }
    supplierInstance.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 120, right: 30, top: 20, bottom: 30 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: names.reverse(), inverse: true, axisLabel: { width: 100, overflow: "truncate" } },
      series: [{
        type: "bar",
        data: values.reverse().map((v: number) => ({ value: v, itemStyle: { color: CHART_COLORS.primary } })),
        barMaxWidth: 24
      }]
    });
  } catch { /* ignore */ }
}

async function loadCategoryDistribution() {
  try {
    const params = getFilterParams();
    const data = await fetchReportPurchaseSummary(params);
    const items = (data.categoryBreakdown || data.categories || []).slice(0, 8);
    const chartData = items.length > 0
      ? items.map((i: any) => ({ name: i.categoryName || i.name, value: Number(i.totalAmount || i.amount || 0) }))
      : [{ name: "暂无数据", value: 1 }];
    if (!categoryInstance) {
      categoryInstance = echarts.init(categoryChart.value!);
    }
    categoryInstance.setOption({
      tooltip: { trigger: "item" },
      legend: { orient: "vertical", right: 10, top: "center", textStyle: { fontSize: 12 } },
      series: [{
        type: "pie",
        radius: ["45%", "70%"],
        center: ["35%", "50%"],
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        data: chartData
      }]
    });
  } catch { /* ignore */ }
}

async function loadPurchaseDetail() {
  loading.value = true;
  try {
    const params: any = {
      page: detailPage.value,
      pageSize: detailPageSize.value
    };
    if (filterSupplierId.value) params.supplierId = filterSupplierId.value;
    const data = await fetchPurchaseOrders(params);
    purchaseDetailList.value = data.records || [];
    detailTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载明细失败");
  } finally {
    loading.value = false;
  }
}

function handleDetailSizeChange(size: number) {
  detailPageSize.value = size;
  detailPage.value = 1;
  loadPurchaseDetail();
}

function handleDetailPageChange(page: number) {
  detailPage.value = page;
  loadPurchaseDetail();
}

async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([
      loadSummary(),
      loadTrend(),
      loadSupplierRanking(),
      loadCategoryDistribution(),
      loadPurchaseDetail()
    ]);
  } finally {
    loading.value = false;
  }
}

function resetFilter() {
  dateRange.value = [];
  filterSupplierId.value = null;
  filterStoreId.value = null;
  refreshAll();
}

function exportData() {
  ElMessage.info("导出功能待实现");
}

function handleResize() {
  trendInstance?.resize();
  supplierInstance?.resize();
  categoryInstance?.resize();
}

onMounted(async () => {
  await Promise.all([loadSupplierOptions(), loadStoreOptions()]);
  await loadSummary();
  await nextTick();
  loadTrend();
  loadSupplierRanking();
  loadCategoryDistribution();
  loadPurchaseDetail();
  window.addEventListener("resize", handleResize);
});
</script>

<style scoped>
.page { padding: 0; }

.filter-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.stats-row { display: flex; gap: 16px; margin-bottom: 16px; }
.stat-card { flex: 1; background: var(--bg-card); border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid var(--color-primary); }
.stat-card.green { border-left-color: var(--color-success); }
.stat-card.blue { border-left-color: var(--color-primary); }
.stat-card.orange { border-left-color: var(--color-warning); }
.stat-value { font-size: 28px; font-weight: 700; color: var(--gray-700); }
.stat-label { font-size: 13px; color: var(--gray-400); margin-top: 4px; }

.chart-box {
  width: 100%;
  background: var(--bg-card);
  border-radius: 8px;
}
.chart-tall { height: 380px; }
.chart-medium { height: 300px; }
</style>
