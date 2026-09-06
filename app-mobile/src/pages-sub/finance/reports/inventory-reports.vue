<template>
  <view class="inventory-reports-page">
    <page-header title="库存报表" @back="goBack" />

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
            <text class="summary-value">{{ summary.totalQty }}</text>
            <text class="summary-label">库存总量</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.totalValue }}</text>
            <text class="summary-label">库存总值</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.warningCount }}</text>
            <text class="summary-label">预警商品</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">库存周转率</view>
      <view class="chart-placeholder">
        <image class="chart-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">商品库存排行</view>
      <view class="rank-list">
        <view class="rank-item" v-for="(item, idx) in rankList" :key="item.id">
          <view class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</view>
          <view class="rank-info">
            <text class="rank-name">{{ item.name }}</text>
            <text class="rank-spec">{{ item.spec }}</text>
          </view>
          <view class="rank-data">
            <text class="rank-qty">{{ item.qty }}件</text>
            <text class="rank-value">¥{{ item.value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>出入库明细</text>
        <text class="title-more" @tap="goDetail">查看全部</text>
      </view>
      <view class="detail-list">
        <view class="detail-item" v-for="item in detailList" :key="item.id">
          <view class="detail-left">
            <text class="detail-type" :class="item.type === 'in' ? 'type-in' : 'type-out'">
              {{ item.type === 'in' ? '入库' : '出库' }}
            </text>
            <text class="detail-name">{{ item.productName }}</text>
          </view>
          <view class="detail-right">
            <text class="detail-qty" :class="item.type === 'in' ? 'qty-in' : 'qty-out'">
              {{ item.type === 'in' ? '+' : '-' }}{{ item.qty }}
            </text>
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
  totalQty: 0,
  totalValue: '0.00',
  warningCount: 0,
})

const rankList = ref<any[]>([])
const detailList = ref<any[]>([])
const trendList = ref<any[]>([])

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
  uni.showToast({ title: '查看全部出入库明细', icon: 'none' })
}

async function loadReportData() {
  try {
    const [summaryData, trendData, rankData, detailData] = await Promise.all([
      reportsApi.getInventorySummary({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined
      }),
      reportsApi.getInventoryTrend({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined,
        period: 'day'
      }),
      reportsApi.getInventoryRank({ limit: 10 }),
      reportsApi.getInventoryDetail({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined,
        type: 'all',
        page: 1,
        pageSize: 20
      })
    ])
    summary.value = {
      totalQty: summaryData.totalQty,
      totalValue: summaryData.totalValue.toFixed(2),
      warningCount: summaryData.warningCount,
    }
    trendList.value = trendData
    rankList.value = rankData
    detailList.value = detailData
  } catch (err) {
    console.error('加载库存报表失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style lang="scss" scoped>
.inventory-reports-page { min-height: 100vh; background: $uni-color-primary-soft; }
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
  display: flex;
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
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
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
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-more { font-size: 24rpx; color: $uni-color-primary; font-weight: 400; }
.chart-placeholder {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  height: 360rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $uni-spacing-sm;
  box-shadow: $uni-shadow-card-sm;
}
.chart-icon { font-size: 64rpx; color: $uni-gray-300; }
.chart-text { font-size: 26rpx; color: $uni-gray-300; }
.rank-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.rank-item:last-child { border-bottom: none; }
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
.rank-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.rank-name {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-spec { font-size: 22rpx; color: $uni-gray-400; }
.rank-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.rank-qty { font-size: 24rpx; color: $uni-gray-500; }
.rank-value { font-size: 26rpx; color: $uni-color-primary; font-weight: 600; }
.detail-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.detail-item:last-child { border-bottom: none; }
.detail-left {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  flex: 1;
  min-width: 0;
}
.detail-type {
  padding: 4rpx $uni-spacing-sm;
  border-radius: $uni-border-radius-xs;
  font-size: 20rpx;
  flex-shrink: 0;
}
.type-in { background: $uni-color-success-soft; color: $uni-color-success; }
.type-out { background: $uni-color-error-soft; color: $uni-color-error; }
.detail-name {
  font-size: 26rpx;
  color: $uni-gray-700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.detail-qty {
  font-size: 26rpx;
  font-weight: 600;
}
.qty-in { color: $uni-color-success; }
.qty-out { color: $uni-color-error; }
.detail-date { font-size: 22rpx; color: $uni-gray-400; }
.safe-bottom { height: 40rpx; }
</style>

