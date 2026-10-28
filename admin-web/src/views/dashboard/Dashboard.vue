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
          aria-label="选择门店"
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
      <!-- 概览失败态：显式提示 + 重试（WB-AUDIT-01；失败不伪装成 0） -->
      <div v-if="metricsState === 'error'" class="metric-strip-error" data-testid="metrics-error">
        <span>今日指标加载失败：{{ metricsError }}</span>
        <button type="button" class="metric-strip-retry" data-testid="metrics-retry" @click="reloadMetrics()">重试</button>
      </div>
    </el-card>

    <el-row :gutter="16">
      <!-- ====== 左：经营动态信息流 ====== -->
      <el-col :xs="24" :md="16" class="dash-col dash-col--left">
        <el-card class="feed-card feed-card--feed" shadow="hover" tabindex="0">
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
                <el-button size="small" :icon="Refresh" circle aria-label="刷新经营动态" @click="loadAllData" />
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
                  :class="{ 'feed-item--locked': !item.route }"
                  :tabindex="item.route ? 0 : -1"
                  :role="item.route ? 'button' : undefined"
                  :aria-disabled="item.route ? undefined : 'true'"
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
                    <span v-if="item.route" class="feed-arrow">›</span>
                    <span v-else class="feed-arrow feed-arrow--locked">不可跳转</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </el-card>

        <!-- 本月销售趋势 -->
        <el-card class="feed-card feed-card--trend" shadow="hover">
          <template #header>
            <div class="feed-header">
              <span class="feed-title">本月销售趋势</span>
            </div>
          </template>
          <div v-if="salesTrendData.length === 0" class="chart-empty">
            <el-empty description="暂无销售数据" :image-size="80" />
          </div>
          <div
            v-else
            ref="salesTrendChartRef"
            class="trend-chart"
            tabindex="0"
            role="region"
            aria-label="本月销售趋势图表"
          />
        </el-card>
      </el-col>

      <!-- ====== 右：今日经营 / 待办预警 / 快捷入口 ====== -->
      <el-col :xs="24" :md="8" class="dash-col dash-col--right">
        <!-- 最新订单（原待办位） -->
        <el-card class="side-card side-card--fill" shadow="hover" tabindex="0">
          <template #header>
            <div class="side-header">
              <span class="side-title">最新订单</span>
              <span class="side-sub">共 {{ recentBills.length }} 单</span>
            </div>
          </template>
          <div v-if="recentBills.length === 0" class="side-empty">暂无最新订单</div>
          <div v-else class="order-list">
            <div
              v-for="b in recentBills"
              :key="b.billNo || b.id"
              class="order-item"
              :class="{ 'order-item--locked': !b.route }"
              :tabindex="b.route ? 0 : -1"
              :role="b.route ? 'button' : undefined"
              :aria-disabled="b.route ? undefined : 'true'"
              @click="b.route && navTo(b.route)"
            >
              <div class="order-main">
                <div class="order-no-row">
                  <span class="order-no">{{ b.billNo || "-" }}</span>
                  <span class="order-source">{{ b.source || "线下门店" }}</span>
                </div>
                <div class="order-customer">{{ b.customerName || "-" }}</div>
              </div>
              <div class="order-side">
                <span class="order-amount">¥{{ formatNum(b.receivableAmount) }}</span>
                <el-tag size="small" :type="billStatusType(b.businessStatus)">{{ billStatusText(b.businessStatus) }}</el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 待办与预警（WB-AUDIT-02：改为消费真实 /dashboard/todos 平铺数组，四态可区分） -->
        <el-card class="side-card side-card--fill" shadow="hover" tabindex="0">
          <template #header>
            <div class="side-header">
              <span class="side-title">待办与预警</span>
              <span v-if="todoState === 'ready'" class="side-badge">{{ todoGroups.totalItems }}</span>
            </div>
          </template>

          <!-- ① loading -->
          <div v-if="todoState === 'loading'" class="side-empty" data-testid="todo-loading">加载中…</div>

          <!-- ② error：**不得伪装成"今日无待办"**，必须显式报错 + 重试 -->
          <div v-else-if="todoState === 'error'" class="side-error" data-testid="todo-error">
            <span class="side-error-text">待办加载失败：{{ todoError }}</span>
            <button class="side-retry" type="button" data-testid="todo-retry" @click="reloadTodos()">重试</button>
          </div>

          <!-- ③ empty：真的没有待办 -->
          <div v-else-if="todoState === 'empty'" class="side-empty" data-testid="todo-empty">今日无待办事项</div>

          <!-- ④ ready：真实待办分区渲染 -->
          <div v-else class="todo-list" data-testid="todo-list">
            <div
              v-for="(item, i) in todoGroups.ordered"
              :key="`${item.type}-${i}`"
              class="todo-item"
              tabindex="0"
              role="button"
              :data-todo-type="item.type"
              @click="item.link && navTo(item.link)"
            >
              <span class="todo-dot" :class="todoDotClass(item.priority)"></span>
              <span class="todo-text">{{ item.title || item.type }}</span>
              <span v-if="item.count > 1" class="todo-count">×{{ item.count }}</span>
              <span v-if="item.subtitle" class="todo-sub">{{ item.subtitle }}</span>
              <span class="todo-arrow">›</span>
            </div>
          </div>
        </el-card>

        <!-- 快捷入口（原本页可帮你） -->
        <el-card class="side-card" shadow="hover">
          <template #header><span class="side-title">快捷入口</span></template>
          <!-- WB-AUDIT-06/10：可见项由目标路由 meta.roles 派生，不再写死六项 -->
          <div class="quick-grid">
            <div v-for="e in quickEntries" :key="e.key" class="quick-cell" :title="e.pageTitle" @click="navTo(e.target)">
              {{ e.label }}
            </div>
            <div v-if="quickEntries.length === 0" class="quick-empty">当前角色无可用快捷入口</div>
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
  fetchDashboardTodos,
  fetchReportProfit,
} from "../../api/report";
/**
 * 唯一字段适配器（WORKBENCH-07 硬验收 §2）：管理 Dashboard 与门店工作台**共用**
 * `admin-web/src/utils/dashboard-contract.ts`，禁止各自手写字段映射。
 */
import {
  CUSTOMER_MEMBERS_ROUTE,
  groupTodos,
  monthRange,
  parseDashboardOverview,
  parseDashboardTodos,
  parseProfitGross,
  resolveDataState,
  todayRange,
  type DashboardMetrics,
  type TodoGroups,
} from "../../utils/dashboard-contract";
import { fetchSaleBills, fetchMembers, fetchStores } from "../../api";
import { fetchReceipts } from "../../api/finance";
import { fetchNotifications } from "../../api/system";
import { fetchInstantOrders } from "../../api/instant-retail";
/**
 * 唯一导航适配器（WORKBENCH-08 硬验收 §1/§3/§4）：
 * 入口可见性与动态链接可达性**只由真实路由 meta.roles 派生**，
 * 页面内不得出现任何角色清单或"可点但会被守卫拦回"的链接。
 */
import {
  collectRouteEntries,
  decorateNavTarget,
  mergeRecentOrders,
  visibleQuickEntries,
  type RouteEntry,
} from "../../utils/dashboard-navigation";

const router = useRouter();
const auth = useAuthStore();

// 真相源：router 实例的真实路由记录（与契约测试解析 router/index.ts 得到同一套 RouteEntry）
const routeEntries = ref<RouteEntry[]>(collectRouteEntries(router));
// 当前登录角色（来自登录态，不在页面内硬编码）
const currentRoles = computed<string[]>(() => auth.userRoles ?? []);

const userName = computed(() => auth.userName || "管理员");
const storeList = ref<any[]>([]);
const selectedStoreIds = ref<number[]>([]);
const feedLoading = ref(false);
const feedFilter = ref("ALL");

const overview = ref<any>({});
const alertData = ref<any>({ inventoryAlerts: [], expiryAlerts: [], overdueReceivables: [], pendingOrders: [] });

// ── 四态数据（WORKBENCH-07：loading / empty / ready / error 必须可区分）──
/** 概览四态（今日/本月指标） */
const metricsLoading = ref(true);
const metricsError = ref<string | null>(null);
const metrics = ref<DashboardMetrics | null>(null);
/** 待办四态（真实 /dashboard/todos） */
const todosLoading = ref(true);
const todosError = ref<string | null>(null);
const todosRaw = ref<import("../../utils/dashboard-contract").TodoItem[] | null>(null);
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

/**
 * 今日指标（WB-AUDIT-01）。
 * **字段全部来自共享适配器 `parseDashboardOverview`**：后端嵌套 `today.salesAmount` 等，
 * 旧代码读扁平 `d.todaySalesAmount` ⇒ 恒为 0。
 */
const todayMetrics = computed(() => {
  const m = metrics.value;
  if (metricsLoading.value) {
    return [
      { label: "今日销售额", value: "…", accent: false },
      { label: "今日订单", value: "…", accent: false },
      { label: "今日毛利", value: "…", accent: false },
      { label: "待办事项", value: "…", accent: false },
    ];
  }
  if (metricsError.value || !m) {
    // 失败**不伪装成 0**：显式显示不可用
    return [
      { label: "今日销售额", value: "—", accent: false },
      { label: "今日订单", value: "—", accent: false },
      { label: "今日毛利", value: "—", accent: false },
      { label: "待办事项", value: todoState.value === "error" ? "—" : `${todoGroups.value.totalItems} 项`, accent: false },
    ];
  }
  // 毛利来自 reports/profit；未取到 ⇒ null ⇒ 显示"—"（**不填 0**）
  const grossText = m.today.grossProfit === null ? "—" : `¥${formatNum(m.today.grossProfit)}`;
  return [
    { label: "今日销售额", value: `¥${formatNum(m.today.salesAmount)}`, accent: true },
    { label: "今日订单", value: `${m.today.orderCount} 单`, accent: false },
    { label: "今日毛利", value: grossText, accent: false },
    {
      label: "待办事项",
      value: todoState.value === "error" ? "—" : `${todoGroups.value.totalItems} 项`,
      accent: todoGroups.value.totalItems > 0,
    },
  ];
});

/** 待办展示态（loading / empty / ready / error）——失败绝不等于空 */
const todoState = computed(() =>
  resolveDataState(todosLoading.value, todosError.value, todosRaw.value ? todosRaw.value.length : null),
);
/** 概览指标展示态（同上四态口径） */
const metricsState = computed(() => resolveDataState(metricsLoading.value, metricsError.value, metrics.value ? 1 : null));
/** 待办分组（按 type/priority 归一；不预设固定类目，后端加类型也不丢） */
const todoGroups = computed<TodoGroups>(() => groupTodos(todosRaw.value ?? []));
const todoError = computed(() => todosError.value ?? "");

/** 待办项左侧圆点按 priority 着色 */
function todoDotClass(priority: string): string {
  const map: Record<string, string> = {
    urgent: "todo-dot--danger",
    important: "todo-dot--warning",
  };
  return map[priority] ?? "todo-dot--primary";
}

/** 待办失败重试（独立于整页刷新，避免牵连其它区块） */
async function reloadTodos() {
  todosLoading.value = true;
  todosError.value = null;
  try {
    const raw = await fetchDashboardTodos();
    const parsed = parseDashboardTodos(raw);
    if (!parsed.ok) {
      todosError.value = parsed.reason;
      todosRaw.value = null;
    } else {
      todosRaw.value = parsed.data;
    }
  } catch (e: any) {
    // ⚠️ 失败**不得**当空数组：置 error，保留 null 让 UI 走错误态
    todosError.value = e?.message || "请求失败";
    todosRaw.value = null;
  } finally {
    todosLoading.value = false;
  }
}

/** 概览失败重试（含毛利补取） */
async function reloadMetrics() {
  metricsLoading.value = true;
  metricsError.value = null;
  try {
    const [ov, gross] = await Promise.all([
      fetchDashboardOverview(),
      // 毛利失败**不拖垮整块**：取不到即 null（UI 显示"—"）
      fetchReportProfit(todayRange()).catch(() => null),
    ]);
    const parsed = parseDashboardOverview(ov, parseProfitGross(gross));
    if (!parsed.ok) {
      metricsError.value = parsed.reason;
      metrics.value = null;
    } else {
      metrics.value = parsed.data;
    }
  } catch (e: any) {
    metricsError.value = e?.message || "请求失败";
    metrics.value = null;
  } finally {
    metricsLoading.value = false;
  }
}

// ==================== 入口与动态链接权限（WB-AUDIT-06/09/10） ====================
/** 快捷入口：按当前角色对目标路由 meta.roles 的可见性派生（不再写死六项） */
const quickEntries = computed(() => visibleQuickEntries(routeEntries.value, currentRoles.value));

/**
 * 动态条目挂目标链接：**无权 ⇒ route 为 null**，模板据此置为不可点击，
 * 绝不保留"可点击但会被路由守卫拦回"的链接（R101 WB-AUDIT-09）。
 */
function navTarget(target: string): string | null {
  return decorateNavTarget(routeEntries.value, currentRoles.value, target).route;
}

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

/** 订单来源渠道中文名（平台订单/小程序） */
const CHANNEL_SOURCE_LABELS: Record<string, string> = {
  JD: "京东",
  MEITUAN: "美团",
  ELEME: "饿了么",
  WECHAT: "小程序",
  DOUYIN: "抖音",
  OFFLINE: "线下门店",
  MINIAPP: "小程序",
};

function channelSourceLabel(platform: string): string {
  const key = String(platform || "").toUpperCase();
  return CHANNEL_SOURCE_LABELS[key] || key || "其他渠道";
}

/** 平台订单（京东/美团等）转最新订单统一结构 */
function channelOrderToBill(o: any) {
  let data: any = {};
  try {
    data = JSON.parse(o.orderDataJson || "{}");
  } catch {
    /* 忽略解析失败，使用默认值 */
  }
  return {
    billNo: o.platformOrderId || o.orderNo || "-",
    customerName: data.customerName || data.receiverName || data.buyerName || "渠道客户",
    receivableAmount: Number(data.amount ?? data.payAmount ?? data.totalAmount ?? 0),
    businessStatus: o.status,
    createdAt: o.createdAt,
    source: channelSourceLabel(o.platform),
    route: "/order-center",
  };
}

/** 线下销售单来源：优先门店名，其次“线下门店” */
function offlineSourceLabel(b: any): string {
  if (b.storeId && storeList.value.length) {
    const s = storeList.value.find((x: any) => String(x.id) === String(b.storeId));
    if (s?.storeName || s?.name) return s.storeName || s.name;
  }
  return "线下门店";
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
      // WB-AUDIT-09：生成时校验目标 route 权限，无权 ⇒ null（不可点击）
      route: navTarget(b.billNo ? `/sale-bills/${encodeURIComponent(b.billNo)}` : "/sale-bills"),
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
      route: navTarget("/finance/receipts"),
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
      route: navTarget(CUSTOMER_MEMBERS_ROUTE),
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
      // WB-AUDIT-10：库存预警指向预警页 /inventory-alerts（/inventory 是库存列表页）
      route: navTarget("/inventory-alerts"),
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
      route: navTarget("/inventory-alerts"),
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
      route: navTarget("/credit"),
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
      route: navTarget("/orders"),
    });
  }

  list.sort((a, b) => (parseTime(b.time)?.getTime() || 0) - (parseTime(a.time)?.getTime() || 0));
  // 经营动态全部展示（上限 50 条防接口数据过大），卡片内滚动查看
  feedList.value = list.slice(0, 50);
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
/** 构建本月 1 号至今天的按天趋势（无销售的天补 0，保证折线连续） */
function buildMonthlyDailyTrend(data: any[]): any[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${y}-${pad(m)}`;
  const byDate = new Map<string, any>();
  for (const d of data || []) {
    if (String(d.date).startsWith(prefix)) byDate.set(String(d.date).slice(0, 10), d);
  }
  const today = now.getDate();
  const out: any[] = [];
  for (let day = 1; day <= today; day++) {
    const key = `${prefix}-${pad(day)}`;
    const row = byDate.get(key);
    out.push({
      date: key,
      salesAmount: row ? Number(row.salesAmount ?? 0) : 0,
      orderCount: row ? Number(row.orderCount ?? 0) : 0,
    });
  }
  return out;
}

function renderSalesTrendChart() {
  if (!salesTrendChartRef.value || salesTrendData.value.length === 0) return;
  if (!salesTrendChart) {
    salesTrendChart = echarts.init(salesTrendChartRef.value);
  }
  // 按天展示：本月 1 号至今天的每日销售额/订单数，X 轴显示中文日期
  const daily = buildMonthlyDailyTrend(salesTrendData.value);
  const dates = daily.map((d) => `${Number(d.date.slice(8, 10))}日`);
  const amounts = daily.map((d) => d.salesAmount);
  const orders = daily.map((d) => d.orderCount);
  salesTrendChart.setOption({
    // 全局字体中文优先，避免数字/英文使用默认西文字体显得突兀
    textStyle: {
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
    },
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: {
      data: ["销售额", "订单数"],
      bottom: 0,
      itemWidth: 14,
      itemHeight: 10,
      textStyle: { fontSize: 12, color: "#606266" },
    },
    // 底部留白固定像素，确保图例与 X 轴日期完整显示不截断
    grid: { left: 8, right: 8, bottom: 46, top: 32, containLabel: true },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: false,
      axisLabel: {
        rotate: dates.length > 14 ? 45 : 0,
        color: "#909399",
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: "#DCDFE6" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "金额(元)",
        nameLocation: "middle",
        nameGap: 48,
        nameTextStyle: { fontSize: 12, color: "#909399" },
        axisLabel: {
          formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()),
          color: "#909399",
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: "#F2F3F5", type: "dashed" } },
      },
      {
        type: "value",
        name: "订单数",
        nameLocation: "middle",
        nameGap: 48,
        nameTextStyle: { fontSize: 12, color: "#909399" },
        axisLabel: {
          formatter: (v: number) => v.toString(),
          color: "#909399",
          fontSize: 11,
        },
        splitLine: { show: false },
      },
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
  // 指标与待办各自独立加载（互不拖垮，失败也不伪装成空）
  void reloadMetrics();
  void reloadTodos();
  try {
    const results = await Promise.allSettled([
      fetchDashboardOverview(),
      fetchDashboardRecentAlerts(),
      fetchSaleBills({ page: 1, pageSize: 100 }),
      fetchReceipts({ page: 1, pageSize: 6 }),
      fetchNotifications({ page: 1, pageSize: 8 }),
      fetchMembers({ page: 1, pageSize: 6 }),
      fetchStores(),
      fetchDashboardSalesTrend(),
      fetchInstantOrders({ page: 1, pageSize: 100 }),
    ]);
    if (results[0].status === "fulfilled") overview.value = results[0].value || {};
    if (results[1].status === "fulfilled") alertData.value = results[1].value || {};
    if (results[6].status === "fulfilled") storeList.value = results[6].value || [];
    if (results[7].status === "fulfilled") salesTrendData.value = Array.isArray(results[7].value) ? results[7].value : [];

    // 兜底：overview 里没有动态数据时，从各列表接口组装
    const bills = results[2].status === "fulfilled" ? (results[2].value?.records || []) : [];
    const receipts = results[3].status === "fulfilled" ? (results[3].value?.records || []) : [];
    const notices = results[4].status === "fulfilled" ? (results[4].value?.records || []) : [];
    const members = results[5].status === "fulfilled" ? (results[5].value?.records || []) : [];
    // 最新订单：只显示进行中的（过滤已完成/作废/退货），合并多渠道来源，固定展示 10 条
    const activeBills = bills.filter((b: any) => !["COMPLETED", "VOIDED", "RETURNED"].includes(b.businessStatus));
    if (!overview.value.recentBills && activeBills.length) overview.value.recentBills = activeBills.slice(0, 10);
    if (!overview.value.recentReceipts && receipts.length) overview.value.recentReceipts = receipts.slice(0, 5);
    if (!overview.value.recentMembers && members.length) overview.value.recentMembers = members.slice(0, 5);
    if (!overview.value.recentNotices && notices.length) overview.value.recentNotices = notices.slice(0, 6);
    const overviewActiveBills = (overview.value.recentBills || []).filter(
      (b: any) => !["COMPLETED", "VOIDED", "RETURNED"].includes(b.businessStatus)
    );
    const channelOrders = results[8].status === "fulfilled" ? (results[8].value?.records || []) : [];
    const channelItems = channelOrders
      .filter((o: any) => !["COMPLETED", "CANCELLED", "VOIDED", "RETURNED"].includes(o.status))
      .map((o: any) => {
        const bill = channelOrderToBill(o);
        // WB-AUDIT-09：渠道订单目标 /order-center 仅 SUPER_ADMIN 可见，无权 ⇒ null（不可点击）
        return { ...bill, route: navTarget(bill.route) };
      });
    const offlineItems = (overviewActiveBills.length ? overviewActiveBills : activeBills)
      .map((b: any) => ({
        ...b,
        source: offlineSourceLabel(b),
        route: navTarget(b.billNo ? `/sale-bills/${encodeURIComponent(b.billNo)}` : "/sale-bills"),
      }));
    // WB-AUDIT-07：线下 10 条与渠道订单合并后**最终截断到 10 条**
    // （渠道订单接口仍按原分页取数，但无论返回多少条，进 DOM 的永远 ≤ 10）
    recentBills.value = mergeRecentOrders({
      offline: offlineItems,
      channel: channelItems,
      getTime: (b: any) => parseTime(b.createdAt)?.getTime() ?? null,
    }).items;
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
  /* el-col 自带 display:block 且后加载会覆盖 flex，必须 !important 保证列内卡片纵向布局生效 */
  display: flex !important;
  flex-direction: column;
}
/* 注意：不能给列设 height:100%——el-row 高度由内容决定(非显式)，百分比高度会失效并破坏 align-items:stretch，
   导致列高退回内容高度、flex 填充卡片被压缩为 0。靠 stretch 自然等高即可底部对齐。 */
/* 卡片间距用 margin 替代 flex gap：兼容不支持 flex gap 的浏览器（旧内核/兼容模式），保证卡片之间始终有 16px 间距 */
.dash-col > .el-card {
  margin-bottom: 16px;
}
.dash-col > .el-card:last-child {
  margin-bottom: 0;
}
/* 左列：经营动态与趋势图固定高度，内容过多时卡片内部滚动，避免被信息拉伸 */
.dash-col--left .feed-card--feed {
  height: 400px;
  display: flex;
  flex-direction: column;
}
.dash-col--left .feed-card--feed :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.dash-col--left .feed-card--trend {
  /* 固定高度：左列总高(400+16+420)作为行高基准，右列 height:100% 据此填满，避免 flex 循环压缩 */
  height: 420px;
  display: flex;
  flex-direction: column;
}
.dash-col--left .feed-card--trend :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  padding: 8px 20px 12px;
}
/* 右列：三卡片与左列底部对齐，最新订单/待办等高均分，快捷入口固定高度 */
.dash-col--right {
  display: flex;
  flex-direction: column;
}
.dash-col--right .side-card--fill {
  /* 固定等高（内容过多时内部滚动），两卡片始终对齐，不被信息拉伸 */
  flex: 1 1 0;
  min-height: 0;
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
  color: #595959; /* WCAG AA */
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
  color: #595959; /* WCAG AA */
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
/* 无权跳转的条目：明确不可点击（WB-AUDIT-09：不留"可点但会被守卫拦回"的链接） */
.feed-item--locked,
.order-item--locked {
  cursor: default;
}
.feed-item--locked:hover {
  background: transparent;
}
.order-item--locked:hover .order-no {
  color: var(--text-regular);
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
  color: #595959; /* WCAG AA */
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
  color: #595959; /* WCAG AA */
}
.feed-arrow {
  color: #595959; /* WCAG AA */
  font-size: 14px;
}
.feed-arrow--locked {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.trend-chart {
  width: 100%;
  height: 100%;
}
.chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
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
  color: #595959; /* WCAG AA */
}
.metric-strip-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.metric-num--accent {
  /* S3-64（A-8）：前景收编为 token --metric-accent（tokens.css），在 --bg-soft #F0F0F0 上 = 5.02:1 ≥ 4.5 */
  color: var(--metric-accent);
}
.side-sub {
  font-size: 12px;
  color: #595959; /* WCAG AA */
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
  color: var(--color-primary-text);
}
.order-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.order-no-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.order-no {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.order-source {
  font-size: 10px;
  line-height: 16px;
  color: #595959; /* WCAG AA */
  background: var(--bg-soft);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 0 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.order-customer {
  font-size: 12px;
  color: #595959; /* WCAG AA */
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
  color: #595959; /* WCAG AA */
  font-size: 13px;
  padding: 12px 0;
}
/* 待办失败态（WB-AUDIT-02）：显式报错 + 重试，**不得**与空态共用样式 */
.side-error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  font-size: 13px;
  color: #b42318;
}
.side-error-text {
  line-height: 1.5;
}
.side-retry {
  align-self: flex-start;
  padding: 3px 12px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.side-retry:hover {
  background: rgba(180, 35, 24, 0.08);
}
/* 指标条失败提示 */
.metric-strip-error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(180, 35, 24, 0.35);
  font-size: 12px;
  color: #b42318;
}
.metric-strip-retry {
  padding: 2px 10px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
/* 待办条目附加信息 */
.todo-count {
  margin-left: 6px;
  color: #595959;
  font-size: 12px;
}
.todo-sub {
  margin-left: 8px;
  color: #8c8c8c;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
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
  color: var(--color-primary-text);
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
  color: #595959; /* WCAG AA */
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
  color: #595959; /* WCAG AA */
  cursor: pointer;
  transition: all 150ms ease;
}
.quick-cell:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-text);
  background: var(--color-primary-bg);
}
/* 当前角色无任何可用入口（由 meta.roles 派生后为空）时的占位，避免空卡片误导 */
.quick-empty {
  grid-column: 1 / -1;
  padding: var(--space-4);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* WCAG AA：Element 组件对比度覆盖（el-select 占位符 / el-radio-button 激活态） */
.dashboard :deep(.el-select__placeholder span) {
  color: #595959;
}
.dashboard :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: #2f5fd0;
  border-color: #2f5fd0;
  box-shadow: -1px 0 0 0 #2f5fd0;
}
.dashboard :deep(.el-tag--success .el-tag__content) {
  color: #0f5132;
}
.dashboard :deep(.el-tag--primary .el-tag__content) {
  color: #2f5fd0;
}
</style>
