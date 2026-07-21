<template>
  <div class="transfer-report-page">
    <div class="page-header">
      <h2>调拨统计报表</h2>
      <p class="page-desc">多维度分析门店调拨数据，辅助库存调配决策</p>
    </div>

    <!-- 筛选条件 -->
    <PageCard>
      <div class="filter-row">
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
  totalTransfers: 128,
  transferGrowth: 12.5,
  completedTransfers: 106,
  completeRate: 82.8,
  totalQty: 3256,
  qtyGrowth: 18.3,
  totalAmount: "268.5万",
  amountGrowth: 15.7
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

function generateTrendData(granularity: string) {
  if (granularity === "day") {
    const days = timeRange.value === "week" ? 7 : timeRange.value === "month" ? 30 : timeRange.value === "quarter" ? 90 : 365;
    const categories = [];
    const data1 = [];
    const data2 = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      categories.push(`${d.getMonth() + 1}/${d.getDate()}`);
      const base = 3 + Math.random() * 4;
      data1.push(Math.floor(base + Math.random() * 2));
      data2.push(Math.floor(base * 25 + Math.random() * 10));
    }
    return { categories, series1: data1, series2: data2 };
  } else if (granularity === "week") {
    const weeks = timeRange.value === "week" ? 1 : timeRange.value === "month" ? 4 : timeRange.value === "quarter" ? 12 : 52;
    const categories = [];
    const data1 = [];
    const data2 = [];
    for (let i = weeks - 1; i >= 0; i--) {
      categories.push(`第${weeks - i}周`);
      const base = 15 + Math.random() * 10;
      data1.push(Math.floor(base));
      data2.push(Math.floor(base * 25));
    }
    return { categories, series1: data1, series2: data2 };
  } else {
    const months = timeRange.value === "week" || timeRange.value === "month" ? 1 : timeRange.value === "quarter" ? 3 : 12;
    const categories = [];
    const data1 = [];
    const data2 = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      categories.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      const base = 50 + Math.random() * 30;
      data1.push(Math.floor(base));
      data2.push(Math.floor(base * 25));
    }
    return { categories, series1: data1, series2: data2 };
  }
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
      axisLine: { lineStyle: { color: "#dcdfe6" } },
      axisLabel: { color: "#606266" }
    },
    yAxis: [
      {
        type: "value",
        name: "单数",
        position: "left",
        axisLine: { show: false },
        splitLine: { lineStyle: { type: "dashed", color: "#ebeef5" } },
        axisLabel: { color: "#606266" }
      },
      {
        type: "value",
        name: "数量（件）",
        position: "right",
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "#606266" }
      }
    ],
    series: [
      {
        name: "调拨单数",
        type: "line",
        smooth: true,
        data: series1,
        yAxisIndex: 0,
        itemStyle: { color: "#409eff" },
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
        itemStyle: { color: "#67c23a" },
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
      splitLine: { lineStyle: { type: "dashed", color: "#ebeef5" } },
      axisLabel: { color: "#606266" }
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.name),
      axisLine: { lineStyle: { color: "#dcdfe6" } },
      axisLabel: { color: "#606266" }
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barWidth: 24,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#83bff6" },
            { offset: 1, color: "#188df0" }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: "right",
          color: "#606266"
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
      splitLine: { lineStyle: { type: "dashed", color: "#ebeef5" } },
      axisLabel: { color: "#606266" }
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.name),
      axisLine: { lineStyle: { color: "#dcdfe6" } },
      axisLabel: { color: "#606266", fontSize: 12 }
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barWidth: 18,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#67c23a" },
            { offset: 1, color: "#95d475" }
          ]),
          borderRadius: [0, 3, 3, 0]
        },
        label: {
          show: true,
          position: "right",
          color: "#606266",
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
    { name: "已完成", value: 106, color: "#67c23a" },
    { name: "调拨中", value: 12, color: "#409eff" },
    { name: "待审核", value: 6, color: "#e6a23c" },
    { name: "已驳回", value: 3, color: "#f56c6c" },
    { name: "已取消", value: 1, color: "#909399" }
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
      textStyle: { color: "#606266", fontSize: 12 }
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
    { name: "补货调拨", value: 68, color: "#409eff" },
    { name: "库存平衡", value: 32, color: "#67c23a" },
    { name: "紧急调货", value: 18, color: "#e6a23c" },
    { name: "临期调拨", value: 7, color: "#f56c6c" },
    { name: "其他", value: 3, color: "#909399" }
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
      textStyle: { color: "#606266", fontSize: 12 }
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

function refreshData() {
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

onMounted(() => {
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
  color: #909399;
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
  color: #606266;
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
  color: #fff;
  flex-shrink: 0;
}

.icon-blue {
  background: linear-gradient(135deg, #66b1ff, #409eff);
}

.icon-green {
  background: linear-gradient(135deg, #95d475, #67c23a);
}

.icon-orange {
  background: linear-gradient(135deg, #f0c78a, #e6a23c);
}

.icon-red {
  background: linear-gradient(135deg, #f78989, #f56c6c);
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.stat-label-sub {
  font-size: 12px;
  color: #67c23a;
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
  color: #67c23a;
}

.stat-trend.down {
  color: #f56c6c;
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
