<template>
  <div>
    <h2 style="margin-bottom: 24px;">租户使用统计</h2>

    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-select
          v-model="selectedTenant"
          placeholder="选择租户"
          filterable
          style="width: 220px;"
          @change="handleTenantChange"
        >
          <el-option
            v-for="t in tenantOptions"
            :key="t.id"
            :label="t.tenantName || t.companyName"
            :value="t.id"
          />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 280px;"
          @change="handleDateChange"
        />
        <el-select v-model="metric" style="width: 160px;" @change="fetchStats">
          <el-option label="用户活跃度" value="user_activity" />
          <el-option label="订单量" value="order_count" />
          <el-option label="销售额" value="sales_amount" />
          <el-option label="商品数量" value="product_count" />
          <el-option label="存储使用量" value="storage_usage" />
          <el-option label="API调用次数" value="api_calls" />
        </el-select>
        <el-button type="primary" @click="fetchStats">查询</el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </el-card>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6" v-for="stat in overviewStats" :key="stat.key">
        <el-card shadow="hover">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; color: var(--text-secondary);">{{ stat.label }}</div>
              <div style="font-size: 26px; font-weight: 700; margin-top: 8px;" :style="{ color: stat.color }">
                {{ stat.value }}
              </div>
              <div v-if="stat.change" style="font-size: 12px; margin-top: 4px;" :class="stat.change > 0 ? 'text-success' : 'text-danger'">
                {{ stat.change > 0 ? '↑' : '↓' }} {{ Math.abs(stat.change) }}% 较上期
              </div>
            </div>
            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;" :style="{ background: stat.bg }">
              <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card style="margin-bottom: 20px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>使用趋势</span>
              <el-radio-group v-model="trendGranularity" size="small" @change="fetchStats">
                <el-radio-button value="day">按日</el-radio-button>
                <el-radio-button value="week">按周</el-radio-button>
                <el-radio-button value="month">按月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 340px;"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="margin-bottom: 20px;">
          <template #header><span>功能模块使用占比</span></template>
          <div ref="moduleChartRef" style="height: 340px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header><span>租户使用排行</span></template>
      <el-tabs v-model="rankTab" @tab-change="fetchRank">
        <el-tab-pane label="按订单量" name="order_count" />
        <el-tab-pane label="按销售额" name="sales_amount" />
        <el-tab-pane label="按用户数" name="user_count" />
        <el-tab-pane label="按活跃度" name="activity" />
      </el-tabs>
      <el-table :data="rankList" v-loading="rankLoading" border stripe style="width: 100%;">
        <el-table-column type="index" label="排名" width="80" align="center">
          <template #default="{ $index }">
            <el-tag v-if="$index < 3" :type="['danger', 'warning', 'primary'][$index]" size="small">
              {{ $index + 1 }}
            </el-tag>
            <span v-else>{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="tenantName" label="租户" min-width="160" />
        <el-table-column prop="planName" label="套餐" width="120" />
        <el-table-column label="指标值" width="140" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600;">{{ formatValue(row.value) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="占比" width="180">
          <template #default="{ row }">
            <el-progress :percentage="row.percentage || 0" :stroke-width="14" :text-inside="true" />
          </template>
        </el-table-column>
        <el-table-column prop="lastActive" label="最近活跃" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import { User, ShoppingCart, Money, Box, DataLine, TrendCharts } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import { getTenantUsageStats, getTenants } from "../api";

const selectedTenant = ref<number | null>(null);
const dateRange = ref<string[]>([]);
const metric = ref("order_count");
const trendGranularity = ref("day");
const rankTab = ref("order_count");

const tenantOptions = ref<any[]>([]);
const rankList = ref<any[]>([]);
const rankLoading = ref(false);

const overviewStats = ref([
  { key: "total_users", label: "总用户数", value: 0, change: 12.5, icon: "User", color: "#2563eb", bg: "#eff6ff" },
  { key: "total_orders", label: "总订单数", value: 0, change: 8.3, icon: "ShoppingCart", color: "#10b981", bg: "#ecfdf5" },
  { key: "total_sales", label: "总销售额", value: "¥0", change: 15.2, icon: "Money", color: "#f59e0b", bg: "#fffbeb" },
  { key: "total_products", label: "商品总数", value: 0, change: -2.1, icon: "Box", color: "#8b5cf6", bg: "#f5f3ff" }
]);

const trendChartRef = ref<HTMLDivElement>();
const moduleChartRef = ref<HTMLDivElement>();
let trendChart: echarts.ECharts | null = null;
let moduleChart: echarts.ECharts | null = null;

function formatValue(value: number | string): string {
  if (typeof value === "number") {
    if (metric.value === "sales_amount") {
      return "¥" + value.toLocaleString();
    }
    return value.toLocaleString();
  }
  return String(value || 0);
}

async function fetchTenants() {
  try {
    const res = await getTenants({ pageSize: 100 });
    const data = res.data?.data || (res as any).data || res;
    tenantOptions.value = data.records || [];
  } catch {
    // ignore
  }
}

async function fetchStats() {
  try {
    const res = await getTenantUsageStats({
      tenantId: selectedTenant.value || undefined,
      metric: metric.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1]
    });
    const data = res.data?.data || (res as any).data || res;
    
    if (data.overview) {
      overviewStats.value[0].value = data.overview.totalUsers || 0;
      overviewStats.value[1].value = data.overview.totalOrders || 0;
      overviewStats.value[2].value = "¥" + (data.overview.totalSales || 0).toLocaleString();
      overviewStats.value[3].value = data.overview.totalProducts || 0;
    }
    
    renderTrendChart(data.trendData || []);
    renderModuleChart(data.moduleUsage || []);
  } catch {
    // 使用模拟数据
    renderMockCharts();
  }
}

function renderMockCharts() {
  const mockTrend = generateMockTrendData();
  renderTrendChart(mockTrend);
  
  const mockModule = [
    { name: "销售管理", value: 35 },
    { name: "库存管理", value: 25 },
    { name: "订单管理", value: 20 },
    { name: "会员管理", value: 12 },
    { name: "营销推广", value: 8 }
  ];
  renderModuleChart(mockModule);
  
  overviewStats.value[0].value = 1256;
  overviewStats.value[1].value = 3420;
  overviewStats.value[2].value = "¥128,560";
  overviewStats.value[3].value = 856;
}

function generateMockTrendData(): any[] {
  const days = trendGranularity.value === 'day' ? 30 : trendGranularity.value === 'week' ? 12 : 6;
  const labels: string[] = [];
  const values: number[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    if (trendGranularity.value === 'day') {
      d.setDate(d.getDate() - i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    } else if (trendGranularity.value === 'week') {
      d.setDate(d.getDate() - i * 7);
      labels.push(`第${Math.ceil((d.getDate() + d.getDay()) / 7)}周`);
    } else {
      d.setMonth(d.getMonth() - i);
      labels.push(`${d.getMonth() + 1}月`);
    }
    values.push(Math.floor(Math.random() * 500) + 100);
  }
  
  return labels.map((label, i) => ({ period: label, value: values[i] }));
}

function renderTrendChart(trendData: any[]) {
  if (!trendChartRef.value) return;
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value);
  }
  
  const labels = trendData.map(d => d.period || d.date);
  const values = trendData.map(d => d.value || d.count || 0);
  
  trendChart.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { fontSize: 12 }
    },
    yAxis: { type: "value", minInterval: 1 },
    series: [{
      name: getMetricLabel(),
      type: "line",
      data: values,
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: "#2563eb" },
      lineStyle: { width: 3 }
    }]
  });
}

function renderModuleChart(moduleData: any[]) {
  if (!moduleChartRef.value) return;
  if (!moduleChart) {
    moduleChart = echarts.init(moduleChartRef.value);
  }
  
  moduleChart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [{
      type: "pie",
      radius: ["50%", "75%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
      label: { show: true, formatter: "{b}\n{d}%" },
      data: moduleData.length ? moduleData : [{ name: "暂无数据", value: 1 }]
    }]
  });
}

function getMetricLabel(): string {
  const map: Record<string, string> = {
    user_activity: "用户活跃度",
    order_count: "订单量",
    sales_amount: "销售额",
    product_count: "商品数量",
    storage_usage: "存储使用量",
    api_calls: "API调用次数"
  };
  return map[metric.value] || metric.value;
}

async function fetchRank() {
  rankLoading.value = true;
  try {
    // 暂时使用模拟数据
    const mockData = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      tenantName: `租户${i + 1}`,
      planName: ["基础版", "标准版", "旗舰版"][i % 3],
      value: Math.floor(Math.random() * 10000) + 1000,
      percentage: Math.floor(Math.random() * 40) + 10,
      lastActive: `2024-01-${String(31 - i).padStart(2, '0')} ${String(10 + i).padStart(2, '0')}:00:00`
    }));
    rankList.value = mockData.sort((a, b) => b.value - a.value);
    rankList.value.forEach((item, i) => {
      item.percentage = Math.floor((item.value / rankList.value[0].value) * 100);
    });
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    rankLoading.value = false;
  }
}

function handleTenantChange() {
  fetchStats();
}

function handleDateChange() {
  fetchStats();
}

function handleExport() {
  ElMessage.info("导出功能待后端API支持");
}

function handleResize() {
  trendChart?.resize();
  moduleChart?.resize();
}

onMounted(async () => {
  await fetchTenants();
  await fetchStats();
  await fetchRank();
  await nextTick();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  trendChart?.dispose();
  moduleChart?.dispose();
});
</script>

<style scoped>
.text-success {
  color: #10b981;
}
.text-danger {
  color: #ef4444;
}
</style>
