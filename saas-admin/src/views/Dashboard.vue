<template>
  <div>
    <h2 style="margin-bottom: 24px;">平台经营看板</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6" v-for="card in statCards" :key="card.key">
        <el-card shadow="hover" v-loading="loading">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">{{ card.label }}</div>
              <div style="font-size: 28px; font-weight: 700; margin-top: 8px; color: var(--brand-primary);">{{ overview[card.key] ?? "--" }}</div>
              <div v-if="card.sub" style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">{{ card.sub }}</div>
            </div>
            <div style="width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center;" :style="{ background: card.bg }">
              <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <!-- 收入趋势 -->
      <el-col :span="16">
        <el-card style="margin-bottom: 20px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>收入趋势（近6个月）</span>
              <el-radio-group v-model="trendType" size="small" @change="fetchOverview">
                <el-radio-button value="MONTHLY">按月</el-radio-button>
                <el-radio-button value="DAILY">按日</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="incomeChartRef" style="height: 340px;"></div>
        </el-card>
      </el-col>

      <!-- 套餐分布 -->
      <el-col :span="8">
        <el-card style="margin-bottom: 20px;">
          <template #header><span>套餐分布</span></template>
          <div ref="planChartRef" style="height: 340px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <!-- 租户状态分布 -->
      <el-col :span="12">
        <el-card style="margin-bottom: 20px;">
          <template #header><span>租户状态分布</span></template>
          <div ref="tenantStatusChartRef" style="height: 300px;"></div>
        </el-card>
      </el-col>

      <!-- 近期开通 -->
      <el-col :span="12">
        <el-card style="margin-bottom: 20px;">
          <template #header><span>近期开通租户</span></template>
          <el-table :data="overview.recentTenants || []" size="small" border stripe max-height="300">
            <el-table-column prop="companyName" label="企业名称" min-width="140" />
            <el-table-column prop="planName" label="套餐" width="100" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'warning'" size="small">
                  {{ row.status === 'ACTIVE' ? '已开通' : '待审核' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="100">
              <template #default="{ row }">{{ (row.createdAt || "").slice(0, 10) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!overview.recentTenants?.length" description="暂无数据" style="margin: 20px 0;" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue";
import * as echarts from "echarts";
import { getPlatformOverview } from "../api";

const loading = ref(false);
const trendType = ref("MONTHLY");
const overview = reactive<any>({});

const statCards = [
  { key: "totalTenants", label: "总租户数", icon: "OfficeBuilding", color: "#2563eb", bg: "#eff6ff", sub: "累计注册" },
  { key: "activeTenants", label: "活跃租户", icon: "UserFilled", color: "#10b981", bg: "#ecfdf5", sub: "当前生效中" },
  { key: "monthlyRevenue", label: "本月收入", icon: "Money", color: "#f59e0b", bg: "#fffbeb", sub: "累计收入: ¥" + (overview.totalRevenue ?? "--") },
  { key: "pendingTenants", label: "待审核", icon: "Clock", color: "#ef4444", bg: "#fef2f2", sub: "待处理申请" }
];

// 图表
const incomeChartRef = ref<HTMLDivElement>();
const planChartRef = ref<HTMLDivElement>();
const tenantStatusChartRef = ref<HTMLDivElement>();
let incomeChart: echarts.ECharts | null = null;
let planChart: echarts.ECharts | null = null;
let tenantStatusChart: echarts.ECharts | null = null;

async function fetchOverview() {
  loading.value = true;
  try {
    const res = await getPlatformOverview();
    const data = res.data?.data || (res as any).data || res;
    Object.assign(overview, data);
    renderCharts(data);
  } catch {
    // 加载失败时用空数据渲染
    renderCharts({});
  } finally {
    loading.value = false;
  }
}

function renderCharts(data: any) {
  renderIncomeChart(data.incomeTrend || []);
  renderPlanChart(data.planDistribution || []);
  renderTenantStatusChart(data.tenantStatus || []);
}

function renderIncomeChart(trend: any[]) {
  if (!incomeChartRef.value) return;
  if (!incomeChart) incomeChart = echarts.init(incomeChartRef.value);
  const months = trend.map((t: any) => t.period || "");
  const amounts = trend.map((t: any) => t.amount || 0);
  incomeChart.setOption({
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: months.length ? months : ["1月", "2月", "3月", "4月", "5月", "6月"] },
    yAxis: { type: "value", axisLabel: { formatter: "¥{value}" } },
    series: [{
      data: amounts.length ? amounts : [0, 0, 0, 0, 0, 0],
      type: "line",
      smooth: true,
      areaStyle: { color: "rgba(37, 99, 235, 0.1)" },
      itemStyle: { color: "#2563eb" }
    }]
  });
}

function renderPlanChart(distribution: any[]) {
  if (!planChartRef.value) return;
  if (!planChart) planChart = echarts.init(planChartRef.value);
  const names = distribution.map((d: any) => d.planName || "");
  const values = distribution.map((d: any) => d.count || 0);
  planChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [{
      type: "pie",
      radius: ["50%", "75%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
      label: { show: true, formatter: "{b}\n{d}%" },
      data: names.length ? names.map((n: string, i: number) => ({ name: n, value: values[i] })) : [{ name: "暂无数据", value: 1 }]
    }]
  });
}

function renderTenantStatusChart(statusData: any[]) {
  if (!tenantStatusChartRef.value) return;
  if (!tenantStatusChart) tenantStatusChart = echarts.init(tenantStatusChartRef.value);
  const names = statusData.length ? statusData.map((s: any) => {
    const map: Record<string, string> = { ACTIVE: "已开通", PENDING: "待审核", SUSPENDED: "已停用", EXPIRED: "已到期", CLOSED: "已关闭" };
    return map[s.status] || s.status;
  }) : ["已开通", "待审核", "已停用", "已到期", "已关闭"];
  const values = statusData.length ? statusData.map((s: any) => s.count || 0) : [0, 0, 0, 0, 0];
  tenantStatusChart.setOption({
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: names, axisLabel: { rotate: 20 } },
    yAxis: { type: "value" },
    series: [{
      data: values,
      type: "bar",
      barWidth: 40,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: (params: any) => {
          const colors = ["#10b981", "#f59e0b", "#ef4444", "#6b7280", "#9ca3af"];
          return colors[params.dataIndex] || "#2563eb";
        }
      }
    }]
  });
}

function handleResize() {
  incomeChart?.resize();
  planChart?.resize();
  tenantStatusChart?.resize();
}

onMounted(() => {
  fetchOverview();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  incomeChart?.dispose();
  planChart?.dispose();
  tenantStatusChart?.dispose();
});
</script>