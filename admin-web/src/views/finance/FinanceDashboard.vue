<template>
  <div class="page">
    <!-- 范围切换 -->
    <div class="range-bar">
      <el-radio-group v-model="rangeType" size="default" @change="loadData">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="quarter">本季</el-radio-button>
        <el-radio-button value="year">本年</el-radio-button>
      </el-radio-group>
      <el-button style="margin-left: 16px" @click="loadData">刷新</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-item">
          <div class="stat-label">本月收入</div>
          <div class="stat-value">{{ formatYuan(dashboard.monthIncome) }}</div>
          <div class="stat-compare">
            <span v-if="dashboard.incomePrev > 0" class="stat-up">▲ {{
              ((dashboard.monthIncome - dashboard.incomePrev) / dashboard.incomePrev * 100).toFixed(1)
            }}%</span>
            <span v-else-if="dashboard.incomePrev < 0" class="stat-down">▼ {{
              ((dashboard.monthIncome - dashboard.incomePrev) / Math.abs(dashboard.incomePrev) * 100).toFixed(1)
            }}%</span>
          </div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-item">
          <div class="stat-label">本月支出</div>
          <div class="stat-value">{{ formatYuan(dashboard.monthExpense) }}</div>
          <div class="stat-compare">
            <span v-if="dashboard.expensePrev > 0 && dashboard.monthExpense > dashboard.expensePrev" class="stat-up">▲ {{
              ((dashboard.monthExpense - dashboard.expensePrev) / dashboard.expensePrev * 100).toFixed(1)
            }}%</span>
            <span v-else-if="dashboard.expensePrev > 0" class="stat-down">▼ {{
              ((dashboard.expensePrev - dashboard.monthExpense) / dashboard.expensePrev * 100).toFixed(1)
            }}%</span>
          </div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-item">
          <div class="stat-label">应收余额</div>
          <div class="stat-value">{{ formatYuan(dashboard.arBalance) }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-item">
          <div class="stat-label">应付余额</div>
          <div class="stat-value">{{ formatYuan(dashboard.apBalance) }}</div>
        </div>
      </div>
    </div>

    <!-- 现金流趋势 -->
    <PageCard title="现金流趋势">
      <div ref="cashFlowChartRef" class="chart-body"></div>
    </PageCard>

    <!-- 利润趋势 -->
    <PageCard title="利润趋势">
      <div ref="profitChartRef" class="chart-body"></div>
    </PageCard>

    <!-- 应收/应付TOP5 -->
    <div class="chart-row">
      <PageCard title="应收TOP5客户" class="half-card">
        <div ref="arTopChartRef" class="chart-body" style="height: 300px"></div>
      </PageCard>
      <PageCard title="应付TOP5供应商" class="half-card">
        <div ref="apTopChartRef" class="chart-body" style="height: 300px"></div>
      </PageCard>
    </div>

    <!-- 日报表 -->
    <PageCard title="日报表">
      <el-table :data="dailyReport" stripe>
        <el-table-column prop="date" label="日期" width="140">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column label="收入" width="160" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.income) }}
          </template>
        </el-table-column>
        <el-table-column label="支出" width="160" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.expense) }}
          </template>
        </el-table-column>
        <el-table-column label="余额" width="160" align="right">
          <template #default="{ row }">
            <span :style="{ color: (row.balance || 0) >= 0 ? '#67c23a' : '#f56c6c' }">
              {{ formatYuan(row.balance) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatDate, formatYuan } from "../../utils/format";
import {
  fetchFinanceDashboard, fetchCashFlow, fetchProfitTrend,
  fetchTopCustomersAR, fetchTopSuppliersAP, fetchDailyReport
} from "../../api";

const rangeType = ref("month");

const dashboard = reactive({
  monthIncome: 0,
  incomePrev: 0,
  monthExpense: 0,
  expensePrev: 0,
  arBalance: 0,
  apBalance: 0
});

const dailyReport = ref<any[]>([]);

const cashFlowChartRef = ref<HTMLDivElement>();
const profitChartRef = ref<HTMLDivElement>();
const arTopChartRef = ref<HTMLDivElement>();
const apTopChartRef = ref<HTMLDivElement>();

let cashFlowInstance: echarts.ECharts | null = null;
let profitInstance: echarts.ECharts | null = null;
let arTopInstance: echarts.ECharts | null = null;
let apTopInstance: echarts.ECharts | null = null;

async function loadData() {
  try {
    const rangeParams = { range: rangeType.value };
    const monthParams = { month: rangeType.value };
    const [dashRes, cashRes, profitRes, arTopRes, apTopRes, dailyRes] = await Promise.all([
      fetchFinanceDashboard(),
      fetchCashFlow(rangeParams),
      fetchProfitTrend(rangeParams),
      fetchTopCustomersAR(),
      fetchTopSuppliersAP(),
      fetchDailyReport(monthParams)
    ]);

    if (dashRes) {
      dashboard.monthIncome = dashRes.monthIncome || 0;
      dashboard.incomePrev = dashRes.incomePrev || 0;
      dashboard.monthExpense = dashRes.monthExpense || 0;
      dashboard.expensePrev = dashRes.expensePrev || 0;
      dashboard.arBalance = dashRes.arBalance || 0;
      dashboard.apBalance = dashRes.apBalance || 0;
    }

    dailyReport.value = dailyRes?.records || dailyRes?.list || [];

    await nextTick();
    renderCharts(cashRes, profitRes, arTopRes, apTopRes);
  } catch {
    // ignore
  }
}

function renderCharts(cashRes: any, profitRes: any, arTopRes: any, apTopRes: any) {
  renderCashFlowChart(cashRes?.data || cashRes?.records || []);
  renderProfitChart(profitRes?.data || profitRes?.records || []);
  renderTopBarChart(arTopChartRef.value, arTopRes?.data || arTopRes?.records || [], "name", "amount", arTopInstance);
  renderTopBarChart(apTopChartRef.value, apTopRes?.data || apTopRes?.records || [], "name", "amount", apTopInstance);
}

function renderCashFlowChart(data: any[]) {
  if (!cashFlowChartRef.value || !data.length) return;
  if (cashFlowInstance) cashFlowInstance.dispose();

  const months = data.map((d: any) => d.month || d.label || "");
  const incomes = data.map((d: any) => Number(d.income) || 0);
  const expenses = data.map((d: any) => Number(d.expense) || 0);

  cashFlowInstance = echarts.init(cashFlowChartRef.value);
  cashFlowInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["收入", "支出"], bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => formatYuan(v) } },
    series: [
      {
        name: "收入",
        type: "line",
        data: incomes,
        smooth: true,
        itemStyle: { color: "#67c23a" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(103,194,58,0.3)" }, { offset: 1, color: "rgba(103,194,58,0)" }]) }
      },
      {
        name: "支出",
        type: "line",
        data: expenses,
        smooth: true,
        itemStyle: { color: "#f56c6c" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(245,108,108,0.3)" }, { offset: 1, color: "rgba(245,108,108,0)" }]) }
      }
    ]
  });
}

function renderProfitChart(data: any[]) {
  if (!profitChartRef.value || !data.length) return;
  if (profitInstance) profitInstance.dispose();

  const months = data.map((d: any) => d.month || d.label || "");
  const incomes = data.map((d: any) => Number(d.income) || 0);
  const expenses = data.map((d: any) => Number(d.expense) || 0);
  const profits = data.map((d: any) => Number(d.profit) || 0);

  profitInstance = echarts.init(profitChartRef.value);
  profitInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["收入", "支出", "利润"], bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => formatYuan(v) } },
    series: [
      { name: "收入", type: "bar", data: incomes, itemStyle: { color: "#409eff" }, barGap: "10%" },
      { name: "支出", type: "bar", data: expenses, itemStyle: { color: "#f56c6c" } },
      { name: "利润", type: "line", data: profits, smooth: true, itemStyle: { color: "#67c23a" }, symbol: "circle", symbolSize: 8 }
    ]
  });
}

function renderTopBarChart(
  el: HTMLDivElement | undefined,
  data: any[],
  nameKey: string,
  valueKey: string,
  instance: echarts.ECharts | null
) {
  if (!el || !data.length) return;
  if (instance) instance.dispose();

  const names = data.map((d: any) => d[nameKey] || "").reverse();
  const values = data.map((d: any) => Number(d[valueKey]) || 0).reverse();

  const chart = echarts.init(el);
  chart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => formatYuan(v) } },
    yAxis: { type: "category", data: names, axisLabel: { width: 90, overflow: "truncate" } },
    series: [{
      type: "bar",
      data: values,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#409eff" },
          { offset: 1, color: "#67c23a" }
        ])
      }
    }]
  });

  if (el === arTopChartRef.value) arTopInstance = chart;
  else apTopInstance = chart;
}

onMounted(() => {
  loadData();
  window.addEventListener("resize", loadData);
});
</script>

<style scoped>
.range-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.stat-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  padding: 20px;
  border-radius: 8px;
  background: #f5f7fa;
  border-left: 4px solid #409eff;
}

.stat-card.stat-primary { border-left-color: #409eff; }
.stat-card.stat-danger { border-left-color: #f56c6c; }
.stat-card.stat-warning { border-left-color: #e6a23c; }
.stat-card.stat-success { border-left-color: #67c23a; }

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
}

.stat-compare {
  font-size: 13px;
  margin-top: 4px;
}

.stat-up {
  color: #f56c6c;
}

.stat-down {
  color: #67c23a;
}

.chart-body {
  width: 100%;
  height: 320px;
}

.chart-row {
  display: flex;
  gap: 16px;
  margin-bottom: 0;
}

.half-card {
  flex: 1;
  min-width: 0;
}
</style>