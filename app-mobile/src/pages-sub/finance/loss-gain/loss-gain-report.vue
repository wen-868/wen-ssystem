<template>
  <view class="report-page">
    <view class="page-header">
      <text class="header-title">损益统计</text>
    </view>

    <!-- 总览卡片 -->
    <view class="overview-section">
      <view class="overview-card">
        <view class="overview-item">
          <text class="overview-value overview-value--danger">{{ stats.totalLossCount }}</text>
          <text class="overview-label">报损单数</text>
        </view>
        <view class="overview-divider"></view>
        <view class="overview-item">
          <text class="overview-value overview-value--success">{{ stats.totalGainCount }}</text>
          <text class="overview-label">报溢单数</text>
        </view>
      </view>
      <view class="overview-card">
        <view class="overview-item">
          <text class="overview-value overview-value--danger">¥{{ stats.totalLossAmount.toFixed(2) }}</text>
          <text class="overview-label">报损总金额</text>
        </view>
        <view class="overview-divider"></view>
        <view class="overview-item">
          <text class="overview-value overview-value--success">¥{{ stats.totalGainAmount.toFixed(2) }}</text>
          <text class="overview-label">报溢总金额</text>
        </view>
      </view>
    </view>

    <!-- 状态统计 -->
    <view class="section-card">
      <view class="card-title">状态分布</view>
      <view class="status-stats">
        <view class="status-stat-item">
          <view class="status-dot status-dot--warning"></view>
          <text class="status-stat-label">待审核</text>
          <text class="status-stat-value">{{ stats.pendingCount }}</text>
        </view>
        <view class="status-stat-item">
          <view class="status-dot status-dot--success"></view>
          <text class="status-stat-label">已通过</text>
          <text class="status-stat-value">{{ stats.approvedCount }}</text>
        </view>
        <view class="status-stat-item">
          <view class="status-dot status-dot--danger"></view>
          <text class="status-stat-label">已驳回</text>
          <text class="status-stat-value">{{ stats.rejectedCount }}</text>
        </view>
      </view>
      <!-- 状态分布条形图 -->
      <view class="bar-chart">
        <view class="bar-item">
          <view class="bar-label">待审核</view>
          <view class="bar-track">
            <view class="bar-fill bar-fill--warning" :style="{ width: pendingPercent + '%' }"></view>
          </view>
          <view class="bar-value">{{ stats.pendingCount }}</view>
        </view>
        <view class="bar-item">
          <view class="bar-label">已通过</view>
          <view class="bar-track">
            <view class="bar-fill bar-fill--success" :style="{ width: approvedPercent + '%' }"></view>
          </view>
          <view class="bar-value">{{ stats.approvedCount }}</view>
        </view>
        <view class="bar-item">
          <view class="bar-label">已驳回</view>
          <view class="bar-track">
            <view class="bar-fill bar-fill--danger" :style="{ width: rejectedPercent + '%' }"></view>
          </view>
          <view class="bar-value">{{ stats.rejectedCount }}</view>
        </view>
      </view>
    </view>

    <!-- 月度趋势 -->
    <view class="section-card">
      <view class="card-title">月度趋势</view>
      <view class="trend-chart">
        <view class="trend-item" v-for="item in stats.monthlyTrend" :key="item.month">
          <view class="trend-bars">
            <view class="trend-bar-wrap">
              <view
                class="trend-bar trend-bar--loss"
                :style="{ height: getLossBarHeight(item.lossAmount) + '%' }"
              ></view>
            </view>
            <view class="trend-bar-wrap">
              <view
                class="trend-bar trend-bar--gain"
                :style="{ height: getGainBarHeight(item.gainAmount) + '%' }"
              ></view>
            </view>
          </view>
          <text class="trend-month">{{ item.month }}</text>
        </view>
      </view>
      <view class="trend-legend">
        <view class="legend-item">
          <view class="legend-dot legend-dot--danger"></view>
          <text class="legend-text">报损金额</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot legend-dot--success"></view>
          <text class="legend-text">报溢金额</text>
        </view>
      </view>
    </view>

    <!-- 原因分布 -->
    <view class="section-card">
      <view class="card-title">原因分布</view>
      <view class="reason-tabs">
        <view
          class="reason-tab"
          :class="{ active: activeReasonTab === 'LOSS' }"
          @tap="activeReasonTab = 'LOSS'"
        >
          <text>报损原因</text>
        </view>
        <view
          class="reason-tab"
          :class="{ active: activeReasonTab === 'GAIN' }"
          @tap="activeReasonTab = 'GAIN'"
        >
          <text>报溢原因</text>
        </view>
      </view>
      <view class="reason-list">
        <view class="reason-item" v-for="item in filteredReasonStats" :key="item.reason">
          <view class="reason-info">
            <text class="reason-name">{{ item.reasonText }}</text>
            <text class="reason-count">{{ item.count }}单</text>
          </view>
          <view class="reason-bar-wrap">
            <view
              class="reason-bar"
              :class="item.type === 'LOSS' ? 'reason-bar--loss' : 'reason-bar--gain'"
              :style="{ width: getReasonPercent(item) + '%' }"
            ></view>
          </view>
          <text class="reason-amount">¥{{ item.amount.toFixed(0) }}</text>
        </view>
      </view>
    </view>

    <!-- 商品排行 -->
    <view class="section-card">
      <view class="card-title">商品排行 TOP5</view>
      <view class="product-list">
        <view class="product-item" v-for="(item, index) in stats.productTop" :key="item.skuId">
          <view class="product-rank" :class="'product-rank--' + (index + 1)">{{ index + 1 }}</view>
          <view class="product-info">
            <text class="product-name">{{ item.skuName }}</text>
            <text class="product-type">{{ item.type === 'LOSS' ? '报损' : '报溢' }}</text>
          </view>
          <view class="product-data">
            <text class="product-qty">{{ item.quantity }}件</text>
            <text
              class="product-amount"
              :class="item.type === 'LOSS' ? 'text-danger' : 'text-success'"
            >¥{{ item.amount.toFixed(0) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 导出按钮 -->
    <view class="export-bar">
      <view class="export-btn" @tap="onExport">
        <text class="export-icon">&#xe62d;</text>
        <text class="export-text">导出报表</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { inventoryLossGainApi, type LossGainStatistics } from '@/api/modules/inventory-loss-gain'

const stats = reactive<LossGainStatistics>({
  totalLossCount: 0,
  totalGainCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  totalLossAmount: 0,
  totalGainAmount: 0,
  monthlyTrend: [],
  reasonStats: [],
  productTop: [],
})

const activeReasonTab = ref<'LOSS' | 'GAIN'>('LOSS')

const totalStatusCount = computed(() => {
  return stats.pendingCount + stats.approvedCount + stats.rejectedCount || 1
})

const pendingPercent = computed(() => {
  return Math.round((stats.pendingCount / totalStatusCount.value) * 100)
})

const approvedPercent = computed(() => {
  return Math.round((stats.approvedCount / totalStatusCount.value) * 100)
})

const rejectedPercent = computed(() => {
  return Math.round((stats.rejectedCount / totalStatusCount.value) * 100)
})

const maxLossAmount = computed(() => {
  if (stats.monthlyTrend.length === 0) return 1
  return Math.max(...stats.monthlyTrend.map(m => m.lossAmount), 1)
})

const maxGainAmount = computed(() => {
  if (stats.monthlyTrend.length === 0) return 1
  return Math.max(...stats.monthlyTrend.map(m => m.gainAmount), 1)
})

const maxAmount = computed(() => {
  return Math.max(maxLossAmount.value, maxGainAmount.value)
})

const filteredReasonStats = computed(() => {
  return stats.reasonStats.filter(r => r.type === activeReasonTab.value)
})

const maxReasonAmount = computed(() => {
  if (filteredReasonStats.value.length === 0) return 1
  return Math.max(...filteredReasonStats.value.map(r => r.amount), 1)
})

function getLossBarHeight(amount: number): number {
  return (amount / maxAmount.value) * 100
}

function getGainBarHeight(amount: number): number {
  return (amount / maxAmount.value) * 100
}

function getReasonPercent(item: { amount: number }): number {
  return (item.amount / maxReasonAmount.value) * 100
}

async function loadStats() {
  try {
    const result = await inventoryLossGainApi.statistics()
    Object.assign(stats, result)
  } catch (err) {
    console.error('加载统计失败:', err)
  }
}

function onExport() {
  uni.showToast({ title: '导出功能开发中', icon: 'none' })
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.report-page { min-height: 100vh; background: #f0f5ff; padding-bottom: 120rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

/* 总览卡片 */
.overview-section {
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.overview-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.overview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.overview-value {
  font-size: 40rpx;
  font-weight: 700;
}
.overview-value--danger { color: #ff4d4f; }
.overview-value--success { color: #52c41a; }
.overview-label {
  font-size: 24rpx;
  color: #999;
}
.overview-divider {
  width: 2rpx;
  height: 60rpx;
  background: #f0f0f0;
}

/* 区块卡片 */
.section-card {
  background: #fff;
  margin: 0 24rpx 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

/* 状态统计 */
.status-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 24rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.status-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}
.status-dot--warning { background: #faad14; }
.status-dot--success { background: #52c41a; }
.status-dot--danger { background: #ff4d4f; }
.status-stat-label { font-size: 24rpx; color: #666; }
.status-stat-value { font-size: 32rpx; font-weight: 600; color: #333; }

/* 条形图 */
.bar-chart { display: flex; flex-direction: column; gap: 20rpx; }
.bar-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.bar-label { width: 100rpx; font-size: 24rpx; color: #666; flex-shrink: 0; }
.bar-track {
  flex: 1;
  height: 24rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  overflow: hidden;
}
.bar-fill { height: 100%; border-radius: 12rpx; transition: width 0.3s; }
.bar-fill--warning { background: linear-gradient(90deg, #faad14, #ffd666); }
.bar-fill--success { background: linear-gradient(90deg, #52c41a, #95de64); }
.bar-fill--danger { background: linear-gradient(90deg, #ff4d4f, #ff7875); }
.bar-value { width: 80rpx; font-size: 24rpx; color: #333; text-align: right; flex-shrink: 0; }

/* 月度趋势 */
.trend-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 300rpx;
  padding: 20rpx 0;
}
.trend-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.trend-bars {
  display: flex;
  gap: 6rpx;
  align-items: flex-end;
  height: 220rpx;
}
.trend-bar-wrap {
  width: 20rpx;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.trend-bar {
  width: 100%;
  border-radius: 4rpx 4rpx 0 0;
  transition: height 0.3s;
}
.trend-bar--loss { background: linear-gradient(180deg, #ff7875, #ff4d4f); }
.trend-bar--gain { background: linear-gradient(180deg, #95de64, #52c41a); }
.trend-month { font-size: 22rpx; color: #999; }

.trend-legend {
  display: flex;
  justify-content: center;
  gap: 32rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}
.legend-item { display: flex; align-items: center; gap: 8rpx; }
.legend-dot { width: 16rpx; height: 16rpx; border-radius: 4rpx; }
.legend-dot--danger { background: #ff4d4f; }
.legend-dot--success { background: #52c41a; }
.legend-text { font-size: 22rpx; color: #666; }

/* 原因分布 */
.reason-tabs {
  display: flex;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 6rpx;
  margin-bottom: 20rpx;
}
.reason-tab {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 26rpx;
  color: #666;
  border-radius: 8rpx;
  transition: all 0.2s;
}
.reason-tab.active {
  background: #fff;
  color: #1677FF;
  font-weight: 500;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}

.reason-list { display: flex; flex-direction: column; gap: 20rpx; }
.reason-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.reason-info { width: 120rpx; flex-shrink: 0; }
.reason-name { font-size: 26rpx; color: #333; display: block; }
.reason-count { font-size: 22rpx; color: #999; }
.reason-bar-wrap {
  flex: 1;
  height: 20rpx;
  background: #f5f5f5;
  border-radius: 10rpx;
  overflow: hidden;
}
.reason-bar { height: 100%; border-radius: 10rpx; transition: width 0.3s; }
.reason-bar--loss { background: linear-gradient(90deg, #ff7875, #ff4d4f); }
.reason-bar--gain { background: linear-gradient(90deg, #95de64, #52c41a); }
.reason-amount { width: 120rpx; font-size: 24rpx; color: #333; text-align: right; flex-shrink: 0; }

/* 商品排行 */
.product-list { display: flex; flex-direction: column; gap: 20rpx; }
.product-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  background: #f9f9f9;
  border-radius: 12rpx;
}
.product-rank {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}
.product-rank--1 { background: linear-gradient(135deg, #ffd700, #ffb800); }
.product-rank--2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); }
.product-rank--3 { background: linear-gradient(135deg, #cd7f32, #b87333); }
.product-rank--4, .product-rank--5 { background: #999; }

.product-info { flex: 1; }
.product-name { font-size: 26rpx; color: #333; display: block; margin-bottom: 4rpx; }
.product-type { font-size: 22rpx; color: #999; }
.product-data { text-align: right; flex-shrink: 0; }
.product-qty { font-size: 24rpx; color: #666; display: block; margin-bottom: 4rpx; }
.product-amount { font-size: 28rpx; font-weight: 600; }

.text-danger { color: #ff4d4f; }
.text-success { color: #52c41a; }

/* 导出按钮 */
.export-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
}
.export-btn {
  height: 88rpx;
  background: #1677FF;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.export-icon { font-size: 32rpx; color: #fff; }
.export-text { font-size: 30rpx; font-weight: 600; color: #fff; }

.safe-bottom { height: 40rpx; }
</style>
