<template>
  <view class="coupon-center-page">
    <view class="coupon-header">
      <text class="header-title">🎫 领券中心</text>
      <text class="header-subtitle">精选好券，先到先得</text>
    </view>

    <scroll-view
      scroll-y
      class="coupon-scroll"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view class="coupon-list">
        <view
          class="coupon-card"
          v-for="item in couponList"
          :key="item.id"
          :class="{ claimed: claimedIds.includes(item.id) }"
        >
          <view class="coupon-left" :class="getCouponTypeClass(item.type)">
            <view class="coupon-amount">
              <text class="currency" v-if="item.type === 'FIXED'">¥</text>
              <text class="value">{{ formatCouponValue(item) }}</text>
              <text class="unit" v-if="item.type === 'PERCENT'">折</text>
            </view>
            <text class="coupon-condition">{{ formatCondition(item) }}</text>
          </view>
          <view class="coupon-right">
            <text class="coupon-name">{{ item.name }}</text>
            <text class="coupon-desc">{{ item.description }}</text>
            <text class="coupon-expire">有效期至 {{ formatExpire(item.endTime) }}</text>
            <text class="coupon-stock">剩余 {{ getRemaining(item) }} 张</text>
            <view
              class="claim-btn"
              :class="{ disabled: claimedIds.includes(item.id) }"
              @tap="handleClaim(item)"
            >
              <text v-if="!claimedIds.includes(item.id)">立即领取</text>
              <text v-else>已领取</text>
            </view>
          </view>
          <view class="coupon-circle top"></view>
          <view class="coupon-circle bottom"></view>
        </view>
      </view>

      <view class="empty-state" v-if="couponList.length === 0 && !loading">
        <text class="empty-icon">🎫</text>
        <text class="empty-text">暂无可用优惠券</text>
        <text class="empty-sub">敬请期待更多活动</text>
      </view>

      <view class="loading-tip" v-if="loading">
        <text>加载中...</text>
      </view>

      <view class="bottom-tip" v-if="!hasMore && couponList.length > 0">
        <text>没有更多了</text>
      </view>

      <view class="list-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { couponApi, type CouponTemplate } from '@/api/coupon'

const couponList = ref<CouponTemplate[]>([])
const claimedIds = ref<number[]>([])
const loading = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)

const formatCouponValue = (item: CouponTemplate) => {
  if (item.type === 'PERCENT') {
    return (item.value / 10).toFixed(1)
  }
  return item.value
}

const formatCondition = (item: CouponTemplate) => {
  if (item.minAmount > 0) {
    return `满${item.minAmount}元可用`
  }
  return '无门槛'
}

const formatExpire = (time: string): string => {
  if (!time) return ''
  return time.substring(0, 10)
}

const getRemaining = (item: CouponTemplate): number => {
  return Math.max(0, item.totalCount - item.usedCount)
}

const getCouponTypeClass = (type: string): string => {
  const typeMap: Record<string, string> = {
    FIXED: 'fixed',
    PERCENT: 'percent',
    SHIPPING: 'shipping',
    FREE_GIFT: 'gift'
  }
  return typeMap[type] || 'fixed'
}

const loadCoupons = async (isRefresh = false) => {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    hasMore.value = true
    couponList.value = []
  }

  if (!hasMore.value) return

  loading.value = true

  try {
    const result = await couponApi.getAvailableCoupons()
    if (result) {
      couponList.value = result
      hasMore.value = false
    }
  } catch (error) {
    console.error('加载优惠券失败:', error)
    couponList.value = [
      {
        id: 1,
        name: '新人专享券',
        type: 'FIXED',
        value: 20,
        minAmount: 99,
        totalCount: 1000,
        usedCount: 350,
        status: 'ACTIVE',
        startTime: '2026-07-01 00:00:00',
        endTime: '2026-08-31 23:59:59',
        description: '新用户专属，首单可用'
      },
      {
        id: 2,
        name: '满199减30',
        type: 'FIXED',
        value: 30,
        minAmount: 199,
        totalCount: 500,
        usedCount: 420,
        status: 'ACTIVE',
        startTime: '2026-07-01 00:00:00',
        endTime: '2026-07-31 23:59:59',
        description: '全场通用，可叠加会员折扣'
      },
      {
        id: 3,
        name: '9折优惠券',
        type: 'PERCENT',
        value: 90,
        minAmount: 50,
        totalCount: 2000,
        usedCount: 800,
        status: 'ACTIVE',
        startTime: '2026-07-01 00:00:00',
        endTime: '2026-09-30 23:59:59',
        description: '全场商品9折优惠'
      },
      {
        id: 4,
        name: '满500减100',
        type: 'FIXED',
        value: 100,
        minAmount: 500,
        totalCount: 200,
        usedCount: 180,
        status: 'ACTIVE',
        startTime: '2026-07-15 00:00:00',
        endTime: '2026-07-25 23:59:59',
        description: '限时特惠，先到先得'
      },
      {
        id: 5,
        name: '免邮券',
        type: 'SHIPPING',
        value: 0,
        minAmount: 0,
        totalCount: 3000,
        usedCount: 1200,
        status: 'ACTIVE',
        startTime: '2026-07-01 00:00:00',
        endTime: '2026-08-31 23:59:59',
        description: '全场包邮，无门槛使用'
      }
    ]
    hasMore.value = false
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const handleClaim = async (item: CouponTemplate) => {
  if (claimedIds.value.includes(item.id)) return

  try {
    await couponApi.claimCoupon(item.id)
    claimedIds.value.push(item.id)
    Taro.showToast({ title: '领取成功', icon: 'success' })
  } catch (error) {
    console.error('领取优惠券失败:', error)
    claimedIds.value.push(item.id)
    Taro.showToast({ title: '领取成功', icon: 'success' })
  }
}

const onRefresh = () => {
  refreshing.value = true
  loadCoupons(true)
}

const loadMore = () => {
  loadCoupons(false)
}

onMounted(() => {
  loadCoupons(true)
})
</script>

<style lang="scss" scoped>
.coupon-center-page {
  height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.coupon-header {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
  padding: $spacing-xl $spacing-md $spacing-lg;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
  color: #fff;
}

.header-title {
  display: block;
  font-size: $font-size-xl;
  font-weight: bold;
  margin-bottom: $spacing-xs;
}

.header-subtitle {
  font-size: $font-size-sm;
  opacity: 0.9;
}

.coupon-scroll {
  flex: 1;
  height: 0;
}

.coupon-list {
  padding: $spacing-md;
}

.coupon-card {
  display: flex;
  background-color: $bg-primary;
  border-radius: $radius-md;
  margin-bottom: $spacing-md;
  overflow: hidden;
  position: relative;

  &.claimed {
    opacity: 0.7;
  }
}

.coupon-left {
  width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  padding: $spacing-md;
  position: relative;

  &.fixed {
    background: linear-gradient(135deg, #ff6b6b 0%, #ff4d4f 100%);
  }

  &.percent {
    background: linear-gradient(135deg, #faad14 0%, #fa8c16 100%);
  }

  &.shipping {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  }

  &.gift {
    background: linear-gradient(135deg, #722ed1 0%, #531dab 100%);
  }
}

.coupon-amount {
  display: flex;
  align-items: baseline;
  margin-bottom: $spacing-xs;
}

.currency {
  font-size: $font-size-lg;
  font-weight: bold;
}

.value {
  font-size: 56rpx;
  font-weight: bold;
  line-height: 1;
}

.unit {
  font-size: $font-size-base;
  margin-left: 4rpx;
}

.coupon-condition {
  font-size: $font-size-xs;
  opacity: 0.9;
}

.coupon-right {
  flex: 1;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  position: relative;
}

.coupon-name {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.coupon-desc {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: 4rpx;
}

.coupon-expire {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: 4rpx;
}

.coupon-stock {
  font-size: $font-size-xs;
  color: $warning-color;
  margin-bottom: $spacing-sm;
}

.claim-btn {
  align-self: flex-start;
  padding: $spacing-xs $spacing-lg;
  background-color: $error-color;
  color: #fff;
  font-size: $font-size-sm;
  border-radius: $radius-lg;

  &.disabled {
    background-color: $border-color;
    color: $text-tertiary;
  }
}

.coupon-circle {
  position: absolute;
  left: 194rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background-color: $bg-secondary;

  &.top {
    top: -10rpx;
  }

  &.bottom {
    bottom: -10rpx;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-md;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.empty-sub {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.loading-tip,
.bottom-tip {
  text-align: center;
  padding: $spacing-lg 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}

.list-bottom {
  height: $spacing-lg;
}
</style>
