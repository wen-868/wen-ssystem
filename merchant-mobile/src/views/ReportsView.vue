<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import {
  fetchDashboard,
  fetchDailySales,
  fetchInventoryAlerts,
  fetchProductRanking,
  fetchSalesRanking,
  fetchProfitAnalysis,
  type DashboardData,
  type DailySalesRecord,
  type InventoryAlertRecord
} from '../api'

/* ========== 日期范围选择 ========== */
const showDatePicker = ref(false)
const dateRange = ref<[string, string]>(['', ''])
const tempDateRange = ref<[string, string]>(['', ''])

function formatDateParam(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDefaultRange(): [string, string] {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return [formatDateParam(sevenDaysAgo), formatDateParam(now)]
}

function openDatePicker() {
  tempDateRange.value = [...dateRange.value]
  showDatePicker.value = true
}

function confirmDateRange() {
  dateRange.value = [...tempDateRange.value]
  showDatePicker.value = false
  loadReportData()
}

function resetDateRange() {
  dateRange.value = getDefaultRange()
  loadReportData()
}

/* ========== Tab 切换 ========== */
const activeReportTab = ref('overview')

const REPORT_TABS = [
  { label: '经营概览', value: 'overview' },
  { label: '销售排行', value: 'ranking' },
  { label: '客户贡献', value: 'customer' },
  { label: '利润分析', value: 'profit' }
]

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
    const data = res.data || {}
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
    dailySales.value = res.data || []
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
    alerts.value = res.data || []
  } catch {
    // ignore
  } finally {
    alertsLoading.value = false
  }
}

/* ========== 销售排行 ========== */
interface RankingItem {
  skuName: string
  quantity: number
  amount: number
}
const rankingData = ref<RankingItem[]>([])
const rankingLoading = ref(false)

async function loadSalesRanking() {
  rankingLoading.value = true
  try {
    const res = await fetchProductRanking({
      startDate: dateRange.value[0] || undefined,
      endDate: dateRange.value[1] || undefined
    })
    rankingData.value = res.data?.records ?? res.data ?? []
  } catch {
    rankingData.value = []
  } finally {
    rankingLoading.value = false
  }
}

/* ========== 客户贡献 ========== */
interface CustomerContribItem {
  customerName: string
  totalAmount: number
  orderCount: number
}
const customerContribData = ref<CustomerContribItem[]>([])
const customerContribLoading = ref(false)

async function loadCustomerContribution() {
  customerContribLoading.value = true
  try {
    const res = await fetchSalesRanking({
      dateStart: dateRange.value[0] || undefined,
      dateEnd: dateRange.value[1] || undefined
    })
    customerContribData.value = res.data?.records ?? res.data ?? []
  } catch {
    customerContribData.value = []
  } finally {
    customerContribLoading.value = false
  }
}

/* ========== 利润分析 ========== */
interface ProfitItem {
  date: string
  revenue: number
  cost: number
  profit: number
  profitRate: number
}
const profitData = ref<ProfitItem[]>([])
const profitLoading = ref(false)

async function loadProfitAnalysis() {
  profitLoading.value = true
  try {
    const res = await fetchProfitAnalysis({
      startDate: dateRange.value[0] || undefined,
      endDate: dateRange.value[1] || undefined
    })
    profitData.value = res.data?.records ?? res.data ?? []
  } catch {
    profitData.value = []
  } finally {
    profitLoading.value = false
  }
}

/* ========== 初始化 & 刷新 ========== */
async function loadAll() {
  await Promise.all([loadDashboard(), loadDailySales(), loadAlerts()])
}

function loadReportData() {
  if (activeReportTab.value === 'ranking') loadSalesRanking()
  else if (activeReportTab.value === 'customer') loadCustomerContribution()
  else if (activeReportTab.value === 'profit') loadProfitAnalysis()
}

function onRefresh() {
  refreshing.value = true
  loadAll().finally(() => {
    refreshing.value = false
  })
}

function onTabChange() {
  loadReportData()
}

onMounted(() => {
  dateRange.value = getDefaultRange()
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

function displayDateRange(): string {
  if (dateRange.value[0] && dateRange.value[1]) {
    return `${dateRange.value[0]} ~ ${dateRange.value[1]}`
  }
  return '选择日期范围'
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">报表</h2>
      <van-button type="default" size="small" icon="calendar-o" @click="openDatePicker">
        {{ displayDateRange() }}
      </van-button>
    </div>

    <!-- 报表类型 Tab -->
    <van-tabs v-model:active="activeReportTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in REPORT_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <!-- A. 经营概览 -->
      <template v-if="activeReportTab === 'overview'">
        <div class="section-header">
          <van-icon name="chart-trending-o" size="16" color="var(--color-primary)" />
          <span>今日概览</span>
        </div>
        <div class="overview-grid" v-loading="dashboardLoading">
          <div class="overview-card">
            <div class="overview-icon" style="background: var(--color-primary-soft);">
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

        <!-- 近 7 天销售趋势 -->
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

        <!-- 库存预警 -->
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
      </template>

      <!-- B. 销售排行 -->
      <template v-if="activeReportTab === 'ranking'">
        <div class="section-header">
          <van-icon name="fire-o" size="16" color="var(--color-danger)" />
          <span>销售排行</span>
        </div>
        <div v-loading="rankingLoading">
          <div v-if="rankingData.length === 0 && !rankingLoading" class="empty-hint">
            暂无排行数据
          </div>
          <van-cell-group v-else inset>
            <van-cell
              v-for="(item, index) in rankingData"
              :key="item.skuName"
              class="ranking-cell"
            >
              <template #title>
                <div class="ranking-header">
                  <span class="ranking-index" :class="{ 'ranking-index--top': index < 3 }">{{ index + 1 }}</span>
                  <span class="ranking-name">{{ item.skuName }}</span>
                </div>
              </template>
              <template #label>
                <div class="ranking-info">
                  <span>销量: {{ item.quantity }}</span>
                  <span class="ranking-amount">¥{{ formatMoney(item.amount) }}</span>
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </template>

      <!-- C. 客户贡献 -->
      <template v-if="activeReportTab === 'customer'">
        <div class="section-header">
          <van-icon name="friends-o" size="16" color="var(--color-primary)" />
          <span>客户贡献</span>
        </div>
        <div v-loading="customerContribLoading">
          <div v-if="customerContribData.length === 0 && !customerContribLoading" class="empty-hint">
            暂无客户贡献数据
          </div>
          <van-cell-group v-else inset>
            <van-cell
              v-for="item in customerContribData"
              :key="item.customerName"
              class="contrib-cell"
            >
              <template #title>
                <div class="contrib-name">{{ item.customerName }}</div>
              </template>
              <template #label>
                <div class="contrib-info">
                  <span>订单: {{ item.orderCount }} 单</span>
                </div>
              </template>
              <template #value>
                <span class="contrib-amount">¥{{ formatMoney(item.totalAmount) }}</span>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </template>

      <!-- D. 利润分析 -->
      <template v-if="activeReportTab === 'profit'">
        <div class="section-header">
          <van-icon name="chart-trending-o" size="16" color="var(--color-success)" />
          <span>利润分析</span>
        </div>
        <div v-loading="profitLoading">
          <div v-if="profitData.length === 0 && !profitLoading" class="empty-hint">
            暂无利润数据
          </div>
          <div v-else class="card profit-card">
            <div v-for="item in profitData" :key="item.date" class="profit-row">
              <div class="profit-date">{{ item.date }}</div>
              <div class="profit-detail">
                <div class="profit-item">
                  <span class="profit-label">收入</span>
                  <span class="profit-value">¥{{ formatMoney(item.revenue) }}</span>
                </div>
                <div class="profit-item">
                  <span class="profit-label">成本</span>
                  <span class="profit-value profit-value--cost">¥{{ formatMoney(item.cost) }}</span>
                </div>
                <div class="profit-item">
                  <span class="profit-label">利润</span>
                  <span class="profit-value" :class="{ 'profit-value--negative': item.profit < 0 }">
                    ¥{{ formatMoney(item.profit) }}
                  </span>
                </div>
                <div class="profit-item">
                  <span class="profit-label">利润率</span>
                  <span class="profit-value" :class="{ 'profit-value--negative': item.profitRate < 0 }">
                    {{ item.profitRate.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </van-pull-refresh>

    <!-- 日期选择弹窗 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round :style="{ maxHeight: '50%' }">
      <div class="date-picker-panel">
        <h3>选择日期范围</h3>
        <van-date-picker
          v-model="tempDateRange"
          title="开始日期"
          :min-date="new Date(2024, 0, 1)"
          :max-date="new Date()"
          @confirm="confirmDateRange"
          @cancel="showDatePicker = false"
        />
        <div class="date-picker-actions">
          <van-button size="small" @click="resetDateRange">重置</van-button>
          <van-button type="primary" size="small" @click="confirmDateRange">确认</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: var(--text-page-title);
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
  padding: 12px var(--space-card-padding);
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
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
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

/* ===== D. 销售排行 ===== */
.ranking-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.ranking-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ranking-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.ranking-index--top {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.ranking-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.ranking-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.ranking-amount {
  font-weight: 600;
  color: var(--color-primary);
}

/* ===== E. 客户贡献 ===== */
.contrib-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.contrib-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.contrib-info {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.contrib-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

/* ===== F. 利润分析 ===== */
.profit-card {
  margin-bottom: 0;
}

.profit-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-normal);
}

.profit-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.profit-row:first-child {
  padding-top: 0;
}

.profit-date {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.profit-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.profit-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profit-label {
  font-size: 11px;
  color: var(--text-muted);
}

.profit-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.profit-value--cost {
  color: var(--text-secondary);
}

.profit-value--negative {
  color: var(--color-danger);
}

/* ===== 日期选择弹窗 ===== */
.date-picker-panel {
  padding: 20px var(--space-card-padding);
}

.date-picker-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.date-picker-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
</style>
