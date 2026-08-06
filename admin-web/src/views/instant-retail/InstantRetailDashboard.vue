<template>
  <div class="page">
    <div class="dashboard-header">
      <h2 class="page-title">即时零售数据看板</h2>
      <div class="header-actions">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :shortcuts="dateShortcuts"
          style="width: 260px; margin-right: 12px"
          @change="loadData"
        />
        <el-select v-model="platformFilter" placeholder="全部平台" clearable style="width: 140px; margin-right: 12px" @change="loadData">
          <el-option label="全部平台" value="" />
          <el-option label="美团外卖" value="MEITUAN" />
          <el-option label="饿了么" value="ELEME" />
          <el-option label="京东到家" value="JD" />
          <el-option label="自有小程序" value="MINIAPP" />
        </el-select>
        <el-button @click="loadData">
          <el-icon style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 指标卡片 -->
    <el-row :gutter="16" class="metrics-row">
      <el-col :span="6">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-content">
            <div class="metric-icon" style="background: var(--el-color-primary-light-9); color: var(--el-color-primary);">
              <el-icon :size="28"><Tickets /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-label">今日订单数</div>
              <div class="metric-value">{{ metrics.todayOrders }}</div>
              <div class="metric-compare">
                较昨日
                <span :class="metrics.orderTrend >= 0 ? 'trend-up' : 'trend-down'">
                  {{ metrics.orderTrend >= 0 ? '+' : '' }}{{ metrics.orderTrend }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-content">
            <div class="metric-icon" style="background: var(--el-color-warning-light-9); color: var(--el-color-warning);">
              <el-icon :size="28"><Clock /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-label">待处理订单</div>
              <div class="metric-value">{{ metrics.pendingOrders }}</div>
              <div class="metric-compare">
                含
                <span class="urgent-count">{{ metrics.urgentOrders }}</span> 单即将超时
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-content">
            <div class="metric-icon" style="background: var(--el-color-success-light-9); color: var(--el-color-success);">
              <el-icon :size="28"><Coin /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-label">今日销售额</div>
              <div class="metric-value">¥{{ formatNumber(metrics.todaySales) }}</div>
              <div class="metric-compare">
                较昨日
                <span :class="metrics.salesTrend >= 0 ? 'trend-up' : 'trend-down'">
                  {{ metrics.salesTrend >= 0 ? '+' : '' }}{{ metrics.salesTrend }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="metric-card" shadow="hover">
          <div class="metric-content">
            <div class="metric-icon" :style="syncStatusStyle">
              <el-icon :size="28"><Connection /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-label">同步状态</div>
              <div class="metric-value">
                <el-tag :type="syncStatusType" size="small">{{ syncStatusText }}</el-tag>
              </div>
              <div class="metric-compare">
                最近同步：{{ metrics.lastSyncTime || '暂无' }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="16" class="charts-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header">
              <span class="chart-title">近7日订单趋势</span>
              <el-radio-group v-model="trendMetric" size="small" @change="loadTrendData">
                <el-radio-button value="orders">订单数</el-radio-button>
                <el-radio-button value="sales">销售额</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-placeholder">
            <div class="simple-bar-chart">
              <div v-for="(item, i) in trendData" :key="i" class="bar-col">
                <div class="bar-value">{{ trendMetric === 'orders' ? item.orders : '¥' + formatNumber(item.sales) }}</div>
                <div class="bar-wrapper">
                  <div
                    class="bar-fill"
                    :style="{
                      height: getBarHeight(item, i) + '%',
                      background: trendMetric === 'orders' ? 'var(--el-color-primary)' : 'var(--el-color-success)'
                    }"
                  ></div>
                </div>
                <div class="bar-label">{{ item.date }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span class="chart-title">平台订单分布</span>
          </template>
          <div class="platform-distribution">
            <div v-for="p in platformData" :key="p.name" class="platform-item">
              <div class="platform-header">
                <span class="platform-name">{{ p.name }}</span>
                <span class="platform-count">{{ p.count }}单</span>
              </div>
              <el-progress
                :percentage="p.percent"
                :color="p.color"
                :stroke-width="12"
                :show-text="false"
              />
              <span class="platform-percent">{{ p.percent }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近订单列表 -->
    <el-card class="recent-orders">
      <template #header>
        <div class="chart-header">
          <span class="chart-title">最近订单</span>
          <el-button text type="primary" @click="$router.push('/instant-retail/orders')">
            查看全部
            <el-icon style="margin-left: 4px"><ArrowRight /></el-icon>
          </el-button>
        </div>
      </template>
      <el-table :data="recentOrders" v-loading="loading" stripe size="small">
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="平台" width="100">
          <template #default="{ row }">
            <el-tag :type="getPlatformTagType(row.platform)" size="small">{{ getPlatformName(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="userName" label="用户" width="100" />
        <el-table-column label="金额" width="100" align="right">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.payAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">{{ getStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="160" />
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="$router.push('/instant-retail/orders')">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { CHART_COLORS } from "@/styles/theme";
import { Tickets, Clock, Coin, Connection, Refresh, ArrowRight } from "@element-plus/icons-vue";

const loading = ref(false);
const dateRange = ref<[string, string] | null>(null);
const platformFilter = ref("");
const trendMetric = ref("orders");

const dateShortcuts = [
  { text: "今天", value: () => { const d = new Date(); const s = formatDate(d); return [s, s] as [string, string]; } },
  { text: "昨天", value: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = formatDate(d); return [s, s] as [string, string]; } },
  { text: "最近7天", value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [formatDate(start), formatDate(end)] as [string, string]; } },
  { text: "最近30天", value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [formatDate(start), formatDate(end)] as [string, string]; } }
];

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatNumber(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString();
}

// ==================== 指标卡片 ====================
const metrics = reactive({
  todayOrders: 0,
  pendingOrders: 0,
  urgentOrders: 0,
  todaySales: 0,
  orderTrend: 0,
  salesTrend: 0,
  lastSyncTime: ""
});

const syncStatus = reactive({
  successCount: 0,
  failCount: 0,
  lastSyncTime: ""
});

const syncStatusType = computed(() => {
  if (syncStatus.failCount > 0 && syncStatus.successCount === 0) return "danger";
  if (syncStatus.failCount > 0) return "warning";
  if (syncStatus.successCount > 0) return "success";
  return "info";
});

const syncStatusText = computed(() => {
  if (syncStatus.failCount > 0 && syncStatus.successCount === 0) return "同步异常";
  if (syncStatus.failCount > 0) return "部分失败";
  if (syncStatus.successCount > 0) return "同步正常";
  return "暂无同步";
});

const syncStatusStyle = computed(() => {
  const type = syncStatusType.value;
  const colorMap: Record<string, string> = {
    danger: "var(--el-color-danger-light-9)",
    warning: "var(--el-color-warning-light-9)",
    success: "var(--el-color-success-light-9)",
    info: "var(--el-color-info-light-9)"
  };
  const textColorMap: Record<string, string> = {
    danger: "var(--el-color-danger)",
    warning: "var(--el-color-warning)",
    success: "var(--el-color-success)",
    info: "var(--el-color-info)"
  };
  return {
    background: colorMap[type] || colorMap.info,
    color: textColorMap[type] || textColorMap.info
  };
});

// ==================== 趋势图 ====================
const trendData = ref<any[]>([]);
const maxBarValue = ref(100);

function getBarHeight(item: any, _index: number) {
  const val = trendMetric.value === "orders" ? item.orders : item.sales;
  return maxBarValue.value > 0 ? Math.round((val / maxBarValue.value) * 100) : 0;
}

function loadTrendData() {
  const mock = [
    { date: "07-01", orders: 45, sales: 3280 },
    { date: "07-02", orders: 52, sales: 4150 },
    { date: "07-03", orders: 38, sales: 2890 },
    { date: "07-04", orders: 61, sales: 5020 },
    { date: "07-05", orders: 48, sales: 3760 },
    { date: "07-06", orders: 55, sales: 4480 },
    { date: "07-07", orders: 42, sales: 3210 }
  ];
  trendData.value = mock;
  const vals = mock.map(m => trendMetric.value === "orders" ? m.orders : m.sales);
  maxBarValue.value = Math.max(...vals, 1);
}

// ==================== 平台分布 ====================
const platformData = ref<any[]>([]);

function loadPlatformData() {
  const mock = [
    { name: "美团外卖", count: 128, percent: 38, color: CHART_COLORS.danger },
    { name: "饿了么", count: 95, percent: 28, color: CHART_COLORS.primary },
    { name: "京东到家", count: 52, percent: 15, color: CHART_COLORS.success },
    { name: "自有小程序", count: 66, percent: 19, color: CHART_COLORS.warning }
  ];
  platformData.value = mock;
}

// ==================== 最近订单 ====================
const recentOrders = ref<any[]>([]);

const statusMap: Record<string, { name: string; type: string }> = {
  PENDING: { name: "待确认", type: "primary" },
  CONFIRMED: { name: "已确认", type: "" },
  PREPARING: { name: "备货中", type: "warning" },
  DELIVERING: { name: "配送中", type: "info" },
  COMPLETED: { name: "已完成", type: "success" },
  CANCELLED: { name: "已取消", type: "info" },
  REFUNDED: { name: "已退款", type: "danger" }
};

const platformMap: Record<string, { name: string; type: string }> = {
  MEITUAN: { name: "美团外卖", type: "danger" },
  ELEME: { name: "饿了么", type: "primary" },
  JD: { name: "京东到家", type: "success" },
  MINIAPP: { name: "自有小程序", type: "warning" }
};

function getStatusName(status: string) { return statusMap[status]?.name || status; }
function getStatusTagType(status: string) { return statusMap[status]?.type || "info"; }
function getPlatformName(platform: string) { return platformMap[platform]?.name || platform; }
function getPlatformTagType(platform: string) { return platformMap[platform]?.type || "info"; }

function loadData() {
  loading.value = true;
  setTimeout(() => {
    // 模拟指标数据
    metrics.todayOrders = 55;
    metrics.pendingOrders = 12;
    metrics.urgentOrders = 3;
    metrics.todaySales = 4480;
    metrics.orderTrend = 8.5;
    metrics.salesTrend = 12.3;
    metrics.lastSyncTime = "10分钟前";

    syncStatus.successCount = 320;
    syncStatus.failCount = 0;
    syncStatus.lastSyncTime = "2026-07-06 14:30:00";

    // 最近订单
    recentOrders.value = [
      { id: 1, orderNo: "IR20260706000001", platform: "MEITUAN", userName: "张三", payAmount: 68.5, status: "CONFIRMED", createdAt: "2026-07-06 14:25:00" },
      { id: 2, orderNo: "IR20260706000002", platform: "ELEME", userName: "李四", payAmount: 128.0, status: "PENDING", createdAt: "2026-07-06 14:20:00" },
      { id: 3, orderNo: "IR20260706000003", platform: "MINIAPP", userName: "王五", payAmount: 45.6, status: "PREPARING", createdAt: "2026-07-06 14:15:00" },
      { id: 4, orderNo: "IR20260706000004", platform: "JD", userName: "赵六", payAmount: 89.9, status: "DELIVERING", createdAt: "2026-07-06 14:10:00" },
      { id: 5, orderNo: "IR20260706000005", platform: "MEITUAN", userName: "钱七", payAmount: 35.0, status: "COMPLETED", createdAt: "2026-07-06 14:00:00" }
    ];

    loading.value = false;
  }, 300);

  loadTrendData();
  loadPlatformData();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  align-items: center;
}
.metrics-row {
  margin-bottom: 16px;
}
.metric-card {
  border-radius: 8px;
}
.metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
.metric-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.metric-info {
  flex: 1;
  min-width: 0;
}
.metric-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.metric-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}
.metric-compare {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.trend-up {
  color: var(--el-color-success);
  font-weight: 500;
}
.trend-down {
  color: var(--el-color-danger);
  font-weight: 500;
}
.urgent-count {
  color: var(--el-color-danger);
  font-weight: 600;
}
.charts-row {
  margin-bottom: 16px;
}
.chart-card {
  border-radius: 8px;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chart-title {
  font-weight: 600;
  font-size: 15px;
}
.chart-placeholder {
  height: 280px;
  display: flex;
  align-items: flex-end;
}
.simple-bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  width: 100%;
  height: 100%;
  padding: 0 20px;
}
.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}
.bar-value {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  white-space: nowrap;
}
.bar-wrapper {
  width: 36px;
  height: 200px;
  background: var(--el-fill-color-light);
  border-radius: 6px 6px 0 0;
  position: relative;
  overflow: hidden;
}
.bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 6px 6px 0 0;
  transition: height 0.5s ease;
  min-height: 4px;
}
.bar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
.platform-distribution {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.platform-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.platform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.platform-name {
  font-size: 14px;
  font-weight: 500;
}
.platform-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.platform-percent {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
}
.recent-orders {
  border-radius: 8px;
}
.amount-text {
  font-weight: 500;
  color: var(--el-color-danger);
}
</style>