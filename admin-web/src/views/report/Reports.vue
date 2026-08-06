<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>统计报表</span>
          <div class="header-actions">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="width: 280px; margin-right: 10px"
              value-format="YYYY-MM-DD"
            />
            <el-button type="primary" @click="loadAllData">
              <el-icon><Search /></el-icon> 查询
            </el-button>
            <el-button @click="loadAllData">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" class="stats-cards">
        <el-col :span="6">
          <div class="stat-card stat-card-primary">
            <div class="stat-label">总销售额</div>
            <div class="stat-value">¥{{ totalSales.toFixed(2) }}</div>
            <div class="stat-desc">较上期 {{ salesGrowth }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card stat-card-success">
            <div class="stat-label">订单总数</div>
            <div class="stat-value">{{ totalOrders }}</div>
            <div class="stat-desc">较上期 {{ orderGrowth }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card stat-card-warning">
            <div class="stat-label">客户数</div>
            <div class="stat-value">{{ totalCustomers }}</div>
            <div class="stat-desc">新增 {{ newCustomers }} 人</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card stat-card-info">
            <div class="stat-label">客单价</div>
            <div class="stat-value">¥{{ avgOrderValue.toFixed(2) }}</div>
            <div class="stat-desc">较上期 {{ avgGrowth }}%</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16" style="margin-top: 20px">
        <el-col :span="16">
          <el-card class="chart-card">
            <template #header>
              <span>销售趋势</span>
            </template>
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
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="chart-card">
            <template #header>
              <span>订单状态分布</span>
            </template>
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
          </el-card>
        </el-col>
      </el-row>

      <el-row style="margin-top: 20px">
        <el-card class="chart-card">
          <template #header>
            <span>门店业绩排名</span>
          </template>
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
        </el-card>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import { fetchDailySales, fetchOrderStats, fetchStorePerformance } from "../../api";

const dateRange = ref<string[]>([]);
const dailySalesLoading = ref(false);
const orderStatsLoading = ref(false);
const storePerformanceLoading = ref(false);
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

const totalCustomers = ref(128);
const newCustomers = ref(12);
const salesGrowth = ref(12.5);
const orderGrowth = ref(8.3);
const avgGrowth = ref(3.8);

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
    const data = await fetchDailySales();
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
    const data = await fetchOrderStats();
    orderStats.value = Array.isArray(data) ? data : (data.records || data || []);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载订单统计失败");
  } finally {
    orderStatsLoading.value = false;
  }
}

async function loadStorePerformance() {
  storePerformanceLoading.value = true;
  try {
    const data = await fetchStorePerformance();
    storePerformance.value = Array.isArray(data) ? data : (data.records || data || []);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载门店业绩失败");
  } finally {
    storePerformanceLoading.value = false;
  }
}

function loadAllData() {
  loadDailySales();
  loadOrderStats();
  loadStorePerformance();
}

onMounted(() => {
  loadAllData();
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
.stats-cards {
  margin-bottom: 0;
}
.stat-card {
  padding: 20px;
  border-radius: 8px;
  color: var(--text-inverse);
}
.stat-card-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-5) 100%);
}
.stat-card-success {
  background: linear-gradient(135deg, var(--color-success) 0%, rgba(14,168,121,0.4) 100%);
}
.stat-card-warning {
  background: linear-gradient(135deg, var(--chart-5) 0%, var(--color-danger) 100%);
}
.stat-card-info {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-6) 100%);
}
.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}
.stat-desc {
  font-size: 12px;
  opacity: 0.8;
}
.chart-card {
  height: 100%;
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
