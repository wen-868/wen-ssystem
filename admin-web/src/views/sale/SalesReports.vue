<template>
  <div class="page">
    <!-- 业务概览 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">¥{{ Number(overview.todaySales || 0).toFixed(2) }}</div>
        <div class="stat-label">今日销售额</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{ overview.todayOrders || 0 }}</div>
        <div class="stat-label">今日订单</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">¥{{ Number(overview.monthSales || 0).toFixed(2) }}</div>
        <div class="stat-label">本月销售额</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">¥{{ Number(overview.receivable || 0).toFixed(2) }}</div>
        <div class="stat-label">本月应收</div>
      </div>
    </div>

    <!-- 销售趋势图 -->
    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-header">
          <span class="chart-title">销售趋势</span>
          <el-radio-group v-model="trendGranularity" size="small" @change="loadTrend">
            <el-radio-button value="day">日</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="month">月</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendChart" class="chart-body"></div>
      </div>
    </div>

    <!-- 排行榜 -->
    <div class="chart-row">
      <div class="chart-card half">
        <div class="chart-header">
          <span class="chart-title">销售排行</span>
          <el-select v-model="rankDimension" size="small" style="width: 120px" @change="loadRanking">
            <el-option label="商品排行" value="product" />
            <el-option label="客户排行" value="customer" />
            <el-option label="员工排行" value="staff" />
          </el-select>
        </div>
        <div ref="rankChart" class="chart-body"></div>
      </div>
      <div class="chart-card half">
        <div class="chart-header">
          <span class="chart-title">客户贡献度分布</span>
        </div>
        <div ref="customerChart" class="chart-body"></div>
      </div>
    </div>

    <!-- 员工绩效 -->
    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-header">
          <span class="chart-title">员工绩效排名</span>
        </div>
        <div ref="staffChart" class="chart-body" style="height: 300px"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import echarts from '@/utils/echarts'
import { fetchReportSalesTrend, fetchReportSalesRanking, fetchReportBusinessOverview, fetchReportCustomerContribution, fetchReportStaffPerformance } from "../../api";

const trendChart = ref<HTMLDivElement>();
const rankChart = ref<HTMLDivElement>();
const customerChart = ref<HTMLDivElement>();
const staffChart = ref<HTMLDivElement>();

const trendGranularity = ref("month");
const rankDimension = ref("product");
const overview = ref({ todaySales: 0, todayOrders: 0, monthSales: 0, receivable: 0 });

let trendInstance: echarts.ECharts | null = null;
let rankInstance: echarts.ECharts | null = null;
let customerInstance: echarts.ECharts | null = null;
let staffInstance: echarts.ECharts | null = null;

async function loadOverview() {
  try {
    const data = await fetchReportBusinessOverview();
    overview.value = {
      todaySales: data.todaySales || data.today_sales || 0,
      todayOrders: data.todayOrders || data.today_orders || 0,
      monthSales: data.monthSales || data.month_sales || 0,
      receivable: data.receivable || data.month_receivable || 0
    };
  } catch { /* ignore */ }
}

async function loadTrend() {
  try {
    const data = await fetchReportSalesTrend({ dateType: trendGranularity.value });
    const labels = (data.labels || data.dates || []).map((d: string) => d);
    const values = (data.values || data.amounts || []).map(Number);
    if (!trendInstance) {
      trendInstance = echarts.init(trendChart.value!);
    }
    trendInstance.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 12 ? 45 : 0 } },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        data: values,
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#409eff" }, { offset: 1, color: "#79bbff" }
        ])},
        barMaxWidth: 40
      }]
    });
  } catch { /* ignore */ }
}

async function loadRanking() {
  try {
    const data = await fetchReportSalesRanking({ dimension: rankDimension.value });
    const items = (data.ranking || data.items || []).slice(0, 10);
    const names = items.map((i: any) => i.name || i.label);
    const values = items.map((i: any) => Number(i.amount || i.value || 0));
    if (!rankInstance) {
      rankInstance = echarts.init(rankChart.value!);
    }
    rankInstance.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: names.reverse(), inverse: true, axisLabel: { width: 80, overflow: "truncate" } },
      series: [{
        type: "bar",
        data: values.reverse().map((v: number) => ({ value: v, itemStyle: { color: "#67c23a" } })),
        barMaxWidth: 20
      }]
    });
  } catch { /* ignore */ }
}

async function loadCustomerContribution() {
  try {
    const data = await fetchReportCustomerContribution();
    const items = (data.ranking || data.items || []).slice(0, 8);
    const chartData = items.map((i: any) => ({ name: i.name || i.label, value: Number(i.amount || i.value || 0) }));
    if (!customerInstance) {
      customerInstance = echarts.init(customerChart.value!);
    }
    customerInstance.setOption({
      tooltip: { trigger: "item" },
      legend: { orient: "vertical", right: 10, top: "center", textStyle: { fontSize: 11 } },
      series: [{
        type: "pie",
        radius: ["45%", "75%"],
        center: ["35%", "50%"],
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        data: chartData
      }]
    });
  } catch { /* ignore */ }
}

async function loadStaffPerformance() {
  try {
    const data = await fetchReportStaffPerformance();
    const items = (data.ranking || data.items || []).slice(0, 10);
    const names = items.map((i: any) => i.name || i.label);
    const values = items.map((i: any) => Number(i.amount || i.value || 0));
    if (!staffInstance) {
      staffInstance = echarts.init(staffChart.value!);
    }
    staffInstance.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 80, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "category", data: names, axisLabel: { rotate: 30 } },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        data: values,
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#e6a23c" }, { offset: 1, color: "#f5dab1" }
        ])},
        barMaxWidth: 40
      }]
    });
  } catch { /* ignore */ }
}

onMounted(async () => {
  await loadOverview();
  await nextTick();
  loadTrend();
  loadRanking();
  loadCustomerContribution();
  loadStaffPerformance();
});
</script>

<style scoped>
.page { padding: 0; }
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border-left: 4px solid #409eff;
}
.stat-card.green { border-left-color: #67c23a; }
.stat-card.blue { border-left-color: #409eff; }
.stat-card.orange { border-left-color: #e6a23c; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

.chart-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.chart-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.chart-card.half { flex: 0 0 calc(50% - 8px); }
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-title { font-size: 15px; font-weight: 600; color: #303133; }
.chart-body { width: 100%; height: 350px; }
</style>
