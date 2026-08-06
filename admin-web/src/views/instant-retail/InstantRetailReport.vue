<template>
  <div class="page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6">
        <div class="stat-card gradient-blue">
          <div class="stat-info">
            <div class="stat-label">今日销售额</div>
            <div class="stat-value">¥{{ formatNumber(summaryData.sales) }}</div>
            <div class="stat-trend" :class="summaryData.salesTrend >= 0 ? 'trend-up' : 'trend-down'">
              <el-icon><CaretTop v-if="summaryData.salesTrend >= 0" /><CaretBottom v-else /></el-icon>
              <span>{{ Math.abs(summaryData.salesTrend).toFixed(1) }}%</span>
              <span class="trend-label">较昨日</span>
            </div>
          </div>
          <div class="stat-icon">
            <el-icon><Money /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card gradient-green">
          <div class="stat-info">
            <div class="stat-label">今日订单量</div>
            <div class="stat-value">{{ formatNumber(summaryData.orders) }}</div>
            <div class="stat-trend" :class="summaryData.ordersTrend >= 0 ? 'trend-up' : 'trend-down'">
              <el-icon><CaretTop v-if="summaryData.ordersTrend >= 0" /><CaretBottom v-else /></el-icon>
              <span>{{ Math.abs(summaryData.ordersTrend).toFixed(1) }}%</span>
              <span class="trend-label">较昨日</span>
            </div>
          </div>
          <div class="stat-icon">
            <el-icon><Document /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card gradient-orange">
          <div class="stat-info">
            <div class="stat-label">客单价</div>
            <div class="stat-value">¥{{ summaryData.avgPrice.toFixed(2) }}</div>
            <div class="stat-trend" :class="summaryData.avgPriceTrend >= 0 ? 'trend-up' : 'trend-down'">
              <el-icon><CaretTop v-if="summaryData.avgPriceTrend >= 0" /><CaretBottom v-else /></el-icon>
              <span>{{ Math.abs(summaryData.avgPriceTrend).toFixed(1) }}%</span>
              <span class="trend-label">较昨日</span>
            </div>
          </div>
          <div class="stat-icon">
            <el-icon><Wallet /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card gradient-purple">
          <div class="stat-info">
            <div class="stat-label">毛利率</div>
            <div class="stat-value">{{ summaryData.profitRate.toFixed(1) }}%</div>
            <div class="stat-trend" :class="summaryData.profitRateTrend >= 0 ? 'trend-up' : 'trend-down'">
              <el-icon><CaretTop v-if="summaryData.profitRateTrend >= 0" /><CaretBottom v-else /></el-icon>
              <span>{{ Math.abs(summaryData.profitRateTrend).toFixed(1) }}%</span>
              <span class="trend-label">较昨日</span>
            </div>
          </div>
          <div class="stat-icon">
            <el-icon><TrendCharts /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card class="section-card" shadow="never">
      <div class="section-header">
        <div class="filter-bar">
          <el-radio-group v-model="quickDate" size="default" @change="handleQuickDateChange">
            <el-radio-button label="today">今天</el-radio-button>
            <el-radio-button label="week">本周</el-radio-button>
            <el-radio-button label="month">本月</el-radio-button>
            <el-radio-button label="30days">近30天</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :disabled="quickDate !== 'custom'"
            @change="handleDateChange"
          />
        </div>
      </div>
    </el-card>

    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="section-title">销售趋势</span>
          <el-radio-group v-model="trendGranularity" size="small">
            <el-radio-button label="day">日</el-radio-button>
            <el-radio-button label="week">周</el-radio-button>
            <el-radio-button label="month">月</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div ref="trendChartRef" class="chart-container trend-chart"></div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="section-card" shadow="never">
          <template #header>
            <span class="section-title">平台销售占比</span>
          </template>
          <div ref="pieChartRef" class="chart-container pie-chart"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="section-card" shadow="never">
          <template #header>
            <span class="section-title">平台对比</span>
          </template>
          <div ref="barChartRef" class="chart-container bar-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="section-card" shadow="never">
      <template #header>
        <span class="section-title">平台对比明细</span>
      </template>
      <el-table :data="platformCompareTable" stripe>
        <el-table-column prop="platform" label="平台" width="120">
          <template #default="{ row }">
            <span class="platform-tag" :style="{ color: row.color }">
              <span class="platform-dot" :style="{ background: row.color }"></span>
              {{ row.platform }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销售额" width="140">
          <template #default="{ row }">¥{{ formatNumber(row.sales) }}</template>
        </el-table-column>
        <el-table-column prop="orders" label="订单量" width="120">
          <template #default="{ row }">{{ formatNumber(row.orders) }}</template>
        </el-table-column>
        <el-table-column prop="avgPrice" label="客单价" width="120">
          <template #default="{ row }">¥{{ row.avgPrice.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="commission" label="平台佣金" width="140">
          <template #default="{ row }">¥{{ formatNumber(row.commission) }}</template>
        </el-table-column>
        <el-table-column prop="netIncome" label="净收入">
          <template #default="{ row }" class="net-income">
            <span style="color: var(--color-success); font-weight: 600">¥{{ formatNumber(row.netIncome) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="section-title">商品排行</span>
          <el-button type="primary" plain @click="handleExport">导出报表</el-button>
        </div>
      </template>
      <el-tabs v-model="rankTab" class="rank-tabs">
        <el-tab-pane label="热销TOP20" name="sales">
          <el-table :data="topSalesList" stripe>
            <el-table-column type="index" label="排名" width="80" align="center">
              <template #default="{ $index }">
                <span class="rank-badge" :class="'rank-' + ($index + 1)">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="商品名称" min-width="200" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column prop="sales" label="销售额" width="140" sortable>
              <template #default="{ row }">¥{{ formatNumber(row.sales) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="销量" width="120" sortable>
              <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
            </el-table-column>
            <el-table-column prop="share" label="销售占比" width="140">
              <template #default="{ row }">
                <el-progress :percentage="row.share" :stroke-width="8" :show-text="false" />
                <span class="share-text">{{ row.share.toFixed(1) }}%</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="毛利TOP20" name="profit">
          <el-table :data="topProfitList" stripe>
            <el-table-column type="index" label="排名" width="80" align="center">
              <template #default="{ $index }">
                <span class="rank-badge" :class="'rank-' + ($index + 1)">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="商品名称" min-width="200" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column prop="profit" label="毛利额" width="140" sortable>
              <template #default="{ row }">
                <span style="color: var(--color-success); font-weight: 500">¥{{ formatNumber(row.profit) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="profitRate" label="毛利率" width="140" sortable>
              <template #default="{ row }">{{ row.profitRate.toFixed(1) }}%</template>
            </el-table-column>
            <el-table-column prop="quantity" label="销量" width="120">
              <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import echarts from '@/utils/echarts'
import { ElMessage } from "element-plus";
import { Money, Document, Wallet, TrendCharts, CaretTop, CaretBottom } from "@element-plus/icons-vue";

const quickDate = ref("today");
const dateRange = ref<[string, string] | null>(null);
const trendGranularity = ref("day");
const rankTab = ref("sales");

const trendChartRef = ref<HTMLElement>();
const pieChartRef = ref<HTMLElement>();
const barChartRef = ref<HTMLElement>();

let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;
let barChart: echarts.ECharts | null = null;

const summaryData = reactive({
  sales: 128560.5,
  salesTrend: 12.5,
  orders: 1256,
  ordersTrend: 8.3,
  avgPrice: 102.35,
  avgPriceTrend: 3.8,
  profitRate: 28.5,
  profitRateTrend: 2.1
});

const trendData = reactive({
  dates: ["01-09", "01-10", "01-11", "01-12", "01-13", "01-14", "01-15"],
  sales: [85200, 92300, 78600, 105800, 98700, 112500, 128560],
  orders: [820, 890, 756, 1024, 956, 1102, 1256]
});

const platformData = [
  { name: "京东秒送", value: 52340, color: "#E1251B" },
  { name: "美团外卖", value: 48620, color: "#FFD101" },
  { name: "饿了么", value: 27600, color: "#0097FF" }
];

const platformCompareTable = computed(() => [
  {
    platform: "京东秒送",
    color: "#E1251B",
    sales: 52340,
    orders: 512,
    avgPrice: 102.2,
    commission: 5234,
    netIncome: 47106
  },
  {
    platform: "美团外卖",
    color: "#FFD101",
    sales: 48620,
    orders: 486,
    avgPrice: 100.0,
    commission: 5834.4,
    netIncome: 42785.6
  },
  {
    platform: "饿了么",
    color: "#0097FF",
    sales: 27600,
    orders: 258,
    avgPrice: 106.98,
    commission: 3312,
    netIncome: 24288
  }
]);

const topSalesList = ref([
  { name: "农夫山泉 550ml*24瓶", category: "饮料", sales: 12560, quantity: 520, share: 9.8 },
  { name: "可口可乐 330ml*24罐", category: "饮料", sales: 10820, quantity: 410, share: 8.4 },
  { name: "伊利纯牛奶 250ml*24盒", category: "乳品", sales: 9650, quantity: 320, share: 7.5 },
  { name: "乐事薯片 原味 70g", category: "零食", sales: 8420, quantity: 650, share: 6.5 },
  { name: "康师傅方便面 红烧牛肉", category: "方便食品", sales: 7890, quantity: 720, share: 6.1 },
  { name: "奥利奥饼干 原味 97g", category: "零食", sales: 6540, quantity: 420, share: 5.1 },
  { name: "脉动 青柠味 600ml", category: "饮料", sales: 5890, quantity: 380, share: 4.6 },
  { name: "三只松鼠 每日坚果", category: "零食", sales: 5420, quantity: 180, share: 4.2 },
  { name: "百草味 芒果干 100g", category: "零食", sales: 4860, quantity: 270, share: 3.8 },
  { name: "统一 老坛酸菜面", category: "方便食品", sales: 4230, quantity: 390, share: 3.3 },
  { name: "旺旺雪饼 84g", category: "零食", sales: 3890, quantity: 310, share: 3.0 },
  { name: "蒙牛 酸酸乳 250ml", category: "乳品", sales: 3560, quantity: 280, share: 2.8 },
  { name: "红牛 维生素饮料 250ml", category: "饮料", sales: 3210, quantity: 160, share: 2.5 },
  { name: "德芙 巧克力 43g", category: "零食", sales: 2980, quantity: 220, share: 2.3 },
  { name: "士力架 花生夹心 51g", category: "零食", sales: 2650, quantity: 210, share: 2.1 }
]);

const topProfitList = ref([
  { name: "三只松鼠 每日坚果", category: "零食", profit: 2168, profitRate: 40.0, quantity: 180 },
  { name: "百草味 芒果干 100g", category: "零食", profit: 1749.6, profitRate: 36.0, quantity: 270 },
  { name: "奥利奥饼干 原味 97g", category: "零食", profit: 2289, profitRate: 35.0, quantity: 420 },
  { name: "德芙 巧克力 43g", category: "零食", profit: 983.4, profitRate: 33.0, quantity: 220 },
  { name: "乐事薯片 原味 70g", category: "零食", profit: 2526, profitRate: 30.0, quantity: 650 },
  { name: "旺旺雪饼 84g", category: "零食", profit: 1089.2, profitRate: 28.0, quantity: 310 },
  { name: "农夫山泉 550ml*24瓶", category: "饮料", profit: 3265.6, profitRate: 26.0, quantity: 520 },
  { name: "可口可乐 330ml*24罐", category: "饮料", profit: 2705, profitRate: 25.0, quantity: 410 },
  { name: "红牛 维生素饮料 250ml", category: "饮料", profit: 738.3, profitRate: 23.0, quantity: 160 },
  { name: "伊利纯牛奶 250ml*24盒", category: "乳品", profit: 2123, profitRate: 22.0, quantity: 320 },
  { name: "脉动 青柠味 600ml", category: "饮料", profit: 1178, profitRate: 20.0, quantity: 380 },
  { name: "蒙牛 酸酸乳 250ml", category: "乳品", profit: 640.8, profitRate: 18.0, quantity: 280 },
  { name: "士力架 花生夹心 51g", category: "零食", profit: 450.5, profitRate: 17.0, quantity: 210 },
  { name: "康师傅方便面 红烧牛肉", category: "方便食品", profit: 946.8, profitRate: 12.0, quantity: 720 },
  { name: "统一 老坛酸菜面", category: "方便食品", profit: 465.3, profitRate: 11.0, quantity: 390 }
]);

function formatNumber(num: number) {
  return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function handleQuickDateChange(val: string) {
  const today = new Date();
  if (val === "today") {
    const todayStr = formatDate(today);
    dateRange.value = [todayStr, todayStr];
  } else if (val === "week") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    dateRange.value = [formatDate(weekStart), formatDate(today)];
  } else if (val === "month") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    dateRange.value = [formatDate(monthStart), formatDate(today)];
  } else if (val === "30days") {
    const day30 = new Date(today);
    day30.setDate(today.getDate() - 29);
    dateRange.value = [formatDate(day30), formatDate(today)];
  }
  nextTick(() => {
    updateTrendChart();
  });
}

function handleDateChange() {
  updateTrendChart();
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function handleExport() {
  ElMessage.success("报表导出中，请稍候...");
}

function initTrendChart() {
  if (!trendChartRef.value) return;
  trendChart = echarts.init(trendChartRef.value);
  updateTrendChart();
}

function updateTrendChart() {
  if (!trendChart) return;
  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" }
    },
    legend: {
      data: ["销售额", "订单量"],
      top: 0
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: 50,
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: trendData.dates,
      axisPointer: { type: "shadow" }
    },
    yAxis: [
      {
        type: "value",
        name: "销售额(元)",
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 10000) return (value / 10000).toFixed(1) + "w";
            return value.toString();
          }
        }
      },
      {
        type: "value",
        name: "订单量(单)",
        axisLabel: {
          formatter: "{value}"
        }
      }
    ],
    series: [
      {
        name: "销售额",
        type: "line",
        smooth: true,
        yAxisIndex: 0,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64, 158, 255, 0.5)" },
            { offset: 1, color: "rgba(64, 158, 255, 0.05)" }
          ])
        },
        lineStyle: {
          width: 3,
          color: CHART_COLORS.primary
        },
        itemStyle: {
          color: CHART_COLORS.primary
        },
        data: trendData.sales
      },
      {
        name: "订单量",
        type: "bar",
        yAxisIndex: 1,
        barWidth: "40%",
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CHART_COLORS.warning },
            { offset: 1, color: "rgba(230, 162, 60, 0.6)" }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        data: trendData.orders
      }
    ]
  };
  trendChart.setOption(option);
}

function initPieChart() {
  if (!pieChartRef.value) return;
  pieChart = echarts.init(pieChartRef.value);
  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "item",
      formatter: "{b}: ¥{c} ({d}%)"
    },
    legend: {
      orient: "vertical",
      right: "5%",
      top: "center"
    },
    series: [
      {
        name: "销售占比",
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
          show: false,
          position: "center"
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: "bold",
            formatter: "{b}\n{d}%"
          }
        },
        labelLine: {
          show: false
        },
        data: platformData.map((item) => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: item.color }
        }))
      }
    ]
  };
  pieChart.setOption(option);
}

function initBarChart() {
  if (!barChartRef.value) return;
  barChart = echarts.init(barChartRef.value);
  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" }
    },
    legend: {
      data: ["销售额", "订单量"],
      top: 0
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: 50,
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: platformData.map((item) => item.name)
    },
    yAxis: [
      {
        type: "value",
        name: "销售额(元)",
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 10000) return (value / 10000).toFixed(1) + "w";
            return value.toString();
          }
        }
      },
      {
        type: "value",
        name: "订单量(单)"
      }
    ],
    series: [
      {
        name: "销售额",
        type: "bar",
        yAxisIndex: 0,
        barWidth: "30%",
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: function (params: any) {
            return platformData[params.dataIndex].color;
          }
        },
        data: platformData.map((item) => item.value)
      },
      {
        name: "订单量",
        type: "bar",
        yAxisIndex: 1,
        barWidth: "30%",
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: "rgba(103, 194, 58, 0.8)"
        },
        data: [512, 486, 258]
      }
    ]
  };
  barChart.setOption(option);
}

function handleResize() {
  trendChart?.resize();
  pieChart?.resize();
  barChart?.resize();
}

onMounted(() => {
  handleQuickDateChange(quickDate.value);
  nextTick(() => {
    initTrendChart();
    initPieChart();
    initBarChart();
    window.addEventListener("resize", handleResize);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  trendChart?.dispose();
  pieChart?.dispose();
  barChart?.dispose();
});

watch(trendGranularity, () => {
  updateTrendChart();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.stat-cards {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  position: relative;
  overflow: hidden;
  min-height: 120px;
}
.gradient-blue {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-5) 100%);
}
.gradient-green {
  background: linear-gradient(135deg, var(--color-success) 0%, rgba(14, 168, 121, 0.45) 100%);
}
.gradient-orange {
  background: linear-gradient(135deg, var(--chart-5) 0%, var(--color-danger) 100%);
}
.gradient-purple {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--chart-6) 100%);
}
.stat-info {
  z-index: 1;
}
.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}
.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.stat-trend.trend-up {
  color: rgba(14, 168, 121, 0.85);
}
.stat-trend.trend-down {
  color: rgba(192, 57, 43, 0.85);
}
.trend-label {
  opacity: 0.8;
  margin-left: 4px;
}
.stat-icon {
  font-size: 48px;
  opacity: 0.3;
}
.section-card {
  margin-bottom: 16px;
  border: 1px solid var(--border-light);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-700);
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.chart-container {
  width: 100%;
  height: 350px;
}
.trend-chart {
  height: 380px;
}
.pie-chart {
  height: 320px;
}
.bar-chart {
  height: 320px;
}
.platform-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.platform-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.rank-tabs {
  margin-top: 8px;
}
.rank-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-soft);
  color: var(--gray-400);
}
.rank-badge.rank-1 {
  background: linear-gradient(135deg, #ffd700, #ffb800);
  color: #fff;
}
.rank-badge.rank-2 {
  background: linear-gradient(135deg, var(--gray-300), var(--gray-400));
  color: #fff;
}
.rank-badge.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #b87333);
  color: #fff;
}
.share-text {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--gray-600);
  margin-top: 2px;
}
.net-income {
  font-weight: 500;
}
</style>
