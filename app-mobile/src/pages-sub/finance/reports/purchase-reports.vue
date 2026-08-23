<template>
  <view class="purchase-reports-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">采购报表</text>
    </view>

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
            <text class="summary-value">¥{{ summary.totalAmount }}</text>
            <text class="summary-label">采购总额</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.orderCount }}</text>
            <text class="summary-label">采购订单</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.supplierCount }}</text>
            <text class="summary-label">供应商</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">采购趋势</view>
      <view class="chart-placeholder">
        <image class="chart-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">供应商采购排行</view>
      <view class="supplier-list">
        <view class="supplier-item" v-for="(item, idx) in supplierList" :key="item.id">
          <view class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</view>
          <view class="supplier-info">
            <text class="supplier-name">{{ item.name }}</text>
            <text class="supplier-category">{{ item.category }}</text>
          </view>
          <view class="supplier-data">
            <text class="supplier-amount">¥{{ item.amount }}</text>
            <text class="supplier-ratio">{{ item.ratio }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>采购订单明细</text>
        <text class="title-more" @tap="goDetail">查看全部</text>
      </view>
      <view class="detail-list">
        <view class="detail-item" v-for="item in detailList" :key="item.id">
          <view class="detail-left">
            <text class="detail-no">订单号：{{ item.orderNo }}</text>
            <text class="detail-supplier">{{ item.supplierName }}</text>
          </view>
          <view class="detail-right">
            <text class="detail-amount">¥{{ item.amount }}</text>
            <text class="detail-date">{{ item.date }}</text>
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
  totalAmount: '0.00',
  orderCount: 0,
  supplierCount: 0,
})

const supplierList = ref<any[]>([])

const detailList = ref<any[]>([])

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
  uni.showToast({ title: '查看全部采购订单', icon: 'none' })
}

async function loadReportData() {
  try {
    const res = await reportsApi.getPurchaseReport({
      dateStart: filterForm.startDate,
      dateEnd: filterForm.endDate,
    })
    summary.value = res?.summary || { totalAmount: '0.00', orderCount: 0, supplierCount: 0 }
    supplierList.value = res?.supplierList || []
    detailList.value = res?.detailList || []
  } catch (err) {
    console.error('加载采购报表失败:', err)
    summary.value = { totalAmount: '0.00', orderCount: 0, supplierCount: 0 }
    supplierList.value = []
    detailList.value = []
  }
}

onMounted(() => { loadReportData() })
</script>

<style lang="scss" scoped>
.purchase-reports-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.filter-form {
  margin: 16rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.filter-row {
  display: flex;
  gap: 24rpx;
  padding: 12rpx 0;
}
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 8rpx;
}
.filter-label { font-size: 22rpx; color: $uni-gray-400; }
.filter-value { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.query-btn {
  width: 100%;
  height: 72rpx;
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 24rpx 24rpx; }
.summary-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.summary-row {
  display: flex;
  align-items: center;
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.summary-label { font-size: 22rpx; color: $uni-gray-400; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}
.section { padding: 0 24rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-more { font-size: 24rpx; color: $uni-color-success; font-weight: 400; }
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
.supplier-list {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.supplier-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.supplier-item:last-child { border-bottom: none; }
.rank-num {
  width: 40rpx; height: 40rpx;
  border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: $uni-bg-color-grey;
  color: $uni-gray-400;
  flex-shrink: 0;
}
.rank-1 { background: $uni-color-success; color: $uni-text-color-inverse; }
.rank-2 { background: $uni-color-success; color: $uni-text-color-inverse; }
.rank-3 { background: $uni-color-success; color: $uni-text-color-inverse; }
.supplier-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.supplier-name {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.supplier-category {
  font-size: 22rpx;
  color: $uni-gray-400;
  padding: 2rpx 10rpx;
  background: $uni-bg-color-grey;
  border-radius: 8rpx;
  align-self: flex-start;
}
.supplier-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.supplier-amount {
  font-size: 26rpx;
  color: $uni-color-success;
  font-weight: 600;
}
.supplier-ratio {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.detail-list {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.detail-item:last-child { border-bottom: none; }
.detail-left {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.detail-no {
  font-size: 24rpx;
  color: $uni-gray-500;
}
.detail-supplier {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-right {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.detail-amount {
  font-size: 26rpx;
  color: $uni-color-success;
  font-weight: 600;
}
.detail-date {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.safe-bottom { height: 40rpx; }
</style>
