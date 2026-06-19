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

/* ========== 今日概览 ========== */
const dashboard = ref<DashboardData>({
  todayOrderCount: 0,
  pendingOrderCount: 0,
  todaySalesAmount: 0,
  unReceivedAmount: 0,
  storeId: 0
})
const dashboardLoading = ref(false)
const refreshing = ref(false)

async function loadDashboard() {
  dashboardLoading.value = true
  try {
    const res = await fetchDashboard()
    const data = res.data.data || {}
    dashboard.value = {
      todayOrderCount: Number(data.todayOrderCount || 0),
      pendingOrderCount: Number(data.pendingOrderCount || 0),
      todaySalesAmount: Number(data.todaySalesAmount || 0),
      unReceivedAmount: Number(data.unReceivedAmount || 0),
      storeId: Number(data.storeId || 0)
    }
  } catch {
    // ignore
  } finally {
    dashboardLoading.value = false
  }
}

/* ========== 近 7 天销售趋势 ========== */
const dailySales = ref<DailySalesRecord[]>([])
const salesLoading = ref(false)

const maxSalesAmount = computed(() => {
  if (dailySales.value.length === 0) return 0
  return Math.max(...dailySales.value.map((d) => d.amount))
})

async function loadDailySales() {
  salesLoading.value = true
  try {
    const res = await fetchDailySales()
    dailySales.value = res.data.data || []
  } catch {
    // ignore
  } finally {
    salesLoading.value = false
  }
}

/* ========== 库存预警 ========== */
const alerts = ref<InventoryAlertRecord[]>([])
const alertsLoading = ref(false)

async function loadAlerts() {
  alertsLoading.value = true
  try {
    const res = await fetchInventoryAlerts()
    alerts.value = res.data.data || []
  } catch {
    // ignore
  } finally {
    alertsLoading.value = false
  }
}

/* ========== 初始化 & 刷新 ========== */
async function loadAll() {
  await Promise.all([loadDashboard(), loadDailySales(), loadAlerts()])
}

function onRefresh() {
  refreshing.value = true
  loadAll().finally(() => {
    refreshing.value = false
  })
}

onMounted(() => {
  loadAll()
})

/* ========== 工具函数 ========== */
function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function barWidth(amount: number): string {
  if (maxSalesAmount.value === 0) return '0%'
  return Math.max(4, (amount / maxSalesAmount.value) * 100) + '%'
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">报表</h2>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <!-- A. 今日概览卡片 -->
      <div class="section-header">
        <van-icon name="chart-trending-o" size="16" color="var(--color-primary)" />
        <span>今日概览</span>
      </div>
      <div class="overview-grid" v-loading="dashboardLoading">
        <div class="overview-card">
          <div class="overview-icon" style="background: var(--color-primary-soft, #EEF4FF);">
            <van-icon name="orders-o" color="var(--color-primary)" size="20" />
          </div>
          <div class="overview-info">
            <span class="overview-label">今日订单数</span>
            <span class="overview-value">{{ dashboard.todayOrderCount }}<span class="overview-unit"> 单</span></span>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: #FFF7ED;">
            <van-icon name="clock-o" color="var(--color-warning)" size="20" />
          </div>
          <div class="overview-info">
            <span class="overview-label">待处理订单</span>
            <span class="overview-value overview-value--warn">{{ dashboard.pendingOrderCount }}<span class="overview-unit"> 单</span></span>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: #ECFDF5;">
            <van-icon name="chart-trending-o" color="var(--color-success)" size="20" />
          </div>
          <div class="overview-info">
            <span class="overview-label">今日销售额</span>
            <span class="overview-value">¥{{ formatMoney(dashboard.todaySalesAmount) }}</span>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: #FEF2F2;">
            <van-icon name="balance-o" color="var(--color-danger)" size="20" />
          </div>
          <div class="overview-info">
            <span class="overview-label">未收金额</span>
            <span class="overview-value overview-value--danger">¥{{ formatMoney(dashboard.unReceivedAmount) }}</span>
          </div>
        </div>
      </div>

      <!-- B. 近 7 天销售趋势 -->
      <div class="section-header">
        <van-icon name="bar-chart-o" size="16" color="var(--color-primary)" />
        <span>近 7 天销售趋势</span>
      </div>
      <div class="card sales-card" v-loading="salesLoading">
        <div v-if="dailySales.length === 0 && !salesLoading" class="empty-hint">
          暂无销售数据
        </div>
        <div v-for="item in dailySales" :key="item.date" class="sales-row">
          <div class="sales-date">{{ formatDate(item.date) }}</div>
          <div class="sales-bar-wrap">
            <div class="sales-bar" :style="{ width: barWidth(item.amount) }"></div>
          </div>
          <div class="sales-meta">
            <span class="sales-count">{{ item.count }}单</span>
            <span class="sales-amount">¥{{ formatMoney(item.amount) }}</span>
          </div>
        </div>
      </div>

      <!-- C. 库存预警 -->
      <div class="section-header">
        <van-icon name="warning-o" size="16" color="var(--color-danger)" />
        <span>库存预警</span>
        <van-tag v-if="alerts.length > 0" type="danger" plain size="medium" class="alert-count-tag">
          {{ alerts.length }} 项
        </van-tag>
      </div>
      <div class="card alerts-card" v-loading="alertsLoading">
        <div v-if="alerts.length === 0 && !alertsLoading" class="empty-hint">
          <van-icon name="checked" size="32" color="var(--color-success)" />
          <span>库存充足，暂无预警</span>
        </div>
        <div v-for="item in alerts" :key="item.skuId" class="alert-row">
          <div class="alert-name">{{ item.skuName }}</div>
          <div class="alert-detail">
            <span class="alert-type">{{ item.stockType }}</span>
            <span class="alert-qty">可售: <b :class="{ 'qty-danger': item.availableQty <= 5 }">{{ item.availableQty }}</b></span>
          </div>
        </div>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 区块标题 */
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.alert-count-tag {
  margin-left: 6px;
}

/* 通用卡片 */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 12px 16px;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== A. 今日概览 ===== */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 14px 12px;
}

.overview-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overview-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.overview-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.overview-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.overview-value--warn {
  color: var(--color-warning);
}

.overview-value--danger {
  color: var(--color-danger);
}

.overview-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
}

/* ===== B. 销售趋势 ===== */
.sales-card {
  margin-bottom: 0;
}

.sales-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-normal);
}

.sales-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.sales-row:first-child {
  padding-top: 0;
}

.sales-date {
  flex-shrink: 0;
  width: 44px;
  font-size: 13px;
  color: var(--text-secondary);
}

.sales-bar-wrap {
  flex: 1;
  height: 10px;
  background: var(--bg-soft);
  border-radius: 5px;
  overflow: hidden;
}

.sales-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), #69B1FF);
  border-radius: 5px;
  min-width: 4px;
  transition: width 0.3s ease;
}

.sales-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.sales-count {
  font-size: 11px;
  color: var(--text-muted);
}

.sales-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== C. 库存预警 ===== */
.alerts-card {
  margin-bottom: 0;
}

.alert-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-normal);
}

.alert-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.alert-row:first-child {
  padding-top: 0;
}

.alert-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-detail {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
}

.alert-type {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-soft);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.alert-qty {
  font-size: 13px;
  color: var(--text-secondary);
}

.alert-qty b {
  font-weight: 600;
  color: var(--text-primary);
}

.qty-danger {
  color: var(--color-danger) !important;
}
</style>
