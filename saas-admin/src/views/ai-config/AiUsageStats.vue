<template>
  <div>
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 280px;"
        />
        <el-input
          v-model="tenantId"
          placeholder="按租户 ID 过滤（选填）"
          clearable
          style="width: 220px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </el-card>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6" v-for="stat in overviewStats" :key="stat.key">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">{{ stat.label }}</div>
              <div style="font-size: 24px; font-weight: 700; margin-top: 8px;" :style="{ color: stat.color }">
                {{ stat.value }}
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;" :style="{ background: stat.bg }">
              <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-bottom: 16px;">
      <template #header><span>按日用量趋势</span></template>
      <div ref="trendChartRef" style="height: 320px;" v-loading="loading"></div>
      <el-empty v-if="!loading && list.length === 0" description="当前筛选条件下暂无用量数据" :image-size="80" />
    </el-card>

    <el-card>
      <template #header><span>用量明细（t_ai_usage_daily）</span></template>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="statDate" label="日期" width="110" />
        <el-table-column prop="tenantId" label="租户 ID" min-width="130" show-overflow-tooltip />
        <el-table-column prop="provider" label="服务商" width="110">
          <template #default="{ row }">{{ row.provider || "-" }}</template>
        </el-table-column>
        <el-table-column prop="model" label="模型" min-width="130" show-overflow-tooltip />
        <el-table-column prop="chatCount" label="对话次数" width="90" align="right" />
        <el-table-column prop="toolCallCount" label="工具调用" width="90" align="right" />
        <el-table-column prop="promptTokens" label="提示Token" width="110" align="right">
          <template #default="{ row }"><span class="mono">{{ formatNumber(row.promptTokens) }}</span></template>
        </el-table-column>
        <el-table-column prop="completionTokens" label="完成Token" width="110" align="right">
          <template #default="{ row }"><span class="mono">{{ formatNumber(row.completionTokens) }}</span></template>
        </el-table-column>
        <el-table-column prop="totalTokens" label="总Token" width="120" align="right">
          <template #default="{ row }"><span class="mono">{{ formatNumber(row.totalTokens) }}</span></template>
        </el-table-column>
        <el-table-column label="总费用（元）" width="120" align="right">
          <template #default="{ row }"><span class="mono">{{ formatCost(row.totalCost) }}</span></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ChatDotRound, Connection, Coin, TrendCharts } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import { getAiUsage, type UsageDailyItem, type UsageSummary } from "../../api/ai-config";

const loading = ref(false);
const list = ref<UsageDailyItem[]>([]);
const summary = reactive<UsageSummary>({ chatCount: 0, toolCallCount: 0, totalTokens: 0, totalCost: 0 });

const dateRange = ref<string[]>([]);
const tenantId = ref("");

/** 默认查询最近 30 天 */
function defaultRange(): [string, string] {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [fmt(start), fmt(end)];
}

const overviewStats = computed(() => [
  { key: "chatCount", label: "对话次数", value: formatNumber(summary.chatCount), icon: ChatDotRound, color: "#5B6ABF", bg: "rgba(91,106,191,0.10)" },
  { key: "toolCallCount", label: "工具调用次数", value: formatNumber(summary.toolCallCount), icon: Connection, color: "#0EA879", bg: "rgba(14,168,121,0.10)" },
  { key: "totalTokens", label: "Token 消耗", value: formatNumber(summary.totalTokens), icon: TrendCharts, color: "#D48B3A", bg: "rgba(212,139,58,0.12)" },
  { key: "totalCost", label: "预估费用（元）", value: formatCost(summary.totalCost), icon: Coin, color: "#C0392B", bg: "rgba(192,57,43,0.10)" },
]);

function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString();
}

function formatCost(n: number | null | undefined): string {
  return Number(n ?? 0).toFixed(4);
}

const trendChartRef = ref<HTMLDivElement>();
let trendChart: echarts.ECharts | null = null;

/** 渲染按日趋势图：总Token（柱状）+ 总费用（折线），双 Y 轴 */
function renderTrendChart(rows: UsageDailyItem[]) {
  if (!trendChartRef.value) return;
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value);
  }
  const labels = rows.map((r) => r.statDate);
  const tokens = rows.map((r) => Number(r.totalTokens ?? 0));
  const costs = rows.map((r) => Number(r.totalCost ?? 0));
  trendChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["总Token", "费用（元）"] },
    grid: { left: 60, right: 60, top: 40, bottom: 30 },
    xAxis: { type: "category", data: labels, axisLabel: { fontSize: 12 } },
    yAxis: [
      { type: "value", name: "Token", minInterval: 1 },
      { type: "value", name: "费用（元）", minInterval: 0.0001, axisLabel: { formatter: (v: number) => v.toFixed(4) } },
    ],
    series: [
      {
        name: "总Token",
        type: "bar",
        data: tokens,
        itemStyle: { color: "#5B6ABF", borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: "费用（元）",
        type: "line",
        yAxisIndex: 1,
        data: costs,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: "#C0392B" },
        lineStyle: { width: 2 },
      },
    ],
  });
}

async function fetchUsage() {
  loading.value = true;
  try {
    const res = await getAiUsage({
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
      tenantId: tenantId.value || undefined,
    });
    list.value = res.list ?? [];
    summary.chatCount = res.summary?.chatCount ?? 0;
    summary.toolCallCount = res.summary?.toolCallCount ?? 0;
    summary.totalTokens = res.summary?.totalTokens ?? 0;
    summary.totalCost = res.summary?.totalCost ?? 0;
    await nextTick();
    renderTrendChart(list.value);
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  fetchUsage();
}

function handleResize() {
  trendChart?.resize();
}

onMounted(() => {
  const [start, end] = defaultRange();
  dateRange.value = [start, end];
  window.addEventListener("resize", handleResize);
  fetchUsage();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  trendChart?.dispose();
  trendChart = null;
});
</script>
