<template>
  <div class="page">
    <PageCard title="应收应付汇总">
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

      <el-tabs v-model="activeTab" @tab-change="loadData">
        <el-tab-pane label="应收汇总" name="receivables">
          <!-- 统计卡片 -->
          <div class="stat-row">
            <div class="stat-card stat-primary">
              <div class="stat-value">{{ formatYuan(arSummary.totalAmount) }}</div>
              <div class="stat-label">总额</div>
            </div>
            <div class="stat-card stat-success">
              <div class="stat-value">{{ formatYuan(arSummary.paidAmount) }}</div>
              <div class="stat-label">已收</div>
            </div>
            <div class="stat-card stat-danger">
              <div class="stat-value">{{ formatYuan(arSummary.unpaidAmount) }}</div>
              <div class="stat-label">未收</div>
            </div>
            <div class="stat-card stat-warning">
              <div class="stat-value">{{ arSummary.billCount }}</div>
              <div class="stat-label">单据数</div>
            </div>
          </div>

          <!-- 图表 -->
          <div class="chart-row">
            <div class="chart-card half">
              <div class="chart-header">
                <span class="chart-title">客户欠款排名 TOP10</span>
              </div>
              <div ref="arBarChartRef" class="chart-body"></div>
            </div>
            <div class="chart-card half">
              <div class="chart-header">
                <span class="chart-title">账龄分析</span>
              </div>
              <div ref="arPieChartRef" class="chart-body"></div>
            </div>
          </div>

          <!-- 明细表格 -->
          <el-table :data="arDetail" v-loading="loading" stripe>
            <el-table-column prop="customerName" label="客户" min-width="140" />
            <el-table-column prop="billNo" label="单据号" width="180" />
            <el-table-column label="金额" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="已收" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.paidAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="余额" width="140" align="right">
              <template #default="{ row }">
                <span :style="{ color: (row.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }">
                  {{ formatYuan(row.balance) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="逾期天数" width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.overdueDays > 90" type="danger">{{ row.overdueDays }}天</el-tag>
                <el-tag v-else-if="row.overdueDays > 30" type="warning">{{ row.overdueDays }}天</el-tag>
                <el-tag v-else-if="row.overdueDays > 0" type="info">{{ row.overdueDays }}天</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="应付汇总" name="payables">
          <!-- 统计卡片 -->
          <div class="stat-row">
            <div class="stat-card stat-primary">
              <div class="stat-value">{{ formatYuan(apSummary.totalAmount) }}</div>
              <div class="stat-label">总额</div>
            </div>
            <div class="stat-card stat-success">
              <div class="stat-value">{{ formatYuan(apSummary.paidAmount) }}</div>
              <div class="stat-label">已付</div>
            </div>
            <div class="stat-card stat-danger">
              <div class="stat-value">{{ formatYuan(apSummary.unpaidAmount) }}</div>
              <div class="stat-label">未付</div>
            </div>
            <div class="stat-card stat-warning">
              <div class="stat-value">{{ apSummary.billCount }}</div>
              <div class="stat-label">单据数</div>
            </div>
          </div>

          <!-- 图表 -->
          <div class="chart-row">
            <div class="chart-card half">
              <div class="chart-header">
                <span class="chart-title">供应商欠款排名 TOP10</span>
              </div>
              <div ref="apBarChartRef" class="chart-body"></div>
            </div>
            <div class="chart-card half">
              <div class="chart-header">
                <span class="chart-title">账龄分析</span>
              </div>
              <div ref="apPieChartRef" class="chart-body"></div>
            </div>
          </div>

          <!-- 明细表格 -->
          <el-table :data="apDetail" v-loading="loading" stripe>
            <el-table-column prop="supplierName" label="供应商" min-width="140" />
            <el-table-column prop="billNo" label="单据号" width="180" />
            <el-table-column label="金额" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="已付" width="140" align="right">
              <template #default="{ row }">
                {{ formatYuan(row.paidAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="余额" width="140" align="right">
              <template #default="{ row }">
                <span :style="{ color: (row.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }">
                  {{ formatYuan(row.balance) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="逾期天数" width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.overdueDays > 90" type="danger">{{ row.overdueDays }}天</el-tag>
                <el-tag v-else-if="row.overdueDays > 30" type="warning">{{ row.overdueDays }}天</el-tag>
                <el-tag v-else-if="row.overdueDays > 0" type="info">{{ row.overdueDays }}天</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import echarts from '@/utils/echarts'
import PageCard from "../../components/PageCard.vue";
import { formatYuan } from "../../utils/format";
import { fetchReceivablesSummary, fetchPayablesSummary } from "../../api";

const activeTab = ref("receivables");
const dateRange = ref<[Date, Date] | null>(null);
const loading = ref(false);

const arSummary = reactive({ totalAmount: 0, paidAmount: 0, unpaidAmount: 0, billCount: 0 });
const apSummary = reactive({ totalAmount: 0, paidAmount: 0, unpaidAmount: 0, billCount: 0 });

const arDetail = ref<any[]>([]);
const apDetail = ref<any[]>([]);

const arBarChartRef = ref<HTMLDivElement>();
const arPieChartRef = ref<HTMLDivElement>();
const apBarChartRef = ref<HTMLDivElement>();
const apPieChartRef = ref<HTMLDivElement>();

let arBarInstance: echarts.ECharts | null = null;
let arPieInstance: echarts.ECharts | null = null;
let apBarInstance: echarts.ECharts | null = null;
let apPieInstance: echarts.ECharts | null = null;

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
    const [arRes, apRes] = await Promise.all([
      fetchReceivablesSummary(params),
      fetchPayablesSummary(params)
    ]);

    if (arRes) {
      arSummary.totalAmount = arRes.totalAmount || 0;
      arSummary.paidAmount = arRes.paidAmount || 0;
      arSummary.unpaidAmount = arRes.unpaidAmount || 0;
      arSummary.billCount = arRes.billCount || 0;
      arDetail.value = arRes.details || arRes.records || [];
    }

    if (apRes) {
      apSummary.totalAmount = apRes.totalAmount || 0;
      apSummary.paidAmount = apRes.paidAmount || 0;
      apSummary.unpaidAmount = apRes.unpaidAmount || 0;
      apSummary.billCount = apRes.billCount || 0;
      apDetail.value = apRes.details || apRes.records || [];
    }

    await nextTick();
    renderCharts();
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  if (activeTab.value === "receivables") {
    renderBarChart(arBarChartRef.value, arBarInstance, arRes?.ranking, "customerName", "amount", "客户欠款排名");
    renderPieChart(arPieChartRef.value, arPieInstance, arRes?.aging);
  } else {
    renderBarChart(apBarChartRef.value, apBarInstance, apRes?.ranking, "supplierName", "amount", "供应商欠款排名");
    renderPieChart(apPieChartRef.value, apPieInstance, apRes?.aging);
  }
}

let arRes: any = null;
let apRes: any = null;

function renderBarChart(el: HTMLDivElement | undefined, instance: echarts.ECharts | null, data: any[], nameKey: string, valueKey: string, title: string) {
  if (!el) return;
  if (!data || data.length === 0) return;
  if (instance) instance.dispose();

  const names = data.map((d: any) => d[nameKey] || "").reverse();
  const values = data.map((d: any) => Number(d[valueKey]) || 0).reverse();

  const chart = echarts.init(el);
  chart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 120, right: 40, top: 10, bottom: 30 },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => formatYuan(v) } },
    yAxis: { type: "category", data: names, axisLabel: { width: 100, overflow: "truncate" } },
    series: [{
      type: "bar",
      data: values,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#3F6FEF" },
          { offset: 1, color: "#0EA879" }
        ])
      }
    }]
  });

  if (activeTab.value === "receivables") arBarInstance = chart;
  else apBarInstance = chart;
}

function renderPieChart(el: HTMLDivElement | undefined, instance: echarts.ECharts | null, data: any[]) {
  if (!el) return;
  if (!data || data.length === 0) return;
  if (instance) instance.dispose();

  const chart = echarts.init(el);
  chart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0 },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      center: ["50%", "45%"],
      data: data.map((d: any) => ({
        name: d.label || d.name || "",
        value: Number(d.value) || 0
      })),
      label: { show: true, formatter: "{b}\n{d}%" },
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 }
    }]
  });

  if (activeTab.value === "receivables") arPieInstance = chart;
  else apPieInstance = chart;
}

onMounted(() => {
  loadData();
  window.addEventListener("resize", renderCharts);
});
</script>

<style scoped>
.stat-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  padding: 20px;
  border-radius: 8px;
  background: var(--bg-page);
  text-align: center;
}

.stat-card.stat-primary { border-left: 4px solid var(--color-primary); }
.stat-card.stat-success { border-left: 4px solid var(--color-success); }
.stat-card.stat-danger { border-left: 4px solid var(--color-danger); }
.stat-card.stat-warning { border-left: 4px solid var(--color-warning); }

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--gray-700);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--gray-400);
}

.chart-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.chart-card {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
}

.chart-card.half {
  flex: 1;
  min-width: 0;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chart-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--gray-700);
}

.chart-body {
  width: 100%;
  height: 320px;
}
</style>