<template>
  <view class="page-container">
    <!-- 用户信息头部 -->
    <view class="user-header">
      <view class="user-info" @tap="goProfileEdit">
        <image :src="userStore.userInfo?.avatar || defaultAvatar" class="avatar" />
        <view class="user-detail">
          <text class="user-name">{{ userStore.userInfo?.nickname || '未登录' }}</text>
          <text class="user-phone">{{ userStore.userInfo?.phone || '点击登录/注册' }}</text>
        </view>
        <text class="user-arrow">›</text>
      </view>

      <!-- 会员等级卡片 -->
      <view class="member-card" @tap="goMemberCenter">
        <view class="member-level">
          <text class="level-icon">👑</text>
          <text class="level-name">{{ userStore.userInfo?.level || '普通会员' }}</text>
        </view>
        <view class="member-progress">
          <view class="progress-bar">
            <view class="progress-inner" :style="{ width: memberProgress + '%' }"></view>
          </view>
          <text class="progress-text">
            {{ userStore.isLogin ? '成长值 ' + growthValue : '登录享更多权益' }}
          </text>
        </view>
        <text class="member-arrow">›</text>
      </view>
    </view>

    <!-- 积分优惠券入口 -->
    <view class="points-card">
      <view class="points-item" @tap="goMemberCenter">
        <text class="points-value">{{ userStore.userInfo?.points || 0 }}</text>
        <text class="points-label">积分</text>
      </view>
      <view class="points-divider"></view>
      <view class="points-item" @tap="goCouponList">
        <text class="points-value">{{ couponCount }}</text>
        <text class="points-label">优惠券</text>
      </view>
      <view class="points-divider"></view>
      <view class="points-item" @tap="goMemberCenter">
        <text class="points-value">{{ userStore.userInfo?.level || '普通' }}</text>
        <text class="points-label">会员等级</text>
      </view>
    </view>

    <!-- 我的订单 -->
    <view class="order-section">
      <view class="section-header">
        <text class="section-title">我的订单</text>
        <view class="section-more" @tap="goOrderList('ALL')">
          <text>全部订单</text>
          <text class="more-arrow">›</text>
        </view>
      </view>
      <view class="order-grid">
        <view class="order-item" @tap="goOrderList('ALL')">
          <view class="order-icon-wrap">
            <text class="order-icon">📋</text>
          </view>
          <text class="order-text">全部</text>
        </view>
        <view class="order-item" @tap="goOrderList('PENDING_PAY')">
          <view class="order-icon-wrap">
            <text class="order-icon">💰</text>
            <view class="badge" v-if="orderCount.pendingPay > 0">{{ orderCount.pendingPay }}</view>
          </view>
          <text class="order-text">待付款</text>
        </view>
        <view class="order-item" @tap="goOrderList('PENDING_SHIP')">
          <view class="order-icon-wrap">
            <text class="order-icon">📦</text>
            <view class="badge" v-if="orderCount.pendingShip > 0">{{ orderCount.pendingShip }}</view>
          </view>
          <text class="order-text">待发货</text>
        </view>
        <view class="order-item" @tap="goOrderList('PENDING_RECEIVE')">
          <view class="order-icon-wrap">
            <text class="order-icon">🚚</text>
            <view class="badge" v-if="orderCount.pendingReceive > 0">{{ orderCount.pendingReceive }}</view>
          </view>
          <text class="order-text">待收货</text>
        </view>
        <view class="order-item" @tap="goOrderList('COMPLETED')">
          <view class="order-icon-wrap">
            <text class="order-icon">⭐</text>
          </view>
          <text class="order-text">待评价</text>
        </view>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @tap="goFavorite">
          <text class="menu-icon">❤️</text>
          <text class="menu-text">我的收藏</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goHistory">
          <text class="menu-icon">👣</text>
          <text class="menu-text">浏览足迹</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goCouponList">
          <text class="menu-icon">🎫</text>
          <text class="menu-text">我的优惠券</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goAddress">
          <text class="menu-icon">🏠</text>
          <text class="menu-text">收货地址</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" @tap="goSetting">
          <text class="menu-icon">⚙️</text>
          <text class="menu-text">设置</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goAbout">
          <text class="menu-icon">ℹ️</text>
          <text class="menu-text">关于我们</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 会员升级引导 -->
    <view class="upgrade-banner" v-if="userStore.isLogin" @tap="goMemberCenter">
      <view class="upgrade-content">
        <text class="upgrade-icon">💎</text>
        <view class="upgrade-text">
          <text class="upgrade-title">升级会员享更多特权</text>
          <text class="upgrade-desc">专属折扣、生日礼遇、优先发货</text>
        </view>
      </view>
      <view class="upgrade-btn">
        <text>去升级</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import Taro, { useDidShow } from '@tarojs/taro'
import { couponApi } from '@/api/coupon'

const userStore = useUserStore()

const defaultAvatar = 'https://neeko-copilot.bytedance.net/api/text2image?prompt=avatar%20icon%20user'
const couponCount = ref(0)
const growthValue = ref(0)

const orderCount = ref({
  pendingPay: 0,
  pendingShip: 0,
  pendingReceive: 0
})

const memberProgress = computed(() => {
  // 模拟会员进度
  return 64
})

const loadUserData = async () => {
  if (!userStore.isLogin) return
  
  try {
    // 加载优惠券数量
    const couponResult = await couponApi.getMyCoupons({ status: 'UNUSED', pageSize: 100 })
    couponCount.value = couponResult.total || couponResult.records?.length || 0
  } catch (error) {
    couponCount.value = 3
  }
}

const goMemberCenter = () => {
  if (!checkLogin()) return
  Taro.navigateTo({ url: '/pages/member/index' })
}

const goOrderList = (status: string) => {
  if (!checkLogin()) return
  Taro.navigateTo({ url: `/pages/order/list/index?status=${status}` })
}

const goCouponList = () => {
  if (!checkLogin()) return
  Taro.navigateTo({ url: '/pages/coupon/list/index' })
}

const goAddress = () => {
  if (!checkLogin()) return
  Taro.navigateTo({ url: '/pages/address/list/index' })
}

const goFavorite = () => {
  if (!checkLogin()) return
  Taro.showToast({ title: '功能开发中', icon: 'none' })
}

const goHistory = () => {
  if (!checkLogin()) return
  Taro.showToast({ title: '功能开发中', icon: 'none' })
}

const goSetting = () => {
  Taro.navigateTo({ url: '/pages/setting/index' })
}

const goAbout = () => {
  Taro.navigateTo({ url: '/pages/about/index' })
}

const goProfileEdit = () => {
  if (!checkLogin()) return
  Taro.navigateTo({ url: '/pages/setting/profile-edit' })
}

const checkLogin = (): boolean => {
  if (!userStore.isLogin) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return false
  }
  return true
}

onMounted(() => {
  loadUserData()
})

useDidShow(() => {
  loadUserData()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: $spacing-xl;
}

.user-header {
  padding: $spacing-xl $spacing-md $spacing-lg;
  padding-top: calc(#{$spacing-xl} + var(--status-bar-height));
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-lg;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.user-detail {
  flex: 1;
  margin-left: $spacing-md;
}

.user-name {
  display: block;
  font-size: $font-size-lg;
  color: #fff;
  font-weight: bold;
  margin-bottom: $spacing-xs;
}

.user-phone {
  font-size: $font-size-sm;
  color: rgba(255, 255, 255, 0.8);
}

.user-arrow {
  color: rgba(255, 255, 255, 0.7);
  font-size: $font-size-xl;
}

.member-card {
  display: flex;
  align-items: center;
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 237, 78, 0.15) 100%);
  border-radius: $radius-md;
  padding: $spacing-md;
  border: 1rpx solid rgba(255, 215, 0, 0.3);
}

.member-level {
  display: flex;
  align-items: center;
  margin-right: $spacing-md;
}

.level-icon {
  font-size: $font-size-xl;
  margin-right: $spacing-xs;
}

.level-name {
  font-size: $font-size-base;
  color: #ffd700;
  font-weight: 500;
}

.member-progress {
  flex: 1;
}

.progress-bar {
  height: 12rpx;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: $spacing-xs;
}

.progress-inner {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ffed4e);
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: $font-size-xs;
  color: rgba(255, 255, 255, 0.8);
}

.member-arrow {
  color: rgba(255, 255, 255, 0.7);
  font-size: $font-size-xl;
  margin-left: $spacing-sm;
}

.points-card {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin: -40rpx $spacing-md $spacing-md;
  padding: $spacing-lg;
  background-color: $bg-primary;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  position: relative;
  z-index: 10;
}

.points-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.points-value {
  font-size: $font-size-xl;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.points-label {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.points-divider {
  width: 1rpx;
  height: 60rpx;
  background-color: $border-color;
}

.order-section {
  margin: 0 $spacing-md $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-md;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.section-more {
  display: flex;
  align-items: center;
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.more-arrow {
  font-size: $font-size-base;
  margin-left: $spacing-xs;
}

.order-grid {
  display: flex;
  justify-content: space-around;
}

.order-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.order-icon-wrap {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-xs;
}

.order-icon {
  font-size: 48rpx;
}

.badge {
  position: absolute;
  top: 0;
  right: -8rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  background-color: $error-color;
  color: #fff;
  font-size: $font-size-xs;
  border-radius: 16rpx;
  text-align: center;
}

.order-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.menu-section {
  margin: 0 $spacing-md;
}

.menu-group {
  background-color: $bg-primary;
  border-radius: $radius-lg;
  margin-bottom: $spacing-md;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
  
  &:last-child {
    border-bottom: none;
  }
}

.menu-icon {
  font-size: $font-size-lg;
  margin-right: $spacing-md;
}

.menu-text {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.menu-arrow {
  font-size: $font-size-xl;
  color: $text-tertiary;
}

.upgrade-banner {
  margin: $spacing-md;
  background: linear-gradient(90deg, #fff9e6 0%, #fff3cd 100%);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upgrade-content {
  display: flex;
  align-items: center;
}

.upgrade-icon {
  font-size: $font-size-xxl;
  margin-right: $spacing-md;
}

.upgrade-text {
  display: flex;
  flex-direction: column;
}

.upgrade-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.upgrade-desc {
  font-size: $font-size-xs;
  color: $text-secondary;
}

.upgrade-btn {
  padding: $spacing-sm $spacing-md;
  background: linear-gradient(90deg, #ffd700, #ffed4e);
  color: #8b6914;
  font-size: $font-size-sm;
  border-radius: $radius-lg;
  font-weight: 500;
}
</style>
