<template>
  <div class="page">
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
              :style="isBestValue(row, col.name) ? { background: '#e1f3d8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 } : {}"
            >
              {{ row[col.name] }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="compareData.length === 0" description="请选择2-4个活动进行对比" :image-size="80" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import echarts from '@/utils/echarts'
import { TrendCharts, VideoPlay, VideoPause, User, Present, CircleCheck } from "@element-plus/icons-vue";

// ==================== Mock 数据 ====================
const mockOverview = {
  totalActivities: 86,
  activeCount: 12,
  endedCount: 58,
  totalParticipants: 45680,
  totalCoupons: 32500,
  verifiedRate: 68.5,
};

const mockActivityTrend = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  participants: Math.floor(Math.random() * 500 + 100),
}));

const mockConversionTrend = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  participants: Math.floor(Math.random() * 500 + 100),
  conversionRate: (Math.random() * 20 + 5).toFixed(1),
}));

const mockROI = Array.from({ length: 10 }, (_, i) => ({
  activityName: `活动${i + 1}`,
  roi: (Math.random() * 5 + 1).toFixed(1),
}));

const mockTypeDistribution = [
  { type: "优惠券", count: 35, ratio: 40.7 },
  { type: "满减", count: 20, ratio: 23.3 },
  { type: "限时折扣", count: 15, ratio: 17.4 },
  { type: "满赠", count: 10, ratio: 11.6 },
  { type: "积分", count: 6, ratio: 7.0 },
];

const mockCouponUsage = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  issued: Math.floor(Math.random() * 200 + 100),
  used: Math.floor(Math.random() * 100 + 50),
  rate: (Math.random() * 30 + 50).toFixed(1),
}));

const mockActivities = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `活动${i + 1}`,
  participants: Math.floor(Math.random() * 2000 + 500),
  conversionRate: (Math.random() * 20 + 5).toFixed(1),
  orders: Math.floor(Math.random() * 500 + 100),
  gmv: Math.floor(Math.random() * 50000 + 10000),
  discountAmount: Math.floor(Math.random() * 10000 + 2000),
  roi: (Math.random() * 5 + 1).toFixed(1),
}));

// ==================== 概览数据 ====================
const overview = reactive({ ...mockOverview });
const hasData = ref(true);

// ==================== 筛选器 ====================
const quickDate = ref("month");
const customDateRange = ref<any[]>([]);
const selectedTypes = ref<string[]>([]);

function handleQuickDate() {
  if (quickDate.value !== "custom") {
    customDateRange.value = [];
    onFilterChange();
  }
}

function onFilterChange() {
  renderAllCharts();
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

function renderActivityTrend() {
  if (!activityTrendRef.value) return;
  if (activityTrendInstance) activityTrendInstance.dispose();

  const data = [...mockActivityTrend];
  activityTrendInstance = echarts.init(activityTrendRef.value);
  activityTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date.slice(5)),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: { type: "value", name: "参与人数" },
    series: [
      {
        name: "参与人数",
        type: "line",
        data: data.map((d) => d.participants),
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#409eff" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64,158,255,0.25)" },
            { offset: 1, color: "rgba(64,158,255,0)" },
          ]),
        },
      },
    ],
  });
}

function renderConversionTrend() {
  if (!conversionTrendRef.value) return;
  if (conversionTrendInstance) conversionTrendInstance.dispose();

  const data = [...mockConversionTrend];
  conversionTrendInstance = echarts.init(conversionTrendRef.value);
  conversionTrendInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["参与人数", "转化率"], bottom: 0 },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date.slice(5)),
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
        data: data.map((d) => d.participants),
        itemStyle: { color: "#409eff" },
        barWidth: "60%",
      },
      {
        name: "转化率",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => Number(d.conversionRate)),
        smooth: true,
        itemStyle: { color: "#67c23a" },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  });
}

function renderROIChart() {
  if (!roiChartRef.value) return;
  if (roiInstance) roiInstance.dispose();

  const data = [...mockROI].sort((a, b) => Number(a.roi) - Number(b.roi));
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
      data: data.map((d) => d.activityName),
      axisLabel: { width: 90, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => Number(d.roi)),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#409eff" },
            { offset: 1, color: "#67c23a" },
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

function renderTypePie() {
  if (!typePieRef.value) return;
  if (typePieInstance) typePieInstance.dispose();

  const data = [...mockTypeDistribution];
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
          name: d.type,
          value: d.count,
        })),
        color: ["#409eff", "#67c23a", "#e6a23c", "#f56c6c", "#909399"],
      },
    ],
  });
}

function renderCouponUsage() {
  if (!couponUsageRef.value) return;
  if (couponUsageInstance) couponUsageInstance.dispose();

  const data = [...mockCouponUsage];
  couponUsageInstance = echarts.init(couponUsageRef.value);
  couponUsageInstance.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["发放量", "使用量", "核销率"], bottom: 0 },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date.slice(5)),
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
        data: data.map((d) => d.issued),
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#409eff" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(64,158,255,0.2)" },
            { offset: 1, color: "rgba(64,158,255,0)" },
          ]),
        },
      },
      {
        name: "使用量",
        type: "line",
        data: data.map((d) => d.used),
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#67c23a" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(103,194,58,0.2)" },
            { offset: 1, color: "rgba(103,194,58,0)" },
          ]),
        },
      },
      {
        name: "核销率",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => Number(d.rate)),
        smooth: true,
        itemStyle: { color: "#e6a23c" },
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
const allActivities = ref([...mockActivities]);
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

function renderCompareTable() {
  if (compareIds.value.length < 2) {
    compareData.value = [];
    compareColumns.value = [];
    return;
  }

  const selected = allActivities.value.filter((a) =>
    compareIds.value.includes(a.id)
  );
  compareColumns.value = selected.map((a) => ({ name: a.name, id: a.id }));

  compareData.value = dimensions.map((dim) => {
    const row: any = { dimension: dim.label };
    selected.forEach((act) => {
      row[act.name] = (act as any)[dim.key];
    });
    return row;
  });
}

function isBestValue(row: any, colName: string): boolean {
  const dim = dimensions.find((d) => d.label === row.dimension);
  if (!dim) return false;

  const values = compareColumns.value.map((c) => {
    const v = row[c.name];
    return typeof v === "string" ? parseFloat(v) : v;
  });

  const currentVal = typeof row[colName] === "string" ? parseFloat(row[colName]) : row[colName];

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

onMounted(() => {
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
  color: #fff;
}

.stat-card.stat-primary {
  background: linear-gradient(135deg, #409eff, #337ecc);
}
.stat-card.stat-success {
  background: linear-gradient(135deg, #67c23a, #529b2e);
}
.stat-card.stat-info-card {
  background: linear-gradient(135deg, #909399, #73767a);
}
.stat-card.stat-purple {
  background: linear-gradient(135deg, #9b59b6, #7d3c98);
}
.stat-card.stat-warning {
  background: linear-gradient(135deg, #e6a23c, #c98a2e);
}
.stat-card.stat-danger {
  background: linear-gradient(135deg, #f56c6c, #d94f4f);
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
  color: #67c23a;
}
</style>