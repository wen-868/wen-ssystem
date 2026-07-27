<template>
  <view class="seckill-detail-page">
    <scroll-view class="detail-scroll" scroll-y v-if="activity">
      <!-- 商品信息 -->
      <view class="product-section">
        <view class="product-image-wrap">
          <view class="product-image">
            <text class="image-icon">🍷</text>
          </view>
          <view class="seckill-badge">秒杀</view>
          <!-- 倒计时标签 -->
          <view class="countdown-badge" v-if="activity.status === 'ACTIVE'">
            <text class="countdown-label">距结束</text>
            <view class="countdown-time">
              <text class="time-block">{{ countdown.hours }}</text>
              <text class="time-colon">:</text>
              <text class="time-block">{{ countdown.minutes }}</text>
              <text class="time-colon">:</text>
              <text class="time-block">{{ countdown.seconds }}</text>
            </view>
          </view>
        </view>
        <view class="product-info">
          <text class="product-name">{{ activity.productName }}</text>
          <view class="price-row">
            <text class="seckill-price-symbol">¥</text>
            <text class="seckill-price">{{ activity.seckillPrice }}</text>
            <text class="original-price">¥{{ activity.originalPrice }}</text>
            <view class="discount-tag">
              <text>{{ discountPercent }}折</text>
            </view>
          </view>
          <view class="stock-row">
            <view class="stock-item">
              <text class="stock-label">秒杀库存</text>
              <text class="stock-value">{{ activity.seckillStock }}件</text>
            </view>
            <view class="stock-item">
              <text class="stock-label">剩余库存</text>
              <text class="stock-value highlight">{{ activity.availableStock }}件</text>
            </view>
            <view class="stock-item">
              <text class="stock-label">每人限购</text>
              <text class="stock-value">{{ activity.limitPerUser }}件</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 库存进度 -->
      <view class="stock-progress-section">
        <view class="progress-header">
          <text class="progress-label">已抢</text>
          <text class="progress-percent">{{ soldPercent }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: soldPercent + '%' }"></view>
        </view>
        <text class="progress-text">已售{{ activity.seckillStock - activity.availableStock }}件，剩余{{ activity.availableStock }}件</text>
      </view>

      <!-- 活动时间 -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">活动时间</text>
        </view>
        <view class="time-info">
          <view class="time-row">
            <text class="time-label">开始时间</text>
            <text class="time-value">{{ formatDateTime(activity.startTime) }}</text>
          </view>
          <view class="time-row">
            <text class="time-label">结束时间</text>
            <text class="time-value">{{ formatDateTime(activity.endTime) }}</text>
          </view>
        </view>
      </view>

      <!-- 活动说明 -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">活动说明</text>
        </view>
        <view class="rule-list">
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">秒杀商品数量有限，先到先得，售完即止</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">每人限购{{ activity.limitPerUser }}件，超出部分按原价购买</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">秒杀商品不支持退换货，敬请谅解</text>
          </view>
          <view class="rule-item">
            <text class="rule-dot">·</text>
            <text class="rule-text">秒杀订单需在15分钟内完成支付，逾期自动取消</text>
          </view>
        </view>
      </view>

      <!-- 商品详情（模拟） -->
      <view class="section">
        <view class="section-header">
          <view class="section-title-bar"></view>
          <text class="section-title">商品详情</text>
        </view>
        <view class="product-detail">
          <view class="detail-row">
            <text class="detail-label">商品名称</text>
            <text class="detail-value">{{ activity.productName }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">商品编号</text>
            <text class="detail-value">SP{{ activity.productId }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">原价</text>
            <text class="detail-value">¥{{ activity.originalPrice }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">秒杀价</text>
            <text class="detail-value highlight">¥{{ activity.seckillPrice }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-placeholder"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="activity">
      <view class="status-tag" :class="'tag-' + activity.status">
        <text>{{ getStatusLabel(activity.status) }}</text>
      </view>
      <view class="quantity-wrap" v-if="activity.status === 'ACTIVE'">
        <view class="quantity-btn" @tap="decreaseQty">
          <text>-</text>
        </view>
        <text class="quantity-value">{{ quantity }}</text>
        <view class="quantity-btn" @tap="increaseQty">
          <text>+</text>
        </view>
      </view>
      <button
        class="action-btn seckill-btn"
        :class="{ disabled: activity.status !== 'ACTIVE' || activity.availableStock <= 0 }"
        :disabled="activity.status !== 'ACTIVE' || activity.availableStock <= 0"
        @tap="handleSeckill"
      >
        {{ getButtonText() }}
      </button>
    </view>

    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { communityMarketingApi, type SeckillActivity } from '@/api/modules/community-marketing'

const activity = ref<SeckillActivity | null>(null)
const loading = ref(false)
const quantity = ref(1)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const discountPercent = computed(() => {
  if (!activity.value) return 0
  return Math.round((activity.value.seckillPrice / activity.value.originalPrice) * 100) / 10
})

const soldPercent = computed(() => {
  if (!activity.value || activity.value.seckillStock === 0) return 0
  const sold = activity.value.seckillStock - activity.value.availableStock
  return Math.round((sold / activity.value.seckillStock) * 100)
})

const countdown = computed(() => {
  if (!activity.value) return { hours: '00', minutes: '00', seconds: '00' }
  const endTime = new Date(activity.value.endTime).getTime()
  const diff = Math.max(0, endTime - now.value)
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return {
    hours: padZero(hours),
    minutes: padZero(minutes),
    seconds: padZero(seconds),
  }
})

function padZero(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '即将开始',
    ACTIVE: '进行中',
    ENDED: '已结束',
  }
  return map[status] || status
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 16)
}

function getButtonText(): string {
  if (!activity.value) return '立即秒杀'
  if (activity.value.status === 'DRAFT') return '即将开始'
  if (activity.value.status === 'ENDED') return '已结束'
  if (activity.value.availableStock <= 0) return '已抢光'
  return '立即秒杀'
}

function decreaseQty() {
  if (quantity.value > 1) {
    quantity.value--
  }
}

function increaseQty() {
  if (activity.value && quantity.value < activity.value.limitPerUser) {
    quantity.value++
  } else if (activity.value) {
    uni.showToast({ title: `每人限购${activity.value.limitPerUser}件`, icon: 'none' })
  }
}

async function loadDetail() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const id = Number(currentPage?.options?.id || 0)
  if (!id) return

  loading.value = true
  try {
    const result = await communityMarketingApi.getSeckill(id)
    activity.value = result
  } catch (err) {
    console.error('加载秒杀详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleSeckill() {
  if (!activity.value) return
  uni.showModal({
    title: '确认秒杀',
    content: `确定以秒杀价¥${activity.value.seckillPrice}购买${quantity.value}件吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await communityMarketingApi.buySeckill(activity.value!.id, quantity.value)
          uni.showToast({ title: '秒杀成功', icon: 'success' })
        } catch (err) {
          console.error('秒杀失败:', err)
        }
      }
    }
  })
}

function startTimer() {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  loadDetail()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.seckill-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
  position: relative;
}

.detail-scroll {
  height: calc(100vh - 120rpx);
}

.product-section {
  background: #fff;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.product-image-wrap {
  width: 100%;
  height: 400rpx;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.product-image {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff7e6, #ffd591);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 120rpx;
}

.seckill-badge {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  background: #fa8c16;
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.countdown-badge {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.countdown-label {
  font-size: 22rpx;
}

.countdown-time {
  display: flex;
  align-items: center;
  gap: 2rpx;
}

.time-block {
  background: #fff;
  color: #fa8c16;
  font-size: 22rpx;
  font-weight: 600;
  padding: 2rpx 6rpx;
  border-radius: 4rpx;
  min-width: 32rpx;
  text-align: center;
}

.time-colon {
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
}

.product-info {
  padding: 0 8rpx;
}

.product-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
  margin-bottom: 16rpx;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.seckill-price-symbol {
  font-size: 28rpx;
  color: #fa8c16;
  font-weight: 600;
}

.seckill-price {
  font-size: 48rpx;
  font-weight: 700;
  color: #fa8c16;
}

.original-price {
  font-size: 26rpx;
  color: #bbb;
  text-decoration: line-through;
  margin-left: 12rpx;
}

.discount-tag {
  background: #fff2e8;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  margin-left: 12rpx;
}

.discount-tag text {
  font-size: 22rpx;
  color: #fa8c16;
  font-weight: 500;
}

.stock-row {
  display: flex;
  background: #f9f9f9;
  border-radius: 8rpx;
  padding: 16rpx 0;
}

.stock-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  border-right: 1rpx solid #e8e8e8;
}

.stock-item:last-child {
  border-right: none;
}

.stock-label {
  font-size: 22rpx;
  color: #999;
}

.stock-value {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.stock-value.highlight {
  color: #fa8c16;
}

.stock-progress-section {
  background: #fff;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.progress-label {
  font-size: 26rpx;
  color: #666;
}

.progress-percent {
  font-size: 26rpx;
  color: #fa8c16;
  font-weight: 600;
}

.progress-bar {
  height: 16rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fa8c16, #ffa940);
  border-radius: 8rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #999;
  text-align: center;
}

.section {
  background: #fff;
  margin-bottom: 16rpx;
  padding: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title-bar {
  width: 6rpx;
  height: 28rpx;
  background: #fa8c16;
  border-radius: 3rpx;
  margin-right: 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-label {
  font-size: 26rpx;
  color: #999;
}

.time-value {
  font-size: 26rpx;
  color: #333;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
}

.rule-dot {
  color: #fa8c16;
  font-size: 24rpx;
  line-height: 1.6;
}

.rule-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
  flex: 1;
}

.product-detail {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.detail-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.detail-label {
  font-size: 26rpx;
  color: #999;
}

.detail-value {
  font-size: 26rpx;
  color: #333;
}

.detail-value.highlight {
  color: #fa8c16;
  font-weight: 600;
}

.bottom-placeholder {
  height: 140rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  gap: 16rpx;
}

.status-tag {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.tag-DRAFT { background: #e6f7ff; color: #1677FF; }
.tag-ACTIVE { background: #f6ffed; color: #52c41a; }
.tag-ENDED { background: #f5f5f5; color: #999; }

.quantity-wrap {
  display: flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
}

.quantity-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 32rpx;
  color: #666;
}

.quantity-value {
  width: 64rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.action-btn::after {
  border: none;
}

.seckill-btn {
  background: linear-gradient(135deg, #fa8c16, #ffa940);
  color: #fff;
}

.seckill-btn.disabled {
  background: #d9d9d9;
  color: #fff;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
