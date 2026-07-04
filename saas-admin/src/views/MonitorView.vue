<template>
  <div class="monitor-page">
    <el-card class="stats-card">
      <template #header>
        <div class="card-header">
          <span>系统概览</span>
          <el-button size="small" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-item">
            <div class="stat-icon db-icon">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">数据库状态</div>
              <div class="stat-value" :class="dbStatus.connection">
                {{ dbStatus.connection === 'connected' ? '正常' : '异常' }}
              </div>
              <div class="stat-detail">表数量: {{ dbStatus.tableCount }}</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-item">
            <div class="stat-icon request-icon">
              <el-icon><DataLine /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">API请求数</div>
              <div class="stat-value">{{ formatNumber(apiStats.totalRequests) }}</div>
              <div class="stat-detail">今日错误: {{ apiStats.todayErrorCount }}</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-item">
            <div class="stat-icon error-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">错误率</div>
              <div class="stat-value" :class="apiStats.errorRate > 5 ? 'warning' : ''">
                {{ apiStats.errorRate }}%
              </div>
              <div class="stat-detail">总错误: {{ apiStats.errorCount }}</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat-item">
            <div class="stat-icon response-icon">
              <el-icon><Timer /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">平均响应时间</div>
              <div class="stat-value">{{ apiStats.avgResponseTime !== null ? apiStats.avgResponseTime + 'ms' : '暂无' }}</div>
              <div class="stat-detail">响应状态码分布</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :sm="12">
        <el-card class="chart-card">
          <template #header>
            <span>近7天错误趋势</span>
          </template>
          <div ref="errorTrendChartRef" class="chart-container" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card class="chart-card">
          <template #header>
            <span>状态码分布</span>
          </template>
          <div v-if="statusCodeData.length === 0" class="chart-empty">
            <el-empty description="暂无数据" :image-size="80" />
          </div>
          <div v-else ref="statusCodeChartRef" class="chart-container" />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="tenant-card" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>即将到期租户</span>
          <el-button type="primary" size="small" @click="handleNotifyTenants" :disabled="selectedTenants.length === 0">
            <el-icon><Bell /></el-icon>
            发送通知 ({{ selectedTenants.length }})
          </el-button>
        </div>
      </template>
      <el-table :data="expiringTenants" size="small" @selection-change="handleTenantSelection" empty-text="暂无即将到期的租户">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="companyName" label="公司名称" min-width="180" />
        <el-table-column prop="tenantCode" label="租户编码" width="120" />
        <el-table-column prop="contactPerson" label="联系人" width="100" />
        <el-table-column prop="contactMobile" label="联系电话" width="130" />
        <el-table-column prop="expireAt" label="到期日期" width="120" />
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <span :class="row.daysLeft <= 3 ? 'danger' : row.daysLeft <= 7 ? 'warning' : ''">
              {{ row.daysLeft }}天
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Monitor, DataLine, Warning, Timer, Bell } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import { fetchDbStatus, fetchApiStats, fetchExpiringTenants, notifyExpiringTenants } from "../api";

interface DbStatus {
  connection: string;
  database: string;
  uptime: number;
  tableCount: number;
}

interface ApiStats {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number | null;
  statusCodes: Record<string, number>;
  todayErrorCount: number;
  weeklyErrorTrend: { date: string; count: number }[];
}

interface ExpiringTenant {
  id: number;
  tenantCode: string;
  companyName: string;
  contactPerson: string;
  contactMobile: string;
  expireAt: string;
  daysLeft: number;
}

const dbStatus = ref<DbStatus>({ connection: "disconnected", database: "", uptime: 0, tableCount: 0 });
const apiStats = ref<ApiStats>({
  totalRequests: 0, errorCount: 0, errorRate: 0, avgResponseTime: null,
  statusCodes: {}, todayErrorCount: 0, weeklyErrorTrend: [],
});
const expiringTenants = ref<ExpiringTenant[]>([]);
const selectedTenants = ref<number[]>([]);
const errorTrendChartRef = ref<HTMLElement | null>(null);
const statusCodeChartRef = ref<HTMLElement | null>(null);
let errorTrendChart: echarts.ECharts | null = null;
let statusCodeChart: echarts.ECharts | null = null;

function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

const statusCodeData = () => {
  return Object.entries(apiStats.value.statusCodes).map(([code, count]) => ({
    name: `HTTP ${code}`,
    value: count,
    itemStyle: {
      color: code.startsWith("2") ? "#67c23a" : code.startsWith("3") ? "#e6a23c" : code.startsWith("4") ? "#f56c6c" : "#909399",
    },
  }));
};

async function refreshData() {
  await Promise.all([loadDbStatus(), loadApiStats(), loadExpiringTenants()]);
  ElMessage.success("数据已刷新");
}

async function loadDbStatus() {
  try {
    const { data } = await fetchDbStatus();
    dbStatus.value = data.data;
  } catch {
    dbStatus.value = { connection: "error", database: "", uptime: 0, tableCount: 0 };
  }
}

async function loadApiStats() {
  try {
    const { data } = await fetchApiStats();
    apiStats.value = data.data;
    await nextTick();
    renderCharts();
  } catch {
    /* ignore */
  }
}

async function loadExpiringTenants() {
  try {
    const { data } = await fetchExpiringTenants();
    expiringTenants.value = data.data || [];
  } catch {
    expiringTenants.value = [];
  }
}

function handleTenantSelection(rows: any[]) {
  selectedTenants.value = rows.map((r) => r.id);
}

async function handleNotifyTenants() {
  if (selectedTenants.value.length === 0) return;
  try {
    await notifyExpiringTenants(selectedTenants.value);
    ElMessage.success(`已向 ${selectedTenants.value.length} 个租户发送通知`);
    selectedTenants.value = [];
  } catch {
    ElMessage.error("发送通知失败");
  }
}

function renderCharts() {
  if (errorTrendChartRef.value) {
    if (!errorTrendChart) errorTrendChart = echarts.init(errorTrendChartRef.value);
    errorTrendChart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: apiStats.value.weeklyErrorTrend.map((d) => d.date.slice(5)) },
      yAxis: { type: "value" },
      series: [{ data: apiStats.value.weeklyErrorTrend.map((d) => d.count), type: "line", smooth: true, areaStyle: { color: "rgba(26,115,232,.1)" }, lineStyle: { color: "#1a73e8" }, itemStyle: { color: "#1a73e8" } }],
    });
  }
  if (statusCodeChartRef.value) {
    if (!statusCodeChart) statusCodeChart = echarts.init(statusCodeChartRef.value);
    statusCodeChart.setOption({
      tooltip: { trigger: "item" },
      series: [{ type: "pie", radius: ["40%", "70%"], data: statusCodeData(), label: { show: false } }],
    });
  }
}

function handleResize() {
  errorTrendChart?.resize();
  statusCodeChart?.resize();
}

onMounted(async () => {
  await Promise.all([loadDbStatus(), loadApiStats(), loadExpiringTenants()]);
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  errorTrendChart?.dispose();
  statusCodeChart?.dispose();
});
</script>

<style scoped>
.monitor-page { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.stat-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
.db-icon { background: #dbeafe; color: #2563eb; }
.request-icon { background: #e0e7ff; color: #4f46e5; }
.error-icon { background: #fee2e2; color: #dc2626; }
.response-icon { background: #d1fae5; color: #059669; }
.stat-content { flex: 1; }
.stat-label { font-size: 13px; color: #6b7280; }
.stat-value { font-size: 1.25rem; font-weight: 700; }
.stat-value.connected { color: #16a34a; }
.stat-value.error { color: #dc2626; }
.stat-value.warning { color: #ea580c; }
.stat-detail { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.chart-container { height: 280px; }
.chart-empty { height: 280px; display: flex; align-items: center; justify-content: center; }
.danger { color: #dc2626; font-weight: 600; }
.warning { color: #ea580c; font-weight: 600; }
</style>