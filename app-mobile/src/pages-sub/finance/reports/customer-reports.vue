<template>
  <view class="customer-reports-page">
    <page-header title="客户报表" @back="goBack" />

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
          <view class="summary-item">
            <text class="summary-value">{{ summary.totalCustomer }}</text>
            <text class="summary-label">客户总数</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.totalSales }}</text>
            <text class="summary-label">客户消费</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.avgOrder }}</text>
            <text class="summary-label">平均客单价</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">客户增长趋势</view>
      <view class="chart-placeholder">
        <image class="chart-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">客户等级分布</view>
      <view class="level-list">
        <view class="level-item" v-for="item in levelList" :key="item.level">
          <view class="level-info">
            <text class="level-name">{{ item.name }}</text>
            <text class="level-count">{{ item.count }}人</text>
          </view>
          <view class="level-bar-wrap">
            <view class="level-bar" :class="'bar-' + item.level" :style="{ width: item.percent + '%' }"></view>
          </view>
          <text class="level-percent">{{ item.percent }}%</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>客户消费排行</text>
        <text class="title-more" @tap="goDetail">查看全部</text>
      </view>
      <view class="customer-list">
        <view class="customer-item" v-for="(item, idx) in customerList" :key="item.id">
          <view class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</view>
          <view class="customer-info">
            <text class="customer-name">{{ item.name }}</text>
            <text class="customer-level" :class="'level-tag-' + item.level">{{ item.levelName }}</text>
          </view>
          <view class="customer-data">
            <text class="customer-amount">¥{{ item.amount }}</text>
            <text class="customer-order">{{ item.orderCount }}单</text>
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
import { reportsApi } from '@/api/modules/reports'

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

const summary = ref<any>({
  totalCustomer: 0,
  totalSales: '0.00',
  avgOrder: '0.00',
})

const levelList = ref<any[]>([])
const customerList = ref<any[]>([])

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
  uni.showToast({ title: '查看全部客户', icon: 'none' })
}

async function loadReportData() {
  try {
    const [salesData, categoryData] = await Promise.all([
      reportsApi.getSalesSummary({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined
      }),
      reportsApi.getCategorySales({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined
      })
    ])
    summary.value = {
      totalCustomer: salesData.customerCount,
      totalSales: salesData.totalSales.toFixed(2),
      avgOrder: salesData.avgPrice.toFixed(2),
    }
    levelList.value = categoryData
    customerList.value = []
  } catch (err) {
    console.error('加载客户报表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  }
}

onMounted(() => { loadReportData() })
</script>

<style lang="scss" scoped>
.customer-reports-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
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
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: $uni-spacing-xs;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.summary-label { font-size: 22rpx; color: $uni-gray-400; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}
.section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.section-title {
  font-size: 28rpx;
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
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.chart-icon { font-size: 64rpx; color: $uni-gray-300; }
.chart-text { font-size: 26rpx; color: $uni-gray-300; }
.level-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.level-item {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.level-item:last-child { border-bottom: none; }
.level-info {
  width: 160rpx;
  display: flex; flex-direction: column;
  gap: 4rpx;
  flex-shrink: 0;
}
.level-name {
  font-size: 26rpx;
  color: $uni-gray-700;
}
.level-count {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.level-bar-wrap {
  flex: 1;
  height: 16rpx;
  background: $uni-bg-color-grey;
  border-radius: 8rpx;
  overflow: hidden;
}
.level-bar {
  height: 100%;
  border-radius: 8rpx;
  min-width: 20rpx;
}
.bar-vip {
  background: linear-gradient(90deg, $uni-color-error, $uni-color-error);
}
.bar-gold {
  background: linear-gradient(90deg, $uni-color-warning, $uni-color-warning);
}
.bar-silver {
  background: linear-gradient(90deg, $uni-color-primary-soft, $uni-color-primary);
}
.bar-normal {
  background: linear-gradient(90deg, $uni-gray-300, $uni-gray-300);
}
.level-percent {
  width: 80rpx;
  font-size: 24rpx;
  color: $uni-gray-500;
  text-align: right;
  flex-shrink: 0;
}
.customer-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.customer-item {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.customer-item:last-child { border-bottom: none; }
.rank-num {
  width: 40rpx; height: 40rpx;
  border-radius: $uni-border-radius-xs;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: $uni-bg-color-grey;
  color: $uni-gray-400;
  flex-shrink: 0;
}
.rank-1 { background: $uni-color-error; color: $uni-text-color-inverse; }
.rank-2 { background: $uni-color-warning; color: $uni-text-color-inverse; }
.rank-3 { background: $uni-color-warning; color: $uni-text-color-inverse; }
.customer-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.customer-name {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.customer-level {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  align-self: flex-start;
}
.level-tag-vip {
  background: $uni-color-error-soft;
  color: $uni-color-error;
}
.level-tag-gold {
  background: $uni-color-warning-soft;
  color: $uni-color-warning;
}
.level-tag-silver {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}
.customer-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.customer-amount {
  font-size: 26rpx;
  color: $uni-color-purple;
  font-weight: 600;
}
.customer-order {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.safe-bottom { height: 40rpx; }
</style>
