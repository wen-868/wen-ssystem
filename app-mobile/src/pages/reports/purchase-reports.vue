<template>
  <view class="purchase-reports-page">
    <view class="page-header">
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
        <text class="chart-icon">&#xe627;</text>
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
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

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
  totalAmount: '1,580,600.00',
  orderCount: 32,
  supplierCount: 8,
})

const supplierList = ref<any[]>([
  { id: 1, name: '茅台集团', category: '酒厂', amount: '520,000', ratio: 33 },
  { id: 2, name: '五粮液股份', category: '酒厂', amount: '380,000', ratio: 24 },
  { id: 3, name: '洋河酒业', category: '酒厂', amount: '280,000', ratio: 18 },
])

const detailList = ref<any[]>([
  { id: 1, orderNo: 'PO20260708001', supplierName: '茅台集团', amount: '120,000', date: '2026-07-08' },
  { id: 2, orderNo: 'PO20260707002', supplierName: '五粮液股份', amount: '80,000', date: '2026-07-07' },
  { id: 3, orderNo: 'PO20260706003', supplierName: '洋河酒业', amount: '60,000', date: '2026-07-06' },
])

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
    // TODO: 对接采购报表接口
  } catch (err) {
    console.error('加载采购报表失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style scoped>
.purchase-reports-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.filter-form {
  margin: 16rpx 24rpx;
  background: #fff;
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
.filter-label { font-size: 22rpx; color: #999; }
.filter-value { font-size: 26rpx; color: #333; font-weight: 500; }
.query-btn {
  width: 100%;
  height: 72rpx;
  background: linear-gradient(135deg, #52c41a, #73d13d);
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 24rpx 24rpx; }
.summary-card {
  background: #fff;
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
.summary-value { font-size: 32rpx; font-weight: 700; color: #333; }
.summary-label { font-size: 22rpx; color: #999; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: #f0f0f0;
}
.section { padding: 0 24rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-more { font-size: 24rpx; color: #52c41a; font-weight: 400; }
.chart-placeholder {
  background: #fff;
  border-radius: 16rpx;
  height: 360rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.chart-icon { font-size: 64rpx; color: #ddd; }
.chart-text { font-size: 26rpx; color: #bbb; }
.supplier-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.supplier-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.supplier-item:last-child { border-bottom: none; }
.rank-num {
  width: 40rpx; height: 40rpx;
  border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: #f5f5f5;
  color: #999;
  flex-shrink: 0;
}
.rank-1 { background: #52c41a; color: #fff; }
.rank-2 { background: #73d13d; color: #fff; }
.rank-3 { background: #95de64; color: #fff; }
.supplier-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.supplier-name {
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.supplier-category {
  font-size: 22rpx;
  color: #999;
  padding: 2rpx 10rpx;
  background: #f5f5f5;
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
  color: #52c41a;
  font-weight: 600;
}
.supplier-ratio {
  font-size: 22rpx;
  color: #999;
}
.detail-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
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
  color: #666;
}
.detail-supplier {
  font-size: 26rpx;
  color: #333;
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
  color: #52c41a;
  font-weight: 600;
}
.detail-date {
  font-size: 22rpx;
  color: #999;
}
.safe-bottom { height: 40rpx; }
</style>
