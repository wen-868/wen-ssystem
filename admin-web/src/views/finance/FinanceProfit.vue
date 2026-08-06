<template>
  <div class="page">
    <PageCard title="经营利润">
      <template #extra>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="loadData"
        />
        <el-button style="margin-left: 12px" @click="loadData">刷新</el-button>
      </template>

      <!-- 汇总卡片 -->
      <el-row :gutter="16" class="summary-row">
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="总收入" :value="overview.totalRevenue || 0" :precision="2">
              <template #prefix>¥</template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="总成本" :value="overview.totalCost || 0" :precision="2">
              <template #prefix>¥</template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="毛利润" :value="overview.grossProfit || 0" :precision="2">
              <template #prefix>¥</template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <el-statistic title="利润率" :value="overview.profitMargin || 0" :precision="1">
              <template #suffix>%</template>
            </el-statistic>
          </el-card>
        </el-col>
      </el-row>
    </PageCard>

    <!-- 图表 -->
    <PageCard title="收入成本对比">
      <div ref="barChartRef" class="chart-container"></div>
    </PageCard>

    <PageCard title="利润趋势">
      <div ref="lineChartRef" class="chart-container"></div>
    </PageCard>

    <!-- 明细表格 -->
    <PageCard title="利润明细">
      <el-table :data="profitData" v-loading="loading" stripe>
        <el-table-column prop="period" label="期间" width="140" />
        <el-table-column label="收入" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.revenue) }}
          </template>
        </el-table-column>
        <el-table-column label="成本" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.cost) }}
          </template>
        </el-table-column>
        <el-table-column label="费用" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.expenses) }}
          </template>
        </el-table-column>
        <el-table-column label="利润" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: (row.profit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
              {{ formatYuan(row.profit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="利润率" width="120" align="right">
          <template #default="{ row }">
            <span :style="{ color: (row.margin || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
              {{ row.margin != null ? (row.margin * 1).toFixed(1) + '%' : '-' }}
            </span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from "vue";
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchReportProfit, fetchReportBusinessOverview } from "../../api";

const dateRange = ref<[Date, Date] | null>(null);
const loading = ref(false);

const overview = reactive({
  totalRevenue: 0,
  totalCost: 0,
  grossProfit: 0,
  profitMargin: 0
});

const profitData = ref<any[]>([]);

const barChartRef = ref<HTMLElement | null>(null);
const lineChartRef = ref<HTMLElement | null>(null);

let barChart: any = null;
let lineChart: any = null;

function getDateParams() {
  const params: any = {};
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    params.dateStart = formatDateOnly(dateRange.value[0]);
    params.dateEnd = formatDateOnly(dateRange.value[1]);
  }
  return params;
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadData() {
  loading.value = true;
  try {
    const params = getDateParams();
    const [profitRes, overviewRes] = await Promise.all([
      fetchReportProfit(),
      fetchReportBusinessOverview()
    ]);

    const profitResult = profitRes?.records || profitRes?.list || profitRes || [];
    profitData.value = profitResult;

    const overviewResult = overviewRes || {};
    overview.totalRevenue = overviewResult.totalRevenue || 0;
    overview.totalCost = overviewResult.totalCost || 0;
    overview.grossProfit = overviewResult.grossProfit || 0;
    overview.profitMargin = overviewResult.profitMargin || 0;

    await nextTick();
    renderCharts();
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  renderBarChart();
  renderLineChart();
}

function renderBarChart() {
  if (!barChartRef.value) return;
  const data = profitData.value;
  if (data.length === 0) return;

  const periods = data.map((d: any) => d.period || "");
  const revenues = data.map((d: any) => Number(d.revenue) || 0);
  const costs = data.map((d: any) => Number(d.cost) || 0);

  const canvas = document.createElement("canvas");
  while (barChartRef.value.firstChild) barChartRef.value.removeChild(barChartRef.value.firstChild);
  barChartRef.value.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = barChartRef.value.clientWidth;
  const height = 300;
  canvas.width = width;
  canvas.height = height;

  const padding = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = [...revenues, ...costs];
  const maxVal = Math.max(...allValues, 1);
  const yScale = chartH / maxVal;

  const barGroupWidth = chartW / periods.length;
  const barWidth = barGroupWidth * 0.35;

  // Grid lines
  ctx.strokeStyle = "#F0F0F0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + chartH - (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#999999";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatYuan((maxVal / 5) * i), padding.left - 10, y + 4);
  }

  // Bars
  data.forEach((_: any, i: number) => {
    const x = padding.left + barGroupWidth * i + barGroupWidth * 0.1;
    const revH = revenues[i] * yScale;
    const costH = costs[i] * yScale;

    ctx.fillStyle = "#3F6FEF";
    ctx.fillRect(x, padding.top + chartH - revH, barWidth, revH);

    ctx.fillStyle = "#C0392B";
    ctx.fillRect(x + barWidth + 4, padding.top + chartH - costH, barWidth, costH);
  });

  // X labels
  ctx.fillStyle = "#444444";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  data.forEach((_: any, i: number) => {
    const x = padding.left + barGroupWidth * i + barGroupWidth / 2;
    ctx.fillText(periods[i], x, height - padding.bottom + 20);
  });

  // Legend
  ctx.fillStyle = "#3F6FEF";
  ctx.fillRect(padding.left, 8, 12, 12);
  ctx.fillStyle = "#444444";
  ctx.textAlign = "left";
  ctx.fillText("收入", padding.left + 18, 18);

  ctx.fillStyle = "#C0392B";
  ctx.fillRect(padding.left + 60, 8, 12, 12);
  ctx.fillStyle = "#444444";
  ctx.fillText("成本", padding.left + 78, 18);
}

function renderLineChart() {
  if (!lineChartRef.value) return;
  const data = profitData.value;
  if (data.length === 0) return;

  const periods = data.map((d: any) => d.period || "");
  const profits = data.map((d: any) => Number(d.profit) || 0);

  const canvas = document.createElement("canvas");
  while (lineChartRef.value.firstChild) lineChartRef.value.removeChild(lineChartRef.value.firstChild);
  lineChartRef.value.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = lineChartRef.value.clientWidth;
  const height = 300;
  canvas.width = width;
  canvas.height = height;

  const padding = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...profits.map(Math.abs), 1);
  const minVal = Math.min(0, ...profits);
  const range = maxVal - minVal || 1;
  const yScale = chartH / range;

  // Grid lines
  ctx.strokeStyle = "#F0F0F0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#999999";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    const val = maxVal - (range / 5) * i;
    ctx.fillText(formatYuan(val), padding.left - 10, y + 4);
  }

  // Line
  ctx.strokeStyle = "#0EA879";
  ctx.lineWidth = 2;
  ctx.beginPath();
  profits.forEach((val: number, i: number) => {
    const x = padding.left + (chartW / (periods.length - 1 || 1)) * i;
    const y = padding.top + (maxVal - val) * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  profits.forEach((val: number, i: number) => {
    const x = padding.left + (chartW / (periods.length - 1 || 1)) * i;
    const y = padding.top + (maxVal - val) * yScale;
    ctx.fillStyle = "#0EA879";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // X labels
  ctx.fillStyle = "#444444";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  data.forEach((_: any, i: number) => {
    const x = padding.left + (chartW / (periods.length - 1 || 1)) * i;
    ctx.fillText(periods[i], x, height - padding.bottom + 20);
  });
}

onMounted(() => {
  loadData();
  window.addEventListener("resize", renderCharts);
});
</script>

<style scoped>
.summary-row {
  margin-bottom: 0;
}

.chart-container {
  width: 100%;
  min-height: 300px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>