<template>
  <div class="page">
    <PageCard title="员工业绩">
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

      <el-table :data="employeeData" v-loading="loading" stripe>
        <el-table-column prop="employeeName" label="员工" min-width="140" />
        <el-table-column prop="orders" label="订单数" width="100" align="right" />
        <el-table-column label="销售额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.revenue) }}
          </template>
        </el-table-column>
        <el-table-column label="客单价" width="140" align="right">
          <template #default="{ row }">
            {{ row.avgOrderValue ? formatYuan(row.avgOrderValue) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="customers" label="服务客户数" width="120" align="right" />
        <el-table-column label="毛利" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.profit) }}
          </template>
        </el-table-column>
        <el-table-column label="利润率" width="100" align="right">
          <template #default="{ row }">
            {{ row.margin != null ? (row.margin * 1).toFixed(1) + '%' : '-' }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>
    </PageCard>

    <!-- 业绩图表 -->
    <PageCard title="业绩对比">
      <div ref="chartRef" class="chart-container"></div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchReportCustomerContribution } from "../../api";

const dateRange = ref<[Date, Date] | null>(null);
const loading = ref(false);
const employeeData = ref<any[]>([]);
const chartRef = ref<HTMLElement | null>(null);

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await fetchReportCustomerContribution();
    employeeData.value = res?.records || res?.list || res || [];
    await nextTick();
    renderChart();
  } catch {
    employeeData.value = [];
  } finally {
    loading.value = false;
  }
}

function renderChart() {
  if (!chartRef.value) return;
  const data = employeeData.value;
  if (data.length === 0) return;

  const canvas = document.createElement("canvas");
  while (chartRef.value.firstChild) chartRef.value.removeChild(chartRef.value.firstChild);
  chartRef.value.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = chartRef.value.clientWidth;
  const height = 350;
  canvas.width = width;
  canvas.height = height;

  const padding = { top: 20, right: 30, bottom: 70, left: 80 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const names = data.map((d: any) => d.employeeName || d.customerName || "");
  const revenues = data.map((d: any) => Number(d.revenue) || 0);
  const maxVal = Math.max(...revenues, 1);
  const barW = Math.min(40, (chartW / data.length) * 0.6);
  const gap = chartW / data.length;

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
    ctx.fillText(formatYuan((maxVal / 5) * (5 - i)), padding.left - 10, y + 4);
  }

  // Bars
  data.forEach((_: any, i: number) => {
    const x = padding.left + gap * i + (gap - barW) / 2;
    const h = (revenues[i] / maxVal) * chartH;

    const gradient = ctx.createLinearGradient(x, padding.top + chartH - h, x, padding.top + chartH);
    gradient.addColorStop(0, "#3F6FEF");
    gradient.addColorStop(1, "#79bbff");
    ctx.fillStyle = gradient;

    ctx.fillRect(x, padding.top + chartH - h, barW, h);

    // X labels
    ctx.fillStyle = "#444444";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    const label = names[i].length > 6 ? names[i].substring(0, 6) + "..." : names[i];
    ctx.fillText(label, x + barW / 2, height - padding.bottom + 20);
  });
}

onMounted(() => {
  loadData();
  window.addEventListener("resize", renderChart);
});
</script>

<style scoped>
.chart-container {
  width: 100%;
  min-height: 350px;
}
</style>