<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  fetchDashboardOverview,
  fetchDashboardSalesTrend,
  fetchDashboardTopProducts,
  fetchDashboardTopCustomers,
  fetchDashboardCategoryDistribution,
  fetchInventoryAlerts,
  fetchTodoStats,
  fetchQuickEntries,
  fetchNotificationUnreadCount,
  type DashboardOverviewData,
  type DashboardSalesTrendRecord,
  type DashboardTopProduct,
  type DashboardTopCustomer,
  type DashboardCategoryDistribution,
  type InventoryAlertRecord,
  type TodoStats,
  type QuickEntryItem
} from '../api'

const router = useRouter()

/* ========== 加载状态 ========== */
const loading = ref(true)
const refreshing = ref(false)

/* ========== 顶部信息 ========== */
const overview = ref<DashboardOverviewData>({
  todaySalesAmount: 0,
  todayOrderCount: 0,
  todayReceivedAmount: 0,
  pendingDeliveryCount: 0,
  unReceivedAmount: 0,
  todayCustomerCount: 0,
  monthSalesAmount: 0,
  storeId: 0,
  storeName: ''
})
const unreadCount = ref(0)
const todayDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
})

/* ========== 核心指标 ========== */
const metrics = computed(() => [
  {
    label: '今日销售额',
    value: overview.value.todaySalesAmount,
    type: 'money',
    icon: 'chart-trending-o',
    bg: 'var(--color-primary-soft)',
    color: 'var(--color-primary)',
    route: '/orders'
  },
  {
    label: '今日收款额',
    value: overview.value.todayReceivedAmount,
    type: 'money',
    icon: 'cash-back-record',
    bg: '#ECFDF5',
    color: 'var(--color-success)',
    route: '/sale-bills'
  },
  {
    label: '今日订单数',
    value: overview.value.todayOrderCount,
    type: 'number',
    icon: 'orders-o',
    bg: '#FFF7ED',
    color: 'var(--color-warning)',
    route: '/orders'
  },
  {
    label: '待配送订单',
    value: overview.value.pendingDeliveryCount,
    type: 'number',
    icon: 'logistics',
    bg: '#FEF9C3',
    color: '#CA8A04',
    route: '/orders'
  },
  {
    label: '待收款金额',
    value: overview.value.unReceivedAmount,
    type: 'money',
    icon: 'balance-o',
    bg: '#FEF2F2',
    color: 'var(--color-danger)',
    route: '/receivables'
  },
  {
    label: '今日客户数',
    value: overview.value.todayCustomerCount,
    type: 'number',
    icon: 'friends-o',
    bg: '#F3E8FF',
    color: '#9333EA',
    route: '/customers'
  },
  {
    label: '本月销售额',
    value: overview.value.monthSalesAmount,
    type: 'money',
    icon: 'bar-chart-o',
    bg: '#E6F4FF',
    color: '#0284C7',
    route: '/reports'
  },
  {
    label: '今日收款额',
    value: overview.value.todayReceivedAmount,
    type: 'money',
    icon: 'gold-coin-o',
    bg: '#ECFDF5',
    color: 'var(--color-success)',
    route: '/sale-bills'
  }
])

/* ========== 销售趋势 ========== */
const salesTrend = ref<DashboardSalesTrendRecord[]>([])
const maxSalesAmount = computed(() => {
  if (salesTrend.value.length === 0) return 0
  return Math.max(...salesTrend.value.map((d) => d.amount))
})

/* ========== 品类分布 ========== */
const categories = ref<DashboardCategoryDistribution[]>([])

/* ========== Top排行 ========== */
const topProducts = ref<DashboardTopProduct[]>([])
const topCustomers = ref<DashboardTopCustomer[]>([])

/* ========== 库存预警 ========== */
const alerts = ref<InventoryAlertRecord[]>([])

/* ========== 待办 ========== */
const todoStats = ref<TodoStats>({
  totalCount: 0,
  pendingCount: 0,
  typeStats: []
})

const todoTypeMap: Record<string, { label: string; bg: string; color: string }> = {
  INVENTORY: { label: '库存预警', bg: '#FEF2F2', color: 'var(--color-danger)' },
  ORDER: { label: '订单待处理', bg: '#FFF7ED', color: 'var(--color-warning)' },
  CUSTOMER: { label: '客户跟进', bg: '#E6F4FF', color: 'var(--color-primary)' },
  PAYMENT: { label: '收款提醒', bg: '#FEF9C3', color: '#CA8A04' },
  RECEIVABLE: { label: '收款提醒', bg: '#FEF9C3', color: '#CA8A04' }
}

function getTodoLabel(type: string): string {
  return todoTypeMap[type]?.label || type
}

function getTodoBg(type: string): string {
  return todoTypeMap[type]?.bg || '#F0F2F5'
}

function getTodoColor(type: string): string {
  return todoTypeMap[type]?.color || '#666'
}

/* ========== 快捷入口 ========== */
const quickEntries = ref<QuickEntryItem[]>([])

const defaultEntries: QuickEntryItem[] = [
  { id: 1, text: '开单收款', icon: 'cash-back-record', route: '/create-sale', sortOrder: 1, groupName: '销售', visible: true },
  { id: 2, text: '销售单据', icon: 'orders-o', route: '/orders', sortOrder: 2, groupName: '销售', visible: true },
  { id: 3, text: '销售账单', icon: 'bill-o', route: '/sale-bills', sortOrder: 3, groupName: '销售', visible: true },
  { id: 4, text: '采购订单', icon: 'shopping-cart-o', route: '/purchase-orders', sortOrder: 4, groupName: '采购', visible: true },
  { id: 5, text: '采购入库', icon: 'logistics', route: '/purchase-in-stocks', sortOrder: 5, groupName: '采购', visible: true },
  { id: 6, text: '采购退货', icon: 'exchange', route: '/purchase-returns', sortOrder: 6, groupName: '采购', visible: true },
  { id: 7, text: '库存管理', icon: 'bar-chart-o', route: '/inventory', sortOrder: 7, groupName: '库存', visible: true },
  { id: 8, text: '库存调整', icon: 'setting-o', route: '/inventory-adjust', sortOrder: 8, groupName: '库存', visible: true },
  { id: 9, text: '销售退货', icon: 'revoke', route: '/sale-returns', sortOrder: 9, groupName: '退货', visible: true },
  { id: 10, text: '对账单', icon: 'balance-list-o', route: '/statements', sortOrder: 10, groupName: '对账', visible: true },
  { id: 11, text: '应收管理', icon: 'gold-coin-o', route: '/receivables', sortOrder: 11, groupName: '对账', visible: true },
  { id: 12, text: '客户管理', icon: 'friends-o', route: '/customers', sortOrder: 12, groupName: '客户', visible: true }
]

const displayEntries = computed(() => {
  if (quickEntries.value.length > 0) return quickEntries.value
  return defaultEntries
})

/* ========== 工具函数 ========== */
function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function goTo(path: string) {
  router.push(path)
}

function goToNotifications() {
  router.push('/notifications')
}

/* ========== 数据加载 ========== */
async function loadDashboard() {
  loading.value = true
  try {
    const [overviewRes, trendRes, productsRes, customersRes, categoryRes, alertsRes, todoRes, entriesRes, unreadRes] =
      await Promise.all([
        fetchDashboardOverview(),
        fetchDashboardSalesTrend(7),
        fetchDashboardTopProducts(5),
        fetchDashboardTopCustomers(5),
        fetchDashboardCategoryDistribution(),
        fetchInventoryAlerts(),
        fetchTodoStats(),
        fetchQuickEntries('MERCHANT'),
        fetchNotificationUnreadCount()
      ])

    overview.value = overviewRes.data || overview.value
    salesTrend.value = trendRes.data || []
    topProducts.value = productsRes.data || []
    topCustomers.value = customersRes.data || []
    categories.value = (categoryRes.data || []).slice(0, 5)
    alerts.value = alertsRes.data || []
    todoStats.value = todoRes.data || todoStats.value
    quickEntries.value = entriesRes.data || []

    const unreadData = unreadRes.data as any
    unreadCount.value = typeof unreadData === 'object' ? (unreadData.count || unreadData.unreadCount || 0) : (Number(unreadData) || 0)
  } catch {
    // 出错时使用空数据兜底
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadDashboard()
}

/* ========== 轮询未读消息数 ========== */
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const res = await fetchNotificationUnreadCount()
      const unreadData = res.data as any
      unreadCount.value = typeof unreadData === 'object' ? (unreadData.count || unreadData.unreadCount || 0) : (Number(unreadData) || 0)
    } catch {
      // 静默失败
    }
  }, 30000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await loadDashboard()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <section class="page">
    <!-- ========== 骨架屏 ========== -->
    <template v-if="loading">
      <van-skeleton title :row="2" style="margin: 16px" />
      <van-skeleton :row="4" style="margin: 16px" />
      <van-skeleton :row="3" style="margin: 16px" />
    </template>

    <!-- ========== 正式内容 ========== -->
    <template v-else>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh" success-text="刷新成功">

        <!-- 顶部导航栏 -->
        <div class="header-bar">
          <div class="header-left">
            <span class="store-name">{{ overview.storeName || '我的门店' }}</span>
            <span class="header-date">{{ todayDate }}</span>
          </div>
          <div class="header-right" @click="goToNotifications">
            <van-badge :content="unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : ''" :show-zero="false">
              <div class="bell-icon">
                <van-icon name="bell-o" size="22" />
              </div>
            </van-badge>
          </div>
        </div>

        <!-- 核心指标网格 2x4 -->
        <div class="section-title">核心指标</div>
        <van-grid :column-num="4" :border="false" class="metric-grid">
          <van-grid-item
            v-for="(item, idx) in metrics"
            :key="idx"
            @click="goTo(item.route)"
          >
            <template #icon>
              <div class="metric-icon" :style="{ background: item.bg }">
                <van-icon :name="item.icon" :color="item.color" size="20" />
              </div>
            </template>
            <template #text>
              <div class="metric-text">
                <span class="metric-label">{{ item.label }}</span>
                <span class="metric-value" :style="item.type === 'money' && item.value > 0 ? { color: item.color } : {}">
                  <template v-if="item.type === 'money'">¥{{ formatMoney(item.value) }}</template>
                  <template v-else>{{ item.value }}</template>
                </span>
              </div>
            </template>
          </van-grid-item>
        </van-grid>

        <!-- 待办提醒 -->
        <div class="section-row">
          <span class="section-title">待办提醒</span>
          <span class="section-link" @click="goTo('/todos')">查看全部 &gt;</span>
        </div>
        <div v-if="todoStats.typeStats.length > 0" class="todo-scroll">
          <div
            v-for="item in todoStats.typeStats"
            :key="item.type"
            class="todo-chip"
            :style="{ background: getTodoBg(item.type), color: getTodoColor(item.type) }"
            @click="goTo('/todos')"
          >
            <span class="todo-chip-label">{{ getTodoLabel(item.type) }}</span>
            <span class="todo-chip-count">{{ item.count }}</span>
          </div>
        </div>
        <div v-else class="empty-state">暂无待办</div>

        <!-- 近7天销售趋势 -->
        <div class="section-title">销售趋势 · 近7天</div>
        <div class="card trend-card">
          <template v-if="salesTrend.length > 0">
            <div v-for="item in salesTrend" :key="item.date" class="trend-row">
              <span class="trend-date">{{ formatDate(item.date) }}</span>
              <div class="trend-bar-wrapper">
                <div
                  class="trend-bar"
                  :style="{ width: maxSalesAmount > 0 ? (item.amount / maxSalesAmount * 100) + '%' : '0%' }"
                />
              </div>
              <span class="trend-amount">¥{{ formatMoney(item.amount) }}</span>
            </div>
          </template>
          <div v-else class="empty-state">暂无销售数据</div>
        </div>

        <!-- 品类分布 -->
        <div class="section-title">品类分布</div>
        <div class="card category-card">
          <template v-if="categories.length > 0">
            <div v-for="item in categories" :key="item.categoryName" class="category-row">
              <div class="category-header">
                <span class="category-name">{{ item.categoryName }}</span>
                <span class="category-amount">¥{{ formatMoney(item.amount) }}</span>
              </div>
              <div class="category-bar-wrapper">
                <div
                  class="category-bar"
                  :style="{ width: (item.percentage || 0) + '%' }"
                />
              </div>
            </div>
          </template>
          <div v-else class="empty-state">暂无数据</div>
        </div>

        <!-- Top排行 -->
        <div class="top-row">
          <div class="top-col">
            <div class="section-title">Top5 商品</div>
            <div class="card top-card">
              <template v-if="topProducts.length > 0">
                <div v-for="(item, idx) in topProducts" :key="idx" class="top-item">
                  <span class="top-rank" :class="{ 'top-rank--gold': idx === 0, 'top-rank--silver': idx === 1, 'top-rank--bronze': idx === 2 }">{{ idx + 1 }}</span>
                  <span class="top-name">{{ item.productName || item.skuName }}</span>
                  <span class="top-value">¥{{ formatMoney(item.salesAmount || 0) }}</span>
                </div>
              </template>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>
          <div class="top-col">
            <div class="section-title">Top5 客户</div>
            <div class="card top-card">
              <template v-if="topCustomers.length > 0">
                <div v-for="(item, idx) in topCustomers" :key="idx" class="top-item">
                  <span class="top-rank" :class="{ 'top-rank--gold': idx === 0, 'top-rank--silver': idx === 1, 'top-rank--bronze': idx === 2 }">{{ idx + 1 }}</span>
                  <span class="top-name">{{ item.customerName }}</span>
                  <span class="top-value">¥{{ formatMoney(item.totalAmount || 0) }}</span>
                </div>
              </template>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>
        </div>

        <!-- 库存预警 -->
        <div class="section-row">
          <span class="section-title">库存预警</span>
          <span class="section-link" @click="goTo('/inventory')">查看全部 &gt;</span>
        </div>
        <div class="card alert-card">
          <template v-if="alerts.length > 0">
            <div v-for="item in alerts.slice(0, 3)" :key="item.skuId" class="alert-item">
              <div class="alert-item-left">
                <span class="alert-item-name">{{ item.skuName }}</span>
                <span class="alert-item-type">{{ item.stockType }}</span>
              </div>
              <div class="alert-item-right">
                <span class="alert-item-qty" :class="{ 'alert-item-qty--danger': item.availableQty <= 5 }">
                  {{ item.availableQty }}
                </span>
                <span class="alert-item-unit">可售</span>
              </div>
            </div>
          </template>
          <div v-else class="empty-state empty-state--success">
            <van-icon name="checked" size="20" color="var(--color-success)" />
            <span>库存充足</span>
          </div>
        </div>

        <!-- 快捷入口 -->
        <div class="section-title">快捷入口</div>
        <van-grid :column-num="4" :border="false" class="quick-grid">
          <van-grid-item
            v-for="entry in displayEntries"
            :key="entry.id"
            :text="entry.text"
            @click="goTo(entry.route)"
          >
            <template #icon>
              <div class="quick-icon">
                <van-icon :name="entry.icon" size="22" color="var(--color-primary)" />
              </div>
            </template>
          </van-grid-item>
        </van-grid>

        <!-- 底部安全距离 -->
        <div style="height: 24px" />
      </van-pull-refresh>
    </template>
  </section>
</template>

<style scoped>
/* ===== 顶部导航栏 ===== */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.store-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.header-date {
  font-size: 12px;
  color: var(--text-muted);
}

.header-right {
  cursor: pointer;
}

.bell-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-soft);
  border-radius: 50%;
  color: var(--text-secondary);
}

/* ===== 核心指标网格 ===== */
.metric-grid {
  margin: 0 12px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.metric-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.metric-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
  white-space: nowrap;
}

.metric-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

/* ===== 待办提醒 ===== */
.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
}

.section-link {
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
}

.todo-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 16px 8px;
  -webkit-overflow-scrolling: touch;
}

.todo-scroll::-webkit-scrollbar {
  display: none;
}

.todo-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  min-width: 72px;
}

.todo-chip-label {
  font-size: 11px;
  margin-bottom: 4px;
}

.todo-chip-count {
  font-size: 20px;
  font-weight: 700;
}

/* ===== 销售趋势 ===== */
.trend-card {
  padding: var(--space-card-padding);
  margin: 0 16px;
}

.trend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.trend-row + .trend-row {
  border-top: 1px solid var(--border-normal);
}

.trend-date {
  flex-shrink: 0;
  width: 40px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.trend-bar-wrapper {
  flex: 1;
  height: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.trend-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  border-radius: var(--radius-sm);
  min-width: 4px;
  transition: width 0.3s ease;
}

.trend-amount {
  flex-shrink: 0;
  width: 80px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
}

/* ===== 品类分布 ===== */
.category-card {
  padding: var(--space-card-padding);
  margin: 0 16px;
}

.category-row {
  padding: 8px 0;
}

.category-row + .category-row {
  border-top: 1px solid var(--border-normal);
}

.category-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.category-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.category-amount {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.category-bar-wrapper {
  height: 8px;
  background: var(--bg-soft);
  border-radius: 4px;
  overflow: hidden;
}

.category-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  border-radius: 4px;
  min-width: 4px;
  transition: width 0.3s ease;
}

/* ===== Top排行 ===== */
.top-row {
  display: flex;
  gap: 8px;
  padding: 0 16px;
}

.top-col {
  flex: 1;
  min-width: 0;
}

.top-col .section-title {
  padding-left: 0;
  padding-right: 0;
}

.top-card {
  padding: 8px 12px;
}

.top-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}

.top-item + .top-item {
  border-top: 1px solid var(--border-normal);
}

.top-rank {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  background: #f0f2f5;
  color: var(--text-secondary);
}

.top-rank--gold {
  background: #FFF7E6;
  color: #D48806;
}

.top-rank--silver {
  background: #F0F2F5;
  color: #667085;
}

.top-rank--bronze {
  background: #FFF0E6;
  color: #D46B08;
}

.top-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-value {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ===== 库存预警 ===== */
.alert-card {
  padding: 0;
  margin: 0 16px;
}

.alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px var(--space-card-padding);
}

.alert-item + .alert-item {
  border-top: 1px solid var(--border-normal);
}

.alert-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.alert-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.alert-item-type {
  font-size: 12px;
  color: var(--text-secondary);
}

.alert-item-right {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.alert-item-qty {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.alert-item-qty--danger {
  color: var(--color-danger);
}

.alert-item-unit {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== 快捷入口 ===== */
.quick-grid {
  margin: 0 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.quick-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  border-radius: 12px;
  margin-bottom: 4px;
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px var(--space-card-padding);
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-state--success {
  color: var(--color-success);
}

.loading-center {
  padding: 24px var(--space-card-padding);
  display: flex;
  justify-content: center;
}

/* ===== 通用 ===== */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 16px 16px 8px;
}

.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.action-grid {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
</style>