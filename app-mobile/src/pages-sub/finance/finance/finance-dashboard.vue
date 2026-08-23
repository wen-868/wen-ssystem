<template>
  <scroll-view class="finance-page" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
    <!-- 顶部 Header -->
    <page-header title="财务看板" :subtitle="currentDate" @back="goBack" />

    <!-- 指标卡片 -->
    <view class="stats-grid">
      <view class="stat-card stat-card--income">
        <text class="stat-label">今日收入</text>
        <text class="stat-value">¥{{ formatAmount(incomeStats.todayIncome) }}</text>
        <view class="stat-trend">
          <image class="trend-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
          <text class="trend-text">本月 ¥{{ formatAmount(incomeStats.monthIncome) }}</text>
        </view>
      </view>

      <view class="stat-card stat-card--expense">
        <text class="stat-label">今日支出</text>
        <text class="stat-value">¥{{ formatAmount(expenseStats.todayExpense) }}</text>
        <view class="stat-trend">
          <image class="trend-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
          <text class="trend-text">本月 ¥{{ formatAmount(expenseStats.monthExpense) }}</text>
        </view>
      </view>

      <view class="stat-card stat-card--profit">
        <text class="stat-label">毛利</text>
        <text class="stat-value">¥{{ formatAmount(profitStats.grossProfit) }}</text>
        <view class="stat-trend">
          <image class="trend-icon ic" src="/static/icons/ic/users.svg" mode="aspectFit"/>
          <text class="trend-text">毛利率 {{ profitStats.grossMargin }}%</text>
        </view>
      </view>

      <view class="stat-card stat-card--net">
        <text class="stat-label">净利润</text>
        <text class="stat-value">¥{{ formatAmount(profitStats.netProfit) }}</text>
        <view class="stat-trend">
          <image class="trend-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
          <text class="trend-text">净利率 {{ profitStats.netMargin }}%</text>
        </view>
      </view>
    </view>

    <!-- Tab切换 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: activeTab === 'income' }" @tap="activeTab = 'income'">
        <text class="tab-text">收入趋势</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'expense' }" @tap="activeTab = 'expense'">
        <text class="tab-text">支出趋势</text>
      </view>
    </view>

    <!-- 趋势图表 -->
    <view class="chart-card">
      <view class="chart-header">
        <text class="chart-title">{{ activeTab === 'income' ? '收入趋势' : '支出趋势' }}</text>
      </view>
      <view class="chart-content">
        <view class="chart-bars">
          <view class="bar-item" v-for="(item, index) in currentTrend" :key="index">
            <view class="bar-wrapper">
              <view class="bar" :style="{ height: getBarHeight(item.amount) + '%' }" :class="activeTab === 'income' ? 'bar--income' : 'bar--expense'"></view>
            </view>
            <text class="bar-label">{{ formatDate(item.date) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 支出分类 -->
    <view class="section-card" v-if="categoryExpenses.length > 0">
      <view class="section-header">
        <text class="section-title">支出分类</text>
      </view>
      <view class="category-list">
        <view class="category-item" v-for="item in categoryExpenses" :key="item.name">
          <view class="category-info">
            <text class="category-name">{{ item.name }}</text>
            <text class="category-amount">¥{{ formatAmount(item.amount) }}</text>
          </view>
          <view class="category-progress">
            <view class="progress-bar" :style="{ width: item.percent + '%' }"></view>
          </view>
          <text class="category-percent">{{ item.percent }}%</text>
        </view>
      </view>
    </view>

    <!-- 安全区域底部间距 -->
    <view class="safe-bottom"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { financeApi, type IncomeStats, type ExpenseStats, type ProfitStats, type IncomeTrendItem, type ExpenseTrendItem, type CategoryExpense } from '@/api/modules/finance'

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/functions/functions' })
}

const incomeStats = ref<IncomeStats>({
  todayIncome: 0,
  monthIncome: 0,
  todayOrders: 0,
  monthOrders: 0
})

const expenseStats = ref<ExpenseStats>({
  todayExpense: 0,
  monthExpense: 0,
  todayCount: 0,
  monthCount: 0
})

const profitStats = ref<ProfitStats>({
  grossProfit: 0,
  netProfit: 0,
  grossMargin: 0,
  netMargin: 0
})

const incomeTrend = ref<IncomeTrendItem[]>([])
const expenseTrend = ref<ExpenseTrendItem[]>([])
const categoryExpenses = ref<CategoryExpense[]>([])

const activeTab = ref<'income' | 'expense'>('income')
const refresherTriggered = ref(false)

const currentDate = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
})

const currentTrend = computed(() => {
  return activeTab.value === 'income' ? incomeTrend.value : expenseTrend.value
})

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toFixed(2)
}

function formatDate(date: string): string {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getBarHeight(amount: number): number {
  const maxAmount = Math.max(...currentTrend.value.map(item => item.amount), 1)
  return Math.max((amount / maxAmount) * 100, 5)
}

async function loadData() {
  try {
    const [income, expense, profit, incomeTrendData, expenseTrendData, categoryData] = await Promise.all([
      financeApi.getIncomeStats(),
      financeApi.getExpenseStats(),
      financeApi.getProfitStats(),
      financeApi.getIncomeTrend(7),
      financeApi.getExpenseTrend(7),
      financeApi.getCategoryExpense()
    ])
    incomeStats.value = income
    expenseStats.value = expense
    profitStats.value = profit
    incomeTrend.value = incomeTrendData
    expenseTrend.value = expenseTrendData
    categoryExpenses.value = categoryData
  } catch (err) {
    console.error('加载财务数据失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  }
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await loadData()
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.finance-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  padding-bottom: env(safe-area-inset-bottom);
}

/* --- Header --- */
.finance-header {
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary-active);
  padding: 60rpx 32rpx 40rpx;
  padding-top: calc(60rpx + env(safe-area-inset-top));
  border-radius: 0 0 40rpx 40rpx;
  position: relative;
}

.finance-header .header-back {
  position: absolute;
  left: 20rpx;
  top: calc(24rpx + env(safe-area-inset-top));
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.finance-header .header-back-icon {
  color: #fff;
  font-size: 40rpx;
  line-height: 1;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

.header-date {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* --- 指标卡片 --- */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 24rpx;
  margin-top: -20rpx;
}

.stat-card {
  background: $uni-bg-color;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.stat-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-bottom: 12rpx;
  display: block;
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
  display: block;
}

.stat-card--income .stat-value { color: $uni-color-success; }
.stat-card--expense .stat-value { color: $uni-color-error; }
.stat-card--profit .stat-value { color: $uni-color-primary; }
.stat-card--net .stat-value { color: $uni-color-purple; }

.stat-trend {
  display: flex;
  align-items: center;
}

.trend-icon {
  font-size: 20rpx;
  color: $uni-gray-400;
  margin-right: 4rpx;
}

.trend-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

/* --- Tab切换 --- */
.tab-bar {
  display: flex;
  margin: 0 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 8rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  transition: all 0.3s;
}

.tab-item.active {
  background: $uni-color-primary;
}

.tab-text {
  font-size: 28rpx;
}

.tab-item .tab-text { color: $uni-gray-500; }
.tab-item.active .tab-text { color: $uni-text-color-inverse; }

/* --- 趋势图表 --- */
.chart-card {
  margin: 20rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.chart-header {
  margin-bottom: 20rpx;
}

.chart-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.chart-content {
  height: 300rpx;
}

.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 40rpx;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-wrapper {
  width: 40rpx;
  height: 220rpx;
  background: $uni-bg-color-grey;
  border-radius: 8rpx;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar {
  width: 100%;
  border-radius: 8rpx;
  transition: height 0.3s;
}

.bar--income { background: linear-gradient(180deg, $uni-color-success, $uni-color-success); }
.bar--expense { background: linear-gradient(180deg, $uni-color-error, $uni-color-error); }

.bar-label {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 12rpx;
}

/* --- 支出分类 --- */
.section-card {
  margin: 20rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.category-list {
  display: flex;
  flex-direction: column;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.category-item:last-child {
  border-bottom: none;
}

.category-info {
  width: 200rpx;
  display: flex;
  flex-direction: column;
}

.category-name {
  font-size: 28rpx;
  color: $uni-gray-700;
}

.category-amount {
  font-size: 24rpx;
  color: $uni-color-error;
  margin-top: 4rpx;
}

.category-progress {
  flex: 1;
  height: 12rpx;
  background: $uni-bg-color-grey;
  border-radius: 6rpx;
  margin: 0 16rpx;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, $uni-color-primary, $uni-color-primary);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.category-percent {
  font-size: 24rpx;
  color: $uni-gray-400;
  width: 80rpx;
  text-align: right;
}

.safe-bottom {
  height: 40rpx;
}
</style>
