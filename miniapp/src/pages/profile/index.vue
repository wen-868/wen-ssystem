<template>
  <view class="page-container">
    <view class="user-header">
      <view class="user-info">
        <image :src="userStore.userInfo?.avatar || defaultAvatar" class="avatar" />
        <view class="user-detail">
          <text class="user-name">{{ userStore.userInfo?.nickname || '未登录' }}</text>
          <text class="user-phone">{{ userStore.userInfo?.phone || '请登录查看' }}</text>
        </view>
      </view>
      <view class="login-btn" v-if="!userStore.isLogin" @tap="goLogin">
        <text>登录</text>
      </view>
    </view>

    <view class="points-card">
      <view class="points-item">
        <text class="points-value">{{ userStore.userInfo?.points || 0 }}</text>
        <text class="points-label">积分</text>
      </view>
      <view class="points-divider"></view>
      <view class="points-item">
        <text class="points-value">{{ userStore.userInfo?.level || '普通会员' }}</text>
        <text class="points-label">会员等级</text>
      </view>
      <view class="points-divider"></view>
      <view class="points-item">
        <text class="points-value">0</text>
        <text class="points-label">优惠券</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" v-for="item in orderMenu" :key="item.id" @tap="goPage(item.url)">
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-text">{{ item.text }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" v-for="item in serviceMenu" :key="item.id" @tap="goPage(item.url)">
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-text">{{ item.text }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" v-for="item in settingMenu" :key="item.id" @tap="goPage(item.url)">
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-text">{{ item.text }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="logout-btn" v-if="userStore.isLogin" @tap="handleLogout">
      <text>退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import Taro from '@tarojs/taro'

const userStore = useUserStore()

const defaultAvatar = 'https://neeko-copilot.bytedance.net/api/text2image?prompt=avatar%20icon%20user'

const orderMenu = ref([
  { id: 1, icon: '📦', text: '我的订单', url: '/pages/order/list/index' },
  { id: 2, icon: '🔄', text: '待付款', url: '/pages/order/list/index?status=PENDING_PAY' },
  { id: 3, icon: '🚚', text: '待发货', url: '/pages/order/list/index?status=PENDING_SHIP' },
  { id: 4, icon: '📮', text: '待收货', url: '/pages/order/list/index?status=PENDING_RECEIVE' },
  { id: 5, icon: '⭐', text: '待评价', url: '/pages/order/list/index?status=COMPLETED' }
])

const serviceMenu = ref([
  { id: 6, icon: '🎫', text: '优惠券', url: '/pages/coupon/list' },
  { id: 7, icon: '🏠', text: '收货地址', url: '/pages/address/list' },
  { id: 8, icon: '❤', text: '我的收藏', url: '/pages/favorite/list' },
  { id: 9, icon: '📜', text: '浏览记录', url: '/pages/history/list' }
])

const settingMenu = ref([
  { id: 10, icon: '⚙️', text: '设置', url: '/pages/setting/index' },
  { id: 11, icon: '💬', text: '意见反馈', url: '/pages/feedback/index' },
  { id: 12, icon: '📞', text: '联系客服', url: '/pages/service/index' },
  { id: 13, icon: 'ℹ️', text: '关于我们', url: '/pages/about/index' }
])

const goLogin = () => {
  Taro.navigateTo({ url: '/pages/login/index' })
}

const goPage = (url: string) => {
  if (!url) return
  Taro.navigateTo({
    url,
    fail: () => {
      Taro.showToast({ title: '页面开发中', icon: 'none' })
    }
  })
}

const handleLogout = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        Taro.showToast({ title: '退出成功', icon: 'success' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xl $spacing-md;
  padding-top: calc($spacing-xl + var(--status-bar-height));
  background: linear-gradient(135deg, $primary-color 0%, $primary-light 100%);
}

.user-info {
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.user-detail {
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

.login-btn {
  padding: $spacing-sm $spacing-md;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: $radius-lg;
  color: #fff;
  font-size: $font-size-base;
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

.menu-section {
  padding: 0 $spacing-md;
}

.menu-group {
  background-color: $bg-primary;
  border-radius: $radius-md;
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

.logout-btn {
  margin: $spacing-md;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-radius: $radius-md;
  text-align: center;
  font-size: $font-size-base;
  color: $error-color;
}
</style>
