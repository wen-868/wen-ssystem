<template>
  <view class="points-page">
    <view class="points-header">
      <view class="points-card">
        <view class="points-label">我的积分</view>
        <view class="points-amount">
          <text class="amount-num">{{ pointsInfo.availablePoints }}</text>
          <text class="amount-unit">积分</text>
        </view>
        <view class="points-tip" v-if="pointsInfo.expiringPoints > 0">
          {{ pointsInfo.expiringDate || '' }} 即将过期 {{ pointsInfo.expiringPoints }} 积分
        </view>
      </view>

      <view class="points-stats">
        <view class="stat-item">
          <text class="stat-value">{{ pointsInfo.totalPoints }}</text>
          <text class="stat-label">累计获得</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ pointsInfo.frozenPoints }}</text>
          <text class="stat-label">冻结中</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" @tap="goRecords">
          <text class="stat-value link">明细</text>
          <text class="stat-label">查看全部</text>
        </view>
      </view>
    </view>

    <view class="action-section">
      <view class="section-title">
        <text class="title-text">积分兑换</text>
      </view>
      <view class="exchange-grid">
        <view class="exchange-item" v-for="item in exchangeList" :key="item.id" @tap="handleExchange(item)">
          <view class="exchange-icon">{{ item.icon }}</view>
          <text class="exchange-name">{{ item.name }}</text>
          <text class="exchange-points">{{ item.points }}积分</text>
        </view>
      </view>
    </view>

    <view class="records-section">
      <view class="section-header">
        <text class="section-title">积分明细</text>
        <text class="section-more" @tap="goRecords">查看全部 ›</text>
      </view>
      <view class="records-list">
        <view class="record-item" v-for="record in recentRecords" :key="record.id">
          <view class="record-left">
            <text class="record-reason">{{ record.reason }}</text>
            <text class="record-time">{{ formatTime(record.createdAt) }}</text>
          </view>
          <text class="record-amount" :class="record.type === 'EARN' ? 'earn' : 'consume'">
            {{ record.type === 'EARN' ? '+' : '-' }}{{ record.amount }}
          </text>
        </view>
        <view class="empty-tip" v-if="recentRecords.length === 0 && !loading">
          <text>暂无积分记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { pointsApi, type PointsInfo, type PointsRecord } from '@/api/points'

const pointsInfo = ref<PointsInfo>({
  totalPoints: 0,
  availablePoints: 0,
  frozenPoints: 0,
  expiringPoints: 0
})

const recentRecords = ref<PointsRecord[]>([])
const loading = ref(false)

const exchangeList = ref([
  { id: 1, name: '优惠券', icon: '🎫', points: 100 },
  { id: 2, name: '满减券', icon: '💰', points: 200 },
  { id: 3, name: '免邮券', icon: '🚚', points: 150 },
  { id: 4, name: '更多', icon: '🎁', points: 0 }
])

const loadPointsInfo = async () => {
  try {
    const result = await pointsApi.getPointsInfo()
    pointsInfo.value = result
  } catch (error) {
    console.error('加载积分信息失败:', error)
    pointsInfo.value = {
      totalPoints: 2580,
      availablePoints: 2380,
      frozenPoints: 200,
      expiringPoints: 500,
      expiringDate: '2026-12-31',
      levelName: '黄金会员',
      levelIcon: '👑'
    }
  }
}

const loadRecentRecords = async () => {
  loading.value = true
  try {
    const result = await pointsApi.getPointsRecords({ page: 1, pageSize: 5 })
    recentRecords.value = result.records
  } catch (error) {
    console.error('加载积分记录失败:', error)
    recentRecords.value = [
      { id: 1, type: 'EARN', amount: 100, reason: '消费获得', orderNo: 'SO20260715001', createdAt: '2026-07-15 14:30:00' },
      { id: 2, type: 'CONSUME', amount: 50, reason: '积分兑换优惠券', createdAt: '2026-07-14 10:20:00' },
      { id: 3, type: 'EARN', amount: 200, reason: '消费获得', orderNo: 'SO20260710002', createdAt: '2026-07-10 16:00:00' },
      { id: 4, type: 'EARN', amount: 10, reason: '签到奖励', createdAt: '2026-07-09 09:00:00' }
    ]
  } finally {
    loading.value = false
  }
}

const formatTime = (time: string): string => {
  if (!time) return ''
  return time.substring(0, 16)
}

const goRecords = () => {
  Taro.navigateTo({ url: '/pages/points/records' })
}

const handleExchange = (item: { id: number; name: string }) => {
  if (item.id === 4) {
    Taro.showToast({ title: '更多兑换商品敬请期待', icon: 'none' })
    return
  }
  Taro.showToast({ title: `${item.name}兑换功能开发中`, icon: 'none' })
}

onMounted(() => {
  loadPointsInfo()
  loadRecentRecords()
})
</script>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.points-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  padding: $spacing-xl $spacing-md;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
}

.points-card {
  color: #fff;
  text-align: center;
  margin-bottom: $spacing-xl;
}

.points-label {
  font-size: $font-size-base;
  opacity: 0.9;
  margin-bottom: $spacing-sm;
}

.points-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.amount-num {
  font-size: 72rpx;
  font-weight: bold;
  line-height: 1;
}

.amount-unit {
  font-size: $font-size-base;
  margin-left: $spacing-xs;
  opacity: 0.9;
}

.points-tip {
  font-size: $font-size-xs;
  margin-top: $spacing-sm;
  opacity: 0.85;
}

.points-stats {
  display: flex;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: $radius-lg;
  padding: $spacing-md 0;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}

.stat-value {
  font-size: $font-size-lg;
  font-weight: bold;
  margin-bottom: 4rpx;

  &.link {
    text-decoration: underline;
  }
}

.stat-label {
  font-size: $font-size-xs;
  opacity: 0.9;
}

.stat-divider {
  width: 1rpx;
  background-color: rgba(255, 255, 255, 0.3);
  margin: $spacing-sm 0;
}

.action-section,
.records-section {
  background-color: $bg-primary;
  margin: $spacing-md;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.section-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-md;
}

.exchange-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -#{$spacing-sm};
}

.exchange-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm;
  box-sizing: border-box;
}

.exchange-icon {
  width: 80rpx;
  height: 80rpx;
  background-color: $primary-bg;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-bottom: $spacing-xs;
}

.exchange-name {
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.exchange-points {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.section-more {
  font-size: $font-size-sm;
  color: $primary-color;
}

.records-list {
  display: flex;
  flex-direction: column;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.record-left {
  display: flex;
  flex-direction: column;
}

.record-reason {
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.record-time {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.record-amount {
  font-size: $font-size-lg;
  font-weight: bold;

  &.earn {
    color: $success-color;
  }

  &.consume {
    color: $error-color;
  }
}

.empty-tip {
  text-align: center;
  padding: $spacing-xl 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>
