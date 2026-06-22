<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import {
  fetchDashboard,
  fetchDailySales,
  fetchOrders,
  type DashboardData,
  type DailySalesRecord,
  type OrderRecord
} from '../api'

const emit = defineEmits<{ navigate: [page: string] }>()

/* ========== 用户信息 ========== */
const userName = ref('')
const storeName = ref('')

onMounted(() => {
  const savedUser = localStorage.getItem('merchant_user')
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser)
      userName.value = parsed.name || '商家用户'
    } catch {
      // ignore
    }
  }
})

/* ========== 搜索栏 ========== */
const searchKeyword = ref('')

function onSearch() {
  // 跳转到商品页搜索
  emit('navigate', 'products')
}

/* ========== 仪表盘指标 ========== */
const metrics = ref<DashboardData>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0,
  storeId: 0
})

const metricCards = computed(() => [
  {
    label: '今日订单',
    value: metrics.value.todayOrderCount,
    unit: '单',
    icon: 'orders-o',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-soft)'
  },
  {
    label: '今日销售',
    value: `¥${formatMoney(metrics.value.todaySalesAmount)}`,
    unit: '',
    icon: 'chart-trending-o',
    color: 'var(--color-success)',
    bg: '#ECFDF5'
  },
  {
    label: '待处理',
    value: metrics.value.pendingOrderCount,
    unit: '单',
    icon: 'clock-o',
    color: 'var(--color-warning)',
    bg: '#FFF7ED'
  },
  {
    label: '待收款',
    value: `¥${formatMoney(metrics.value.unReceivedAmount)}`,
    unit: '',
    icon: 'balance-o',
    color: 'var(--color-danger)',
    bg: '#FEF2F2'
  }
])

/* ========== 订单进度 ========== */
const orderProgress = ref([
  { label: '待配送', value: 0, status: 'WAIT_DELIVERY', color: 'var(--color-warning)' },
  { label: '配送中', value: 0, status: 'DELIVERING', color: 'var(--color-primary)' },
  { label: '已完成', value: 0, status: 'COMPLETED', color: 'var(--color-success)' }
])

/* ========== 最新订单 ========== */
const latestOrders = ref<OrderRecord[]>([])

/* ========== 近 7 天销售趋势 ========== */
const dailySales = ref<DailySalesRecord[]>([])

const maxSalesAmount = computed(() => {
  if (dailySales.value.length === 0) return 0
  return Math.max(...dailySales.value.map((d) => d.amount))
})

/* ========== 数据加载 ========== */
async function loadDashboard() {
  try {
    const res = await fetchDashboard()
    const data = res.data || {}
    metrics.value = {
      todayOrderCount: Number(data.todayOrderCount || 0),
      pendingOrderCount: Number(data.pendingOrderCount || 0),
      todaySalesAmount: Number(data.todaySalesAmount || 0),
      unReceivedAmount: Number(data.unReceivedAmount || 0),
      storeId: Number(data.storeId || 0)
    }
    storeName.value = data.storeName || '默认门店'
  } catch {
    // 接口失败时保持空状态
  }
}

async function loadLatestOrders() {
  try {
    const res = await fetchOrders({ page: 1, pageSize: 5 })
    const data = res.data
    latestOrders.value = data?.records ?? []
  } catch {
    // ignore
  }
}

async function loadDailySales() {
  try {
    const res = await fetchDailySales()
    dailySales.value = res.data || []
  } catch {
    // ignore
  }
}

onMounted(async () => {
  await Promise.all([loadDashboard(), loadLatestOrders(), loadDailySales()])
})

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function goToOrders() {
  emit('navigate', 'orders')
}
</script>

<template>
  <section class="page">
    <!-- 顶部信息栏 -->
    <div class="top-bar">
      <div class="user-info">
        <van-icon name="manager-o" size="20" color="var(--text-primary)" />
        <span class="user-name">{{ userName }}</span>
      </div>
      <div class="store-info">
        <van-icon name="shop-o" size="16" color="var(--text-secondary)" />
        <span class="store-name">{{ storeName }}</span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索商品、客户、订单"
        shape="round"
        clearable
        @search="onSearch"
      />
    </div>

    <!-- 经营数据看板 -->
    <div class="section-title">今日经营</div>
    <div class="metric-grid">
      <div
        v-for="card in metricCards"
        :key="card.label"
        class="metric-card"
      >
        <div class="metric-icon" :style="{ background: card.bg, color: card.color }">
          <van-icon :name="card.icon" size="20" />
        </div>
        <div class="metric-content">
          <span class="metric-label">{{ card.label }}</span>
          <span class="metric-value">
            {{ card.value }}<span v-if="card.unit" class="metric-unit">{{ card.unit }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 订单进度 -->
    <div class="section-title">订单进度</div>
    <div class="progress-bar">
      <div
        v-for="item in orderProgress"
        :key="item.status"
        class="progress-item"
        @click="goToOrders"
      >
        <div class="progress-value" :style="{ color: item.color }">{{ item.value }}</div>
        <div class="progress-label">{{ item.label }}</div>
      </div>
    </div>

    <!-- 最新订单 -->
    <div class="section-title">
      <span>最新订单</span>
      <van-button type="default" size="mini" plain @click="goToOrders">查看全部</van-button>
    </div>
    <div class="order-list">
      <div v-if="latestOrders.length === 0" class="empty-hint">暂无订单</div>
      <div
        v-for="order in latestOrders"
        :key="order.orderNo"
        class="order-item"
      >
        <div class="order-header">
          <span class="order-no">{{ order.orderNo }}</span>
          <van-tag
            :type="order.orderStatus === 'COMPLETED' ? 'success' : order.orderStatus === 'WAIT_DELIVERY' ? 'warning' : 'primary'"
            plain
            size="medium"
          >
            {{ order.orderStatus === 'WAIT_DELIVERY' ? '待配送' : order.orderStatus === 'DELIVERING' ? '配送中' : order.orderStatus === 'COMPLETED' ? '已完成' : order.orderStatus }}
          </van-tag>
        </div>
        <div class="order-info">
          <span>{{ order.receiverName }}</span>
          <span class="order-amount">¥{{ Number(order.payableAmount).toFixed(2) }}</span>
        </div>
        <div class="order-time">{{ order.createdAt }}</div>
      </div>
    </div>

    <!-- 7日趋势 -->
    <div class="section-title">近 7 天销售趋势</div>
    <div class="trend-card">
      <div v-if="dailySales.length === 0" class="empty-hint">暂无销售数据</div>
      <div v-for="item in dailySales" :key="item.date" class="trend-row">
        <span class="trend-date">{{ formatDate(item.date) }}</span>
        <div class="trend-bar-wrapper">
          <div
            class="trend-bar"
            :style="{ width: maxSalesAmount > 0 ? (item.amount / maxSalesAmount * 100) + '%' : '0%' }"
          />
        </div>
        <span class="trend-amount">¥{{ formatMoney(item.amount) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ===== 顶部信息栏 ===== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.store-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== 搜索栏 ===== */
.search-bar {
  margin: 0 -16px 16px;
}

:deep(.van-search) {
  padding: 8px 12px;
  background: var(--bg-page);
}

:deep(.van-search__content) {
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
}

/* ===== 区块标题 ===== */
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 16px 0 10px;
}

/* ===== 经营数据看板 ===== */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 8px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px 12px;
  box-shadow: var(--shadow-card);
}

.metric-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.metric-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

/* ===== 订单进度 ===== */
.progress-bar {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 8px;
}

.progress-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.progress-value {
  font-size: 20px;
  font-weight: 600;
}

.progress-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ===== 最新订单 ===== */
.order-list {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.empty-hint {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.order-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-normal);
}

.order-item:last-child {
  border-bottom: none;
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.order-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.order-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.order-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.order-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* ===== 7日趋势 ===== */
.trend-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.trend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
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
  border-radius: 8px;
  overflow: hidden;
}

.trend-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  border-radius: 8px;
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
</style>
