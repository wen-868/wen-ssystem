<template>
  <view class="stored-page">
    <view class="stored-header">
      <view class="card-wrap">
        <view class="stored-card">
          <view class="card-top">
            <view class="card-logo">💳</view>
            <view class="card-grade" v-if="storedInfo.grade">{{ storedInfo.grade }}</view>
          </view>
          <view class="card-balance">
            <text class="balance-label">可用余额（元）</text>
            <text class="balance-value">{{ storedInfo.balance.toFixed(2) }}</text>
          </view>
          <view class="card-no">卡号：{{ storedInfo.cardNo }}</view>
        </view>
      </view>

      <view class="card-stats">
        <view class="stat-item">
          <text class="stat-value">¥{{ storedInfo.totalRecharge.toFixed(2) }}</text>
          <text class="stat-label">累计充值</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">¥{{ storedInfo.totalConsume.toFixed(2) }}</text>
          <text class="stat-label">累计消费</text>
        </view>
      </view>
    </view>

    <view class="action-buttons">
      <view class="action-btn primary" @tap="goRecharge">
        <text class="btn-icon">💰</text>
        <text class="btn-text">立即充值</text>
      </view>
    </view>

    <view class="records-section">
      <view class="section-header">
        <text class="section-title">交易记录</text>
        <view class="tab-switch">
          <text
            class="tab-item"
            :class="{ active: activeTab === 'all' }"
            @tap="switchTab('all')"
          >全部</text>
          <text
            class="tab-item"
            :class="{ active: activeTab === 'RECHARGE' }"
            @tap="switchTab('RECHARGE')"
          >充值</text>
          <text
            class="tab-item"
            :class="{ active: activeTab === 'CONSUME' }"
            @tap="switchTab('CONSUME')"
          >消费</text>
        </view>
      </view>

      <view class="records-list">
        <view class="record-item" v-for="record in recordsList" :key="record.id">
          <view class="record-left">
            <view class="record-icon" :class="record.type.toLowerCase()">
              {{ record.type === 'RECHARGE' ? '+' : '-' }}
            </view>
            <view class="record-info">
              <text class="record-reason">{{ record.reason }}</text>
              <text class="record-time">{{ formatTime(record.createdAt) }}</text>
            </view>
          </view>
          <view class="record-right">
            <text class="record-amount" :class="record.type === 'RECHARGE' ? 'recharge' : 'consume'">
              {{ record.type === 'RECHARGE' ? '+' : '-' }}¥{{ record.amount.toFixed(2) }}
            </text>
            <text class="record-balance">余额：¥{{ record.balance.toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <view class="empty-tip" v-if="recordsList.length === 0 && !loading">
        <text>暂无交易记录</text>
      </view>

      <view class="loading-tip" v-if="loading">
        <text>加载中...</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { storedApi, type StoredCardInfo, type StoredRecord } from '@/api/stored'

const storedInfo = ref<StoredCardInfo>({
  cardNo: '',
  balance: 0,
  totalRecharge: 0,
  totalConsume: 0
})

const recordsList = ref<StoredRecord[]>([])
const activeTab = ref('all')
const loading = ref(false)

const formatTime = (time: string): string => {
  if (!time) return ''
  return time.substring(0, 16)
}

const loadStoredInfo = async () => {
  try {
    const result = await storedApi.getStoredCardInfo()
    storedInfo.value = result
  } catch (error) {
    console.error('加载储值卡信息失败:', error)
    storedInfo.value = {
      cardNo: '6666 **** **** 8888',
      balance: 588.50,
      totalRecharge: 1000,
      totalConsume: 411.50,
      grade: '黄金会员',
      gradeIcon: '👑'
    }
  }
}

const loadRecords = async () => {
  loading.value = true
  try {
    const result = await storedApi.getStoredRecords({
      type: activeTab.value === 'all' ? undefined : activeTab.value,
      page: 1,
      pageSize: 20
    })
    recordsList.value = result.records
  } catch (error) {
    console.error('加载交易记录失败:', error)
    const mockData: StoredRecord[] = [
      { id: 1, type: 'RECHARGE', amount: 500, balance: 588.50, reason: '微信充值', createdAt: '2026-07-15 14:30:00' },
      { id: 2, type: 'CONSUME', amount: 199, balance: 88.50, reason: '订单消费', orderNo: 'SO20260710001', createdAt: '2026-07-10 16:00:00' },
      { id: 3, type: 'RECHARGE', amount: 300, balance: 287.50, reason: '微信充值', createdAt: '2026-07-05 10:20:00' },
      { id: 4, type: 'CONSUME', amount: 112.5, balance: -12.5, reason: '订单消费', orderNo: 'SO20260703002', createdAt: '2026-07-03 14:10:00' },
      { id: 5, type: 'RECHARGE', amount: 200, balance: 187.50, reason: '首充奖励', createdAt: '2026-07-01 09:00:00' }
    ]

    recordsList.value = mockData.filter(item => {
      if (activeTab.value === 'all') return true
      return item.type === activeTab.value
    })
  } finally {
    loading.value = false
  }
}

const switchTab = (tab: string) => {
  activeTab.value = tab
  loadRecords()
}

const goRecharge = () => {
  Taro.navigateTo({ url: '/pages/stored/recharge' })
}

onMounted(() => {
  loadStoredInfo()
  loadRecords()
})
</script>

<style lang="scss" scoped>
.stored-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.stored-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  padding: $spacing-xl $spacing-md $spacing-lg;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
}

.card-wrap {
  margin-bottom: $spacing-lg;
}

.stored-card {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  border-radius: $radius-xl;
  padding: $spacing-lg;
  color: #8b6914;
  box-shadow: $shadow-lg;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-lg;
}

.card-logo {
  font-size: 48rpx;
}

.card-grade {
  padding: $spacing-xs $spacing-md;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: $radius-lg;
  font-size: $font-size-xs;
  font-weight: 500;
}

.card-balance {
  margin-bottom: $spacing-md;
}

.balance-label {
  font-size: $font-size-sm;
  opacity: 0.8;
  display: block;
  margin-bottom: $spacing-xs;
}

.balance-value {
  font-size: 56rpx;
  font-weight: bold;
  line-height: 1;
}

.card-no {
  font-size: $font-size-sm;
  opacity: 0.7;
  letter-spacing: 2rpx;
}

.card-stats {
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

.action-buttons {
  padding: $spacing-md;
  margin-top: -#{$spacing-sm};
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  font-weight: 500;

  &.primary {
    background-color: $primary-color;
    color: #fff;
  }
}

.btn-icon {
  font-size: $font-size-lg;
  margin-right: $spacing-sm;
}

.records-section {
  background-color: $bg-primary;
  margin: 0 $spacing-md $spacing-md;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.section-header {
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.tab-switch {
  display: flex;
  background-color: $bg-secondary;
  border-radius: $radius-md;
  padding: 4rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-sm $spacing-md;
  font-size: $font-size-sm;
  color: $text-secondary;
  border-radius: $radius-sm;
  transition: all 0.3s ease;

  &.active {
    background-color: $bg-primary;
    color: $primary-color;
    font-weight: 500;
  }
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
  align-items: center;
}

.record-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-lg;
  font-weight: bold;
  margin-right: $spacing-md;

  &.recharge {
    background-color: $success-soft;
    color: $success-color;
  }

  &.consume {
    background-color: $error-soft;
    color: $error-color;
  }
}

.record-info {
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

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.record-amount {
  font-size: $font-size-base;
  font-weight: bold;
  margin-bottom: 4rpx;

  &.recharge {
    color: $success-color;
  }

  &.consume {
    color: $text-primary;
  }
}

.record-balance {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.empty-tip,
.loading-tip {
  text-align: center;
  padding: $spacing-xl 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>
