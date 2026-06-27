<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>即时零售报表</span>
          <div class="header-actions">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              style="margin-right: 8px"
              value-format="YYYY-MM-DD"
              @change="loadData"
            />
            <el-button @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <el-row :gutter="16" class="summary-cards">
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-label">总订单数</div>
              <div class="stat-value">{{ summary.totalOrders || 0 }}</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-label">总营收</div>
              <div class="stat-value stat-amount">¥{{ Number(summary.totalRevenue || 0).toFixed(2) }}</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-label">平均客单价</div>
              <div class="stat-value stat-amount">¥{{ Number(summary.avgOrderValue || 0).toFixed(2) }}</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-label">完成率</div>
              <div class="stat-value">{{ Number(summary.completionRate || 0).toFixed(1) }}%</div>
            </el-card>
          </el-col>
        </el-row>

        <div class="chart-section">
          <canvas ref="chartCanvas" width="800" height="300" class="chart-canvas"></canvas>
        </div>

        <el-table :data="trendList" stripe class="trend-table">
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="orders" label="订单数" width="100" />
          <el-table-column prop="revenue" label="营收" width="140">
            <template #default="{ row }">
              <span class="amount-text">¥{{ Number(row.revenue || 0).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="avgValue" label="平均客单价" width="140">
            <template #default="{ row }">
              <span class="amount-text">¥{{ Number(row.avgValue || 0).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="completionRate" label="完成率" min-width="100">
            <template #default="{ row }">
              {{ Number(row.completionRate || 0).toFixed(1) }}%
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无报表数据" />
          </template>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { fetchInstantReportSummary, fetchInstantReportTrend } from "../api";

const loading = ref(false);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
const trendList = ref<any[]>([]);
const dateRange = ref<[string, string] | null>(null);

const summary = reactive({
  totalOrders: 0,
  totalRevenue: 0,
  avgOrderValue: 0,
  completionRate: 0
});

function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1]
    };
    const [summaryData, trendData] = await Promise.all([
      fetchInstantReportSummary(params),
      fetchInstantReportTrend(params)
    ]);
    if (summaryData) {
      summary.totalOrders = summaryData.totalOrders || 0;
      summary.totalRevenue = summaryData.totalRevenue || 0;
      summary.avgOrderValue = summaryData.avgOrderValue || 0;
      summary.completionRate = summaryData.completionRate || 0;
    }
    trendList.value = (trendData && Array.isArray(trendData) ? trendData : trendData?.records) || [];
    await nextTick();
    drawChart();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载报表数据失败"));
  } finally {
    loading.value = false;
  }
}

function drawChart() {
  const canvas = chartCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const data = trendList.value;
  if (data.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#909399";
    ctx.textAlign = "center";
    ctx.fillText("暂无趋势数据", canvas.width / 2, canvas.height / 2);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = canvas.width - padding.left - padding.right;
  const chartH = canvas.height - padding.top - padding.bottom;

  const maxRevenue = Math.max(...data.map((d: any) => Number(d.revenue || 0)), 1);
  const maxOrders = Math.max(...data.map((d: any) => Number(d.orders || 0)), 1);

  // Draw axes
  ctx.strokeStyle = "#e4e7ed";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();

  // Y-axis labels (revenue)
  ctx.fillStyle = "#409EFF";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxRevenue / 4) * i);
    const y = padding.top + chartH - (chartH / 4) * i;
    ctx.fillText(`¥${val}`, padding.left - 8, y + 4);
    if (i > 0) {
      ctx.strokeStyle = "#f5f7fa";
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }
  }

  // Y-axis labels (orders) on right
  ctx.fillStyle = "#E6A23C";
  ctx.textAlign = "left";
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxOrders / 4) * i);
    const y = padding.top + chartH - (chartH / 4) * i;
    ctx.fillText(`${val}单`, padding.left + chartW + 8, y + 4);
  }

  // Draw bars and line
  const barWidth = Math.max(8, Math.min(20, chartW / data.length / 2.5));
  const gap = chartW / data.length;

  // Revenue bars
  ctx.fillStyle = "rgba(64, 158, 255, 0.6)";
  data.forEach((d: any, i: number) => {
    const barH = (Number(d.revenue || 0) / maxRevenue) * chartH;
    const x = padding.left + gap * i + gap / 2 - barWidth;
    const y = padding.top + chartH - barH;
    ctx.fillRect(x, y, barWidth, barH);
  });

  // Orders line
  ctx.strokeStyle = "#E6A23C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d: any, i: number) => {
    const x = padding.left + gap * i + gap / 2;
    const y = padding.top + chartH - (Number(d.orders || 0) / maxOrders) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Orders dots
  ctx.fillStyle = "#E6A23C";
  data.forEach((d: any, i: number) => {
    const x = padding.left + gap * i + gap / 2;
    const y = padding.top + chartH - (Number(d.orders || 0) / maxOrders) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // X-axis labels
  ctx.fillStyle = "#606266";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  data.forEach((d: any, i: number) => {
    const x = padding.left + gap * i + gap / 2;
    const label = String(d.date || "").slice(5);
    ctx.fillText(label, x, padding.top + chartH + 16);
  });

  // Legend
  ctx.fillStyle = "rgba(64, 158, 255, 0.6)";
  ctx.fillRect(padding.left, padding.top + chartH + 28, 12, 12);
  ctx.fillStyle = "#606266";
  ctx.textAlign = "left";
  ctx.fillText("营收", padding.left + 16, padding.top + chartH + 38);

  ctx.strokeStyle = "#E6A23C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left + 80, padding.top + chartH + 34);
  ctx.lineTo(padding.left + 110, padding.top + chartH + 34);
  ctx.stroke();
  ctx.fillStyle = "#E6A23C";
  ctx.beginPath();
  ctx.arc(padding.left + 95, padding.top + chartH + 34, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#606266";
  ctx.fillText("订单数", padding.left + 114, padding.top + chartH + 38);
}

watch(trendList, () => {
  nextTick(() => drawChart());
});

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
.summary-cards {
  margin-bottom: 20px;
}
.stat-card {
  text-align: center;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}
.stat-amount {
  color: #409EFF;
}
.chart-section {
  margin-bottom: 20px;
  overflow-x: auto;
}
.chart-canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
.trend-table {
  margin-top: 16px;
}
.amount-text {
  font-weight: 500;
}
</style>