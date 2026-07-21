<template>
  <div class="page">
    <!-- 汇总卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">¥{{ Number(summary.purchaseAmount || 0).toFixed(2) }}</div>
        <div class="stat-label">本月采购额</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{ summary.orderCount || 0 }}</div>
        <div class="stat-label">订单数</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">{{ summary.supplierCount || 0 }}</div>
        <div class="stat-label">供应商数</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{ summary.inStockCount || 0 }}</div>
        <div class="stat-label">入库批次</div>
      </div>
    </div>

    <!-- 采购趋势 -->
    <div class="chart-card">
      <div class="chart-header">
        <span class="chart-title">采购趋势</span>
        <el-radio-group v-model="trendGranularity" size="small" @change="loadTrend">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
        </el-radio-group>
      </div>
      <div ref="trendChart" class="chart-body"></div>
    </div>

    <!-- 供应商排名 + 品类采购占比 -->
    <div class="chart-row">
      <div class="chart-card half">
        <div class="chart-header">
          <span class="chart-title">供应商排名</span>
        </div>
        <div ref="supplierChart" class="chart-body" style="height: 350px"></div>
      </div>
      <div class="chart-card half">
        <div class="chart-header">
          <span class="chart-title">品类采购占比</span>
        </div>
        <div ref="categoryChart" class="chart-body" style="height: 350px"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import echarts from '@/utils/echarts'
import { fetchReportPurchaseSummary, fetchReportSupplierRanking, fetchReportPurchaseTrend } from "../../api";

const trendChart = ref<HTMLDivElement>();
const supplierChart = ref<HTMLDivElement>();
const categoryChart = ref<HTMLDivElement>();
const trendGranularity = ref("month");

const summary = ref({ purchaseAmount: 0, orderCount: 0, supplierCount: 0, inStockCount: 0 });

let trendInstance: echarts.ECharts | null = null;
let supplierInstance: echarts.ECharts | null = null;
let categoryInstance: echarts.ECharts | null = null;

async function loadSummary() {
  try {
    const data = await fetchReportPurchaseSummary();
    summary.value = {
      purchaseAmount: data.purchaseAmount || data.totalAmount || 0,
      orderCount: data.orderCount || 0,
      supplierCount: data.supplierCount || 0,
      inStockCount: data.inStockCount || 0
    };
  } catch { /* ignore */ }
}

async function loadTrend() {
  try {
    const data = await fetchReportPurchaseTrend({ granularity: trendGranularity.value });
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
          { offset: 0, color: "rgba(64,158,255,0.3)" }, { offset: 1, color: "rgba(64,158,255,0.05)" }
        ])},
        lineStyle: { color: "#409eff", width: 2 },
        itemStyle: { color: "#409eff" }
      }]
    });
  } catch { /* ignore */ }
}

async function loadSupplierRanking() {
  try {
    const data = await fetchReportSupplierRanking();
    const items = (data.ranking || data || []).slice(0, 10);
    const names = items.map((i: any) => i.supplierName || i.name);
    const values = items.map((i: any) => Number(i.totalAmount || i.amount || 0));
    if (!supplierInstance) {
      supplierInstance = echarts.init(supplierChart.value!);
    }
    supplierInstance.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: names.reverse(), inverse: true, axisLabel: { width: 80, overflow: "truncate" } },
      series: [{
        type: "bar",
        data: values.reverse().map((v: number) => ({ value: v, itemStyle: { color: "#409eff" } })),
        barMaxWidth: 20
      }]
    });
  } catch { /* ignore */ }
}

async function loadCategoryDistribution() {
  try {
    // Use purchase summary for category data
    const data = await fetchReportPurchaseSummary();
    const items = (data.categoryBreakdown || data.categories || []).slice(0, 6);
    const chartData = items.length > 0
      ? items.map((i: any) => ({ name: i.categoryName || i.name, value: Number(i.totalAmount || i.amount || 0) }))
      : [{ name: "暂无数据", value: 1 }];
    if (!categoryInstance) {
      categoryInstance = echarts.init(categoryChart.value!);
    }
    categoryInstance.setOption({
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

onMounted(async () => {
  await loadSummary();
  await nextTick();
  loadTrend();
  loadSupplierRanking();
  loadCategoryDistribution();
});
</script>

<style scoped>
.page { padding: 0; }
.stats-row { display: flex; gap: 16px; margin-bottom: 16px; }
.stat-card { flex: 1; background: #fff; border-radius: 8px; padding: 16px 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #409eff; }
.stat-card.green { border-left-color: #67c23a; }
.stat-card.blue { border-left-color: #409eff; }
.stat-card.orange { border-left-color: #e6a23c; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

.chart-row { display: flex; gap: 16px; margin-bottom: 16px; }
.chart-card { flex: 1; background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px; }
.chart-card.half { flex: 0 0 calc(50% - 8px); margin-bottom: 0; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.chart-title { font-size: 15px; font-weight: 600; color: #303133; }
.chart-body { width: 100%; height: 350px; }
</style>