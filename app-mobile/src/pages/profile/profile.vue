<template>
  <!-- 无表单交互，无需三件套（纯展示菜单导航页） -->
  <scroll-view class="profile-page" scroll-y>
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-avatar">
        <image v-if="userStore.user?.avatar" class="avatar-img" :src="userStore.user.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-text">{{ initialChar }}</text>
        </view>
      </view>
      <view class="user-info">
        <text class="user-name">{{ userStore.user?.name || '未登录' }}</text>
        <text class="user-store">{{ userStore.user?.storeName || '' }}</text>
        <view class="user-role-tag">
          <text class="role-text">{{ roleText }}</text>
        </view>
      </view>
      <text class="user-arrow">&#xe616;</text>
    </view>

    <!-- 功能列表 -->
    <view class="menu-section">
      <view class="menu-item" @tap="navigateTo('/pages/profile/edit')">
        <view class="menu-icon-wrap menu-icon-wrap--blue">
          <text class="menu-icon">&#xe640;</text>
        </view>
        <text class="menu-label">编辑资料</text>
        <text class="menu-arrow">&#xe616;</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages/notifications/notifications')">
        <view class="menu-icon-wrap menu-icon-wrap--orange">
          <text class="menu-icon">&#xe642;</text>
        </view>
        <text class="menu-label">消息通知</text>
        <view class="menu-badge" v-if="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</view>
        <text class="menu-arrow">&#xe616;</text>
      </view>

      <view class="menu-item" @tap="navigateTo('/pages/todos/todos')">
        <view class="menu-icon-wrap menu-icon-wrap--purple">
          <text class="menu-icon">&#xe643;</text>
        </view>
        <text class="menu-label">待办事项</text>
        <text class="menu-arrow">&#xe616;</text>
      </view>
    </view>

    <!-- 管理入口（仅管理员可见） -->
    <view class="menu-section" v-if="userStore.isAdmin">
      <view class="menu-item" @tap="navigateTo('/pages/admin/admin')">
        <view class="menu-icon-wrap menu-icon-wrap--dark">
          <text class="menu-icon">&#xe644;</text>
        </view>
        <text class="menu-label">管理后台</text>
        <text class="menu-arrow">&#xe616;</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @tap="handleLogout">退出登录</button>
    </view>

    <!-- 版本号 -->
    <view class="version-section">
      <text class="version-text">v1.0.0</text>
    </view>

    <view class="safe-bottom"></view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const unreadCount = ref(0)

const initialChar = computed(() => {
  const name = userStore.user?.name
  return name ? name.charAt(0) : 'U'
})

const roleText = computed(() => {
  const map: Record<string, string> = {
    SUPER_ADMIN: '超级管理员',
    ADMIN: '管理员',
    STORE_MANAGER: '店长',
    STAFF: '员工'
  }
  const roles = userStore.user?.roles
  return roles && roles.length > 0 ? map[roles[0]] || roles[0] : ''
})

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    }
  })
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f0f5ff;
}

/* 用户卡片 */
.user-card {
  background: linear-gradient(135deg, #1677FF, #4096ff);
  padding: 48rpx 32rpx;
  padding-top: calc(48rpx + env(safe-area-inset-top));
  display: flex;
  align-items: center;
  border-radius: 0 0 32rpx 32rpx;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 4rpx solid rgba(255, 255, 255, 0.4);
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 48rpx;
  font-weight: 700;
  color: #fff;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6rpx;
}

.user-store {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10rpx;
}

.user-role-tag {
  align-self: flex-start;
  padding: 4rpx 16rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8rpx;
}

.role-text {
  font-size: 22rpx;
  color: #fff;
}

.user-arrow {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.6);
}

/* 菜单区域 */
.menu-section {
  background: #fff;
  border-radius: 16rpx;
  margin: 20rpx 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.menu-icon-wrap--blue { background: #e6f4ff; }
.menu-icon-wrap--green { background: #f6ffed; }
.menu-icon-wrap--orange { background: #fff7e6; }
.menu-icon-wrap--purple { background: #f9f0ff; }
.menu-icon-wrap--dark { background: #f5f5f5; }

.menu-icon {
  font-size: 32rpx;
  color: #1677FF;
}

.menu-label {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-badge {
  min-width: 36rpx;
  height: 36rpx;
  background: #ff4d4f;
  border-radius: 18rpx;
  font-size: 20rpx;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10rpx;
  margin-right: 12rpx;
}

.menu-arrow {
  font-size: 28rpx;
  color: #bbb;
}

/* 退出登录 */
.logout-section {
  padding: 40rpx 24rpx 0;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  background: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  color: #ff4d4f;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ff4d4f;
}

.logout-btn::after {
  border: none;
}

/* 版本号 */
.version-section {
  text-align: center;
  padding: 32rpx 0;
}

.version-text {
  font-size: 24rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>