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
                {{ dbStatus.connection === 'connected' ? '正常' : dbStatus.connection === 'error' ? '异常' : '断开' }}
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
              <div class="stat-value">{{ apiStats.avgResponseTime }}ms</div>
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
      <el-table
        :data="expiringTenants"
        size="small"
        @selection-change="handleTenantSelection"
        empty-text="暂无即将到期的租户"
      >
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
import * as echarts from "echarts";
import { Refresh, Monitor, DataLine, Warning, Timer, Bell } from "@element-plus/icons-vue";
import { fetchDbStatus, fetchApiStats, fetchExpiringTenants, notifyExpiringTenants } from "../api";

interface DbStatus {
  connection: "connected" | "disconnected" | "error";
  database: string;
  uptime: number;
  tableCount: number;
}

interface ApiStats {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  statusCodes: Record<number, number>;
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
  totalRequests: 0,
  errorCount: 0,
  errorRate: 0,
  avgResponseTime: 0,
  statusCodes: {},
  todayErrorCount: 0,
  weeklyErrorTrend: [],
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
    const data = await fetchDbStatus();
    dbStatus.value = data;
  } catch {
    dbStatus.value = { connection: "error", database: "", uptime: 0, tableCount: 0 };
  }
}

async function loadApiStats() {
  try {
    const data = await fetchApiStats();
    apiStats.value = data;
    await nextTick();
    renderCharts();
  } catch {
    apiStats.value = {
      totalRequests: 0,
      errorCount: 0,
      errorRate: 0,
      avgResponseTime: 0,
      statusCodes: {},
      todayErrorCount: 0,
      weeklyErrorTrend: [],
    };
  }
}

async function loadExpiringTenants() {
  try {
    const data = await fetchExpiringTenants();
    expiringTenants.value = data;
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
  renderErrorTrendChart();
  renderStatusCodeChart();
}

function renderErrorTrendChart() {
  if (!errorTrendChartRef.value) return;
  if (!errorTrendChart) {
    errorTrendChart = echarts.init(errorTrendChartRef.value);
  }

  const dates = apiStats.value.weeklyErrorTrend.map((d) => d.date);
  const counts = apiStats.value.weeklyErrorTrend.map((d) => d.count);

  errorTrendChart.setOption(
    {
      tooltip: { trigger: "axis" },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "8%", containLabel: true },
      xAxis: { type: "category", data: dates, boundaryGap: false },
      yAxis: { type: "value", min: 0 },
      series: [
        {
          name: "错误数",
          type: "line",
          data: counts,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2, color: "#f56c6c" },
          itemStyle: { color: "#f56c6c" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(245,108,108,0.3)" },
              { offset: 1, color: "rgba(245,108,108,0.05)" },
            ]),
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderStatusCodeChart() {
  if (!statusCodeChartRef.value) return;
  if (!statusCodeChart) {
    statusCodeChart = echarts.init(statusCodeChartRef.value);
  }

  statusCodeChart.setOption(
    {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { type: "scroll", orient: "vertical", right: 10, top: "center", itemWidth: 12, itemHeight: 12 },
      series: [
        {
          type: "pie",
          radius: ["50%", "75%"],
          center: ["40%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
          data: statusCodeData(),
        },
      ],
    },
    { notMerge: true }
  );
}

function handleResize() {
  errorTrendChart?.resize();
  statusCodeChart?.resize();
}

onMounted(async () => {
  await refreshData();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  errorTrendChart?.dispose();
  statusCodeChart?.dispose();
});
</script>

<style scoped>
.monitor-page {
  padding: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-card :deep(.el-card__body) {
  padding: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.db-icon {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: #fff;
}

.request-icon {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #fff;
}

.error-icon {
  background: linear-gradient(135deg, #f56c6c 0%, #f89898 100%);
  color: #fff;
}

.response-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
  color: #fff;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-value.warning {
  color: #f56c6c;
}

.stat-value.connected {
  color: #67c23a;
}

.stat-value.error {
  color: #f56c6c;
}

.stat-value.disconnected {
  color: #e6a23c;
}

.stat-detail {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.chart-card {
  min-height: 320px;
}

.chart-card :deep(.el-card__body) {
  padding: 12px 16px;
}

.chart-container {
  width: 100%;
  height: 260px;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 260px;
}

.tenant-card :deep(.el-table__row:hover) {
  background: #f5f7fa;
}

.danger {
  color: #f56c6c;
  font-weight: 600;
}

.warning {
  color: #e6a23c;
  font-weight: 600;
}
</style>