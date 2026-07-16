<template>
  <view class="settle-page">
    <view class="page-header">
      <text class="header-title">日结管理</text>
    </view>

    <!-- 日期选择 -->
    <view class="date-bar">
      <view class="date-prev" @tap="changeDate(-1)">&#xe616;</view>
      <picker mode="date" :value="settleDate" @change="onDateChange">
        <view class="date-display">
          <text class="date-icon">&#xe613;</text>
          <text class="date-text">{{ displayDate }}</text>
        </view>
      </picker>
      <view class="date-next" @tap="changeDate(1)">&#xe616;</view>
    </view>

    <scroll-view class="settle-body" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
      <!-- 加载状态 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-text">加载中...</text>
      </view>

      <template v-else-if="settleInfo">
        <!-- 状态标识 -->
        <view class="status-bar">
          <view class="status-badge" :class="settleInfo.status === 'settled' ? 'status-badge--settled' : 'status-badge--pending'">
            <text class="status-text">{{ settleInfo.status === 'settled' ? '已日结' : '待日结' }}</text>
          </view>
          <text class="settle-time" v-if="settleInfo.settledAt">日结时间：{{ settleInfo.settledAt }}</text>
          <text class="settle-time" v-if="settleInfo.settledBy">操作人：{{ settleInfo.settledBy }}</text>
        </view>

        <!-- 销售汇总 -->
        <view class="summary-card">
          <view class="card-title">销售汇总</view>
          <view class="total-row">
            <text class="total-label">总销售额</text>
            <text class="total-value">¥{{ formatAmount(settleInfo.totalAmount) }}</text>
          </view>
          <view class="meta-grid">
            <view class="meta-item">
              <text class="meta-label">订单数</text>
              <text class="meta-value">{{ settleInfo.totalOrders }} 笔</text>
            </view>
            <view class="meta-item">
              <text class="meta-label">客单价</text>
              <text class="meta-value">¥{{ formatAmount(settleInfo.avgOrderAmount) }}</text>
            </view>
          </view>
        </view>

        <!-- 收款方式汇总 -->
        <view class="channel-card">
          <view class="card-title">收款方式汇总</view>
          <view class="channel-list">
            <view class="channel-row">
              <view class="channel-info">
                <text class="channel-icon channel-icon--cash">¥</text>
                <text class="channel-name">现金</text>
              </view>
              <text class="channel-amount">¥{{ formatAmount(settleInfo.cashAmount) }}</text>
            </view>
            <view class="channel-row">
              <view class="channel-info">
                <text class="channel-icon channel-icon--wechat">W</text>
                <text class="channel-name">微信支付</text>
              </view>
              <text class="channel-amount">¥{{ formatAmount(settleInfo.wechatAmount) }}</text>
            </view>
            <view class="channel-row">
              <view class="channel-info">
                <text class="channel-icon channel-icon--alipay">A</text>
                <text class="channel-name">支付宝</text>
              </view>
              <text class="channel-amount">¥{{ formatAmount(settleInfo.alipayAmount) }}</text>
            </view>
            <view class="channel-row">
              <view class="channel-info">
                <text class="channel-icon channel-icon--card">S</text>
                <text class="channel-name">储值卡</text>
              </view>
              <text class="channel-amount">¥{{ formatAmount(settleInfo.storeCardAmount) }}</text>
            </view>
          </view>
        </view>

        <!-- 优惠与退款 -->
        <view class="extra-card">
          <view class="card-title">优惠与退款</view>
          <view class="extra-row">
            <text class="extra-label">优惠总额</text>
            <text class="extra-value extra-value--discount">- ¥{{ formatAmount(settleInfo.discountAmount) }}</text>
          </view>
          <view class="extra-row">
            <text class="extra-label">退款金额</text>
            <text class="extra-value extra-value--refund">- ¥{{ formatAmount(settleInfo.refundAmount) }}</text>
          </view>
          <view class="extra-row">
            <text class="extra-label">退款订单</text>
            <text class="extra-value">{{ settleInfo.refundOrders }} 笔</text>
          </view>
          <view class="extra-row">
            <text class="extra-label">会员积分使用</text>
            <text class="extra-value">{{ settleInfo.memberPointsUsed }} 分</text>
          </view>
        </view>

        <!-- 日结操作 -->
        <button
          v-if="settleInfo.status === 'pending'"
          class="settle-btn"
          :disabled="submitting"
          @tap="onSettle"
        >
          {{ submitting ? '处理中...' : '执行日结' }}
        </button>
        <view class="settled-tip" v-else>
          <text class="settled-icon">&#xe610;</text>
          <text class="settled-text">当日已完成日结</text>
        </view>
      </template>

      <!-- 空状态 -->
      <view class="empty-state" v-else>
        <text class="empty-icon">&#xe631;</text>
        <text class="empty-text">当日无交易数据</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { dailySettleApi, type DailySettleInfo } from '@/api/modules/cashier'

const settleDate = ref(formatDate(new Date()))
const settleInfo = ref<DailySettleInfo | null>(null)
const loading = ref(false)
const submitting = ref(false)
const refresherTriggered = ref(false)

const displayDate = computed(() => {
  const d = new Date(settleDate.value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(settleDate.value)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  let prefix = ''
  if (diffDays === 0) prefix = '今天 · '
  else if (diffDays === 1) prefix = '昨天 · '
  else if (diffDays === -1) prefix = '明天 · '
  return prefix + settleDate.value
})

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatAmount(amount: number): string {
  return (amount || 0).toFixed(2)
}

function onDateChange(e: any) {
  settleDate.value = e.detail.value
  loadSettle()
}

function changeDate(delta: number) {
  const d = new Date(settleDate.value)
  d.setDate(d.getDate() + delta)
  settleDate.value = formatDate(d)
  loadSettle()
}

async function loadSettle() {
  loading.value = true
  try {
    settleInfo.value = await dailySettleApi.getDailySettle(settleDate.value)
  } catch (err) {
    settleInfo.value = null
  } finally {
    loading.value = false
  }
}

async function onSettle() {
  if (submitting.value || !settleInfo.value) return
  uni.showModal({
    title: '确认日结',
    content: `日期：${settleDate.value}\n总销售额：¥${formatAmount(settleInfo.value.totalAmount)}\n订单数：${settleInfo.value.totalOrders} 笔\n\n日结后当日数据将锁定，确认执行？`,
    success: async (res) => {
      if (!res.confirm) return
      submitting.value = true
      try {
        const result = await dailySettleApi.settle(settleDate.value)
        settleInfo.value = result
        uni.showToast({ title: '日结成功', icon: 'success' })
      } catch (err) {
        uni.showToast({ title: '日结失败', icon: 'none' })
      } finally {
        submitting.value = false
      }
    }
  })
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await loadSettle()
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadSettle()
})
</script>

<style scoped>
.settle-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

/* 日期选择 */
.date-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.date-prev,
.date-next {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #1677FF;
}

.date-next {
  transform: rotate(180deg);
}

.date-display {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.date-icon {
  font-size: 28rpx;
  color: #1677FF;
}

.date-text {
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}

.settle-body {
  flex: 1;
  padding: 16rpx 24rpx;
}

.loading-state {
  padding: 120rpx 0;
  text-align: center;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

/* 状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 0;
  flex-wrap: wrap;
}

.status-badge {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
}

.status-badge--pending {
  background: #fff7e6;
}

.status-badge--pending .status-text {
  color: #fa8c16;
  font-size: 24rpx;
}

.status-badge--settled {
  background: #f6ffed;
}

.status-badge--settled .status-text {
  color: #52c41a;
  font-size: 24rpx;
}

.settle-time {
  font-size: 24rpx;
  color: #999;
}

/* 汇总卡片 */
.summary-card,
.channel-card,
.extra-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20rpx;
}

.total-label {
  font-size: 28rpx;
  color: #666;
}

.total-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.meta-item {
  background: #f9fbff;
  border-radius: 12rpx;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.meta-label {
  font-size: 24rpx;
  color: #999;
}

.meta-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

/* 收款方式 */
.channel-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.channel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.channel-row:last-child {
  border-bottom: none;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.channel-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
}

.channel-icon--cash {
  background: #fa8c16;
}

.channel-icon--wechat {
  background: #52c41a;
}

.channel-icon--alipay {
  background: #1677FF;
}

.channel-icon--card {
  background: #722ed1;
}

.channel-name {
  font-size: 28rpx;
  color: #333;
}

.channel-amount {
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}

/* 优惠与退款 */
.extra-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.extra-row:last-child {
  border-bottom: none;
}

.extra-label {
  font-size: 26rpx;
  color: #666;
}

.extra-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.extra-value--discount {
  color: #fa8c16;
}

.extra-value--refund {
  color: #ff4d4f;
}

/* 日结按钮 */
.settle-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 20rpx;
}

.settle-btn::after {
  border: none;
}

.settle-btn[disabled] {
  opacity: 0.5;
}

.settled-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx 0;
}

.settled-icon {
  font-size: 32rpx;
  color: #52c41a;
}

.settled-text {
  font-size: 28rpx;
  color: #52c41a;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.safe-bottom {
  height: 40rpx;
}
</style>
