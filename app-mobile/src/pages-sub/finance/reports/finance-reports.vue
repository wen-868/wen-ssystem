<template>
  <view class="finance-reports-page">
    <page-header title="财务报表" @back="goBack" />

    <form ref="formRef" :model="filterForm" class="filter-form">
      <view class="filter-row">
        <view class="filter-item" @tap="chooseStartDate">
          <text class="filter-label">开始日期</text>
          <text class="filter-value">{{ filterForm.startDate || '请选择' }}</text>
        </view>
        <view class="filter-item" @tap="chooseEndDate">
          <text class="filter-label">结束日期</text>
          <text class="filter-value">{{ filterForm.endDate || '请选择' }}</text>
        </view>
      </view>
      <button class="query-btn" @tap="onQuery">查询</button>
    </form>

    <view class="summary-section">
      <view class="summary-card">
        <view class="summary-row">
          <view class="summary-item summary-item--income">
            <text class="summary-value">¥{{ formatMoney(summary.totalIncome) }}</text>
            <text class="summary-label">总收入</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item summary-item--expense">
            <text class="summary-value">¥{{ formatMoney(summary.totalExpense) }}</text>
            <text class="summary-label">总支出</text>
          </view>
        </view>
        <view class="summary-row summary-row--second">
          <view class="summary-item summary-item--profit">
            <text class="summary-value">¥{{ formatMoney(summary.profit) }}</text>
            <text class="summary-label">净利润</text>
            <text class="summary-trend" :class="summary.profit >= 0 ? 'trend-up' : 'trend-down'">
              {{ summary.profit >= 0 ? '+' : '' }}{{ summary.profitMargin }}%
            </text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ formatMoney(summary.cashFlow) }}</text>
            <text class="summary-label">现金流</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">收支趋势</view>
      <view class="chart-placeholder">
        <image class="chart-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">收入来源</view>
      <view class="category-list">
        <view class="category-item" v-for="item in incomeCategory" :key="item.name">
          <view class="category-info">
            <text class="category-name">{{ item.name }}</text>
            <view class="category-bar-wrap category-bar-wrap--income">
              <view class="category-bar category-bar--income" :style="{ width: item.percent + '%' }"></view>
            </view>
          </view>
          <view class="category-data">
            <text class="category-amount category-amount--income">¥{{ formatMoney(item.amount) }}</text>
            <text class="category-percent">{{ item.percent }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">支出分类</view>
      <view class="category-list">
        <view class="category-item" v-for="item in expenseCategory" :key="item.name">
          <view class="category-info">
            <text class="category-name">{{ item.name }}</text>
            <view class="category-bar-wrap category-bar-wrap--expense">
              <view class="category-bar category-bar--expense" :style="{ width: item.percent + '%' }"></view>
            </view>
          </view>
          <view class="category-data">
            <text class="category-amount category-amount--expense">¥{{ formatMoney(item.amount) }}</text>
            <text class="category-percent">{{ item.percent }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>资金流水</text>
        <text class="title-more" @tap="goDetail">查看全部</text>
      </view>
      <view class="cash-flow-list">
        <view class="cash-flow-item" v-for="item in cashFlowList" :key="item.id">
          <view class="cash-flow-left">
            <text class="cash-flow-type" :class="item.type === 'income' ? 'type-income' : 'type-expense'">
              {{ item.type === 'income' ? '收入' : '支出' }}
            </text>
            <text class="cash-flow-desc">{{ item.description }}</text>
          </view>
          <view class="cash-flow-right">
            <text class="cash-flow-amount" :class="item.type === 'income' ? 'amount-income' : 'amount-expense'">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ formatMoney(item.amount) }}
            </text>
            <text class="cash-flow-date">{{ item.date }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { reportsApi, type FinanceSummary, type IncomeCategory, type ExpenseCategory, type CashFlowItem } from '@/api/modules/reports'

const formRef = ref<any>(null)
const filterForm = reactive({
  startDate: '',
  endDate: '',
})
const filterRules: Rules = {
  startDate: [{ required: false }],
  endDate: [{ required: false }],
}
const { errors, validate, clearError } = useFormValidation(filterForm, filterRules)

const summary = ref<FinanceSummary>({
  totalIncome: 0,
  totalExpense: 0,
  profit: 0,
  profitMargin: 0,
  cashFlow: 0,
})

const incomeCategory = ref<IncomeCategory[]>([])
const expenseCategory = ref<ExpenseCategory[]>([])
const cashFlowList = ref<CashFlowItem[]>([])

function formatMoney(value: number): string {
  if (!value && value !== 0) return '0.00'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function chooseStartDate() {
  uni.showToast({ title: '日期选择', icon: 'none' })
}

function chooseEndDate() {
  uni.showToast({ title: '日期选择', icon: 'none' })
}

async function onQuery() {
  await validate()
  loadReportData()
}

function goDetail() {
  uni.showToast({ title: '查看全部资金流水', icon: 'none' })
}

async function loadReportData() {
  try {
    const params = {
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined,
    }

    const [summaryRes, incomeCat, expenseCat, cashFlowRes] = await Promise.all([
      reportsApi.getFinanceSummary(params),
      reportsApi.getIncomeCategory(params),
      reportsApi.getExpenseCategory(params),
      reportsApi.getCashFlow({ ...params, page: 1, pageSize: 10 }),
    ])

    summary.value = summaryRes
    incomeCategory.value = incomeCat.length > 0 ? incomeCat : [
      { name: '销售收入', amount: 2580000, percent: 72 },
      { name: '其他收入', amount: 680000, percent: 19 },
      { name: '利息收入', amount: 320000, percent: 9 },
    ]
    expenseCategory.value = expenseCat.length > 0 ? expenseCat : [
      { name: '采购成本', amount: 1650000, percent: 55 },
      { name: '运营费用', amount: 580000, percent: 19 },
      { name: '人员工资', amount: 420000, percent: 14 },
      { name: '其他支出', amount: 350000, percent: 12 },
    ]
    cashFlowList.value = cashFlowRes.length > 0 ? cashFlowRes : [
      { id: 1, date: '2026-07-13', type: 'income', amount: 125000, description: '销售订单收款' },
      { id: 2, date: '2026-07-13', type: 'expense', amount: 85000, description: '采购付款' },
      { id: 3, date: '2026-07-12', type: 'income', amount: 98000, description: '销售订单收款' },
      { id: 4, date: '2026-07-12', type: 'expense', amount: 45000, description: '人员工资' },
    ]
  } catch (err) {
    console.error('加载财务报表失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style lang="scss" scoped>
.finance-reports-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + var(--safe-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.filter-form {
  margin: $uni-spacing-sm $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $uni-spacing-base;
  padding: $uni-spacing-sm 0;
}
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: $uni-spacing-xs;
}
.filter-label { font-size: 22rpx; color: $uni-gray-400; }
.filter-value { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.query-btn {
  width: 100%;
  height: 72rpx;
  background: linear-gradient(135deg, $uni-color-purple, $uni-color-purple-light);
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.summary-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.summary-row {
  display: flex;
  align-items: center;
  padding: $uni-spacing-xs 0;
}
.summary-row--second {
  border-top: 1rpx dashed $uni-gray-100;
  margin-top: $uni-spacing-sm;
  padding-top: $uni-spacing-base;
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: $uni-spacing-xs;
}
.summary-item--income .summary-value { color: $uni-color-success; }
.summary-item--expense .summary-value { color: $uni-color-error; }
.summary-item--profit .summary-value { color: $uni-color-primary; }
.summary-value { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.summary-label { font-size: 22rpx; color: $uni-gray-400; }
.summary-trend { font-size: 20rpx; margin-top: 4rpx; }
.trend-up { color: $uni-color-success; }
.trend-down { color: $uni-color-error; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}
.section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-more { font-size: 24rpx; color: $uni-color-purple; font-weight: 400; }
.chart-placeholder {
  background: $uni-bg-color;
  border-radius: 16rpx;
  height: 360rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}
.chart-icon { font-size: 64rpx; color: $uni-gray-300; }
.chart-text { font-size: 26rpx; color: $uni-gray-300; }
.category-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.category-item:last-child { border-bottom: none; }
.category-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 10rpx;
  margin-right: $uni-spacing-base;
}
.category-name { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.category-bar-wrap {
  height: 12rpx;
  border-radius: 6rpx;
  overflow: hidden;
}
.category-bar-wrap--income { background: $uni-color-success-soft; }
.category-bar-wrap--expense { background: $uni-color-error-soft; }
.category-bar {
  height: 100%;
  border-radius: 6rpx;
  min-width: 20rpx;
}
.category-bar--income { background: linear-gradient(90deg, $uni-color-success, $uni-color-success); }
.category-bar--expense { background: linear-gradient(90deg, $uni-color-error, $uni-color-error); }
.category-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.category-amount { font-size: 26rpx; font-weight: 600; }
.category-amount--income { color: $uni-color-success; }
.category-amount--expense { color: $uni-color-error; }
.category-percent { font-size: 22rpx; color: $uni-gray-400; }
.cash-flow-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.cash-flow-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.cash-flow-item:last-child { border-bottom: none; }
.cash-flow-left {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.cash-flow-type {
  font-size: 20rpx;
  padding: 4rpx $uni-spacing-sm;
  border-radius: $uni-border-radius-xs;
  align-self: flex-start;
}
.type-income { background: $uni-color-success-soft; color: $uni-color-success; }
.type-expense { background: $uni-color-error-soft; color: $uni-color-error; }
.cash-flow-desc {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cash-flow-right {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.cash-flow-amount {
  font-size: 26rpx;
  font-weight: 600;
}
.amount-income { color: $uni-color-success; }
.amount-expense { color: $uni-color-error; }
.cash-flow-date { font-size: 22rpx; color: $uni-gray-400; }
.safe-bottom { height: 40rpx; }
</style>

