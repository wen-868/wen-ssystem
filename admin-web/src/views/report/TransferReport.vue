<template>
<div class="page">
<div class="page-header">
      <h2>调拨统计报表</h2>
      <p class="page-desc">多维度分析门店调拨数据，辅助库存调配决策</p>
    </div>

    <!-- 筛选条件 -->
    <PageCard>
      <div class="filter-bar">
        <div class="filter-item">
          <span class="filter-label">时间范围：</span>
          <el-radio-group v-model="timeRange" size="default" @change="onTimeRangeChange">
            <el-radio-button value="week">近7天</el-radio-button>
            <el-radio-button value="month">近30天</el-radio-button>
            <el-radio-button value="quarter">近90天</el-radio-button>
            <el-radio-button value="year">近一年</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <span class="filter-label">门店：</span>
          <el-select v-model="filterStore" placeholder="全部门店" clearable style="width: 160px">
            <el-option label="全部门店" value="" />
            <el-option
              v-for="s in storeOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </div>
        <div class="filter-item">
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
          <el-button @click="exportReport">
            <el-icon><Download /></el-icon> 导出报表
          </el-button>
        </div>
      </div>
    </PageCard>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <el-card shadow="hover" class="stat-card">
        <div class="stat-card-inner">
          <div class="stat-icon icon-blue">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ statData.totalTransfers }}</div>
            <div class="stat-label">调拨单总数</div>
            <div class="stat-trend up">
              <el-icon><ArrowUp /></el-icon>
              <span>{{ statData.transferGrowth }}%</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <div class="stat-card-inner">
          <div class="stat-icon icon-green">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ statData.completedTransfers }}</div>
            <div class="stat-label">已完成调拨</div>
            <div class="stat-label-sub">完成率 {{ statData.completeRate }}%</div>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <div class="stat-card-inner">
          <div class="stat-icon icon-orange">
            <el-icon><Goods /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ statData.totalQty }}</div>
            <div class="stat-label">调拨商品总量（件）</div>
            <div class="stat-trend up">
              <el-icon><ArrowUp /></el-icon>
              <span>{{ statData.qtyGrowth }}%</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="stat-card">
        <div class="stat-card-inner">
          <div class="stat-icon icon-red">
            <el-icon><Money /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥{{ statData.totalAmount }}</div>
            <div class="stat-label">调拨总金额</div>
            <div class="stat-trend up">
              <el-icon><ArrowUp /></el-icon>
              <span>{{ statData.amountGrowth }}%</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 图表区域 -->
    <div class="chart-grid">
      <!-- 调拨趋势 -->
      <PageCard title="调拨趋势" class="chart-card chart-large">
        <div class="chart-toolbar">
          <el-radio-group v-model="trendGranularity" size="small" @change="renderTrendChart">
            <el-radio-button value="day">按天</el-radio-button>
            <el-radio-button value="week">按周</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendChartRef" class="chart-container"></div>
      </PageCard>

      <!-- 门店调拨排行 -->
      <PageCard title="门店调拨排行（调出）" class="chart-card">
        <div ref="storeRankChartRef" class="chart-container"></div>
      </PageCard>

      <!-- 商品调拨排行 -->
      <PageCard title="商品调拨排行 TOP10" class="chart-card">
        <div ref="productRankChartRef" class="chart-container"></div>
      </PageCard>

      <!-- 调拨状态分布 -->
      <PageCard title="调拨状态分布" class="chart-card chart-small">
        <div ref="statusPieChartRef" class="chart-container"></div>
      </PageCard>

      <!-- 调拨原因分布 -->
      <PageCard title="调拨原因分布" class="chart-card chart-small">
        <div ref="reasonPieChartRef" class="chart-container"></div>
      </PageCard>
    </div>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import { fetchTransferStatistics, fetchTransferTrend } from "../../api";
import { CHART_COLORS } from "@/styles/theme";
import { ElMessage } from "element-plus";
import { Refresh, Download, Document, CircleCheck, Goods, Money, ArrowUp } from "@element-plus/icons-vue";
import echarts from "../../utils/echarts";
import PageCard from "../../components/PageCard.vue";

const timeRange = ref("month");
const filterStore = ref("");
const trendGranularity = ref("day");

const storeOptions = [
  { value: 1, label: "总店" },
  { value: 2, label: "朝阳门店" },
  { value: 3, label: "海淀门店" },
  { value: 4, label: "丰台门店" }
];

const statData = reactive({
  totalTransfers: 0,
  transferGrowth: 0,
  completedTransfers: 0,
  completeRate: 0,
  totalQty: 0,
  qtyGrowth: 0,
  totalAmount: "0",
  amountGrowth: 0
});

const trendChartRef = ref<HTMLElement>();
const storeRankChartRef = ref<HTMLElement>();
const productRankChartRef = ref<HTMLElement>();
const statusPieChartRef = ref<HTMLElement>();
const reasonPieChartRef = ref<HTMLElement>();

let trendChart: any = null;
let storeRankChart: any = null;
let productRankChart: any = null;
let statusPieChart: any = null;
let reasonPieChart: any = null;

const trendCache = ref<any[]>([])

async function loadRealData() {
  try {
    const [stats, trend] = await Promise.all([
      fetchTransferStatistics(),
      fetchTransferTrend(90),
    ])
    statData.totalTransfers = stats?.monthTotal ?? 0
    statData.completedTransfers = stats?.receivedCount ?? 0
    statData.totalQty = stats?.transitCount ?? 0
    statData.completeRate = statData.totalTransfers ? Math.round((statData.completedTransfers / statData.totalTransfers) * 1000) / 10 : 0
    trendCache.value = (trend || []).map((t: any) => ({ date: (t.date || '').slice(5), count: Number(t.count || 0) }))
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '加载调拨统计失败')
    trendCache.value = []
  }
}

function generateTrendData(granularity: string) {
  const categories = trendCache.value.map((t) => t.date)
  const series1 = trendCache.value.map((t) => t.count)
  const series2 = trendCache.value.map((t) => t.count)
  return { categories, series1, series2 }
}

function renderTrendChart() {
  if (!trendChartRef.value || !trendChart) return;
  const { categories, series1, series2 } = generateTrendData(trendGranularity.value);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" }
    },
    legend: {
      data: ["调拨单数", "调拨数量"],
      right: 10
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: categories,
      axisLine: { lineStyle: { color: CHART_COLORS.gray100 } },
      axisLabel: { color: CHART_COLORS.textSecondary }
    },
    yAxis: [
      {
        type: "value",
        name: "单数",
        position: "left",
        axisLine: { show: false },
        splitLine: { lineStyle: { type: "dashed", color: CHART_COLORS.gray100 } },
        axisLabel: { color: CHART_COLORS.textSecondary }
      },
      {
        type: "value",
        name: "数量（件）",
        position: "right",
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: CHART_COLORS.textSecondary }
      }
    ],
    series: [
      {
        name: "调拨单数",
        type: "line",
        smooth: true,
        data: series1,
        yAxisIndex: 0,
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64, 158, 255, 0.3)" },
            { offset: 1, color: "rgba(64, 158, 255, 0.05)" }
          ])
        }
      },
      {
        name: "调拨数量",
        type: "line",
        smooth: true,
        data: series2,
        yAxisIndex: 1,
        itemStyle: { color: CHART_COLORS.success },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(103, 194, 58, 0.3)" },
            { offset: 1, color: "rgba(103, 194, 58, 0.05)" }
          ])
        }
      }
    ]
  };

  trendChart.setOption(option, true);
}

function renderStoreRankChart() {
  if (!storeRankChartRef.value || !storeRankChart) return;

  const data = [
    { name: "总店", value: 45 },
    { name: "朝阳门店", value: 32 },
    { name: "海淀门店", value: 28 },
    { name: "丰台门店", value: 23 }
  ].sort((a, b) => a.value - b.value);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" }
    },
    grid: {
      left: "3%",
      right: "10%",
      bottom: "3%",
      top: "5%",
      containLabel: true
    },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { type: "dashed", color: CHART_COLORS.gray100 } },
      axisLabel: { color: CHART_COLORS.textSecondary }
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.name),
      axisLine: { lineStyle: { color: CHART_COLORS.gray100 } },
      axisLabel: { color: CHART_COLORS.textSecondary }
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barWidth: 24,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "rgba(63,111,239,0.4)" },
            { offset: 1, color: CHART_COLORS.primary }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: "right",
          color: CHART_COLORS.textSecondary
        }
      }
    ]
  };

  storeRankChart.setOption(option);
}

function renderProductRankChart() {
  if (!productRankChartRef.value || !productRankChart) return;

  const data = [
    { name: "飞天茅台53度500ml", value: 856 },
    { name: "五粮液普五52度500ml", value: 720 },
    { name: "剑南春水晶剑52度", value: 610 },
    { name: "泸州老窖特曲52度", value: 480 },
    { name: "青岛啤酒经典500ml", value: 420 },
    { name: "洋河蓝色经典52度", value: 380 },
    { name: "古井贡酒52度", value: 310 },
    { name: "汾酒青花20年53度", value: 260 },
    { name: "百威啤酒500ml", value: 210 },
    { name: "燕京啤酒500ml", value: 180 }
  ].sort((a, b) => a.value - b.value);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" }
    },
    grid: {
      left: "3%",
      right: "10%",
      bottom: "3%",
      top: "3%",
      containLabel: true
    },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { type: "dashed", color: CHART_COLORS.gray100 } },
      axisLabel: { color: CHART_COLORS.textSecondary }
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.name),
      axisLine: { lineStyle: { color: CHART_COLORS.gray100 } },
      axisLabel: { color: CHART_COLORS.textSecondary, fontSize: 12 }
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barWidth: 18,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: CHART_COLORS.success },
            { offset: 1, color: "rgba(14,168,121,0.4)" }
          ]),
          borderRadius: [0, 3, 3, 0]
        },
        label: {
          show: true,
          position: "right",
          color: CHART_COLORS.textSecondary,
          fontSize: 12
        }
      }
    ]
  };

  productRankChart.setOption(option);
}

function renderStatusPieChart() {
  if (!statusPieChartRef.value || !statusPieChart) return;

  const data = [
    { name: "已完成", value: 106, color: CHART_COLORS.success },
    { name: "调拨中", value: 12, color: CHART_COLORS.primary },
    { name: "待审核", value: 6, color: CHART_COLORS.warning },
    { name: "已驳回", value: 3, color: CHART_COLORS.danger },
    { name: "已取消", value: 1, color: CHART_COLORS.textMuted }
  ];

  const option = {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)"
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: { color: CHART_COLORS.textSecondary, fontSize: 12 }
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: "#fff",
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold"
          }
        },
        data: data.map((d) => ({ value: d.value, name: d.name, itemStyle: { color: d.color } }))
      }
    ]
  };

  statusPieChart.setOption(option);
}

function renderReasonPieChart() {
  if (!reasonPieChartRef.value || !reasonPieChart) return;

  const data = [
    { name: "补货调拨", value: 68, color: CHART_COLORS.primary },
    { name: "库存平衡", value: 32, color: CHART_COLORS.success },
    { name: "紧急调货", value: 18, color: CHART_COLORS.warning },
    { name: "临期调拨", value: 7, color: CHART_COLORS.danger },
    { name: "其他", value: 3, color: CHART_COLORS.textMuted }
  ];

  const option = {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)"
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: { color: CHART_COLORS.textSecondary, fontSize: 12 }
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: "#fff",
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold"
          }
        },
        data: data.map((d) => ({ value: d.value, name: d.name, itemStyle: { color: d.color } }))
      }
    ]
  };

  reasonPieChart.setOption(option);
}

function initCharts() {
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value);
    renderTrendChart();
  }
  if (storeRankChartRef.value) {
    storeRankChart = echarts.init(storeRankChartRef.value);
    renderStoreRankChart();
  }
  if (productRankChartRef.value) {
    productRankChart = echarts.init(productRankChartRef.value);
    renderProductRankChart();
  }
  if (statusPieChartRef.value) {
    statusPieChart = echarts.init(statusPieChartRef.value);
    renderStatusPieChart();
  }
  if (reasonPieChartRef.value) {
    reasonPieChart = echarts.init(reasonPieChartRef.value);
    renderReasonPieChart();
  }
}

function onTimeRangeChange() {
  renderTrendChart();
}

async function refreshData() {
  await loadRealData();
  renderTrendChart();
  renderStoreRankChart();
  renderProductRankChart();
  renderStatusPieChart();
  renderReasonPieChart();
  ElMessage.success("数据已刷新");
}

function exportReport() {
  ElMessage.success("报表导出中...");
}

function handleResize() {
  trendChart?.resize();
  storeRankChart?.resize();
  productRankChart?.resize();
  statusPieChart?.resize();
  reasonPieChart?.resize();
}

onMounted(async () => {
  await loadRealData();
  nextTick(() => {
    initCharts();
  });
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  trendChart?.dispose();
  storeRankChart?.dispose();
  productRankChart?.dispose();
  statusPieChart?.dispose();
  reasonPieChart?.dispose();
});
</script>

<style scoped>
.transfer-report-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.page-desc {
  margin: 0;
  color: var(--gray-400);
  font-size: 14px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-item {
  display: flex;
  align-items: center;
}

.filter-label {
  color: var(--gray-600);
  font-size: 14px;
  margin-right: 8px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 16px 0;
}

.stat-card {
  border-radius: 8px;
}

.stat-card-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--text-inverse);
  flex-shrink: 0;
}

.icon-blue {
  background: linear-gradient(135deg, rgba(63,111,239,0.4), var(--color-primary));
}

.icon-green {
  background: linear-gradient(135deg, rgba(14,168,121,0.4), var(--color-success));
}

.icon-orange {
  background: linear-gradient(135deg, rgba(212,139,58,0.4), var(--color-warning));
}

.icon-red {
  background: linear-gradient(135deg, rgba(192,57,43,0.4), var(--color-danger));
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--gray-700);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--gray-400);
  margin-top: 4px;
}

.stat-label-sub {
  font-size: 12px;
  color: var(--color-success);
  margin-top: 2px;
}

.stat-trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
}

.stat-trend.up {
  color: var(--color-success);
}

.stat-trend.down {
  color: var(--color-danger);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.chart-card {
  margin-bottom: 0;
}

.chart-large {
  grid-column: span 2;
}

.chart-small {
  grid-column: span 1;
}

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.chart-small .chart-container {
  height: 280px;
}

@media (max-width: 1400px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-large {
    grid-column: span 2;
  }
}
</style>
