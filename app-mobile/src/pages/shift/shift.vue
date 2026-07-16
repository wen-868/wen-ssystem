<template>
  <view class="shift-page">
    <view class="page-header">
      <text class="header-title">交接班</text>
    </view>

    <scroll-view class="shift-body" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
      <!-- 当前班次状态卡片 -->
      <view class="current-card" v-if="currentShift">
        <view class="card-status-row">
          <view class="status-badge status-badge--active">
            <text class="status-text">进行中</text>
          </view>
          <text class="shift-no">班次号：{{ currentShift.shiftNo }}</text>
        </view>
        <view class="card-info">
          <view class="info-row">
            <text class="info-label">操作员</text>
            <text class="info-value">{{ currentShift.operatorName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">开始时间</text>
            <text class="info-value">{{ currentShift.startTime }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">已运行</text>
            <text class="info-value info-value--highlight">{{ runningDuration }}</text>
          </view>
        </view>

        <!-- 本班汇总 -->
        <view class="summary-section">
          <view class="summary-title">本班汇总</view>
          <view class="summary-amount">
            <text class="amount-label">总销售额</text>
            <text class="amount-value">¥{{ formatAmount(currentShift.totalAmount) }}</text>
          </view>
          <view class="summary-meta">
            <text class="meta-text">订单数：{{ currentShift.totalOrders }} 笔</text>
          </view>
        </view>

        <!-- 收款方式明细 -->
        <view class="channel-detail">
          <view class="channel-row">
            <text class="channel-label">现金</text>
            <text class="channel-value">¥{{ formatAmount(currentShift.cashAmount) }}</text>
          </view>
          <view class="channel-row">
            <text class="channel-label">微信</text>
            <text class="channel-value">¥{{ formatAmount(currentShift.wechatAmount) }}</text>
          </view>
          <view class="channel-row">
            <text class="channel-label">支付宝</text>
            <text class="channel-value">¥{{ formatAmount(currentShift.alipayAmount) }}</text>
          </view>
          <view class="channel-row">
            <text class="channel-label">储值卡</text>
            <text class="channel-value">¥{{ formatAmount(currentShift.storeCardAmount) }}</text>
          </view>
        </view>

        <button class="end-shift-btn" :disabled="submitting" @tap="onEndShift">
          {{ submitting ? '处理中...' : '交班结算' }}
        </button>
      </view>

      <!-- 未开班状态 -->
      <view class="no-shift-card" v-else>
        <text class="no-shift-icon">&#xe610;</text>
        <text class="no-shift-text">当前无进行中的班次</text>
        <button class="start-shift-btn" :disabled="submitting" @tap="onStartShift">
          {{ submitting ? '处理中...' : '开始接班' }}
        </button>
      </view>

      <!-- 交接班历史 -->
      <view class="history-section">
        <view class="section-header">
          <text class="section-title">交接班历史</text>
          <text class="section-more" @tap="loadMoreHistory">查看更多 ></text>
        </view>
        <view class="history-list" v-if="historyList.length > 0">
          <view class="history-item" v-for="item in historyList" :key="item.id">
            <view class="history-header">
              <text class="history-no">{{ item.shiftNo }}</text>
              <view class="history-status history-status--closed">
                <text class="history-status-text">已交班</text>
              </view>
            </view>
            <view class="history-body">
              <view class="history-info-row">
                <text class="history-info-label">操作员</text>
                <text class="history-info-value">{{ item.operatorName }}</text>
              </view>
              <view class="history-info-row">
                <text class="history-info-label">起止时间</text>
                <text class="history-info-value">{{ item.startTime }} ~ {{ item.endTime }}</text>
              </view>
              <view class="history-info-row">
                <text class="history-info-label">销售额</text>
                <text class="history-info-value history-info-value--price">¥{{ formatAmount(item.totalAmount) }}</text>
              </view>
              <view class="history-info-row">
                <text class="history-info-label">订单数</text>
                <text class="history-info-value">{{ item.totalOrders }} 笔</text>
              </view>
            </view>
          </view>
        </view>
        <view class="empty-state" v-else>
          <text class="empty-text">暂无交接班记录</text>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { shiftApi, type ShiftInfo } from '@/api/modules/cashier'

const currentShift = ref<ShiftInfo | null>(null)
const historyList = ref<ShiftInfo[]>([])
const submitting = ref(false)
const refresherTriggered = ref(false)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const runningDuration = computed(() => {
  if (!currentShift.value?.startTime) return '0 分钟'
  const start = new Date(currentShift.value.startTime).getTime()
  const diff = now.value - start
  if (diff < 0) return '0 分钟'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours > 0) {
    return `${hours} 小时 ${remainMinutes} 分钟`
  }
  return `${minutes} 分钟`
})

function formatAmount(amount: number): string {
  return (amount || 0).toFixed(2)
}

async function loadCurrentShift() {
  try {
    currentShift.value = await shiftApi.getCurrentShift()
  } catch (err) {
    currentShift.value = null
  }
}

async function loadHistory() {
  try {
    const res = await shiftApi.listShifts({ page: 1, pageSize: 10 })
    historyList.value = res.list || []
  } catch (err) {
    historyList.value = []
  }
}

function loadMoreHistory() {
  uni.showToast({ title: '已加载最近10条记录', icon: 'none' })
}

async function onStartShift() {
  if (submitting.value) return
  submitting.value = true
  try {
    const shift = await shiftApi.startShift()
    currentShift.value = shift
    uni.showToast({ title: '接班成功', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '接班失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function onEndShift() {
  if (submitting.value || !currentShift.value) return
  uni.showModal({
    title: '确认交班',
    content: `本班销售额：¥${formatAmount(currentShift.value.totalAmount)}，订单数：${currentShift.value.totalOrders} 笔。确认交班？`,
    success: async (res) => {
      if (!res.confirm) return
      submitting.value = true
      try {
        const closed = await shiftApi.endShift(currentShift.value!.id)
        uni.showModal({
          title: '交班成功',
          content: `班次 ${closed.shiftNo} 已结束\n总销售额：¥${formatAmount(closed.totalAmount)}`,
          showCancel: false,
          success: () => {
            currentShift.value = null
            loadHistory()
          }
        })
      } catch (err) {
        uni.showToast({ title: '交班失败', icon: 'none' })
      } finally {
        submitting.value = false
      }
    }
  })
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await Promise.all([loadCurrentShift(), loadHistory()])
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadCurrentShift()
  loadHistory()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.shift-page {
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

.shift-body {
  flex: 1;
  padding: 16rpx 24rpx;
}

/* 当前班次卡片 */
.current-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.status-badge {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
}

.status-badge--active {
  background: #f6ffed;
}

.status-badge--active .status-text {
  color: #52c41a;
  font-size: 24rpx;
}

.shift-no {
  font-size: 24rpx;
  color: #999;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 26rpx;
  color: #999;
}

.info-value {
  font-size: 28rpx;
  color: #333;
}

.info-value--highlight {
  color: #1677FF;
  font-weight: 600;
}

/* 汇总 */
.summary-section {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.summary-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.summary-amount {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8rpx;
}

.amount-label {
  font-size: 26rpx;
  color: #666;
}

.amount-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #ff4d4f;
}

.summary-meta {
  display: flex;
}

.meta-text {
  font-size: 24rpx;
  color: #999;
}

/* 收款方式明细 */
.channel-detail {
  padding: 20rpx 0;
}

.channel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}

.channel-label {
  font-size: 26rpx;
  color: #666;
}

.channel-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.end-shift-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #fa8c16, #ffa940);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 16rpx;
}

.end-shift-btn::after {
  border: none;
}

.end-shift-btn[disabled] {
  opacity: 0.5;
}

/* 未开班 */
.no-shift-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 80rpx 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.no-shift-icon {
  font-size: 80rpx;
  color: #1677FF;
  margin-bottom: 20rpx;
}

.no-shift-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.start-shift-btn {
  width: 400rpx;
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
}

.start-shift-btn::after {
  border: none;
}

.start-shift-btn[disabled] {
  opacity: 0.5;
}

/* 历史记录 */
.history-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.section-more {
  font-size: 26rpx;
  color: #1677FF;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.history-item {
  background: #f9fbff;
  border-radius: 12rpx;
  padding: 20rpx;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.history-no {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
}

.history-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.history-status--closed {
  background: #f5f5f5;
}

.history-status-text {
  font-size: 22rpx;
  color: #999;
}

.history-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.history-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-info-label {
  font-size: 24rpx;
  color: #999;
}

.history-info-value {
  font-size: 26rpx;
  color: #333;
}

.history-info-value--price {
  color: #fa8c16;
  font-weight: 600;
}

.empty-state {
  padding: 60rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #bbb;
}

.safe-bottom {
  height: 40rpx;
}
</style>
