<template>
  <view class="member-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">会员中心</text>
    </view>

    <!-- 会员信息卡片 -->
    <view class="member-card">
      <view class="member-avatar">
        <image v-if="memberInfo.avatar" class="avatar-img" :src="memberInfo.avatar" mode="aspectFill" />
        <text v-else class="avatar-placeholder">{{ memberInfo.nickname?.charAt(0) || '会' }}</text>
      </view>
      <view class="member-info">
        <text class="member-name">{{ memberInfo.nickname || '会员用户' }}</text>
        <view class="member-level">
          <text class="level-badge">{{ memberInfo.levelLabel || '普通会员' }}</text>
        </view>
      </view>
    </view>

    <!-- 资产概览 -->
    <view class="asset-grid">
      <view class="asset-item" @tap="navigateTo('/pages-sub/marketing/points/points-detail')">
        <text class="asset-value">{{ memberInfo.points || 0 }}</text>
        <text class="asset-label">积分</text>
      </view>
      <view class="asset-item" @tap="navigateTo('/pages-sub/marketing/stored-cards/stored-cards')">
        <text class="asset-value">¥{{ memberInfo.balance || '0.00' }}</text>
        <text class="asset-label">储值余额</text>
      </view>
      <view class="asset-item" @tap="navigateTo('/pages-sub/marketing/marketing/coupons')">
        <text class="asset-value">{{ memberInfo.couponCount || 0 }}</text>
        <text class="asset-label">优惠券</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/points/points-detail')">
        <view class="menu-left">
          <text class="menu-icon">★</text>
          <text class="menu-text">我的积分</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/stored-cards/stored-cards')">
        <view class="menu-left">
          <text class="menu-icon">💰</text>
          <text class="menu-text">我的储值</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/marketing/coupons')">
        <view class="menu-left">
          <text class="menu-icon">🎫</text>
          <text class="menu-text">我的优惠券</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/member-levels/member-levels')">
        <view class="menu-left">
          <text class="menu-icon">👑</text>
          <text class="menu-text">我的等级</text>
        </view>
        <view class="menu-right">
          <text class="level-progress-text">{{ memberInfo.levelProgress || '0%' }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/member/address')">
        <view class="menu-left">
          <text class="menu-icon">📍</text>
          <text class="menu-text">收货地址</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages/profile/edit')">
        <view class="menu-left">
          <text class="menu-icon">⚙</text>
          <text class="menu-text">我的资料</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { memberApi } from '@/api/modules/member'

const memberInfo = reactive({
  avatar: '',
  nickname: '',
  levelLabel: '普通会员',
  levelProgress: '0%',
  points: 0,
  balance: '0.00',
  couponCount: 0,
})

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

async function loadMemberInfo() {
  try {
    const res = await memberApi.getMemberInfo()
    Object.assign(memberInfo, res)
  } catch (err) {
    console.error('加载会员信息失败:', err)
  }
}

onMounted(() => {
  loadMemberInfo()
})
</script>

<style scoped>
.member-page {
  min-height: 100vh;
  background: #f0f5ff;
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

.member-card {
  margin: 24rpx;
  padding: 32rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.member-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  font-size: 40rpx;
  color: #fff;
  font-weight: 700;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
  display: block;
}

.member-level {
  display: flex;
}

.level-badge {
  padding: 4rpx 20rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
}

.asset-grid {
  display: flex;
  margin: 0 24rpx 24rpx;
  gap: 16rpx;
}

.asset-item {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.asset-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #1677FF;
}

.asset-label {
  font-size: 24rpx;
  color: #999;
}

.menu-section {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.menu-icon {
  font-size: 36rpx;
}

.menu-text {
  font-size: 28rpx;
  color: #333;
}

.menu-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.level-progress-text {
  font-size: 24rpx;
  color: #1677FF;
}

.menu-arrow {
  font-size: 32rpx;
  color: #bbb;
}

.safe-bottom {
  height: 40rpx;
}
</style>