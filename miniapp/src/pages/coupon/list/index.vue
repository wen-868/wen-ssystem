<template>
  <view class="coupon-list-page">
    <!-- Tab 切换 -->
    <view class="tab-bar">
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'UNUSED' }"
        @tap="switchTab('UNUSED')"
      >
        <text>可用</text>
        <view class="tab-line" v-if="activeTab === 'UNUSED'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'USED' }"
        @tap="switchTab('USED')"
      >
        <text>已使用</text>
        <view class="tab-line" v-if="activeTab === 'USED'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'EXPIRED' }"
        @tap="switchTab('EXPIRED')"
      >
        <text>已过期</text>
        <view class="tab-line" v-if="activeTab === 'EXPIRED'"></view>
      </view>
    </view>

    <!-- 优惠券列表 -->
    <scroll-view 
      class="coupon-scroll" 
      scroll-y 
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view class="coupon-list">
        <view 
          class="coupon-card" 
          :class="{ disabled: activeTab !== 'UNUSED' }"
          v-for="item in couponList" 
          :key="item.id"
        >
          <view class="coupon-left">
            <view class="coupon-amount">
              <text class="currency" v-if="item.type === 'FIXED'">¥</text>
              <text class="value">{{ formatCouponValue(item) }}</text>
              <text class="unit" v-if="item.type === 'PERCENT'">折</text>
            </view>
            <text class="coupon-condition">{{ formatCondition(item) }}</text>
          </view>
          <view class="coupon-right">
            <text class="coupon-name">{{ item.name }}</text>
            <text class="coupon-expire">有效期至 {{ formatExpire(item.endTime || item.expireAt) }}</text>
            <view class="coupon-btn" v-if="activeTab === 'UNUSED'" @tap="handleUse(item)">
              <text>去使用</text>
            </view>
            <view class="coupon-status" v-else>
              <text>{{ statusText }}</text>
            </view>
          </view>
          <view class="coupon-circle top"></view>
          <view class="coupon-circle bottom"></view>
        </view>
      </view>

      <view class="empty-state" v-if="couponList.length === 0 && !loading">
        <text class="empty-icon">🎫</text>
        <text class="empty-text">暂无{{ statusText }}优惠券</text>
      </view>

      <view class="loading-tip" v-if="loading">
        <text>加载中...</text>
      </view>

      <view class="bottom-tip" v-if="!hasMore && couponList.length > 0">
        <text>没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { couponApi } from '@/api/coupon'
import type { UserCoupon } from '@/api/coupon'

const activeTab = ref<'UNUSED' | 'USED' | 'EXPIRED'>('UNUSED')
const couponList = ref<UserCoupon[]>([])
const loading = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)

const statusText = computed(() => {
  const map: Record<string, string> = {
    UNUSED: '可用',
    USED: '已使用',
    EXPIRED: '已过期'
  }
  return map[activeTab.value] || ''
})

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
    const result = await couponApi.getMyCoupons({
      page: page.value,
      pageSize: pageSize.value,
      status: activeTab.value
    })
    
    if (result && result.records) {
      if (isRefresh) {
        couponList.value = result.records
      } else {
        couponList.value = [...couponList.value, ...result.records]
      }
      hasMore.value = couponList.value.length < result.total
      page.value++
    }
  } catch (error) {
    // 接口未实现时使用模拟数据
    const mockData: UserCoupon[] = [
      { id: 1, templateId: 1, name: '新人专享券', type: 'FIXED', value: 20, minAmount: 99, status: 'UNUSED', claimedAt: '2026-07-01 10:00:00', endTime: '2026-08-31 23:59:59' },
      { id: 2, templateId: 2, name: '满199减30', type: 'FIXED', value: 30, minAmount: 199, status: 'UNUSED', claimedAt: '2026-07-05 14:00:00', endTime: '2026-07-31 23:59:59' },
      { id: 3, templateId: 3, name: '9折优惠券', type: 'PERCENT', value: 90, minAmount: 50, status: 'UNUSED', claimedAt: '2026-07-08 09:00:00', endTime: '2026-09-30 23:59:59' },
      { id: 4, templateId: 4, name: '满500减100', type: 'FIXED', value: 100, minAmount: 500, status: 'USED', claimedAt: '2026-06-01 10:00:00', endTime: '2026-06-30 23:59:59' },
      { id: 5, templateId: 5, name: '8.5折优惠券', type: 'PERCENT', value: 85, minAmount: 200, status: 'EXPIRED', claimedAt: '2026-05-01 10:00:00', endTime: '2026-05-31 23:59:59' }
    ]
    
    const filtered = mockData.filter(item => item.status === activeTab.value)
    if (isRefresh) {
      couponList.value = filtered
    } else {
      couponList.value = [...couponList.value, ...filtered]
    }
    hasMore.value = false
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const switchTab = (tab: 'UNUSED' | 'USED' | 'EXPIRED') => {
  activeTab.value = tab
  loadCoupons(true)
}

const onRefresh = () => {
  refreshing.value = true
  loadCoupons(true)
}

const loadMore = () => {
  loadCoupons(false)
}

const formatCouponValue = (item: UserCoupon) => {
  if (item.type === 'PERCENT') {
    return (item.value / 10).toFixed(1)
  }
  return item.value
}

const formatCondition = (item: UserCoupon) => {
  if (item.minAmount > 0) {
    return `满${item.minAmount}元可用`
  }
  return '无门槛'
}

const formatExpire = (time?: string) => {
  if (!time) return ''
  return time.substring(0, 10)
}

const handleUse = (item: UserCoupon) => {
  Taro.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  loadCoupons(true)
})
</script>

<style lang="scss" scoped>
.coupon-list-page {
  height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  display: flex;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $border-color;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md 0;
  font-size: $font-size-base;
  color: $text-secondary;
  position: relative;

  &.active {
    color: $primary-color;
    font-weight: 500;
  }
}

.tab-line {
  position: absolute;
  bottom: 0;
  width: 48rpx;
  height: 6rpx;
  background-color: $primary-color;
  border-radius: 3rpx;
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

  &.disabled {
    opacity: 0.6;
  }
}

.coupon-left {
  width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff4d4f 100%);
  color: #fff;
  padding: $spacing-md;
  position: relative;
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
  justify-content: center;
  position: relative;
}

.coupon-name {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.coupon-expire {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: $spacing-sm;
}

.coupon-btn {
  align-self: flex-start;
  padding: $spacing-xs $spacing-md;
  background-color: $primary-color;
  color: #fff;
  font-size: $font-size-sm;
  border-radius: $radius-lg;
}

.coupon-status {
  align-self: flex-start;
  font-size: $font-size-sm;
  color: $text-tertiary;
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
  color: $text-tertiary;
}

.loading-tip,
.bottom-tip {
  text-align: center;
  padding: $spacing-lg 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>
