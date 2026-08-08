<template>
  <div class="page">
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">统计报表</h2>
        <p class="page-desc">销售趋势、订单状态分布与门店业绩</p>
      </div>
      <div class="page-header-actions">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
        />
        <el-button type="primary" @click="loadAllData">
          <el-icon><Search /></el-icon>&nbsp;查询
        </el-button>
        <el-button @click="loadAllData">
          <el-icon><Refresh /></el-icon>&nbsp;刷新
        </el-button>
      </div>
    </div>

    <!-- 指标卡 -->
    <div class="stat-grid">
      <div class="stat-grid-card">
        <div class="stat-grid-value stat-grid-value--primary">¥{{ totalSales.toFixed(2) }}</div>
        <div class="stat-grid-label">总销售额</div>
        <div class="stat-grid-trend up">较上期 {{ salesGrowth }}%</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ totalOrders }}</div>
        <div class="stat-grid-label">订单总数</div>
        <div class="stat-grid-trend up">较上期 {{ orderGrowth }}%</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">{{ totalCustomers }}</div>
        <div class="stat-grid-label">客户数</div>
        <div class="stat-grid-trend down">新增 {{ newCustomers }} 人</div>
      </div>
      <div class="stat-grid-card">
        <div class="stat-grid-value">¥{{ avgOrderValue.toFixed(2) }}</div>
        <div class="stat-grid-label">客单价</div>
        <div class="stat-grid-trend up">较上期 {{ avgGrowth }}%</div>
      </div>
    </div>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="16">
        <div class="chart-card">
          <div class="chart-card-header">销售趋势</div>
          <div class="chart-card-body">
            <div v-loading="dailySalesLoading" class="chart-container">
              <div class="chart-bars">
                <div
                  v-for="(item, index) in dailySales" :key="index"
                  class="bar-item"
                >
                  <div class="bar-wrapper">
                    <div
                      class="bar"
                      :style="{ height: getBarHeight(item.salesAmount) + '%' }"
                    ></div>
                  </div>
                  <div class="bar-label">{{ formatDate(item.date) }}</div>
                  <div class="bar-value">¥{{ Number(item.salesAmount || 0).toFixed(0) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="chart-card">
          <div class="chart-card-header">订单状态分布</div>
          <div class="chart-card-body">
            <div v-loading="orderStatsLoading" class="pie-chart-container">
              <div class="pie-legend">
                <div
                  v-for="(item, index) in orderStats"
                  :key="index"
                  class="legend-item"
                >
                  <span class="legend-dot" :class="'dot-' + index"></span>
                  <span class="legend-label">{{ item.statusName }}</span>
                  <span class="legend-value">{{ item.count || 0 }}</span>
                </div>
              </div>
              <div class="pie-progress">
                <div
                  v-for="(item, index) in orderStats"
                  :key="index"
                  class="progress-item"
                >
                  <div class="progress-label">{{ item.statusName }}</div>
                  <el-progress
                    :percentage="getPercentage(item.count, totalOrderCount)"
                    :color="getProgressColor(index)"
                    :show-text="false"
                  />
                  <div class="progress-count">{{ item.count || 0 }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 明细表 -->
    <div class="chart-card table-block">
      <div class="chart-card-header">门店业绩排名</div>
      <div class="table-card chart-card-table">
          <el-table :data="storePerformance" v-loading="storePerformanceLoading" stripe>
            <el-table-column type="index" label="排名" width="80">
              <template #default="{ $index }">
                <el-tag v-if="$index === 0" type="danger" size="small">第1名</el-tag>
                <el-tag v-else-if="$index === 1" type="warning" size="small">第2名</el-tag>
                <el-tag v-else-if="$index === 2" type="primary" size="small">第3名</el-tag>
                <span v-else>第{{ $index + 1 }}名</span>
              </template>
            </el-table-column>
            <el-table-column prop="storeName" label="门店" min-width="150" />
            <el-table-column prop="salesAmount" label="销售额" width="150">
              <template #default="{ row }">
                <span class="amount-text">¥{{ Number(row.salesAmount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单数" width="120" />
            <el-table-column prop="avgOrderValue" label="客单价" width="150">
              <template #default="{ row }">¥{{ Number(row.avgOrderValue || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="customerCount" label="客户数" width="120" />
            <el-table-column label="完成率" width="200">
              <template #default="{ row }">
                <el-progress
                  :percentage="Number(row.completionRate || 0)"
                  :color="row.completionRate >= 100 ? 'var(--color-success)' : 'var(--color-warning)'"
                />
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="80" />
            </template>
          </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import {
  fetchReportSalesDaily,
  fetchReportBusinessOverview,
  fetchDashboardCustomerStats,
} from "../../api";
import { api } from "../../api";

const dateRange = ref<string[]>([]);
const dailySalesLoading = ref(false);
const orderStatsLoading = ref(false);
const storePerformanceLoading = ref(false);
const customerLoading = ref(false);
const dailySales = ref<any[]>([]);
const orderStats = ref<any[]>([]);
const storePerformance = ref<any[]>([]);

const totalSales = computed(() => {
  return dailySales.value.reduce((sum, item) => sum + Number(item.salesAmount || 0), 0);
});

const totalOrders = computed(() => {
  return orderStats.value.reduce((sum, item) => sum + Number(item.count || 0), 0);
});

const totalOrderCount = computed(() => totalOrders.value);

const totalCustomers = ref(0);
const newCustomers = ref(0);
const salesGrowth = ref(0);
const orderGrowth = ref(0);

// 客单价增长率：由销售日报最近两日客单价计算
const avgGrowth = computed(() => {
  const list = dailySales.value;
  if (list.length < 2) return 0;
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const cur = Number(last.salesAmount ?? 0) / (Number(last.orderCount ?? 0) || 1);
  const pre = Number(prev.salesAmount ?? 0) / (Number(prev.orderCount ?? 0) || 1);
  if (pre === 0) return 0;
  return Math.round(((cur - pre) / pre) * 1000) / 10;
});

const avgOrderValue = computed(() => {
  if (totalOrders.value === 0) return 0;
  return totalSales.value / totalOrders.value;
});

const maxSales = computed(() => {
  if (dailySales.value.length === 0) return 1;
  return Math.max(...dailySales.value.map(item => Number(item.salesAmount || 0)), 1);
});

function getBarHeight(value: number) {
  if (maxSales.value === 0) return 0;
  return (value / maxSales.value) * 100;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getPercentage(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function getProgressColor(index: number) {
  const colors = [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.primary, CHART_COLORS.danger, CHART_COLORS.textMuted];
  return colors[index % colors.length];
}

async function loadDailySales() {
  dailySalesLoading.value = true;
  try {
    const data = await fetchReportSalesDaily({
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    });
    dailySales.value = Array.isArray(data) ? data : (data.records || data || []);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载销售趋势失败");
  } finally {
    dailySalesLoading.value = false;
  }
}

async function loadOrderStats() {
  orderStatsLoading.value = true;
  try {
    const { data } = await api.get("/admin/orders/stats");
    const list = Array.isArray(data.data) ? data.data : (data.data?.records || []);
    const statusNames: Record<string, string> = {
      PENDING_PAYMENT: "待付款",
      PAID: "已支付",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
      CLOSED: "已关闭",
    };
    orderStats.value = list.map((s: any) => ({
      statusName: statusNames[s.status] || s.status || "-",
      count: Number(s.count ?? 0),
    }));
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载订单统计失败");
  } finally {
    orderStatsLoading.value = false;
  }
}

async function loadStorePerformance() {
  storePerformanceLoading.value = true;
  try {
    const { data } = await api.get("/admin/store-sales-performance");
    const list = Array.isArray(data.data) ? data.data : (data.data?.records || []);
    storePerformance.value = list.map((s: any) => ({
      storeId: s.storeId,
      storeName: s.storeName || "-",
      salesAmount: Number(s.totalSales ?? 0),
      orderCount: Number(s.billCount ?? 0),
    }));
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载门店业绩失败");
  } finally {
    storePerformanceLoading.value = false;
  }
}

// 客户数/新增/增长率：来自客户统计 + 经营概览
async function loadCustomerAndGrowth() {
  customerLoading.value = true;
  try {
    const [customer, overview] = await Promise.all([
      fetchDashboardCustomerStats(),
      fetchReportBusinessOverview(),
    ]);
    totalCustomers.value = Number(customer?.totalCount ?? 0);
    newCustomers.value = Number(customer?.monthlyNewCount ?? 0);
    salesGrowth.value = Number(overview?.salesGrowthRate ?? 0);
    orderGrowth.value = Number(overview?.orderGrowthRate ?? 0);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载客户/增长率失败");
  } finally {
    customerLoading.value = false;
  }
}

function loadAllData() {
  loadDailySales();
  loadOrderStats();
  loadStorePerformance();
  loadCustomerAndGrowth();
}

onMounted(() => {
  loadAllData();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.chart-row {
  margin-bottom: 16px;
}
.table-block {
  margin-top: 16px;
}
.chart-card-table {
  border-top: none;
  border-radius: 0 0 var(--card-radius) var(--card-radius);
  box-shadow: none;
}
.chart-container {
  height: 300px;
  display: flex;
  align-items: flex-end;
}
.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  width: 100%;
  height: 100%;
  padding-bottom: 40px;
  position: relative;
}
.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  margin: 0 4px;
}
.bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar {
  width: 60%;
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--chart-5) 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s ease;
}
.bar:hover {
  opacity: 0.8;
}
.bar-label {
  position: absolute;
  bottom: 20px;
  font-size: 12px;
  color: var(--gray-400);
}
.bar-value {
  position: absolute;
  bottom: 0;
  font-size: 11px;
  color: var(--gray-600);
}
.pie-chart-container {
  padding: 10px 0;
}
.pie-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot-0 { background: var(--color-success); }
.dot-1 { background: var(--color-warning); }
.dot-2 { background: var(--color-primary); }
.dot-3 { background: var(--color-danger); }
.dot-4 { background: var(--gray-400); }
.legend-label {
  color: var(--gray-600);
}
.legend-value {
  font-weight: 600;
  color: var(--gray-700);
}
.pie-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.progress-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.progress-label {
  width: 80px;
  font-size: 13px;
  color: var(--gray-600);
}
.progress-count {
  width: 50px;
  text-align: right;
  font-size: 13px;
  color: var(--gray-700);
}
.amount-text {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
