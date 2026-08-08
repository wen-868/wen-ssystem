<template>
<div class="page">
    <div class="page-header">
    <div class="page-header-main">
      <h2 class="page-title">营销概览</h2>
      <p class="page-desc">营销活动整体效果概览</p>
    </div>
  </div>
<!-- 概览卡片行 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="24"><TrendCharts /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">活动总数</div>
          <div class="stat-value">{{ overview.totalActivities }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="24"><VideoPlay /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">进行中</div>
          <div class="stat-value">{{ overview.activeCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-info-card">
        <div class="stat-icon"><el-icon :size="24"><VideoPause /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">已结束</div>
          <div class="stat-value">{{ overview.endedCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-purple">
        <div class="stat-icon"><el-icon :size="24"><User /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">参与总人数</div>
          <div class="stat-value">{{ overview.totalParticipants.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="24"><Present /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">发放优惠券数</div>
          <div class="stat-value">{{ overview.totalCoupons.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">核销率</div>
          <div class="stat-value">{{ overview.verifiedRate }}%</div>
        </div>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-bar">
      <div class="filter-left">
        <el-radio-group v-model="quickDate" size="default" @change="handleQuickDate">
          <el-radio-button value="today">今天</el-radio-button>
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
          <el-radio-button value="30days">近30天</el-radio-button>
          <el-radio-button value="custom">自定义</el-radio-button>
        </el-radio-group>
        <el-date-picker
          v-if="quickDate === 'custom'"
          v-model="customDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="margin-left: 12px"
          @change="onFilterChange"
        />
        <el-select
          v-model="selectedTypes"
          placeholder="活动类型"
          multiple
          clearable
          style="width: 200px; margin-left: 12px"
          @change="onFilterChange"
        >
          <el-option label="优惠券" value="coupon" />
          <el-option label="满减" value="fullReduction" />
          <el-option label="限时折扣" value="flashSale" />
          <el-option label="满赠" value="gift" />
          <el-option label="积分" value="points" />
        </el-select>
      </div>
      <el-button @click="onFilterChange">刷新</el-button>
    </div>

    <!-- 图表区域 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>活动参与趋势</span>
              <el-radio-group v-model="trendGranularity" size="small" @change="renderActivityTrend">
                <el-radio-button value="day">日</el-radio-button>
                <el-radio-button value="week">周</el-radio-button>
                <el-radio-button value="month">月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="activityTrendRef" class="chart-body"></div>
          <el-empty v-if="!hasData" description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>活动转化率趋势</span>
            </div>
          </template>
          <div ref="conversionTrendRef" class="chart-body"></div>
          <el-empty v-if="!hasData" description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>活动ROI排行</span>
            </div>
          </template>
          <div ref="roiChartRef" class="chart-body" style="height: 360px"></div>
          <el-empty v-if="!hasData" description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>活动类型分布</span>
            </div>
          </template>
          <div ref="typePieRef" class="chart-body" style="height: 360px"></div>
          <el-empty v-if="!hasData" description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>优惠券使用趋势</span>
            </div>
          </template>
          <div ref="couponUsageRef" class="chart-body" style="height: 340px"></div>
          <el-empty v-if="!hasData" description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 活动对比表 -->
    <el-card>
      <template #header>
        <div class="chart-header">
          <span>活动对比</span>
          <el-select
            v-model="compareIds"
            placeholder="选择2-4个活动对比"
            multiple
            :multiple-limit="4"
            style="width: 300px"
            @change="renderCompareTable"
          >
            <el-option
              v-for="act in allActivities"
              :key="act.id"
              :label="act.name"
              :value="act.id"
            />
          </el-select>
        </div>
      </template>
      <div class="table-card">
<el-table v-if="compareData.length > 0" :data="compareData" stripe border>
        <el-table-column prop="dimension" label="对比维度" width="140" />
        <el-table-column
          v-for="(col, idx) in compareColumns"
          :key="idx"
          :label="col.name"
          align="center"
        >
          <template #default="{ row }">
            <span
              :class="{ 'best-value': isBestValue(row, col.name) }"
              :style="isBestValue(row, col.name) ? { background: 'var(--color-success-soft)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 } : {}"
            >
              {{ row[col.name] }}
            </span>
          </template>
        </el-table-column>
      </el-table>
</div>
      <el-empty v-if="compareData.length === 0" description="请选择2-4个活动进行对比" :image-size="80" />
    </el-card>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import echarts from '@/utils/echarts'
import { TrendCharts, VideoPlay, VideoPause, User, Present, CircleCheck } from "@element-plus/icons-vue";
import {
  getMarketingOverview,
  getMarketingTrend,
  getActivityRanking,
  getActivityStats,
  getCouponStats,
  getActivityComparison
} from "@/api";

// ==================== 概览数据 ====================
const overview = reactive({
  totalActivities: 0,
  activeCount: 0,
  endedCount: 0,
  totalParticipants: 0,
  totalCoupons: 0,
  verifiedRate: 0,
});
const hasData = ref(true);

// ==================== 筛选器 ====================
const quickDate = ref("month");
const customDateRange = ref<any[]>([]);
const selectedTypes = ref<string[]>([]);

function getDateRange(): { startDate?: string; endDate?: string } {
  if (quickDate.value === "custom" && customDateRange.value.length === 2) {
    return {
      startDate: customDateRange.value[0],
      endDate: customDateRange.value[1],
    };
  }
  return {};
}

function handleQuickDate() {
  if (quickDate.value !== "custom") {
    customDateRange.value = [];
    onFilterChange();
  }
}

async function onFilterChange() {
  await loadOverview();
  renderAllCharts();
}

async function loadOverview() {
  const dateRange = getDateRange();
  try {
    const data = await getMarketingOverview(dateRange);
    overview.totalActivities = data.totalActivities || 0;
    overview.activeCount = data.activeCount || 0;
    overview.endedCount = data.endedCount || 0;
    overview.totalParticipants = data.totalParticipants || 0;
    overview.totalCoupons = data.totalCoupons || 0;
    overview.verifiedRate = data.verifiedRate || 0;
    hasData.value = overview.totalActivities > 0;
  } catch {
    // API 调用失败时保持默认值
  }
}

// ==================== 图表 ====================
const activityTrendRef = ref<HTMLDivElement>();
const conversionTrendRef = ref<HTMLDivElement>();
const roiChartRef = ref<HTMLDivElement>();
const typePieRef = ref<HTMLDivElement>();
const couponUsageRef = ref<HTMLDivElement>();

let activityTrendInstance: echarts.ECharts | null = null;
let conversionTrendInstance: echarts.ECharts | null = null;
let roiInstance: echarts.ECharts | null = null;
let typePieInstance: echarts.ECharts | null = null;
let couponUsageInstance: echarts.ECharts | null = null;

const trendGranularity = ref("day");

async function renderActivityTrend() {
  if (!activityTrendRef.value) return;
  if (activityTrendInstance) activityTrendInstance.dispose();

  let data: any[] = [];
  try {
    const dateRange = getDateRange();
    const trendData = await getMarketingTrend({ period: trendGranularity.value, ...dateRange });
    data = trendData?.participants || [];
  } catch {
    // API 调用失败时使用空数据
  }

  if (data.length === 0) {
    // 使用空状态
    activityTrendInstance = echarts.init(activityTrendRef.value);
    activityTrendInstance.setOption({
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value", name: "参与人数" },
      series: [],
    });
    return;
  }

  activityTrendInstance = echarts.init(activityTrendRef.value);
  activityTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date?.slice(5) || d.date || ""),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: { type: "value", name: "参与人数" },
    series: [
      {
        name: "参与人数",
        type: "line",
        data: data.map((d) => d.participants || 0),
        smooth: true,
        symbol: "none",
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(63,111,239,0.25)" },
            { offset: 1, color: "rgba(63,111,239,0)" },
          ]),
        },
      },
    ],
  });
}

async function renderConversionTrend() {
  if (!conversionTrendRef.value) return;
  if (conversionTrendInstance) conversionTrendInstance.dispose();

  let data: any[] = [];
  try {
    const dateRange = getDateRange();
    const trendData = await getMarketingTrend({ period: trendGranularity.value, ...dateRange });
    data = trendData?.conversionRate || trendData?.participants || [];
  } catch {
    // API 调用失败时使用空数据
  }

  if (data.length === 0) {
    conversionTrendInstance = echarts.init(conversionTrendRef.value);
    conversionTrendInstance.setOption({
      grid: { left: 60, right: 60, top: 20, bottom: 40 },
      xAxis: { type: "category", data: [] },
      yAxis: [{ type: "value" }, { type: "value" }],
      series: [],
    });
    return;
  }

  conversionTrendInstance = echarts.init(conversionTrendRef.value);
  conversionTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["参与人数", "转化率"], bottom: 0 },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date?.slice(5) || d.date || ""),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: [
      { type: "value", name: "参与人数" },
      {
        type: "value",
        name: "转化率(%)",
        axisLabel: { formatter: "{value}%" },
      },
    ],
    series: [
      {
        name: "参与人数",
        type: "bar",
        data: data.map((d) => d.participants || 0),
        itemStyle: { color: CHART_COLORS.primary },
        barWidth: "60%",
      },
      {
        name: "转化率",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => Number(d.conversionRate || 0)),
        smooth: true,
        itemStyle: { color: CHART_COLORS.success },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  });
}

async function renderROIChart() {
  if (!roiChartRef.value) return;
  if (roiInstance) roiInstance.dispose();

  let data: any[] = [];
  try {
    const dateRange = getDateRange();
    const rankingData = await getActivityRanking({ rankBy: "roi", ...dateRange });
    data = rankingData || [];
  } catch {
    // API 调用失败时使用空数据
  }

  const sortedData = [...data].sort((a, b) => Number(a.roi || 0) - Number(b.roi || 0));

  roiInstance = echarts.init(roiChartRef.value);
  roiInstance.setOption({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => `${params[0].name}：ROI ${params[0].value}`,
    },
    grid: { left: 100, right: 50, top: 10, bottom: 20 },
    xAxis: { type: "value", name: "ROI" },
    yAxis: {
      type: "category",
      data: sortedData.map((d) => d.activityName || d.name || ""),
      axisLabel: { width: 90, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: sortedData.map((d) => Number(d.roi || 0)),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: CHART_COLORS.primary },
            { offset: 1, color: CHART_COLORS.success },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: "right",
          formatter: "{c}",
        },
      },
    ],
  });
}

async function renderTypePie() {
  if (!typePieRef.value) return;
  if (typePieInstance) typePieInstance.dispose();

  let data: any[] = [];
  try {
    const dateRange = getDateRange();
    const statsData = await getActivityStats({ ...dateRange });
    data = statsData?.typeDistribution || [];
  } catch {
    // API 调用失败时使用空数据
  }

  typePieInstance = echarts.init(typePieRef.value);
  typePieInstance.setOption({
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
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
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold",
          },
        },
        data: data.map((d) => ({
          name: d.type || d.name || "",
          value: d.count || d.value || 0,
        })),
        color: [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.textMuted],
      },
    ],
  });
}

async function renderCouponUsage() {
  if (!couponUsageRef.value) return;
  if (couponUsageInstance) couponUsageInstance.dispose();

  let data: any[] = [];
  try {
    const statsData = await getCouponStats();
    data = statsData?.usageTrend || [];
  } catch {
    // API 调用失败时使用空数据
  }

  if (data.length === 0) {
    couponUsageInstance = echarts.init(couponUsageRef.value);
    couponUsageInstance.setOption({
      grid: { left: 60, right: 60, top: 20, bottom: 40 },
      xAxis: { type: "category", data: [] },
      yAxis: [{ type: "value" }, { type: "value" }],
      series: [],
    });
    return;
  }

  couponUsageInstance = echarts.init(couponUsageRef.value);
  couponUsageInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["发放量", "使用量", "核销率"], bottom: 0 },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date?.slice(5) || d.date || ""),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: [
      { type: "value", name: "数量" },
      {
        type: "value",
        name: "核销率(%)",
        axisLabel: { formatter: "{value}%" },
      },
    ],
    series: [
      {
        name: "发放量",
        type: "line",
        data: data.map((d) => d.issued || d.count || 0),
        smooth: true,
        symbol: "none",
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(63,111,239,0.2)" },
            { offset: 1, color: "rgba(63,111,239,0)" },
          ]),
        },
      },
      {
        name: "使用量",
        type: "line",
        data: data.map((d) => d.used || d.redeemed || 0),
        smooth: true,
        symbol: "none",
        itemStyle: { color: CHART_COLORS.success },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(14,168,121,0.2)" },
            { offset: 1, color: "rgba(14,168,121,0)" },
          ]),
        },
      },
      {
        name: "核销率",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => Number(d.rate || d.redeemRate || 0)),
        smooth: true,
        itemStyle: { color: CHART_COLORS.warning },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  });
}

function renderAllCharts() {
  nextTick(() => {
    renderActivityTrend();
    renderConversionTrend();
    renderROIChart();
    renderTypePie();
    renderCouponUsage();
  });
}

// ==================== 活动对比 ====================
const allActivities = ref<any[]>([]);
const compareIds = ref<number[]>([]);
const compareData = ref<any[]>([]);
const compareColumns = ref<any[]>([]);

const dimensions = [
  { key: "participants", label: "参与人数" },
  { key: "conversionRate", label: "转化率(%)" },
  { key: "orders", label: "订单数" },
  { key: "gmv", label: "GMV(元)" },
  { key: "discountAmount", label: "优惠金额(元)" },
  { key: "roi", label: "ROI" },
];

async function renderCompareTable() {
  if (compareIds.value.length < 2) {
    compareData.value = [];
    compareColumns.value = [];
    return;
  }

  try {
    const dateRange = getDateRange();
    const comparisonData = await getActivityComparison({ activityIds: compareIds.value, ...dateRange });
    if (comparisonData) {
      compareColumns.value = comparisonData.map((act: any) => ({ name: act.name, id: act.id }));
      compareData.value = dimensions.map((dim) => {
        const row: any = { dimension: dim.label };
        comparisonData.forEach((act: any) => {
          row[act.name] = (act as any)[dim.key] || "-";
        });
        return row;
      });
    } else {
      // 如果API没有返回数据，使用本地活动列表数据
      const selected = allActivities.value.filter((a) => compareIds.value.includes(a.id));
      compareColumns.value = selected.map((a) => ({ name: a.name, id: a.id }));
      compareData.value = dimensions.map((dim) => {
        const row: any = { dimension: dim.label };
        selected.forEach((act) => {
          row[act.name] = (act as any)[dim.key] || "-";
        });
        return row;
      });
    }
  } catch {
    // API 调用失败时使用本地数据
    const selected = allActivities.value.filter((a) => compareIds.value.includes(a.id));
    compareColumns.value = selected.map((a) => ({ name: a.name, id: a.id }));
    compareData.value = dimensions.map((dim) => {
      const row: any = { dimension: dim.label };
      selected.forEach((act) => {
        row[act.name] = (act as any)[dim.key] || "-";
      });
      return row;
    });
  }
}

function isBestValue(row: any, colName: string): boolean {
  const dim = dimensions.find((d) => d.label === row.dimension);
  if (!dim) return false;

  const values = compareColumns.value.map((c) => {
    const v = row[c.name];
    return typeof v === "string" ? parseFloat(v) || 0 : v || 0;
  });

  const currentVal = typeof row[colName] === "string" ? parseFloat(row[colName]) || 0 : row[colName] || 0;

  if (dim.key === "gmv" || dim.key === "discountAmount") {
    return currentVal === Math.max(...values);
  }
  return currentVal === Math.max(...values);
}

// ==================== 窗口 resize ====================
function handleResize() {
  activityTrendInstance?.resize();
  conversionTrendInstance?.resize();
  roiInstance?.resize();
  typePieInstance?.resize();
  couponUsageInstance?.resize();
}

onMounted(async () => {
  await loadOverview();
  renderAllCharts();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  activityTrendInstance?.dispose();
  conversionTrendInstance?.dispose();
  roiInstance?.dispose();
  typePieInstance?.dispose();
  couponUsageInstance?.dispose();
});
</script>

<style scoped>
.page {
  padding: 20px;
}

/* 统计卡片 */
.stat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  color: var(--text-inverse);
}

.stat-card.stat-primary {
  background: linear-gradient(135deg, var(--color-primary), rgba(63,111,239,0.4));
}
.stat-card.stat-success {
  background: linear-gradient(135deg, var(--color-success), rgba(14,168,121,0.4));
}
.stat-card.stat-info-card {
  background: linear-gradient(135deg, var(--gray-400), var(--gray-500));
}
.stat-card.stat-purple {
  background: linear-gradient(135deg, var(--chart-5), rgba(139,92,246,0.6));
}
.stat-card.stat-warning {
  background: linear-gradient(135deg, var(--color-warning), rgba(212,139,58,0.4));
}
.stat-card.stat-danger {
  background: linear-gradient(135deg, var(--color-danger), rgba(192,57,43,0.4));
}

.stat-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
}

/* 筛选器 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* 图表 */
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-body {
  width: 100%;
  height: 320px;
}

.best-value {
  color: var(--color-success);
}
</style>