<template>
  <view class="setting-page">
    <!-- 个人资料 -->
    <view class="setting-section">
      <view class="setting-item" @tap="goProfile">
        <text class="setting-icon">👤</text>
        <text class="setting-label">个人资料</text>
        <view class="setting-right">
          <text class="setting-value">{{ userStore.userInfo?.nickname || '未设置' }}</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>
      <view class="setting-item" @tap="goAddress">
        <text class="setting-icon">🏠</text>
        <text class="setting-label">收货地址</text>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 账号安全 -->
    <view class="setting-section">
      <view class="setting-item" @tap="goChangePassword">
        <text class="setting-icon">🔒</text>
        <text class="setting-label">修改密码</text>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 其他 -->
    <view class="setting-section">
      <view class="setting-item" @tap="goAbout">
        <text class="setting-icon">ℹ️</text>
        <text class="setting-label">关于我们</text>
        <view class="setting-right">
          <text class="setting-arrow">›</text>
        </view>
      </view>
      <view class="setting-item" @tap="handleClearCache">
        <text class="setting-icon">🗑️</text>
        <text class="setting-label">清除缓存</text>
        <view class="setting-right">
          <text class="setting-value">{{ cacheSize }}</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section" v-if="userStore.isLogin">
      <view class="logout-btn" @tap="handleLogout">
        <text>退出登录</text>
      </view>
    </view>

    <!-- 版本号 -->
    <view class="version-info">
      <text>智享全链 v1.0.0</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const cacheSize = ref('0MB')

const goProfile = () => {
  Taro.navigateTo({ url: '/pages/setting/profile-edit' })
}

const goAddress = () => {
  Taro.navigateTo({ url: '/pages/address/list/index' })
}

const goChangePassword = () => {
  Taro.navigateTo({ url: '/pages/setting/password' })
}

const goAbout = () => {
  Taro.navigateTo({ url: '/pages/about/index' })
}

const handleClearCache = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要清除缓存吗？',
    success: (res) => {
      if (res.confirm) {
        Taro.clearStorageSync()
        cacheSize.value = '0MB'
        Taro.showToast({ title: '清除成功', icon: 'success' })
      }
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
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      }
    }
  })
}

const getCacheSize = async () => {
  try {
    const res = await Taro.getStorageInfoSync()
    const size = (res.currentSize / 1024).toFixed(2)
    cacheSize.value = `${size}MB`
  } catch (error) {
    cacheSize.value = '0MB'
  }
}

onMounted(() => {
  getCacheSize()
})
</script>

<style lang="scss" scoped>
.setting-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.setting-section {
  background-color: $bg-primary;
  margin-top: $spacing-md;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.setting-icon {
  font-size: $font-size-lg;
  margin-right: $spacing-md;
}

.setting-label {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.setting-right {
  display: flex;
  align-items: center;
}

.setting-value {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-right: $spacing-xs;
}

.setting-arrow {
  font-size: $font-size-xl;
  color: $text-tertiary;
}

.logout-section {
  padding: $spacing-xl $spacing-md;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background-color: $bg-primary;
  color: $error-color;
  font-size: $font-size-base;
  border-radius: $radius-lg;
}

.version-info {
  text-align: center;
  padding: $spacing-xl 0;
  font-size: $font-size-sm;
  color: $text-tertiary;
}
</style>
