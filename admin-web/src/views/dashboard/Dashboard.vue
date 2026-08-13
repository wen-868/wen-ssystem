<template>
  <div class="dashboard">
    <!-- 顶部：欢迎语 + 日期 + 快捷开单 + 门店 -->
    <div class="header-bar">
      <div class="header-left">
        <h2 class="welcome-text">{{ greeting }}，{{ userName }}</h2>
        <span class="date-text">{{ formattedDate }}</span>
      </div>
      <div class="header-right">
        <el-button type="primary" size="large" class="quick-cashier-btn" @click="navTo('/sales/create')">
          <el-icon class="quick-cashier-icon"><ShoppingCart /></el-icon>
          开单收银
        </el-button>
        <el-select
          v-model="selectedStoreIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="全部门店"
          clearable
          style="width: 220px"
          @change="loadAllData"
        >
          <el-option v-for="store in storeList" :key="store.id" :label="store.name" :value="store.id" />
        </el-select>
      </div>
    </div>

    <!-- 今日经营：紧凑指标条 -->
    <el-card class="metric-strip" shadow="hover">
      <div class="metric-strip-inner">
        <div v-for="m in todayMetrics" :key="m.label" class="metric-strip-cell">
          <span class="metric-strip-label">{{ m.label }}</span>
          <span class="metric-strip-num" :class="{ 'metric-num--accent': m.accent }">{{ m.value }}</span>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <!-- ====== 左：经营动态信息流 ====== -->
      <el-col :xs="24" :md="16" class="dash-col">
        <el-card class="feed-card" shadow="hover">
          <template #header>
            <div class="feed-header">
              <span class="feed-title">经营动态</span>
              <div class="feed-actions">
                <el-radio-group v-model="feedFilter" size="small">
                  <el-radio-button value="ALL">全部</el-radio-button>
                  <el-radio-button value="SALE">销售</el-radio-button>
                  <el-radio-button value="RECEIPT">收款</el-radio-button>
                  <el-radio-button value="CUSTOMER">客户</el-radio-button>
                  <el-radio-button value="ALERT">预警</el-radio-button>
                  <el-radio-button value="NOTICE">通知</el-radio-button>
                </el-radio-group>
                <el-button size="small" :icon="Refresh" circle @click="loadAllData" />
              </div>
            </div>
          </template>

          <div v-loading="feedLoading" class="feed-body">
            <el-empty v-if="!feedLoading && filteredFeed.length === 0" description="暂无经营动态" />
            <template v-else>
              <div v-for="group in groupedFeed" :key="group.label" class="feed-group">
                <div class="feed-group-label">{{ group.label }}</div>
                <div
                  v-for="item in group.items"
                  :key="item.key"
                  class="feed-item"
                  @click="onFeedClick(item)"
                >
                  <span class="feed-icon" :class="'feed-icon--' + item.type.toLowerCase()">
                    <el-icon><component :is="feedIcon(item.type)" /></el-icon>
                  </span>
                  <div class="feed-body-main">
                    <div class="feed-title-row">
                      <span class="feed-item-title">{{ item.title }}</span>
                      <el-tag v-if="item.tag" size="small" :type="item.tagType || 'info'">{{ item.tag }}</el-tag>
                    </div>
                    <div class="feed-desc">{{ item.desc }}</div>
                  </div>
                  <div class="feed-side">
                    <span class="feed-time">{{ item.timeText }}</span>
                    <span class="feed-arrow">›</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </el-card>

        <!-- 本月销售趋势 -->
        <el-card class="feed-card" shadow="hover">
          <template #header>
            <div class="feed-header">
              <span class="feed-title">本月销售趋势</span>
            </div>
          </template>
          <div v-if="salesTrendData.length === 0" class="chart-empty">
            <el-empty description="暂无销售数据" :image-size="80" />
          </div>
          <div v-else ref="salesTrendChartRef" class="trend-chart" />
        </el-card>
      </el-col>

      <!-- ====== 右：今日经营 / 待办预警 / 快捷入口 ====== -->
      <el-col :xs="24" :md="8" class="dash-col dash-col--right">
        <!-- 最新订单（原待办位） -->
        <el-card class="side-card side-card--fill" shadow="hover">
          <template #header>
            <div class="side-header">
              <span class="side-title">最新订单</span>
              <span class="side-sub">共 {{ recentBills.length }} 单</span>
            </div>
          </template>
          <div v-if="recentBills.length === 0" class="side-empty">暂无最新订单</div>
          <div v-else class="order-list">
            <div v-for="b in recentBills.slice(0, 10)" :key="b.billNo || b.id" class="order-item" @click="navTo(b.billNo ? '/sale-bills/' + encodeURIComponent(b.billNo) : '/sale-bills')">
              <div class="order-main">
                <div class="order-no">{{ b.billNo || "-" }}</div>
                <div class="order-customer">{{ b.customerName || "-" }}</div>
              </div>
              <div class="order-side">
                <span class="order-amount">¥{{ formatNum(b.receivableAmount) }}</span>
                <el-tag size="small" :type="billStatusType(b.businessStatus)">{{ billStatusText(b.businessStatus) }}</el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 待办与预警（原可帮你位） -->
        <el-card class="side-card side-card--fill" shadow="hover">
          <template #header>
            <div class="side-header">
              <span class="side-title">待办与预警</span>
              <span v-if="todoCount > 0" class="side-badge">{{ todoCount }}</span>
            </div>
          </template>
          <div v-if="todoCount === 0" class="side-empty">今日无待办事项</div>
          <div v-else class="todo-list">
            <div v-if="alertData.inventoryAlerts.length" class="todo-item" @click="navTo('/inventory')">
              <span class="todo-dot todo-dot--warning"></span>
              <span class="todo-text">{{ alertData.inventoryAlerts.length }} 项库存预警</span>
              <span class="todo-arrow">›</span>
            </div>
            <div v-if="alertData.expiryAlerts.length" class="todo-item" @click="navTo('/inventory')">
              <span class="todo-dot todo-dot--warning"></span>
              <span class="todo-text">{{ alertData.expiryAlerts.length }} 款商品临期</span>
              <span class="todo-arrow">›</span>
            </div>
            <div v-if="alertData.overdueReceivables.length" class="todo-item" @click="navTo('/credit')">
              <span class="todo-dot todo-dot--danger"></span>
              <span class="todo-text">{{ alertData.overdueReceivables.length }} 笔应收待核销</span>
              <span class="todo-arrow">›</span>
            </div>
            <div v-if="alertData.pendingOrders.length" class="todo-item" @click="navTo('/orders')">
              <span class="todo-dot todo-dot--primary"></span>
              <span class="todo-text">{{ alertData.pendingOrders.length }} 个待处理订单</span>
              <span class="todo-arrow">›</span>
            </div>
          </div>
        </el-card>

        <!-- 快捷入口（原本页可帮你） -->
        <el-card class="side-card" shadow="hover">
          <template #header><span class="side-title">快捷入口</span></template>
          <div class="quick-grid">
            <div class="quick-cell" @click="navTo('/sales/create')">开单收银</div>
            <div class="quick-cell" @click="navTo('/sale-bills')">销售单据</div>
            <div class="quick-cell" @click="navTo('/messages')">消息中心</div>
            <div class="quick-cell" @click="navTo('/inventory')">库存预警</div>
            <div class="quick-cell" @click="navTo('/sales/reports')">销售报表</div>
            <div class="quick-cell" @click="navTo('/customer/members')">客户会员</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import * as echarts from "echarts";
import { Bell, Money, Refresh, ShoppingCart, User, Warning } from "@element-plus/icons-vue";
import { useAuthStore } from "../../stores/auth";
import {
  fetchDashboardOverview,
  fetchDashboardRecentAlerts,
  fetchDashboardSalesTrend,
} from "../../api/report";
import { fetchSaleBills, fetchMembers, fetchStores } from "../../api";
import { fetchReceipts } from "../../api/finance";
import { fetchNotifications } from "../../api/system";

const router = useRouter();
const auth = useAuthStore();

const userName = computed(() => auth.userName || "管理员");
const storeList = ref<any[]>([]);
const selectedStoreIds = ref<number[]>([]);
const feedLoading = ref(false);
const feedFilter = ref("ALL");

const overview = ref<any>({});
const alertData = ref<any>({ inventoryAlerts: [], expiryAlerts: [], overdueReceivables: [], pendingOrders: [] });
const feedList = ref<any[]>([]);
const recentBills = ref<any[]>([]);
const salesTrendData = ref<any[]>([]);
const salesTrendChartRef = ref<HTMLElement | null>(null);
let salesTrendChart: echarts.ECharts | null = null;

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
});

const formattedDate = computed(() => {
  const now = new Date();
  const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
});

function formatNum(v: any): string {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return "0";
  if (n >= 10000) return (n / 10000).toFixed(2) + "万";
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

const todayMetrics = computed(() => {
  const d = overview.value || {};
  return [
    { label: "今日销售额", value: `¥${formatNum(d.todaySalesAmount)}`, accent: true },
    { label: "今日订单", value: `${d.todayOrderCount ?? 0} 单` },
    { label: "今日毛利", value: `¥${formatNum(d.todayGrossProfit)}` },
    { label: "待办事项", value: `${todoCount.value} 项`, accent: todoCount.value > 0 },
  ];
});

const todoCount = computed(() =>
  (alertData.value.inventoryAlerts?.length || 0) +
  (alertData.value.expiryAlerts?.length || 0) +
  (alertData.value.overdueReceivables?.length || 0) +
  (alertData.value.pendingOrders?.length || 0)
);

// ==================== 信息流构建 ====================
function parseTime(v: any): Date | null {
  if (!v) return null;
  const s = String(v).replace("T", " ").replace("Z", "").trim();
  const d = new Date(s.length >= 19 ? s.slice(0, 19) : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayLabel(d: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function timeText(v: any): string {
  const d = parseTime(v);
  if (!d) return "";
  const today = new Date();
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return sameDay ? `今天 ${hh}:${mm}` : `${d.getMonth() + 1}-${d.getDate()} ${hh}:${mm}`;
}

function feedIcon(type: string): any {
  const map: Record<string, any> = {
    SALE: ShoppingCart,
    RECEIPT: Money,
    CUSTOMER: User,
    ALERT: Warning,
    NOTICE: Bell,
  };
  return map[type] || Bell;
}

function billStatusText(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "草稿",
    CREATED: "已创建",
    COMPLETED: "已完成",
    VOIDED: "已作废",
    RETURNED: "已退货",
  };
  return map[s] || s || "";
}

function billStatusType(s: string): any {
  const map: Record<string, string> = {
    DRAFT: "info",
    CREATED: "primary",
    COMPLETED: "success",
    VOIDED: "danger",
    RETURNED: "warning",
  };
  return map[s] || "info";
}

function receiptStatusText(s: string): string {
  return s === "CONFIRMED" ? "已确认" : s === "VOIDED" ? "已作废" : (s || "待确认");
}

function buildFeed() {
  const list: any[] = [];
  const d = alertData.value || {};
  const bills = Array.isArray(d.pendingOrders) ? d.pendingOrders : [];

  // 销售动态
  for (const b of (overview.value?.recentBills || [])) {
    list.push({
      key: `bill-${b.billNo || b.id}`,
      type: "SALE",
      time: b.createdAt,
      title: `销售单 ${b.billNo || ""} 已创建`,
      desc: `客户：${b.customerName || "-"} · 金额 ¥${formatNum(b.receivableAmount)}`,
      tag: billStatusText(b.businessStatus),
      tagType: "success",
      route: b.billNo ? `/sale-bills/${encodeURIComponent(b.billNo)}` : "/sale-bills",
    });
  }
  // 收款动态
  for (const r of (overview.value?.recentReceipts || [])) {
    list.push({
      key: `receipt-${r.receiptNo || r.id}`,
      type: "RECEIPT",
      time: r.createdAt,
      title: `收款 ${r.receiptNo || ""}`,
      desc: `客户：${r.customerName || "-"} · 金额 ¥${formatNum(r.amount)}`,
      tag: receiptStatusText(r.status),
      tagType: "primary",
      route: "/finance/receipts",
    });
  }
  // 客户动态
  for (const m of (overview.value?.recentMembers || [])) {
    list.push({
      key: `member-${m.id || m.name}`,
      type: "CUSTOMER",
      time: m.createdAt,
      title: `新增客户 ${m.name || "-"}`,
      desc: `手机：${m.mobile || "-"}`,
      tag: "新客户",
      tagType: "success",
      route: "/customer/members",
    });
  }
  // 预警动态
  if (d.inventoryAlerts?.length) {
    list.push({
      key: "alert-inventory",
      type: "ALERT",
      time: new Date().toISOString(),
      title: `${d.inventoryAlerts.length} 项库存预警`,
      desc: "部分商品可用库存低于预警阈值，请及时补货",
      tag: "预警",
      tagType: "warning",
      route: "/inventory",
    });
  }
  if (d.expiryAlerts?.length) {
    list.push({
      key: "alert-expiry",
      type: "ALERT",
      time: new Date().toISOString(),
      title: `${d.expiryAlerts.length} 款商品临期`,
      desc: "存在临近保质期的商品，请检查处理",
      tag: "临期",
      tagType: "warning",
      route: "/inventory",
    });
  }
  if (d.overdueReceivables?.length) {
    list.push({
      key: "alert-overdue",
      type: "ALERT",
      time: new Date().toISOString(),
      title: `${d.overdueReceivables.length} 笔应收待核销`,
      desc: "存在逾期应收款项，请及时跟进",
      tag: "应收",
      tagType: "danger",
      route: "/credit",
    });
  }
  if (bills.length) {
    list.push({
      key: "alert-orders",
      type: "ALERT",
      time: new Date().toISOString(),
      title: `${bills.length} 个待处理订单`,
      desc: "有订单等待处理，请及时响应",
      tag: "订单",
      tagType: "primary",
      route: "/orders",
    });
  }

  list.sort((a, b) => (parseTime(b.time)?.getTime() || 0) - (parseTime(a.time)?.getTime() || 0));
  // 经营动态固定展示 10 条
  feedList.value = list.slice(0, 10);
}

const filteredFeed = computed(() => {
  if (feedFilter.value === "ALL") return feedList.value;
  return feedList.value.filter((i) => i.type === feedFilter.value);
});

const groupedFeed = computed(() => {
  const groups: { label: string; items: any[] }[] = [];
  for (const item of filteredFeed.value) {
    const label = dayLabel(parseTime(item.time) || new Date());
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
});

function onFeedClick(item: any) {
  if (item.route) router.push(item.route);
}

function navTo(path: string) {
  router.push(path);
}

// ==================== 本月销售趋势图 ====================
function renderSalesTrendChart() {
  if (!salesTrendChartRef.value || salesTrendData.value.length === 0) return;
  if (!salesTrendChart) {
    salesTrendChart = echarts.init(salesTrendChartRef.value);
  }
  const dates = salesTrendData.value.map((d) => d.date);
  const amounts = salesTrendData.value.map((d) => d.amount);
  const orders = salesTrendData.value.map((d) => d.orderCount);
  salesTrendChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { data: ["销售额", "订单数"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "14%", top: "8%", containLabel: true },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: false,
      axisLabel: { rotate: dates.length > 14 ? 45 : 0 },
    },
    yAxis: [
      {
        type: "value",
        name: "金额 (¥)",
        axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
      },
      { type: "value", name: "订单数", axisLabel: { formatter: (v: number) => v.toString() } },
    ],
    series: [
      {
        name: "销售额",
        type: "line",
        data: amounts,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: "#3F6FEF" },
        itemStyle: { color: "#3F6FEF" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(63,111,239,0.3)" },
            { offset: 1, color: "rgba(63,111,239,0.05)" },
          ]),
        },
      },
      {
        name: "订单数",
        type: "line",
        yAxisIndex: 1,
        data: orders,
        smooth: true,
        symbol: "diamond",
        symbolSize: 6,
        lineStyle: { width: 2, color: "#0EA879" },
        itemStyle: { color: "#0EA879" },
      },
    ],
  });
}

function handleResize() {
  salesTrendChart?.resize();
}

// ==================== 数据加载 ====================
async function loadAllData() {
  feedLoading.value = true;
  try {
    const results = await Promise.allSettled([
      fetchDashboardOverview(),
      fetchDashboardRecentAlerts(),
      fetchSaleBills(),
      fetchReceipts({ page: 1, pageSize: 6 }),
      fetchNotifications({ page: 1, pageSize: 8 }),
      fetchMembers({ page: 1, pageSize: 6 }),
      fetchStores(),
      fetchDashboardSalesTrend(),
    ]);
    if (results[0].status === "fulfilled") overview.value = results[0].value || {};
    if (results[1].status === "fulfilled") alertData.value = results[1].value || { inventoryAlerts: [], expiryAlerts: [], overdueReceivables: [], pendingOrders: [] };
    if (results[6].status === "fulfilled") storeList.value = results[6].value || [];
    if (results[7].status === "fulfilled") salesTrendData.value = Array.isArray(results[7].value) ? results[7].value : [];

    // 兜底：overview 里没有动态数据时，从各列表接口组装
    const bills = results[2].status === "fulfilled" ? (results[2].value?.records || []) : [];
    const receipts = results[3].status === "fulfilled" ? (results[3].value?.records || []) : [];
    const notices = results[4].status === "fulfilled" ? (results[4].value?.records || []) : [];
    const members = results[5].status === "fulfilled" ? (results[5].value?.records || []) : [];
    // 最新订单：只显示进行中的（过滤已完成/作废/退货），固定展示 10 条
    const activeBills = bills.filter((b) => !["COMPLETED", "VOIDED", "RETURNED"].includes(b.businessStatus));
    if (!overview.value.recentBills && activeBills.length) overview.value.recentBills = activeBills.slice(0, 10);
    if (!overview.value.recentReceipts && receipts.length) overview.value.recentReceipts = receipts.slice(0, 5);
    if (!overview.value.recentMembers && members.length) overview.value.recentMembers = members.slice(0, 5);
    if (!overview.value.recentNotices && notices.length) overview.value.recentNotices = notices.slice(0, 6);
    const overviewActiveBills = (overview.value.recentBills || []).filter(
      (b) => !["COMPLETED", "VOIDED", "RETURNED"].includes(b.businessStatus)
    );
    recentBills.value = (overviewActiveBills.length ? overviewActiveBills : activeBills).slice(0, 10);
    buildFeed();
    await nextTick();
    renderSalesTrendChart();
  } finally {
    feedLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener("resize", handleResize);
  loadAllData();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  salesTrendChart?.dispose();
  salesTrendChart = null;
});
</script>

<style scoped>
.dashboard {
  min-height: calc(100vh - var(--topbar-height) - 32px);
}
.dash-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dash-col--right {
  /* 右侧列高度自适应内容，不被左侧大卡片拉伸 */
  align-self: flex-start;
}
.dash-col--right .side-card--fill {
  /* 最新订单、待办与预警：固定等高（内容过多时内部滚动），两卡片始终对齐 */
  height: 190px;
  display: flex;
  flex-direction: column;
}
.dash-col--right .side-card--fill :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.dash-col--right .side-card:not(.side-card--fill) {
  /* 快捷入口：保持自然高度，不拉伸 */
  flex: 0 0 auto;
}
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.welcome-text {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
.date-text {
  font-size: 12px;
  color: var(--text-muted);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.quick-cashier-btn .quick-cashier-icon {
  margin-right: 4px;
}
.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.feed-title,
.side-title {
  font-weight: 600;
  color: var(--text-primary);
}
.feed-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.feed-group {
  margin-bottom: 8px;
}
.feed-group-label {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 0 4px;
  border-bottom: 1px solid var(--border-light);
}
.feed-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms ease;
}
.feed-item:hover {
  background: var(--bg-soft);
}
.feed-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}
.feed-icon--sale {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.feed-icon--receipt {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.feed-icon--customer {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}
.feed-icon--alert {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.feed-icon--notice {
  background: rgba(6, 182, 212, 0.12);
  color: #06b6d4;
}
.feed-body-main {
  flex: 1;
  min-width: 0;
}
.feed-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.feed-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.feed-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}
.feed-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.feed-time {
  font-size: 12px;
  color: var(--text-placeholder);
}
.feed-arrow {
  color: var(--text-placeholder);
  font-size: 14px;
}
.trend-chart {
  width: 100%;
  height: 300px;
}
.chart-empty {
  padding: 20px 0;
}
.metric-strip {
  margin-bottom: 16px;
}
.metric-strip-inner {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.metric-strip-cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius-md);
}
.metric-strip-label {
  font-size: 12px;
  color: var(--text-muted);
}
.metric-strip-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.metric-num--accent {
  color: var(--color-primary);
}
.side-sub {
  font-size: 12px;
  color: var(--text-muted);
}
.order-list {
  display: flex;
  flex-direction: column;
}
.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.order-item:last-child {
  border-bottom: none;
}
.order-item:hover .order-no {
  color: var(--color-primary);
}
.order-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.order-no {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.order-customer {
  font-size: 12px;
  color: var(--text-muted);
}
.order-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.order-amount {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.side-badge {
  background: var(--color-danger);
  color: #fff;
  border-radius: 10px;
  font-size: 12px;
  padding: 0 8px;
  line-height: 20px;
}
.side-empty {
  color: var(--text-placeholder);
  font-size: 13px;
  padding: 12px 0;
}
.todo-list {
  display: flex;
  flex-direction: column;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
}
.todo-item:last-child {
  border-bottom: none;
}
.todo-item:hover {
  color: var(--color-primary);
}
.todo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.todo-dot--warning {
  background: var(--color-warning);
}
.todo-dot--danger {
  background: var(--color-danger);
}
.todo-dot--primary {
  background: var(--color-primary);
}
.todo-text {
  flex: 1;
  font-size: 13px;
}
.todo-arrow {
  color: var(--text-placeholder);
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.quick-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 14px 6px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}
.quick-cell:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
</style>
