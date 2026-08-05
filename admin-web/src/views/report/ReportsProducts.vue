<template>
  <div class="page">
    <PageCard title="商品排行">
      <template #extra>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="loadData"
        />
        <el-select v-model="dimension" style="width: 150px; margin-left: 12px" @change="loadData">
          <el-option label="按销售额" value="sales" />
          <el-option label="按销量" value="qty" />
          <el-option label="按利润" value="profit" />
        </el-select>
        <el-select v-model="topN" style="width: 120px; margin-left: 12px" @change="loadData">
          <el-option label="Top 10" :value="10" />
          <el-option label="Top 20" :value="20" />
          <el-option label="Top 50" :value="50" />
        </el-select>
        <el-button style="margin-left: 12px" @click="loadData">刷新</el-button>
      </template>

      <el-table :data="rankingData" v-loading="loading" stripe>
        <el-table-column label="排名" width="80" align="center">
          <template #default="{ $index }">
            <el-tag v-if="$index === 0" type="danger" size="small">1</el-tag>
            <el-tag v-else-if="$index === 1" type="warning" size="small">2</el-tag>
            <el-tag v-else-if="$index === 2" type="success" size="small">3</el-tag>
            <span v-else>{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品名称" min-width="180" />
        <el-table-column prop="barcode" label="商品编码" width="140" />
        <el-table-column label="销售额" width="140" align="right">
          <template #default="{ row }">
            {{ formatYuan(row.salesAmount) }}
          </template>
        </el-table-column>
        <el-table-column prop="salesQty" label="销量" width="100" align="right" />
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
        <template #empty>
          <el-empty description="暂无数据" :image-size="80" />
        </template>
      </el-table>
    </PageCard>

    <!-- 图表 -->
    <PageCard title="排行图表">
      <div ref="chartRef" class="chart-container"></div>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchReportSalesRanking } from "../../api";

const dateRange = ref<[Date, Date] | null>(null);
const dimension = ref("sales");
const topN = ref(10);
const loading = ref(false);
const rankingData = ref<any[]>([]);
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
    const params: any = { dimension: dimension.value };
    if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
      params.dateStart = formatDateOnly(dateRange.value[0]);
      params.dateEnd = formatDateOnly(dateRange.value[1]);
    }
    const res = await fetchReportSalesRanking(params);
    let list = res?.records || res?.list || res || [];
    list = list.slice(0, topN.value);
    rankingData.value = list;
    await nextTick();
    renderChart();
  } catch {
    rankingData.value = [];
  } finally {
    loading.value = false;
  }
}

function renderChart() {
  if (!chartRef.value) return;
  const data = rankingData.value;
  if (data.length === 0) return;

  const canvas = document.createElement("canvas");
  while (chartRef.value.firstChild) chartRef.value.removeChild(chartRef.value.firstChild);
  chartRef.value.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = chartRef.value.clientWidth;
  const height = 400;
  canvas.width = width;
  canvas.height = height;

  const padding = { top: 20, right: 30, bottom: 20, left: 140 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const valKey = dimension.value === "sales" ? "salesAmount" : dimension.value === "qty" ? "salesQty" : "profit";
  const values = data.map((d: any) => Number(d[valKey]) || 0);
  const labels = data.map((d: any) => d.productName || "");
  const maxVal = Math.max(...values, 1);
  const barH = Math.min(28, chartH / data.length * 0.7);
  const gap = chartH / data.length - barH;

  // Bars
  data.forEach((_: any, i: number) => {
    const y = padding.top + i * (barH + gap);
    const barW = (values[i] / maxVal) * chartW;

    const colors = ["#3F6FEF", "#0EA879", "#D48B3A", "#C0392B", "#999999"];
    ctx.fillStyle = colors[i % colors.length];

    ctx.fillRect(padding.left, y, Math.max(barW, 2), barH);

    // Label
    ctx.fillStyle = "#444444";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    const label = labels[i].length > 12 ? labels[i].substring(0, 12) + "..." : labels[i];
    ctx.fillText(label, padding.left - 10, y + barH / 2 + 4);

    // Value
    ctx.fillStyle = "#333333";
    ctx.textAlign = "left";
    const valText = dimension.value === "qty" ? String(values[i]) : formatYuan(values[i]);
    ctx.fillText(valText, padding.left + barW + 8, y + barH / 2 + 4);
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
  min-height: 400px;
}
</style>