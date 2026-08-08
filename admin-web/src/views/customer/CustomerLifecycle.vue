<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">客户生命周期</h2>
    <p class="page-desc">客户生命周期统计与明细</p>
  </div>
  <div class="page-header-actions">
    <el-button @click="loadData">刷新</el-button>
  </div>
</div>

      

      <el-row :gutter="20" class="stat-row">
        <el-col :span="4" v-for="s in stageStats" :key="s.stage">
          <el-card shadow="never" class="stat-card">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-count">{{ s.count }}</div>
            <div class="stat-pct">{{ s.percentage }}%</div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="12">
          <el-card shadow="never">
            <template #header><span>阶段分布（漏斗）</span></template>
            <div ref="funnelChartRef" class="chart-box" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never">
            <template #header><span>阶段趋势（近12个月）</span></template>
            <div ref="trendChartRef" class="chart-box" />
          </el-card>
        </el-col>
      </el-row>

      <PageCard title="客户明细" style="margin-top: 20px">
        <template #extra>
          <el-select v-model="detailFilter.stage" placeholder="阶段筛选" clearable style="width: 140px" @change="loadDetail">
            <el-option v-for="s in stageOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </template>

        <div class="table-card">
<el-table :data="detailList" v-loading="detailLoading" stripe>
          <el-table-column prop="name" label="客户" min-width="120" />
          <el-table-column prop="lifecycleStage" label="当前阶段" width="100" align="center">
            <template #default="{ row }">{{ stageLabel(row.lifecycleStage) }}</template>
          </el-table-column>
          <el-table-column prop="daysSinceLast" label="停留天数" width="100" align="center" />
          <el-table-column prop="lastConsumeDate" label="最后消费" width="180">
            <template #default="{ row }">{{ formatDate(row.lastConsumeDate) }}</template>
          </el-table-column>
          <el-table-column prop="totalConsumeAmount" label="累计消费" width="140" align="right">
            <template #default="{ row }">¥{{ Number(row.totalConsumeAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <template #empty><el-empty description="暂无数据" :image-size="60" /></template>
        </el-table>

        <div class="table-card-footer">
          <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="detailTotal" :page-size="detailPageSize" :current-page="detailPage" @size-change="(s: number) => { detailPageSize = s; loadDetail(); }" @current-change="(p: number) => { detailPage = p; loadDetail(); }" />
        </div>
</div>
      
    </PageCard>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import { fetchLifecycleStages, fetchLifecycleTrend, fetchLifecycleDetail } from "../../api";

const stageOptions = [
  { value: "POTENTIAL", label: "潜客" },
  { value: "NEW", label: "新客" },
  { value: "ACTIVE", label: "活跃" },
  { value: "DORMANT", label: "沉睡" },
  { value: "LOST", label: "流失" }
];
const stageLabels: Record<string, string> = {
  POTENTIAL: "潜客", NEW: "新客", ACTIVE: "活跃", DORMANT: "沉睡", LOST: "流失"
};
function stageLabel(v: string) { return stageLabels[v] || v; }

const stageStats = ref<any[]>([]);
const funnelChartRef = ref<HTMLDivElement>();
const trendChartRef = ref<HTMLDivElement>();
let funnelChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

const detailList = ref<any[]>([]);
const detailLoading = ref(false);
const detailTotal = ref(0);
const detailPage = ref(1);
const detailPageSize = ref(20);
const detailFilter = reactive({ stage: "" });

async function loadStages() {
  try {
    const data = await fetchLifecycleStages();
    const total = (data || []).reduce((s: number, i: any) => s + (i.count || 0), 0);
    stageStats.value = (data || []).map((item: any) => ({
      stage: item.stage,
      label: stageLabel(item.stage),
      count: item.count || 0,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : 0
    }));
    await nextTick();
    renderFunnelChart();
  } catch { ElMessage.error("加载阶段统计失败"); }
}

function renderFunnelChart() {
  if (!funnelChartRef.value || !stageStats.value.length) return;
  if (!funnelChart) { funnelChart = echarts.init(funnelChartRef.value); }
  funnelChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [{
      type: "funnel",
      left: "10%", top: 20, bottom: 20, width: "80%",
      sort: "descending",
      label: { show: true, position: "inside" },
      data: stageStats.value.map(s => ({ name: s.label, value: s.count }))
    }]
  });
}

async function loadTrend() {
  try {
    const data = await fetchLifecycleTrend();
    await nextTick();
    renderTrendChart(data);
  } catch { /* ignore */ }
}

function renderTrendChart(data: any) {
  if (!trendChartRef.value || !data) return;
  if (!trendChart) { trendChart = echarts.init(trendChartRef.value); }
  const months = data.months || [];
  const series = stageOptions.map((s, i) => ({
    name: s.label,
    type: "line" as const,
    data: (data.series || []).find((d: any) => d.stage === s.value)?.values || [],
    smooth: true
  }));
  trendChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: stageOptions.map(s => s.label), bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value" },
    series
  });
}

async function loadDetail() {
  detailLoading.value = true;
  try {
    const res = await fetchLifecycleDetail({
      page: detailPage.value,
      pageSize: detailPageSize.value,
      stage: detailFilter.stage || undefined
    });
    detailList.value = res.records || res.list || [];
    detailTotal.value = res.total || 0;
  } catch { ElMessage.error("加载明细失败"); }
  finally { detailLoading.value = false; }
}

async function loadData() {
  await Promise.all([loadStages(), loadTrend(), loadDetail()]);
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.stat-row { margin-bottom: 0; }
.stat-card { text-align: center; }
.stat-label { font-size: 13px; color: #999; margin-bottom: 8px; }
.stat-count { font-size: 28px; font-weight: 700; color: var(--gray-700); }
.stat-pct { font-size: 12px; color: var(--color-success); margin-top: 4px; }
.chart-box { width: 100%; height: 320px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>