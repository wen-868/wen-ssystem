<template>
  <div class="page">
    <PageCard title="门店对比">
      <template #extra>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="loadData"
        />
        <el-select v-model="metric" style="width: 150px; margin-left: 12px" @change="loadData">
          <el-option label="按销售额" value="revenue" />
          <el-option label="按订单量" value="orders" />
          <el-option label="按利润" value="profit" />
        </el-select>
        <el-button style="margin-left: 12px" @click="loadData">刷新</el-button>
      </template>

      <el-table :data="storeData" v-loading="loading" stripe>
        <el-table-column prop="storeName" label="门店名称" min-width="160" />
        <el-table-column label="销售额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.revenue) }}
          </template>
        </el-table-column>
        <el-table-column prop="orders" label="订单量" width="100" align="right" />
        <el-table-column label="客单价" width="140" align="right">
          <template #default="{ row }">
            {{ row.avgOrderValue ? formatYuan(row.avgOrderValue) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="利润" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.profit) }}
          </template>
        </el-table-column>
        <el-table-column label="利润率" width="100" align="right">
          <template #default="{ row }">
            {{ row.margin != null ? (row.margin * 1).toFixed(1) + '%' : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="环比增长" width="120" align="right">
          <template #default="{ row }">
            <span :style="{ color: (row.growthRate || 0) >= 0 ? '#0EA879' : '#C0392B' }">
              {{ row.growthRate != null ? (row.growthRate >= 0 ? '+' : '') + (row.growthRate * 1).toFixed(1) + '%' : '-' }}
            </span>
          </template>
        </el-table-column>
      <template #empty>
        <el-empty description="暂无数据" :image-size="80" />
      </template>
      </el-table>
    </PageCard>

    <!-- 对比图表 -->
    <PageCard title="对比图表">
      <div ref="chartRef" class="chart-container"></div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchStorePerformance } from "../../api";

const dateRange = ref<[Date, Date] | null>(null);
const metric = ref("revenue");
const loading = ref(false);
const storeData = ref<any[]>([]);
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
    const res = await fetchStorePerformance();
    storeData.value = res?.records || res?.list || res || [];
    await nextTick();
    renderChart();
  } catch {
    storeData.value = [];
  } finally {
    loading.value = false;
  }
}

function renderChart() {
  if (!chartRef.value) return;
  const data = storeData.value;
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

  const names = data.map((d: any) => d.storeName || "");
  const valKey = metric.value;
  const values = data.map((d: any) => Number(d[valKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const barW = Math.min(50, (chartW / data.length) * 0.6);
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
    const label = metric.value === "orders"
      ? String(Math.round((maxVal / 5) * (5 - i)))
      : formatYuan((maxVal / 5) * (5 - i));
    ctx.fillText(label, padding.left - 10, y + 4);
  }

  // Bars
  data.forEach((_: any, i: number) => {
    const x = padding.left + gap * i + (gap - barW) / 2;
    const h = (values[i] / maxVal) * chartH;

    const colors = ["#3F6FEF", "#0EA879", "#D48B3A", "#C0392B", "#999999", "#00d4ff", "#ff6b6b", "#a29bfe"];
    ctx.fillStyle = colors[i % colors.length];

    ctx.fillRect(x, padding.top + chartH - h, barW, h);

    // Value on top
    ctx.fillStyle = "#333333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    const valText = metric.value === "orders"
      ? String(values[i])
      : formatYuan(values[i]);
    ctx.fillText(valText, x + barW / 2, padding.top + chartH - h - 6);

    // X labels
    ctx.fillStyle = "#444444";
    ctx.font = "11px sans-serif";
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