<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import {
  fetchDashboard,
  fetchDailySales,
  fetchInventoryAlerts,
  type DashboardData,
  type DailySalesRecord,
  type InventoryAlertRecord
} from '../api'

/* ========== 仪表盘指标 ========== */
const loading = ref(false)
const metrics = ref<DashboardData>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0,
  storeId: 0
})

/* ========== 近 7 天销售趋势 ========== */
const dailySales = ref<DailySalesRecord[]>([])
const salesLoading = ref(false)

const maxSalesAmount = computed(() => {
  if (dailySales.value.length === 0) return 0
  return Math.max(...dailySales.value.map((d) => d.amount))
})

/* ========== 库存预警 ========== */
const alerts = ref<InventoryAlertRecord[]>([])
const alertsLoading = ref(false)

/* ========== 快捷操作 ========== */
const quickActions = [
  { text: '开单收款', icon: 'cash-back-record', color: 'var(--color-success)', route: 'create-sale' },
  { text: '库存管理', icon: 'search', color: 'var(--color-warning)', route: 'inventory' },
  { text: '客户管理', icon: 'friends-o', color: 'var(--color-primary)', route: 'customers' },
  { text: '应收管理', icon: 'balance-o', color: 'var(--color-danger)', route: 'receivables' },
  { text: '报表', icon: 'chart-trending-o', color: 'var(--color-primary)', route: 'reports' }
]

function handleQuickAction(route: string) {
  window.dispatchEvent(new CustomEvent('nav', { detail: route }))
}

/* ========== 数据加载 (store/dashboard) ========== */
async function loadDashboard() {
  loading.value = true
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
  } catch {
    // 接口失败时保持空状态
  } finally {
    loading.value = false
  }
}

async function loadDailySales() {
  salesLoading.value = true
  try {
    const res = await fetchDailySales()
    dailySales.value = res.data || []
  } catch {
    // 接口失败时保持空状态
  } finally {
    salesLoading.value = false
  }
}

async function loadAlerts() {
  alertsLoading.value = true
  try {
    const res = await fetchInventoryAlerts()
    alerts.value = res.data || []
  } catch {
    // 接口失败时保持空状态
  } finally {
    alertsLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadDashboard(), loadDailySales(), loadAlerts()])
})

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <section class="page">
    <!-- 顶部经营概览 -->
    <div class="card hero">
      <div class="hero-content">
        <h2>今日经营</h2>
        <p>快速查看销售、收款、配送和应收</p>
      </div>
    </div>

    <!-- 核心指标网格 -->
    <van-grid :column-num="2" :border="false" class="metric-grid">
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: var(--color-primary-soft);">
            <van-icon name="chart-trending-o" color="var(--color-primary)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">今日销售额</span>
            <span class="metric-value">¥{{ formatMoney(metrics.todaySalesAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #ECFDF5;">
            <van-icon name="cash-back-record" color="var(--color-success)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">今日收款额</span>
            <span class="metric-value metric-value--success">¥{{ formatMoney(metrics.todaySalesAmount - metrics.unReceivedAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #FFF7ED;">
            <van-icon name="logistics" color="var(--color-warning)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">待配送订单</span>
            <span class="metric-value metric-value--warn">{{ metrics.pendingOrderCount }}<span class="metric-unit"> 单</span></span>
          </div>
        </template>
      </van-grid-item>
      <van-grid-item>
        <template #icon>
          <div class="metric-icon" style="background: #FEF2F2;">
            <van-icon name="balance-o" color="var(--color-danger)" size="24" />
          </div>
        </template>
        <template #text>
          <div class="metric-text">
            <span class="metric-label">待收款金额</span>
            <span class="metric-value metric-value--danger">¥{{ formatMoney(metrics.unReceivedAmount) }}</span>
          </div>
        </template>
      </van-grid-item>
    </van-grid>

    <!-- 近 7 天销售趋势 -->
    <div class="section-title">近 7 天销售趋势</div>
    <div class="card trend-card">
      <van-loading v-if="salesLoading" size="24" vertical class="loading-center">加载中...</van-loading>
      <template v-else-if="dailySales.length > 0">
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
      </template>
      <div v-else class="empty-state">暂无销售数据</div>
    </div>

    <!-- 库存预警列表 -->
    <div class="section-title">库存预警</div>
    <div class="card alert-card">
      <van-loading v-if="alertsLoading" size="24" vertical class="loading-center">加载中...</van-loading>
      <template v-else-if="alerts.length > 0">
        <div v-for="item in alerts" :key="item.skuId" class="alert-item">
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

    <!-- 快捷操作 -->
    <div class="section-title">常用操作</div>
    <van-grid :column-num="4" :border="false" class="action-grid">
      <van-grid-item
        v-for="action in quickActions"
        :key="action.text"
        :icon="action.icon"
        :text="action.text"
        :icon-color="action.color"
        @click="handleQuickAction(action.route)"
      />
    </van-grid>
  </section>
</template>

<style scoped>
.hero {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.hero-content h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.hero-content p {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}

.metric-grid {
  margin: 12px 0;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.metric-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.metric-text {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.metric-value--success {
  color: var(--color-success);
}

.metric-value--warn {
  color: var(--color-warning);
}

.metric-value--danger {
  color: var(--color-danger);
}

.metric-unit {
  font-size: 12px;
  font-weight: 400;
}

/* ===== 近 7 天销售趋势 ===== */
.trend-card {
  padding: var(--space-card-padding);
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

/* ===== 库存预警 ===== */
.alert-card {
  padding: 0;
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

.action-grid {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
</style>
