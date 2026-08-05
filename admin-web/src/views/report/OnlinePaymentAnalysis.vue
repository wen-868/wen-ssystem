<template>
  <div class="page">
    <!-- 筛选栏 -->
    <PageCard>
      <div class="filter-bar">
        <span class="filter-label">日期范围：</span>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 280px"
          @change="loadData"
        />
        <span class="filter-label" style="margin-left: 16px">分组方式：</span>
        <el-radio-group v-model="groupBy" @change="loadData">
          <el-radio-button value="date">按日期</el-radio-button>
          <el-radio-button value="customer">按客户</el-radio-button>
          <el-radio-button value="staff">按员工</el-radio-button>
        </el-radio-group>
        <el-button type="primary" style="margin-left: 16px" @click="loadData">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </PageCard>

    <!-- 核心指标卡片 -->
    <el-row :gutter="16" style="margin-top: 16px" v-loading="loading">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: rgba(63,111,239,0.06)">
              <el-icon :size="28" color="#3F6FEF"><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">收款总金额</div>
              <div class="stat-value">{{ formatYuan(summary.totalAmount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: rgba(14,168,121,0.12)">
              <el-icon :size="28" color="#0EA879"><Tickets /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">收款总笔数</div>
              <div class="stat-value">{{ summary.totalCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: rgba(212,139,58,0.12)">
              <el-icon :size="28" color="#D48B3A"><Coin /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">日均收款额</div>
              <div class="stat-value">{{ formatYuan(summary.avgDailyAmount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fef0f0">
              <el-icon :size="28" color="#C0392B"><DataLine /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">单笔均值</div>
              <div class="stat-value">{{ formatYuan(summary.avgAmount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势图 -->
    <PageCard title="收款趋势分析" style="margin-top: 16px">
      <div class="chart-container" ref="chartRef" v-loading="loading">
        <el-empty v-if="!chartData.length" description="暂无数据" :image-size="80" />
      </div>
    </PageCard>

    <!-- 收款明细列表 -->
    <PageCard :title="getDetailTitle()" style="margin-top: 16px">
      <el-table :data="records" v-loading="loading" stripe>
        <el-table-column v-if="groupBy === 'date'" label="日期" min-width="140">
          <template #default="{ row }">{{ row.period }}</template>
        </el-table-column>
        <el-table-column v-if="groupBy === 'customer'" label="客户名称" min-width="180">
          <template #default="{ row }">{{ row.customerName || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="groupBy === 'staff'" label="员工名称" min-width="140">
          <template #default="{ row }">{{ row.staffName || '-' }}</template>
        </el-table-column>
        <el-table-column label="收款笔数" width="120" align="center">
          <template #default="{ row }">{{ row.paymentCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="收款金额" width="140" align="center">
          <template #default="{ row }">
            <span class="amount-text">{{ formatYuan(row.totalAmount || 0) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="占比" width="200" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="getPercentage(row.totalAmount)"
              :stroke-width="14"
              :text-inside="true"
              :color="getProgressColor(row.totalAmount)"
            />
          </template>
        </el-table-column>
        <el-table-column label="单笔均值" width="140" align="center">
          <template #default="{ row }">
            {{ formatYuan(getAvgAmount(row)) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无收款数据" :image-size="80" />
        </template>
      </el-table>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from "vue";
import { ElMessage } from "element-plus";
import { Money, Tickets, Coin, DataLine } from "@element-plus/icons-vue";
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchReportPaymentAnalysis } from "../../api";
import echarts from "../../utils/echarts";

const loading = ref(false);
const records = ref<any[]>([]);
const groupBy = ref<"date" | "customer" | "staff">("date");

// 默认查最近30天
function getDefaultDateRange(): [string, string] {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [fmt(start), fmt(end)];
}

const dateRange = ref<[string, string]>(getDefaultDateRange());

const chartRef = ref<HTMLElement>();
let chartInstance: echarts.ECharts | null = null;

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { msg?: string; message?: string } }; message?: string };
  return anyError?.response?.data?.msg || anyError?.message || fallback;
}

const summary = computed(() => {
  const totalAmount = records.value.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const totalCount = records.value.reduce((sum, r) => sum + Number(r.paymentCount || 0), 0);
  const dayCount = groupBy.value === "date" ? records.value.length || 1 : 30;
  const avgDailyAmount = totalAmount / dayCount;
  const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
  return {
    totalAmount,
    totalCount,
    avgDailyAmount,
    avgAmount
  };
});

const chartData = computed(() => {
  if (groupBy.value === "date") {
    return records.value.map(r => ({
      label: r.period,
      amount: Number(r.totalAmount || 0),
      count: Number(r.paymentCount || 0)
    }));
  }
  if (groupBy.value === "customer") {
    return records.value.map(r => ({
      label: r.customerName || "未知",
      amount: Number(r.totalAmount || 0),
      count: Number(r.paymentCount || 0)
    }));
  }
  return records.value.map(r => ({
    label: r.staffName || "未知",
    amount: Number(r.totalAmount || 0),
    count: Number(r.paymentCount || 0)
  }));
});

function getDetailTitle(): string {
  if (groupBy.value === "date") return "每日收款明细";
  if (groupBy.value === "customer") return "客户收款排名";
  return "员工收款排名";
}

function getPercentage(amount: number): number {
  const total = summary.value.totalAmount || 1;
  return Math.round((Number(amount || 0) / total) * 100);
}

function getProgressColor(amount: number): string {
  const pct = getPercentage(amount);
  if (pct > 30) return "#C0392B";
  if (pct > 15) return "#D48B3A";
  if (pct > 5) return "#3F6FEF";
  return "#0EA879";
}

function getAvgAmount(row: any): number {
  const count = Number(row.paymentCount || 0);
  if (count === 0) return 0;
  return Number(row.totalAmount || 0) / count;
}

async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, string> = { groupBy: groupBy.value };
    if (dateRange.value && dateRange.value.length === 2) {
      params.dateStart = dateRange.value[0];
      params.dateEnd = dateRange.value[1];
    }
    const data = await fetchReportPaymentAnalysis(params);
    records.value = Array.isArray(data) ? data : (data?.records || data?.list || []);
    await nextTick();
    renderChart();
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e, "加载收款分析数据失败"));
    records.value = [];
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  dateRange.value = getDefaultDateRange();
  groupBy.value = "date";
  loadData();
}

function renderChart() {
  if (!chartRef.value) return;
  if (!chartData.value.length) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }

  const isDateMode = groupBy.value === "date";
  chartInstance.setOption({
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
        params.forEach((p: any) => {
          const val = p.seriesName === "收款金额" ? formatYuan(p.value) : `${p.value} 笔`;
          html += `<div>${p.marker} ${p.seriesName}：${val}</div>`;
        });
        return html;
      }
    },
    legend: { data: ["收款金额", "收款笔数"], top: 5 },
    grid: { left: 60, right: 60, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: chartData.value.map(d => d.label),
      axisLabel: {
        fontSize: 11,
        rotate: isDateMode ? 30 : 0,
        interval: isDateMode ? "auto" : 0
      }
    },
    yAxis: [
      {
        type: "value",
        name: "金额(元)",
        position: "left",
        axisLabel: { fontSize: 11 }
      },
      {
        type: "value",
        name: "笔数",
        position: "right",
        minInterval: 1,
        axisLabel: { fontSize: 11 }
      }
    ],
    series: [
      {
        name: "收款金额",
        type: isDateMode ? "line" : "bar",
        data: chartData.value.map(d => d.amount),
        smooth: true,
        areaStyle: isDateMode ? { opacity: 0.15 } : undefined,
        itemStyle: { color: "#3F6FEF" },
        lineStyle: { width: 3 }
      },
      {
        name: "收款笔数",
        type: "bar",
        yAxisIndex: 1,
        data: chartData.value.map(d => d.count),
        itemStyle: { color: "#0EA879", opacity: 0.7 }
      }
    ]
  });
}

function handleResize() {
  chartInstance?.resize();
}

watch(groupBy, () => {
  nextTick(() => renderChart());
});

onMounted(() => {
  loadData();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});
</script>

<style scoped>
.page {
  padding: 0;
}
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.filter-label {
  font-size: 14px;
  color: var(--gray-600);
  white-space: nowrap;
}
.stat-card {
  margin-bottom: 0;
}
.stat-content {
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
  flex-shrink: 0;
}
.stat-info {
  flex: 1;
}
.stat-label {
  font-size: 13px;
  color: var(--gray-400);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--gray-700);
  line-height: 1.2;
}
.chart-container {
  width: 100%;
  height: 360px;
}
.amount-text {
  font-weight: 600;
  color: var(--color-warning);
}
</style>
