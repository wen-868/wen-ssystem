<template>
  <view class="track-page">
    <!-- 物流状态头部 -->
    <view class="track-header">
      <view class="header-icon">{{ getStatusIcon(logisticsInfo?.status) }}</view>
      <view class="header-info">
        <text class="header-status">{{ getStatusText(logisticsInfo?.status) }}</text>
        <text class="header-desc" v-if="logisticsInfo?.traces?.[0]">
          {{ logisticsInfo.traces[0].description }}
        </text>
      </view>
    </view>

    <!-- 物流公司信息 -->
    <view class="company-card" v-if="logisticsInfo">
      <view class="company-row">
        <text class="company-label">物流公司</text>
        <text class="company-value">{{ logisticsInfo.company }}</text>
      </view>
      <view class="company-row">
        <text class="company-label">运单号</text>
        <view class="company-value-wrap">
          <text class="company-value">{{ logisticsInfo.trackingNo }}</text>
          <text class="copy-btn" @tap="copyTrackingNo">复制</text>
        </view>
      </view>
    </view>

    <!-- 物流时间线 -->
    <view class="timeline-card">
      <view class="timeline-title">物流轨迹</view>
      <view class="timeline-list" v-if="logisticsInfo?.traces?.length > 0">
        <view
          class="timeline-item"
          v-for="(trace, index) in logisticsInfo.traces"
          :key="index"
          :class="{ first: index === 0 }"
        >
          <view class="timeline-dot">
            <view class="dot-inner" :class="{ active: index === 0 }"></view>
          </view>
          <view class="timeline-line" v-if="index < logisticsInfo.traces.length - 1"></view>
          <view class="timeline-content">
            <text class="timeline-desc">{{ trace.description }}</text>
            <text class="timeline-time">{{ formatTime(trace.time) }}</text>
            <text class="timeline-location" v-if="trace.location">{{ trace.location }}</text>
          </view>
        </view>
      </view>
      <view class="timeline-empty" v-else>
        <text class="empty-text">暂无物流信息</text>
      </view>
    </view>

    <!-- 查看订单按钮 -->
    <view class="bottom-actions">
      <view class="action-btn" @tap="goOrderDetail">查看订单</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { orderApi, type OrderLogistics } from '@/api/order'

const router = useRouter()

const orderId = ref<number>(0)
const logisticsInfo = ref<OrderLogistics | null>(null)

const getStatusText = (status?: string): string => {
  const map: Record<string, string> = {
    pickup: '已揽收',
    transit: '运输中',
    delivery: '派送中',
    signed: '已签收',
    exception: '异常'
  }
  return status ? (map[status] || status) : '运输中'
}

const getStatusIcon = (status?: string): string => {
  const map: Record<string, string> = {
    pickup: '📦',
    transit: '🚚',
    delivery: '🛵',
    signed: '✅',
    exception: '⚠️'
  }
  return status ? (map[status] || '🚚') : '🚚'
}

const formatTime = (timeStr: string): string => {
  const date = new Date(timeStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

const loadLogistics = async () => {
  if (!orderId.value) return

  try {
    Taro.showLoading({ title: '加载中' })
    const data = await orderApi.getLogistics(orderId.value)
    logisticsInfo.value = data
  } catch (error) {
    console.error('加载物流信息失败:', error)
  } finally {
    Taro.hideLoading()
  }
}

const copyTrackingNo = () => {
  if (!logisticsInfo.value?.trackingNo) return
  Taro.setClipboardData({
    data: logisticsInfo.value.trackingNo,
    success: () => {
      Taro.showToast({ title: '复制成功', icon: 'success' })
    }
  })
}

const goOrderDetail = () => {
  Taro.redirectTo({ url: `/pages/order/detail?id=${orderId.value}` })
}

onMounted(() => {
  const id = router.params.id
  if (id) {
    orderId.value = parseInt(id)
    loadLogistics()
  } else {
    Taro.showToast({ title: '订单参数错误', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.track-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 160rpx;
}

.track-header {
  display: flex;
  align-items: center;
  padding: $spacing-xl $spacing-md;
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
  color: #fff;
}

.header-icon {
  font-size: 80rpx;
  margin-right: $spacing-md;
}

.header-info {
  flex: 1;
}

.header-status {
  display: block;
  font-size: $font-size-xl;
  font-weight: bold;
  margin-bottom: $spacing-xs;
}

.header-desc {
  font-size: $font-size-sm;
  opacity: 0.9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.company-card {
  margin: -40rpx $spacing-md $spacing-md;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
}

.company-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm 0;

  &:first-child {
    padding-top: 0;
    border-bottom: 1rpx solid $border-color;
  }

  &:last-child {
    padding-bottom: 0;
  }
}

.company-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  flex-shrink: 0;
}

.company-value-wrap {
  display: flex;
  align-items: center;
}

.company-value {
  font-size: $font-size-sm;
  color: $text-primary;
  word-break: break-all;
  text-align: right;
}

.copy-btn {
  font-size: $font-size-xs;
  color: $primary-color;
  margin-left: $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  border: 1rpx solid $primary-color;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.timeline-card {
  margin: 0 $spacing-md;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
}

.timeline-title {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: bold;
  margin-bottom: $spacing-md;
}

.timeline-list {
  position: relative;
  padding-left: 40rpx;
}

.timeline-item {
  position: relative;
  padding-bottom: $spacing-lg;

  &:last-child {
    padding-bottom: 0;
  }

  &.first {
    .dot-inner {
      background-color: $primary-color;
      transform: scale(1.2);
    }

    .timeline-desc {
      color: $primary-color;
      font-weight: bold;
    }
  }
}

.timeline-dot {
  position: absolute;
  left: -40rpx;
  top: 4rpx;
  width: 24rpx;
  height: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot-inner {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background-color: $border-color;
  transition: all 0.2s;

  &.active {
    background-color: $primary-color;
  }
}

.timeline-line {
  position: absolute;
  left: -33rpx;
  top: 28rpx;
  width: 2rpx;
  bottom: -$spacing-lg + 28rpx;
  background-color: $border-color;
}

.timeline-content {
  padding-left: $spacing-sm;
}

.timeline-desc {
  display: block;
  font-size: $font-size-sm;
  color: $text-primary;
  line-height: 1.5;
  margin-bottom: $spacing-xs;
}

.timeline-time {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-right: $spacing-sm;
}

.timeline-location {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.timeline-empty {
  text-align: center;
  padding: $spacing-xl 0;
}

.empty-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
}

.action-btn {
  width: 100%;
  padding: $spacing-md;
  background-color: $primary-color;
  color: #fff;
  text-align: center;
  border-radius: $radius-lg;
  font-size: $font-size-base;
  font-weight: bold;
}
</style>
