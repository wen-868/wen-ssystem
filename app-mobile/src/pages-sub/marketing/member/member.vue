<template>
  <view class="member-page">
    <!-- 顶部栏 -->
    <page-header title="会员中心" @back="goBack" />

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
          <image class="menu-icon-img" src="/static/icons/ic/star.svg" mode="aspectFit" />
          <text class="menu-text">我的积分</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/stored-cards/stored-cards')">
        <view class="menu-left">
          <image class="menu-icon-img" src="/static/icons/ic/wallet.svg" mode="aspectFit" />
          <text class="menu-text">我的储值</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/marketing/coupons')">
        <view class="menu-left">
          <image class="menu-icon-img" src="/static/icons/ic/ticket.svg" mode="aspectFit" />
          <text class="menu-text">我的优惠券</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/member-levels/member-levels')">
        <view class="menu-left">
          <image class="menu-icon-img" src="/static/icons/ic/crown.svg" mode="aspectFit" />
          <text class="menu-text">我的等级</text>
        </view>
        <view class="menu-right">
          <text class="level-progress-text">{{ memberInfo.levelProgress || '0%' }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages-sub/marketing/member/address')">
        <view class="menu-left">
          <image class="menu-icon-img" src="/static/icons/ic/location.svg" mode="aspectFit" />
          <text class="menu-text">收货地址</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages/profile/edit')">
        <view class="menu-left">
          <image class="menu-icon-img" src="/static/icons/ic/gear.svg" mode="aspectFit" />
          <text class="menu-text">我的资料</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

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

<style lang="scss" scoped>
.member-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}

.member-card {
  margin: $uni-spacing-base;
  padding: $uni-spacing-lg;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: $uni-border-radius-xs;
  display: flex;
  align-items: center;
  gap: $uni-spacing-base;
}

.member-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $zx-white-300;
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
  color: $uni-text-color-inverse;
  font-weight: 700;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
  margin-bottom: $uni-spacing-xs;
  display: block;
}

.member-level {
  display: flex;
}

.level-badge {
  padding: 4rpx 20rpx;
  background: $zx-white-250;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: $uni-text-color-inverse;
}

.asset-grid {
  display: flex;
  margin: 0 $uni-spacing-base $uni-spacing-base;
  gap: $uni-spacing-sm;
}

.asset-item {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base $uni-spacing-sm;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-xs;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.asset-value {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.asset-label {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.menu-section {
  margin: 0 $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-base $uni-spacing-base;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
}

.menu-icon {
  font-size: 36rpx;
}

.menu-icon-img {
  width: 40rpx;
  height: 40rpx;
}

.menu-text {
  font-size: 28rpx;
  color: $uni-gray-700;
}

.menu-right {
  display: flex;
  align-items: center;
  gap: $uni-spacing-xs;
}

.level-progress-text {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.menu-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: 40rpx;
}
</style>
